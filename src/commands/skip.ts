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
      const musicManager = guildManager.musicController;

      if (!channel) {
        return guildManager.replyToInteractionWithMessage(
          interaction,
          "You need to be in a Voice Channel to skip a song.",
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
            "There are no songs to be skipped. Queue is empty.",
            3000
          );
        }

        await musicManager.skip();
        return guildManager.replyToInteractionWithMessage(
          interaction,
          "Song removed from queue",
          3000
        );
      } catch (e) {
        console.log(e);
        return guildManager.replyToInteractionWithMessage(
          interaction,
          `Something went wrong: ${e}`,
          5000
        );
      }
    }
  };
}

export default createSkipCommand;
