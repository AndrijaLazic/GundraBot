import type { Guild } from "discord.js";
import type { BotInteraction } from "../types/command.js";
import type { MusicManager } from "../music/MusicManager.js";

export class GuildLock {
  private tail: Promise<void> = Promise.resolve();

  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const prev = this.tail;

    let release!: () => void;
    this.tail = new Promise<void>(r => (release = r));

    await prev;
    try {
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
    private readonly music: MusicManager,
    private readonly logger: Console,
    private readonly onDispose: () => void
  ) {
    if (interaction) this.music.musicEmbed.setInteraction(interaction);

    this.music.on("trackStart", (_guildId, track) => {
      try {
        this.music.musicEmbed.updateCurrentEmbedWithSong(track);
      } catch (e) {
        this.logger.log(e);
      }
    });

    // Disconnect after inactivity
    this.music.on("disconnect", async () => {
      console.log(`Music disconnected from guild ${this.guild.name} (${this.guild.id})`);
    });

    this.music.on("error", (_guildId, err) => this.logger.error("PLAYER ERROR", err));
  }

  get musicController() {
    return this.music;
  }

  get musicEmbed() {
    return this.music.musicEmbed;
  }

  async replyToInteractionWithMessage(
    interaction: BotInteraction,
    message: string,
    timeToRemove = -1
  ) {
    this.music.musicEmbed.setInteraction(interaction);

    const replyPayload = { content: message };
    const sent =
      interaction.deferred || interaction.replied
        ? await interaction.editReply(replyPayload)
        : await interaction.reply(replyPayload);

    if (timeToRemove !== -1) {
      setTimeout(() => {
        interaction.deleteReply?.().catch(() => {});
        sent?.delete?.().catch(() => {});
      }, timeToRemove);
    }

    return sent;
  }

  async reset() {
    try { await this.music.leave(); } catch {}
  }
}
