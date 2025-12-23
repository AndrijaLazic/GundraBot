import type { Track } from "discord-player";
import type { ButtonInteraction, RepliableInteraction } from "discord.js";
import type { BotInteraction } from "../types/command.js";
import type { BotClient } from "../types/bot.js";
import { createMusicMessageEmbed } from "./EmbedMessageTemplate.js";
import { MusicEmbedUI } from "./ButtonsUI.js";
import type { MusicManager, TrackInfo } from "../music/MusicManager.js";

class ReplyControll {
  private interaction: BotInteraction | null;
  private currentEmbed = createMusicMessageEmbed();

  // async mutex state
  private lockTail: Promise<void> = Promise.resolve();
  private closed = false;

  constructor(interaction: BotInteraction | null) {
    this.interaction = interaction;
  }

  setInteraction(interaction: BotInteraction | null) {
    // allow updating the active interaction when you get a new one
    this.interaction = interaction;
  }


  //Higher-order function for locking
  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const prev = this.lockTail;

    let release!: () => void;
    this.lockTail = new Promise<void>(r => (release = r));

    await prev;
    try {
      if (this.closed) {
        throw new Error("ReplyControllSingleton is closed/reset.");
      }
      return await fn();
    } finally {
      release();
    }
  }

  private async removeCurrentEmbedUnsafe() {
    if (this.interaction?.replied) {
      try {
        await this.interaction.deleteReply();
      } catch (err) {
        console.error(err);
      }
    }
  }

  /**
   * Called by resetInstance(). Runs under lock, removes embed, then closes the instance.
   */
  async shutdown() {
    return this.withLock(async () => {
      await this.removeCurrentEmbedUnsafe();
      this.interaction = null;
      this.closed = true;
    });
  }

  async replyToInteractionWithEmbed(
    reply: ReturnType<typeof createMusicMessageEmbed>,
    newInteraction: RepliableInteraction,
    UIcomponent: MusicEmbedUI | null = null,
    timeToRemove = -1
  ) {
    return this.withLock(async () => {
      const replyObject = {
        embeds: [reply],
        components: UIcomponent ? [UIcomponent] : undefined
      };

      if (timeToRemove !== -1) {
        const sentReply = await newInteraction.reply(replyObject);
        setTimeout(() => {
          // prevent unhandled rejection if message is already gone
          sentReply.delete().catch(() => {});
        }, timeToRemove);
        return;
      }

      if (this.interaction?.replied) {
        const loadingMessage = `Loading ${reply.fields?.[0]?.value ?? ""}`;
        const sentReply = await newInteraction.reply(loadingMessage);
        setTimeout(() => {
          sentReply.delete().catch(() => {});
        }, 2000);
        return;
      }

      if (!this.interaction) {
        throw new Error("There is no interaction to reply to.");
      }

      return this.interaction.reply(replyObject);
    });
  }

  replyToInteractionWithMessage(
    reply: string,
    newInteraction: RepliableInteraction,
    timeToRemove = -1
  ) {
    // Keep as non-async API, but still serialize via lock.
    return this.withLock(async () => {
      const sentReply = await newInteraction.reply(reply);

      if (timeToRemove !== -1) {
        setTimeout(() => {
          sentReply.delete().catch(() => {});
        }, timeToRemove);
      }

      return sentReply;
    });
  }

  songToEmbed(song: Track | TrackInfo) {
    // This is synchronous; it will be called from locked methods below.
    if (!this.currentEmbed.fields) this.currentEmbed.fields = [];

    if (!this.currentEmbed.fields[0]) {
      this.currentEmbed.fields[0] = { name: "Now playing:", value: song.title };
    } else {
      this.currentEmbed.fields[0].value = song.title;
    }

    const rawThumbnail = (song as Track)?.raw as Record<string, any> | undefined;
    const thumbnailUrl = rawThumbnail?.thumbnail?.url ?? (song as TrackInfo)?.thumbnailUrl ?? "";
    this.currentEmbed.image = { url: thumbnailUrl };

    return this.currentEmbed;
  }

  getMusicUI() {
    return new MusicEmbedUI();
  }

  async removeCurrentEmbed() {
    return this.withLock(async () => {
      await this.removeCurrentEmbedUnsafe();
    });
  }

  async buttonClick(
    interaction: ButtonInteraction<"cached">,
    client: BotClient,
    musicManager: MusicManager | null = null
  ) {
    let commandName: string | null = null;

    switch (interaction.customId) {
      case "skipButton":
        commandName = "skip";
        break;
      case "pauseButton":
        commandName = "pause";
        break;
      case "resumeButton":
        commandName = "resume";
        break;
      case "exitButton":
        await this.replyToInteractionWithMessage("Exiting...", interaction, 1000);
        if (musicManager) {
          await musicManager.leave();
        }
        return;
      default:
        break;
    }

    if (!commandName) throw new Error("There is no button with that customId");

    const command = client.commands.get(commandName);
    if (!command) throw new Error(`There is no command with name: ${commandName}`);

    // IMPORTANT: do NOT lock around command.execute() to avoid deadlocks
    // if command.execute() calls back into ReplyControllSingleton methods.
    return command.execute({ client, interaction });
  }

  updateCurrentEmbedWithSong(song: Track | TrackInfo) {
    return this.withLock(async () => {
      if (!this.interaction) throw new Error("There is no interaction to update");
      if (!this.interaction.replied) throw new Error("Cannot update interaction before replying to it");

      const musicMessageEmbed = this.songToEmbed(song);
      const replyObject = {
        embeds: [musicMessageEmbed],
        components: [new MusicEmbedUI()]
      };

      return this.interaction.editReply(replyObject);
    });
  }
}

export { ReplyControll };
