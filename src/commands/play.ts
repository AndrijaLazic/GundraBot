import { SlashCommandBuilder } from "discord.js";
import type { Services } from "../di/container.js";
import type { CommandModule } from "../types/command.js";

export function createPlayCommand(services: Services): CommandModule {
  const { guildManagers } = services;

  return {
    data: new SlashCommandBuilder()
      .setName("play")
      .setDescription("Play a song from YouTube by name or URL.")
      .addStringOption(option =>
        option
          .setName("query")
          .setDescription("Song name or YouTube URL")
          .setRequired(true)
      ),

    execute: async ({ interaction }) => {
      if (!interaction.isChatInputCommand() || !interaction.inCachedGuild()) {
        return;
      }

      const requesterTag = interaction.user.tag;
      const channel = interaction.member.voice.channel;
      const guildManager = guildManagers.get(interaction.guild, interaction);
      const musicManager = guildManager.musicController;

      if (!channel) {
        console.log(`[play] ${requesterTag} blocked: not in voice channel`);
        return guildManager.replyToInteractionWithMessage(
          interaction,
          "You need to be in a Voice Channel to play a song.",
          3000
        );
      }

      const query = interaction.options.getString("query", true).trim();
      console.log(
        `[play] ${requesterTag} requested "${query}" in ${interaction.guild.id}/${channel.id}`
      );

      // If input is a URL, restrict it to YouTube only.
      let parsedUrl: URL | null = null;
      try {
        parsedUrl = new URL(query);
      } catch {}

      if (parsedUrl) {
        const host = parsedUrl.hostname.toLowerCase();
        const isYoutube = host.includes("youtube.com") || host.includes("youtu.be");

        if (!isYoutube) {
          console.log(`[play] ${requesterTag} blocked: non-YouTube URL "${query}"`);
          return guildManager.replyToInteractionWithMessage(
            interaction,
            "You can only use YOUTUBE as a source",
            3000
          );
        }
      }

      // Reply fast, then do the heavy work
      await guildManager.replyToInteractionWithMessage(interaction, "Loading…");

      try {
        const track = await musicManager.enqueueFromQuery({
          voiceChannel: channel,
          queryOrUrl: query,
          requestedBy: interaction.user.tag
        });

        console.log(
          `[play] queued "${track.title}" for ${requesterTag} in ${interaction.guild.id}`
        );
        // Don’t set “Now playing” here (might already be playing something).
        // Let your trackStart event update the embed when it actually starts.
        await interaction.editReply(`Queued: **${track.title}**`);
      } catch (e) {
        console.log(`[play] enqueue failed for ${requesterTag}`, e);
        await interaction.editReply("Something went wrong while loading that track.");
      }
    }
  };
}

export default createPlayCommand;
