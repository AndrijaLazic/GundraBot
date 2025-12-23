import type { Guild } from "discord.js";
import type { BotInteraction } from "../types/command.js";
import type { MusicManager } from "../music/MusicManager.js";
import type { ReplyControll } from "../reply/ReplyControll.js";

export class GuildLock {
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

export class ServerGuildManager {
  constructor(
    private readonly guild: Guild,
    interaction: BotInteraction | null,
    private readonly lock: GuildLock,
    private readonly replies: ReplyControll,
    private readonly music: MusicManager,
    private readonly logger: Console,
    private readonly onDispose: () => void
  ) {
    if (interaction) this.replies.setInteraction(interaction);

    this.music.on("trackStart", (_guildId, track) => {
      try {
        this.replies.updateCurrentEmbedWithSong(track);
      } catch (e) {
        this.logger.log(e);
      }
    });

    this.music.on("disconnect", async () => {
      try {
        await this.replies.shutdown();
      } catch (e) {
        this.logger.log(e);
      }
      // this.onDispose();
    });

    this.music.on("error", (_guildId, err) => this.logger.error("PLAYER ERROR", err));
  }

  get repliesController() {
    return this.replies;
  }

  get musicController() {
    return this.music;
  }

  async reset() {
    try { await this.music.leave(); } catch {}
    try { await this.replies.shutdown(); } catch {}
    this.lock.close();
  }
}
