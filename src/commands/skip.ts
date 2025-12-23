import { SlashCommandBuilder } from "discord.js";
import type { Services } from "../di/container.js";
import type { CommandModule } from "../types/command.js";

export function createSkipCommand(services: Services): CommandModule {
  const { guildManagers } = services;

  return {
    data: new SlashCommandBuilder().setName("skip").setDescription("Skip current song"),

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
          "You need to be in a Voice Channel to skip a song.",
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
          return replyController.replyToInteractionWithMessage(
            "There are no songs to be skipped. Queue is empty.",
            interaction,
            3000
          );
        }

        await musicManager.skip();
        return replyController.replyToInteractionWithMessage("Song removed from queue", interaction, 3000);
      } catch (e) {
        console.log(e);
        return replyController.replyToInteractionWithMessage(`Something went wrong: ${e}`, interaction, 5000);
      }
    }
  };
}

export default createSkipCommand;
