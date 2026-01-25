import { SlashCommandBuilder } from "discord.js";
import type { Services } from "../di/container.js";
import type { CommandModule } from "../types/command.js";

export function createPauseCommand(services: Services): CommandModule {
  const { guildManagers } = services;
  const logger = services.logger.child({ command: "pause" });

  return {
    data: new SlashCommandBuilder().setName("pause").setDescription("Pause current song"),

    execute: async ({ interaction }) => {
      if (!interaction.inCachedGuild()) {
        return;
      }

      const requestLogger = logger.child({
        guildId: interaction.guild.id,
        requesterTag: interaction.user.tag
      });

      const channel = interaction.member.voice.channel;
      const guildManager = guildManagers.get(interaction.guild, interaction);
      const musicManager = guildManager.musicController;

      if (!channel) {
        return guildManager.replyToInteractionWithMessage(
          interaction,
          "You need to be in a Voice Channel to pause a song.",
          3000
        );
      }

      if (!musicManager.isConnected()) {
        return guildManager.replyToInteractionWithMessage(
          interaction,
          "Bot is not connected to this channel.",
          3000
        );
      }

      try {
        if (!musicManager.isPlaying()) {
          return guildManager.replyToInteractionWithMessage(interaction, "No song is playing", 3000);
        }

        await musicManager.pause();
        return guildManager.replyToInteractionWithMessage(interaction, "Song paused", 3000);
      } catch (e) {
        requestLogger.error("Pause failed", e);
        return guildManager.replyToInteractionWithMessage(
          interaction,
          `Something went wrong: ${e}`
        );
      }
    }
  };
}

export default createPauseCommand;
