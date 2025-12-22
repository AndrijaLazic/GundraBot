// src/music/MusicManager.ts
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

class GuildLock {
  private tail: Promise<void> = Promise.resolve();
  private closed = false;

  close() {
    this.closed = true;
  }

  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const prev = this.tail;

    let release!: () => void;
    this.tail = new Promise<void>(r => (release = r));

    await prev;
    try {
      if (this.closed) throw new Error("GuildLock is closed.");
      return await fn();
    } finally {
      release();
    }
  }
}

class GuildMusicState {
  readonly lock = new GuildLock();
  connection: VoiceConnection | null = null;
  player: AudioPlayer;
  queue: TrackInfo[] = [];
  nowPlaying: TrackInfo | null = null;

  constructor() {
    this.player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause }
    });
  }
}

export class MusicManager extends EventEmitter {
  private states = new Map<string, GuildMusicState>();

  /**
   * If TRUE: stream is `yt-dlp -> stdout -> ffmpeg -> opus/ogg -> discord`
   * This is usually the most stable option (less CDN weirdness).
   */
  private readonly PIPE_FROM_YTDLP = true;

  /**
   * Prefer opus from YouTube to avoid re-encoding (reduces CPU + stutter).
   */
  private readonly YTDLP_FORMAT = "bestaudio[acodec=opus]/bestaudio/best";

  private state(guildId: string): GuildMusicState {
    let s = this.states.get(guildId);
    if (!s) {
      s = new GuildMusicState();
      this.states.set(guildId, s);

      s.player.on("stateChange", (o, n) => {
        // Useful while debugging stutter/end
        // console.log("[PLAYER]", guildId, o.status, "->", n.status);
        if (n.status === AudioPlayerStatus.Idle) {
          void this.playNext(guildId);
        }
      });

      s.player.on("error", err => {
        this.emit("error", guildId, err);
        void this.playNext(guildId);
      });
    }
    return s;
  }

  async enqueueFromQuery(args: {
    guild: Guild;
    voiceChannel: VoiceBasedChannel;
    queryOrUrl: string;
    requestedBy?: string;
  }): Promise<TrackInfo> {
    const { guild, voiceChannel, queryOrUrl, requestedBy } = args;
    const s = this.state(guild.id);

    return s.lock.withLock(async () => {
      await this.ensureConnected(guild, voiceChannel);

      const track = await this.resolveWithYtDlp(queryOrUrl, requestedBy);
      s.queue.push(track);

      if (!s.nowPlaying) {
        void this.playNext(guild.id);
      }

      return track;
    });
  }

  async skip(guildId: string) {
    const s = this.states.get(guildId);
    if (!s) return;

    await s.lock.withLock(async () => {
      s.player.stop(true);
    });
  }

  async pause(guildId: string) {
    const s = this.states.get(guildId);
    if (!s) return;

    await s.lock.withLock(async () => {
      s.player.pause(true);
    });
  }

  async resume(guildId: string) {
    const s = this.states.get(guildId);
    if (!s) return;

    await s.lock.withLock(async () => {
      s.player.unpause();
    });
  }

  async leave(guildId: string) {
    const s = this.states.get(guildId);
    if (!s) return;

    await s.lock.withLock(async () => {
      s.queue = [];
      s.nowPlaying = null;

      try {
        s.player.stop(true);
      } catch {}

      if (s.connection) {
        try {
          s.connection.destroy();
        } catch {}
        s.connection = null;
      }

      s.lock.close();
      this.states.delete(guildId);

      this.emit("disconnect", guildId);
    });
  }

  private async ensureConnected(guild: Guild, voiceChannel: VoiceBasedChannel) {
    const s = this.state(guild.id);

    if (s.connection) {
      s.connection.subscribe(s.player);
      return;
    }

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator
    });

    s.connection = connection;
    connection.subscribe(s.player);

    await entersState(connection, VoiceConnectionStatus.Ready, 20_000);

    connection.on(VoiceConnectionStatus.Disconnected, () => {
      this.emit("disconnect", guild.id);
    });
  }

  private async playNext(guildId: string) {
    const s = this.states.get(guildId);
    if (!s) return;

    await s.lock.withLock(async () => {
      const next = s.queue.shift() ?? null;
      s.nowPlaying = next;

      if (!next) return;

      const resource = await this.createResourceForTrack(next);

      s.player.play(resource);
      this.emit("trackStart", guildId, next);
    });
  }

  private async resolveWithYtDlp(queryOrUrl: string, requestedBy?: string): Promise<TrackInfo> {
    const info = (await youtubedl(queryOrUrl, {
      dumpSingleJson: true,
      noWarnings: true,
      noPlaylist: true,
      defaultSearch: "ytsearch1",
      format: this.YTDLP_FORMAT
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
    const ytdlp = youtubedl.exec(videoUrl, {
      output: "-",
      format: this.YTDLP_FORMAT,
      noPlaylist: true
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

    // debug (enable if needed)
    // ytdlp.stderr?.on("data", d => console.log("[yt-dlp]", d.toString()));
    // ffmpeg.process?.stderr?.on("data", d => console.log("[ffmpeg]", d.toString()));
    // ffmpeg.process?.on("close", code => console.log("[ffmpeg] exited", code));

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

export const musicManager = new MusicManager();
