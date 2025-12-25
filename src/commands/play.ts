import { SlashCommandBuilder } from "discord.js";
import type { Services } from "../di/container.js";
import type { CommandModule } from "../types/command.js";

export function createPlayCommand(services: Services): CommandModule {
  const { guildManagers } = services;

  return {
    data: new SlashCommandBuilder()
      .setName("play")
      .setDescription("Play a song from YouTube.")
      .addSubcommand(subcommand =>
        subcommand
          .setName("url")
          .setDescription("Plays a single song from youtube url")
          .addStringOption(option =>
            option
              .setName("url")
              .setDescription("the song's url")
              .setRequired(true)
          )
      ),

    execute: async ({ interaction }) => {
      if (!interaction.isChatInputCommand() || !interaction.inCachedGuild()) {
        return;
      }

      const channel = interaction.member.voice.channel;
      const guildManager = guildManagers.get(interaction.guild, interaction);
      const musicManager = guildManager.musicController;

      if (!channel) {
        return guildManager.replyToInteractionWithMessage(
          interaction,
          "You need to be in a Voice Channel to play a song.",
          3000
        );
      }

      const query = interaction.options.getString("url", true);

      // Validate URL (avoid new URL() throwing)
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(query);
      } catch {
        return guildManager.replyToInteractionWithMessage(
          interaction,
          "Invalid URL. Paste a full YouTube URL.",
          3000
        );
      }

      const host = parsedUrl.hostname.toLowerCase();
      const isYoutube = host.includes("youtube.com") || host.includes("youtu.be");

      if (!isYoutube) {
        return guildManager.replyToInteractionWithMessage(
          interaction,
          "You can only use YOUTUBE as a source",
          3000
        );
      }

      // Reply fast, then do the heavy work
      await guildManager.replyToInteractionWithMessage(interaction, "Loading…");

      try {
        const track = await musicManager.enqueueFromQuery({
          voiceChannel: channel,
          queryOrUrl: query,
          requestedBy: interaction.user.tag
        });

        // Don’t set “Now playing” here (might already be playing something).
        // Let your trackStart event update the embed when it actually starts.
        await interaction.editReply(`Queued: **${track.title}**`);
      } catch (e) {
        console.log(e);
        await interaction.editReply("Something went wrong while loading that track.");
      }
    }
  };
}

export default createPlayCommand;
