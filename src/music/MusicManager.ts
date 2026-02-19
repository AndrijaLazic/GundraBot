import { EventEmitter } from "node:events";
import {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  VoiceConnectionStatus,
  createAudioPlayer,
  entersState,
  joinVoiceChannel,
  type AudioPlayer,
  type VoiceConnection
} from "@discordjs/voice";
import type { Guild, VoiceBasedChannel } from "discord.js";
import { GuildLock } from "../guild/ServerGuildManager.js";
import { MusicEmbed } from "./MusicEmbed.js";
import { QueueLimitReachedError } from "./errors/QueueLimitReachedError.js";
import { YoutubeMusicPlayer } from "./YoutubeMusicPlayer.js";

const DEFAULT_QUEUE_LIMIT_PER_GUILD = 20;

function parsePositiveInt(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function resolveQueueLimitPerGuild(): number {
  return parsePositiveInt(process.env.QUEUE_LIMIT_PER_GUILD) ?? DEFAULT_QUEUE_LIMIT_PER_GUILD;
}

export type TrackInfo = {
  title: string;
  webpageUrl: string;
  thumbnailUrl?: string;
  requestedBy?: string;

  // if you use direct-url mode
  audioUrl?: string;
  acodec?: string;
};

type MusicEvents = {
  trackStart: (guildId: string, track: TrackInfo) => void;
  disconnect: (guildId: string) => void;
  error: (guildId: string, err: unknown) => void;
};

export class MusicManager extends EventEmitter {
  private lock: GuildLock;
  private connection: VoiceConnection | null = null;
  private player: AudioPlayer;
  private queue: TrackInfo[] = [];
  private nowPlaying: TrackInfo | null = null;
  private guild: Guild;
  private shuttingDown = false;
  public readonly musicEmbed: MusicEmbed;
  private readonly youtubeHelper: YoutubeMusicPlayer;
  private readonly queueLimitPerGuild: number;

  /**
   * If TRUE: stream is `yt-dlp -> stdout -> ffmpeg -> opus/ogg -> discord`
   * This is usually the most stable option (less CDN weirdness).
   */
  private readonly PIPE_FROM_YTDLP = true;

  /**
   * Prefer opus from YouTube to avoid re-encoding (reduces CPU + stutter).
   */
  private readonly YTDLP_FORMAT = "bestaudio[acodec=opus]/bestaudio/best";

  constructor(guild: Guild) {
    super();
    this.guild = guild;
    this.lock = new GuildLock();
    this.musicEmbed = new MusicEmbed();
    this.queueLimitPerGuild = resolveQueueLimitPerGuild();
    this.youtubeHelper = new YoutubeMusicPlayer({
      cookiesPath: process.env.YTDLP_COOKIES,
      pipeFromYtdlp: this.PIPE_FROM_YTDLP,
      ytdlpFormat: this.YTDLP_FORMAT
    });

    this.player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause }
    });

    this.player.on("stateChange", (_oldState, newState) => {
      if (this.shuttingDown)
        return;
      
      if (newState.status === AudioPlayerStatus.Idle) {
        void this.playNext();
      }
    });

    this.player.on("error", err => {
      this.emit("error", this.guild.id, err);
      void this.playNext();
    });
  }

  async enqueueFromQuery(args: {
    voiceChannel: VoiceBasedChannel;
    queryOrUrl: string;
    requestedBy?: string;
  }): Promise<TrackInfo> {
    const { voiceChannel, queryOrUrl, requestedBy } = args;

    return this.lock.withLock(async () => {
      if (this.queue.length >= this.queueLimitPerGuild) {
        throw new QueueLimitReachedError(this.queueLimitPerGuild);
      }

      await this.ensureConnected(voiceChannel);

      const track = await this.resolveWithYtDlp(queryOrUrl, requestedBy);
      this.queue.push(track);

      if (!this.nowPlaying) {
        void this.playNext();
      }

      return track;
    });
  }

  async skip() {
    await this.lock.withLock(async () => {
      this.player.stop(true);
    });
  }

  async pause() {
    await this.lock.withLock(async () => {
      this.player.pause(true);
    });
  }

  async resume() {
    await this.lock.withLock(async () => {
      this.player.unpause();
    });
  }

  async leave() {
    await this.lock.withLock(async () => {
      this.queue = [];
      this.nowPlaying = null;
      this.shuttingDown = true;

      try {
        this.player.stop(true);
      } catch {}

      if (this.connection) {
        try {
          this.musicEmbed.shutdown();
          this.connection.destroy();
        } catch {}
        this.connection = null;
      }
    });
  }

  private async ensureConnected(voiceChannel: VoiceBasedChannel) {
    if (this.connection) {
      this.connection.subscribe(this.player);
      return;
    }

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: this.guild.id,
      adapterCreator: this.guild.voiceAdapterCreator
    });

    this.connection = connection;
    connection.subscribe(this.player);

    await entersState(connection, VoiceConnectionStatus.Ready, 20_000);

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      await this.leave();
      this.emit("disconnect", this.guild.id);
    });
  }

  isConnected() {
    return this.connection !== null;
  }

  hasTracks() {
    return this.nowPlaying !== null || this.queue.length > 0;
  }

  isPlaying() {
    return this.player.state.status === AudioPlayerStatus.Playing;
  }

  isPaused() {
    return this.player.state.status === AudioPlayerStatus.Paused;
  }

  private async playNext() {
    await this.lock.withLock(async () => {
      const next = this.queue.shift() ?? null;
      this.nowPlaying = next;

      if (!next) return;

      const resource = await this.createResourceForTrack(next);

      this.player.play(resource);
      this.emit("trackStart", this.guild.id, next);
    });
  }

  private async resolveWithYtDlp(queryOrUrl: string, requestedBy?: string): Promise<TrackInfo> {
    return this.youtubeHelper.resolveWithYtDlp(queryOrUrl, requestedBy);
  }

  private async createResourceForTrack(track: TrackInfo) {
    return this.youtubeHelper.createResourceForTrack(track);
  }
}
