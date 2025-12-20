import { Track, useMainPlayer } from "discord-player";
import type { ButtonInteraction, Guild, RepliableInteraction } from "discord.js";
import type { BotInteraction } from "../types/command.js";
import type { BotClient } from "../types/bot.js";
import { createMusicMessageEmbed } from "./embedMessageTemplate.js";
import { musicEmbedUI } from "./buttonsUI.js";

declare module "discord.js" {
  interface Guild {
    replyControllSingleton?: ReplyControllSingleton | null;
  }
}

class ReplyControllSingleton {
  private interaction: BotInteraction | null;
  private currentEmbed = createMusicMessageEmbed();

  constructor(interaction: BotInteraction | null) {
    this.interaction = interaction;
  }

  async replyToInteractionWithEmbed(
    reply: ReturnType<typeof createMusicMessageEmbed>,
    newInteraction: RepliableInteraction,
    UIcomponent: musicEmbedUI | null = null,
    timeToRemove = -1
  ) {
    const replyObject = {
      embeds: [reply],
      components: UIcomponent ? [UIcomponent] : undefined
    };

    if (timeToRemove !== -1) {
      return newInteraction.reply(replyObject).then(sentReply => {
        setTimeout(() => {
          sentReply.delete();
        }, timeToRemove);
      });
    }

    if (this.interaction?.replied) {
      const loadingMessage = `Loading ${reply.fields?.[0]?.value ?? ""}`;
      return newInteraction.reply(loadingMessage).then(sentReply => {
        setTimeout(() => {
          sentReply.delete();
        }, 2000);
      });
    }

    if (!this.interaction) {
      throw new Error("There is no interaction to reply to.");
    }

    return this.interaction.reply(replyObject);
  }

  replyToInteractionWithMessage(reply: string, newInteraction: RepliableInteraction, timeToRemove = -1) {
    if (timeToRemove === -1) {
      return newInteraction.reply(reply);
    }

    return newInteraction.reply(reply).then(sentReply => {
      setTimeout(() => {
        sentReply.delete();
      }, timeToRemove);
    });
  }

  songToEmbed(song: Track) {
    if (!this.currentEmbed.fields) {
      this.currentEmbed.fields = [];
    }

    if (!this.currentEmbed.fields[0]) {
      this.currentEmbed.fields[0] = { name: "Now playing:", value: song.title };
    } else {
      this.currentEmbed.fields[0].value = song.title;
    }

    const thumbnailUrl = (song.raw as Record<string, any>)?.thumbnail?.url ?? "";
    this.currentEmbed.image = { url: thumbnailUrl };
    return this.currentEmbed;
  }

  getMusicUI() {
    return new musicEmbedUI();
  }

  async removeCurrentEmbed() {
    if (this.interaction?.replied) {
      try {
        await this.interaction.deleteReply();
      } catch (err) {
        // Swallow failures caused by missing reply context
        console.error(err);
      }
    }
  }

  exitChanell(client: BotClient, interaction: BotInteraction) {
    const player = useMainPlayer();
    const guildNodeManager = player.queues;
    const guildQueue = interaction.guildId ? guildNodeManager.get(client.guilds.cache.get(interaction.guildId) as Guild) : null;

    if (guildQueue?.connection) {
      if (guildQueue.connection.disconnect()) {
        player.events.emit("disconnect", guildQueue);
      }
    }
  }

  async buttonClick(interaction: ButtonInteraction, client: BotClient) {
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
        this.exitChanell(client, interaction);
        return;
      default:
        break;
    }

    if (!commandName) {
      throw new Error("There is no button with that customId");
    }

    const command = client.commands.get(commandName);

    if (!command) {
      throw new Error(`There is no command with name: ${commandName}`);
    }

    return command.execute({ client, interaction });
  }

  updateCurrentEmbedWithSong(song: Track) {
    if (!this.interaction) {
      throw new Error("There is no interaction to update");
    }

    if (!this.interaction.replied) {
      throw new Error("Cannot update interaction before replying to it");
    }

    const musicMessageEmbed = this.songToEmbed(song);
    const replyObject = {
      embeds: [musicMessageEmbed],
      components: [new musicEmbedUI()]
    };

    return this.interaction.editReply(replyObject);
  }
}

class ReplyControll {
  constructor() {
    throw new Error("Use ReplyControll.getInstance()");
  }

  static getInstance(guild: Guild, interaction: BotInteraction | null = null) {
    if (!guild.replyControllSingleton) {
      guild.replyControllSingleton = new ReplyControllSingleton(interaction);
    }
    return guild.replyControllSingleton;
  }

  static async resetInstance(guild: Guild) {
    if (guild.replyControllSingleton) {
      await guild.replyControllSingleton.removeCurrentEmbed();
    }
    guild.replyControllSingleton = null;
  }
}

export { ReplyControll as replyControll, ReplyControllSingleton };
