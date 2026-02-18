import youtubedl from "youtube-dl-exec";
import prism from "prism-media";
import { StreamType, createAudioResource } from "@discordjs/voice";
import type { TrackInfo } from "./MusicManager.js";

export class YoutubeMusicPlayer {
  private readonly cookiesPath: string | undefined;
  private readonly pipeFromYtdlp: boolean;
  private readonly ytdlpFormat: string;

  constructor(options: {
    cookiesPath?: string;
    pipeFromYtdlp?: boolean;
    ytdlpFormat?: string;
  } = {}) {
    this.cookiesPath = options.cookiesPath;
    this.pipeFromYtdlp = options.pipeFromYtdlp ?? true;
    this.ytdlpFormat = options.ytdlpFormat ?? "bestaudio[acodec=opus]/bestaudio/best";
  }

  /**
   * Resolves a user input (YouTube URL or a search query) into TrackInfo.
   *
   * Returns:
   * - title/webpageUrl/thumbnailUrl for UI
   * - audioUrl/acodec when yt-dlp provides direct stream URLs (used by the direct-url playback path)
   */
  async resolveWithYtDlp(queryOrUrl: string, requestedBy?: string): Promise<TrackInfo> {
    // youtube-dl-exec has multiple call signatures; this cast forces the "exec function" signature
    const execYtdlp = youtubedl as unknown as (
      url: string,
      options: Record<string, unknown>
    ) => Promise<unknown>;

    const isUrl = isLikelyUrl(queryOrUrl);
    const ytdlpInput = isUrl ? queryOrUrl : `ytsearch1:${queryOrUrl}`;

    // Ask yt-dlp for metadata (single JSON object) and a set of formats
    const info = (await execYtdlp(ytdlpInput, {
      dumpSingleJson: true,
      noWarnings: true,
      noPlaylist: true,
      defaultSearch: "ytsearch1",
      format: this.ytdlpFormat,
      jsRuntimes: "node",
      ...(this.cookiesPath ? { cookies: this.cookiesPath } : {})
    })) as any;

    const entry = firstSearchEntry(info);
    const source = entry ?? info;

    // Human-friendly display fields
    const title: string = source?.title ?? source?.fulltitle ?? "Unknown title";
    const webpageUrl: string = source?.webpage_url ?? source?.original_url ?? queryOrUrl;

    // Choose a thumbnail: prefer a single `thumbnail`, else use the last (usually largest) from `thumbnails[]`
    const thumbnailUrl: string | undefined =
      source?.thumbnail ??
      (Array.isArray(source?.thumbnails) ? source.thumbnails.at(-1)?.url : undefined);

    // Try to pick a direct audio stream URL + codec from yt-dlp output (if available)
    const picked = pickAudioUrlAndCodec(source);

    return {
      title,
      webpageUrl,
      thumbnailUrl,
      requestedBy,
      audioUrl: picked?.url,
      acodec: picked?.acodec
    };
  }

  /**
   * Builds a Discord Voice AudioResource for a resolved track.
   *
   * Two strategies:
   * 1) Pipe mode (default, most reliable):
   *    - yt-dlp downloads the audio and writes bytes to stdout
   *    - ffmpeg reads from stdin and outputs Ogg Opus (what Discord voice expects)
   *
   * 2) Direct URL mode:
   *    - use the selected `track.audioUrl` directly as ffmpeg input
   *    - if codec is already Opus, we can "copy" (no re-encode) to reduce CPU
   *
   * Falls back to pipe mode if direct URL is missing.
   */
  async createResourceForTrack(track: TrackInfo) {
    // Preferred path for reliability across URL expiry and auth edge-cases.
    if (this.pipeFromYtdlp) {
      return this.createResourceViaYtDlpPipe(track.webpageUrl);
    }

    // If metadata did not include a direct audio URL, fallback to pipe mode.
    if (!track.audioUrl) {
      return this.createResourceViaYtDlpPipe(track.webpageUrl);
    }

    // Fast path: stream directly from chosen format URL.
    return this.createResourceFromDirectUrl(track.audioUrl, track.acodec);
  }

  /**
   * Pipe strategy:
   * - Launch yt-dlp with output "-" (stdout) so media bytes stream out.
   * - Pipe yt-dlp stdout into ffmpeg stdin (pipe:0).
   * - ffmpeg converts to Ogg Opus and writes to stdout.
   * - createAudioResource consumes the ffmpeg stream as StreamType.OggOpus.
   *
   * This is generally the most robust approach when direct stream URLs expire or require cookies.
   */
  private async createResourceViaYtDlpPipe(videoUrl: string) {
    // yt-dlp writes audio bytes to stdout
    const ytdlp = (youtubedl as any).exec(videoUrl, {
      output: "-",
      format: this.ytdlpFormat,
      noPlaylist: true,
      jsRuntimes: "node",
      ...(this.cookiesPath ? { cookies: this.cookiesPath } : {})
    });

    // ffmpeg reads from stdin and outputs Ogg Opus
    const ffmpeg = new prism.FFmpeg({
      args: [
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        "pipe:0", // read from stdin
        "-vn", // ignore video
        "-af",
        "aresample=async=1:first_pts=0", // smooth timestamps / reduce glitches
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

    // Connect pipeline: yt-dlp stdout -> ffmpeg stdin
    ytdlp.stdout?.pipe(ffmpeg);

    // Discord voice consumes Ogg Opus stream
    return createAudioResource(ffmpeg, { inputType: StreamType.OggOpus });
  }

  /**
   * Direct URL strategy:
   * - Use yt-dlp's chosen format URL (`audioUrl`) directly as ffmpeg input.
   * - Add UA + referer headers (helps some CDNs/YouTube).
   * - Enable reconnect options to handle transient network issues.
   *
   * If the audio codec is already Opus, we use `-c:a copy` to avoid re-encoding (lower CPU).
   * Otherwise we re-encode to Opus to ensure Discord-compatible stream.
   */
  private async createResourceFromDirectUrl(audioUrl: string, acodec?: string) {
    const isOpus = (acodec ?? "").toLowerCase().includes("opus");

    const ffmpeg = new prism.FFmpeg({
      args: [
        "-hide_banner",
        "-loglevel",
        "error",

        // headers help some CDNs accept the request
        "-user_agent",
        "Mozilla/5.0",
        "-referer",
        "https://www.youtube.com/",

        // reconnect behavior for streaming URLs
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
              // already Opus: avoid re-encode
              "-c:a",
              "copy",
              "-f",
              "ogg"
            ]
          : [
              // not Opus: re-encode to stable Ogg Opus output
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

function isLikelyUrl(input: string): boolean {
  try {
    new URL(input);
    return true;
  } catch {
    return false;
  }
}

function firstSearchEntry(info: any): any | null {
  if (!Array.isArray(info?.entries)) {
    return null;
  }

  return info.entries.find((entry: any) => entry && typeof entry === "object") ?? null;
}

/**
 * Extracts a usable audio stream URL (+ codec) from yt-dlp's JSON output.
 *
 * yt-dlp may place the selected stream URL in different fields depending on extractor and options:
 * - `info.url` (sometimes already the chosen format URL)
 * - `requested_formats[]` (common when yt-dlp is set up for merging formats)
 * - `formats[]` list (most detailed; we pick best audio bitrate candidate with an audio codec)
 */
function pickAudioUrlAndCodec(info: any): { url: string; acodec?: string } | null {
  // Some extractors provide a top-level direct URL
  if (typeof info?.url === "string" && info.url.length > 0) {
    const acodec = info?.acodec ?? undefined;
    return { url: info.url, acodec };
  }

  // Sometimes requested_formats exists (esp. when multiple streams are involved)
  const rf = info?.requested_formats;
  if (Array.isArray(rf) && typeof rf[0]?.url === "string") {
    return { url: rf[0].url, acodec: rf[0]?.acodec ?? undefined };
  }

  // Most reliable: scan formats for audio-capable entries, pick highest abr
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
