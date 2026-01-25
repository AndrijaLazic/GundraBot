import { SlashCommandBuilder } from "discord.js";
import type { Services } from "../di/container.js";
import type { CommandModule } from "../types/command.js";

export function createResumeCommand(services: Services): CommandModule {
  const { guildManagers } = services;
  const logger = services.logger.child({ command: "resume" });

  return {
    data: new SlashCommandBuilder().setName("resume").setDescription("Resume current song"),

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
          "You need to be in a Voice Channel to resume a song.",
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
        if (!musicManager.hasTracks()) {
          return guildManager.replyToInteractionWithMessage(
            interaction,
            "There is no song to resume",
            3000
          );
        }
        if (!musicManager.isPaused()) {
          return guildManager.replyToInteractionWithMessage(
            interaction,
            "Song is already playing",
            3000
          );
        }

        await musicManager.resume();
        return guildManager.replyToInteractionWithMessage(interaction, "Song resumed", 3000);
      } catch (e) {
        requestLogger.error("Resume failed", e);
        return guildManager.replyToInteractionWithMessage(
          interaction,
          `Something went wrong: ${e}`,
          3000
        );
      }
    }
  };
}

export default createResumeCommand;
