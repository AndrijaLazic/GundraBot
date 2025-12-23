import { EventEmitter } from "node:events";
import youtubedl from "youtube-dl-exec";
import prism from "prism-media";
import {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  type AudioPlayer,
  type VoiceConnection
} from "@discordjs/voice";
import type { Guild, VoiceBasedChannel } from "discord.js";
import type { GuildLock } from "../guild/ServerGuildManager.js";

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
  private cookiesPath = process.env.YTDLP_COOKIES;
  private guild: Guild;
  private shuttingDown = false;

  /**
   * If TRUE: stream is `yt-dlp -> stdout -> ffmpeg -> opus/ogg -> discord`
   * This is usually the most stable option (less CDN weirdness).
   */
  private readonly PIPE_FROM_YTDLP = true;

  /**
   * Prefer opus from YouTube to avoid re-encoding (reduces CPU + stutter).
   */
  private readonly YTDLP_FORMAT = "bestaudio[acodec=opus]/bestaudio/best";

  constructor(guild: Guild, lock: GuildLock) {
    super();
    this.guild = guild;
    this.lock = lock;

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
          this.connection.destroy();
        } catch {}
        this.connection = null;
      }

      this.lock.close();
      this.emit("disconnect", this.guild.id);
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

    connection.on(VoiceConnectionStatus.Disconnected, () => {
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
    const execYtdlp = youtubedl as unknown as (
      url: string,
      options: Record<string, unknown>
    ) => Promise<unknown>;

    const info = (await execYtdlp(queryOrUrl, {
      dumpSingleJson: true,
      noWarnings: true,
      noPlaylist: true,
      defaultSearch: "ytsearch1",
      format: this.YTDLP_FORMAT,
      jsRuntimes: "node",
      ...(this.cookiesPath ? { cookies: this.cookiesPath } : {})
    })) as any;

    const title: string = info?.title ?? info?.fulltitle ?? "Unknown title";
    const webpageUrl: string = info?.webpage_url ?? info?.original_url ?? queryOrUrl;

    const thumbnailUrl: string | undefined =
      info?.thumbnail ??
      (Array.isArray(info?.thumbnails) ? info.thumbnails.at(-1)?.url : undefined);

    // For direct-url mode, pick best audio url + codec
    const picked = pickAudioUrlAndCodec(info);

    return {
      title,
      webpageUrl,
      thumbnailUrl,
      requestedBy,
      audioUrl: picked?.url,
      acodec: picked?.acodec
    };
  }

  private async createResourceForTrack(track: TrackInfo) {
    if (this.PIPE_FROM_YTDLP) {
      return this.createResourceViaYtDlpPipe(track.webpageUrl);
    }

    if (!track.audioUrl) {
      // fallback: if no audioUrl, still pipe
      return this.createResourceViaYtDlpPipe(track.webpageUrl);
    }

    return this.createResourceFromDirectUrl(track.audioUrl, track.acodec);
  }

  private async createResourceViaYtDlpPipe(videoUrl: string) {
    // yt-dlp downloads and writes audio bytes to stdout
    const ytdlp = (youtubedl as any).exec(videoUrl, {
      output: "-",
      format: this.YTDLP_FORMAT,
      noPlaylist: true,
      jsRuntimes: "node",
      ...(this.cookiesPath ? { cookies: this.cookiesPath } : {})
    });

    // ffmpeg reads from stdin (pipe:0) and outputs Ogg Opus to stdout
    const ffmpeg = new prism.FFmpeg({
      args: [
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        "pipe:0",
        "-vn",
        "-af",
        "aresample=async=1:first_pts=0",
        "-c:a",
        "libopus",
        "-b:a",
        "96k",
        "-vbr",
        "on",
        "-compression_level",
        "0",
        "-frame_duration",
        "20",
        "-f",
        "ogg"
      ]
    });

    // pipe yt-dlp -> ffmpeg
    ytdlp.stdout?.pipe(ffmpeg);

    return createAudioResource(ffmpeg, { inputType: StreamType.OggOpus });
  }

  private async createResourceFromDirectUrl(audioUrl: string, acodec?: string) {
    const isOpus = (acodec ?? "").toLowerCase().includes("opus");

    const ffmpeg = new prism.FFmpeg({
      args: [
        "-hide_banner",
        "-loglevel",
        "error",

        // headers help some CDNs
        "-user_agent",
        "Mozilla/5.0",
        "-referer",
        "https://www.youtube.com/",

        "-reconnect",
        "1",
        "-reconnect_streamed",
        "1",
        "-reconnect_delay_max",
        "5",

        "-i",
        audioUrl,
        "-vn",

        ...(isOpus
          ? [
              // avoid re-encode (less CPU, less stutter)
              "-c:a",
              "copy",
              "-f",
              "ogg"
            ]
          : [
              // stable re-encode path
              "-af",
              "aresample=async=1:first_pts=0",
              "-c:a",
              "libopus",
              "-b:a",
              "96k",
              "-vbr",
              "on",
              "-compression_level",
              "0",
              "-frame_duration",
              "20",
              "-f",
              "ogg"
            ])
      ]
    });

    return createAudioResource(ffmpeg, { inputType: StreamType.OggOpus });
  }
}

function pickAudioUrlAndCodec(info: any): { url: string; acodec?: string } | null {
  // Sometimes top-level has `url`
  if (typeof info?.url === "string" && info.url.length > 0) {
    const acodec = info?.acodec ?? undefined;
    return { url: info.url, acodec };
  }

  const rf = info?.requested_formats;
  if (Array.isArray(rf) && typeof rf[0]?.url === "string") {
    return { url: rf[0].url, acodec: rf[0]?.acodec ?? undefined };
  }

  const formats = info?.formats;
  if (Array.isArray(formats)) {
    const candidates = formats
      .filter((f: any) => typeof f?.url === "string" && (f?.acodec ?? "none") !== "none")
      .sort((a: any, b: any) => Number(b?.abr ?? 0) - Number(a?.abr ?? 0));

    if (typeof candidates[0]?.url === "string") {
      return { url: candidates[0].url, acodec: candidates[0]?.acodec ?? undefined };
    }
  }

  return null;
}
