import youtubedl from "youtube-dl-exec";
import type { Logger } from "./logging/logger.js";

const DEFAULT_REFRESH_INTERVAL_MINUTES = 360;
const MIN_REFRESH_INTERVAL_MINUTES = 5;
const DEFAULT_REFRESH_URL = "https://www.youtube.com/watch?v=BaW_jenozKc";

type CookieRefresher = {
  stop: () => void;
};

function parseBoolean(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  return undefined;
}

function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

export function startYtDlpCookieRefresher(logger: Logger): CookieRefresher | null {
  const cookiesPath = process.env.YTDLP_COOKIES?.trim();
  if (!cookiesPath) {
    logger.info("Cookie refresher disabled: YTDLP_COOKIES is not set");
    return null;
  }

  const enabled = parseBoolean(process.env.YTDLP_COOKIE_REFRESH_ENABLED);
  if (enabled === false) {
    logger.info("Cookie refresher disabled by YTDLP_COOKIE_REFRESH_ENABLED");
    return null;
  }

  const configuredIntervalMinutes = parsePositiveInt(
    process.env.YTDLP_COOKIE_REFRESH_INTERVAL_MINUTES
  );
  const intervalMinutes = Math.max(
    configuredIntervalMinutes ?? DEFAULT_REFRESH_INTERVAL_MINUTES,
    MIN_REFRESH_INTERVAL_MINUTES
  );

  const refreshUrl = process.env.YTDLP_COOKIE_REFRESH_URL?.trim() || DEFAULT_REFRESH_URL;
  const intervalMs = intervalMinutes * 60_000;
  let isRunning = false;
  let isStopped = false;

  const execYtDlp = youtubedl as unknown as (
    url: string,
    options: Record<string, unknown>
  ) => Promise<unknown>;

  const refreshOnce = async () => {
    if (isStopped || isRunning) return;
    isRunning = true;

    try {
      await execYtDlp(refreshUrl, {
        skipDownload: true,
        noWarnings: true,
        noPlaylist: true,
        quiet: true,
        cookies: cookiesPath,
        jsRuntimes: "node"
      });
      logger.info("yt-dlp cookies refreshed", {
        cookiesPath,
        refreshUrl,
        intervalMinutes
      });
    } catch (error) {
      logger.warn("yt-dlp cookie refresh failed", {
        cookiesPath,
        refreshUrl,
        error
      });
    } finally {
      isRunning = false;
    }
  };

  logger.info("Cookie refresher started", {
    cookiesPath,
    refreshUrl,
    intervalMinutes
  });

  void refreshOnce();
  const timer = setInterval(() => {
    void refreshOnce();
  }, intervalMs);
  timer.unref();

  return {
    stop: () => {
      isStopped = true;
      clearInterval(timer);
      logger.info("Cookie refresher stopped");
    }
  };
}
