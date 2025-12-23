import { SlashCommandBuilder } from "discord.js";
import type { Services } from "../di/container.js";
import type { CommandModule } from "../types/command.js";

export function createResumeCommand(services: Services): CommandModule {
  const { guildManagers } = services;

  return {
    data: new SlashCommandBuilder().setName("resume").setDescription("Resume current song"),

    execute: async ({ interaction }) => {
      if (!interaction.inCachedGuild()) {
        return;
      }

      const channel = interaction.member.voice.channel;
      const guildManager = guildManagers.get(interaction.guild, interaction);
      const replyController = guildManager.repliesController;
      const musicManager = guildManager.musicController;

      if (!channel) {
        return replyController.replyToInteractionWithMessage(
          "You need to be in a Voice Channel to resume a song.",
          interaction,
          3000
        );
      }

      if (!musicManager.isConnected()) {
        return replyController.replyToInteractionWithMessage(
          "Bot is not connected to this channel.",
          interaction,
          3000
        );
      }

      try {
        if (!musicManager.hasTracks()) {
          return replyController.replyToInteractionWithMessage("There is no song to resume", interaction, 3000);
        }
        if (!musicManager.isPaused()) {
          return replyController.replyToInteractionWithMessage("Song is already playing", interaction, 3000);
        }

        await musicManager.resume();
        return replyController.replyToInteractionWithMessage("Song resumed", interaction, 3000);
      } catch (e) {
        console.log(e);
        return replyController.replyToInteractionWithMessage(`Something went wrong: ${e}`, interaction, 3000);
      }
    }
  };
}

export default createResumeCommand;
