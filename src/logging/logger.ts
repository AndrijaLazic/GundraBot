import { createWriteStream, mkdirSync, type WriteStream } from "fs";
import { dirname, isAbsolute, relative } from "path";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogDestination = "console" | "file" | "both";

export type LoggerOptions = {
  level?: LogLevel;
  base?: Record<string, unknown>;
  filePath?: string;
  destination?: LogDestination;
};

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const fileStreams = new Map<string, WriteStream>();

function normalizeLevel(input?: string): LogLevel {
  switch (input) {
    case "debug":
    case "info":
    case "warn":
    case "error":
      return input;
    default:
      return "info";
  }
}

function normalizeDestination(input?: string): LogDestination | undefined {
  switch (input) {
    case "console":
    case "file":
    case "both":
      return input;
    default:
      return undefined;
  }
}

const TAG_KEYS = ["component", "command", "module", "scope", "service", "name", "class"] as const;

function formatTag(base: Record<string, unknown>): string | null {
  if (!base || Object.keys(base).length === 0) {
    return null;
  }

  for (const key of TAG_KEYS) {
    const value = base[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return `{${trimmed}}`;
      }
    }
  }

  return null;
}

function normalizeFilePath(input?: string): string | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getFileStream(filePath: string): WriteStream {
  const existing = fileStreams.get(filePath);
  if (existing) return existing;

  try {
    mkdirSync(dirname(filePath), { recursive: true });
  } catch {}

  const stream = createWriteStream(filePath, { flags: "a" });
  stream.on("error", () => {});
  fileStreams.set(filePath, stream);
  return stream;
}

function safeJsonStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_key, val) => {
    if (val instanceof Error) {
      return { name: val.name, message: val.message, stack: val.stack };
    }
    if (typeof val === "object" && val !== null) {
      if (seen.has(val)) return "[Circular]";
      seen.add(val);
    }
    return val;
  });
}

function extractStackLocation(line: string): string | null {
  const trimmed = line.trim();
  const match = trimmed.match(/(?:\()?(.*:\d+:\d+)\)?$/);
  if (!match) return null;
  return match[1].replace(/^file:\/\//, "");
}

function isAnonymousLocation(location: string): boolean {
  return location.includes("<anonymous>");
}

function isLoggerLocation(location: string): boolean {
  return (
    location.includes("/logging/logger.") ||
    location.includes("\\logging\\logger.") ||
    location.startsWith("node:internal")
  );
}

function formatLocation(location: string): string {
  const match = location.match(/^(.*):(\d+):(\d+)$/);
  if (!match) return location;

  let filePath = match[1];
  const line = match[2];
  const column = match[3];

  if (isAbsolute(filePath)) {
    const rel = relative(process.cwd(), filePath);
    if (rel && !rel.startsWith("..") && !isAbsolute(rel)) {
      filePath = rel;
    }
  }

  return `${filePath}:${line}:${column}`;
}

function getCallerLocation(): string | null {
  const error = new Error();
  if (!error.stack) return null;
  const lines = error.stack.split("\n").slice(1);

  for (const line of lines) {
    const location = extractStackLocation(line);
    if (!location) continue;
    if (isAnonymousLocation(location)) continue;
    if (isLoggerLocation(location)) continue;
    return formatLocation(location);
  }

  return null;
}

function buildLogEntry(
  logLevel: LogLevel,
  base: Record<string, unknown>,
  args: unknown[]
) {
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level: logLevel,
    ...base
  };

  if (args.length === 0) {
    return entry;
  }

  if (typeof args[0] === "string") {
    entry.msg = args[0];
    if (args.length > 1) {
      entry.args = args.slice(1);
    }
    return entry;
  }

  entry.args = args;
  return entry;
}

export function createLogger(options: LoggerOptions = {}): Logger {
  return new Logger(options);
}

export class Logger {
  private readonly level: LogLevel;
  private readonly base: Record<string, unknown>;
  private readonly filePath?: string;
  private readonly destination: LogDestination;
  private readonly wantsFile: boolean;
  private readonly wantsConsole: boolean;
  private readonly fileStream: WriteStream | null;

  constructor(options: LoggerOptions = {}) {
    this.level = normalizeLevel(options.level ?? process.env.LOG_LEVEL);
    this.base = options.base ?? {};
    this.filePath = normalizeFilePath(options.filePath ?? process.env.LOG_FILE);
    this.destination =
      normalizeDestination(options.destination ?? process.env.LOG_DESTINATION) ??
      (this.filePath ? "both" : "console");
    this.wantsFile = this.destination === "file" || this.destination === "both";
    this.wantsConsole = this.destination === "console" || this.destination === "both";
    this.fileStream = this.wantsFile && this.filePath ? getFileStream(this.filePath) : null;
  }

  debug(...args: unknown[]) {
    this.write("debug", args);
  }

  info(...args: unknown[]) {
    this.write("info", args);
  }

  warn(...args: unknown[]) {
    this.write("warn", args);
  }

  error(...args: unknown[]) {
    this.write("error", args);
  }

  child(meta: Record<string, unknown>): Logger {
    return new Logger({
      level: this.level,
      base: { ...this.base, ...meta },
      filePath: this.filePath,
      destination: this.destination
    });
  }

  private write(logLevel: LogLevel, args: unknown[]) {
    if (LEVEL_ORDER[logLevel] < LEVEL_ORDER[this.level]) {
      return;
    }

    if (this.wantsConsole) {
      const timestamp = new Date().toISOString();
      const location = logLevel === "error" ? getCallerLocation() : null;
      const tag = formatTag(this.base);
      const prefixParts = [`[${timestamp}]`, `[${logLevel}]`];
      if (tag) {
        prefixParts.push(tag);
      }
      if (location) {
        prefixParts.push(location);
      }
      const prefix = prefixParts.join(" ");
      const output =
        logLevel === "error" ? console.error : logLevel === "warn" ? console.warn : console.log;

      output(prefix, ...args);
    }

    if (this.fileStream) {
      const entry = buildLogEntry(logLevel, this.base, args);
      this.fileStream.write(safeJsonStringify(entry) + "\n");
    }
  }
}
