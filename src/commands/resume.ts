import { SlashCommandBuilder } from "discord.js";
import { useMainPlayer } from "discord-player";
import { replyControll } from "../replyFolder/replyControll.js";
import type { CommandModule } from "../types/command.js";

const resume: CommandModule = {
  data: new SlashCommandBuilder().setName("resume").setDescription("Resume current song"),

  execute: async ({ client, interaction }) => {
    if (!interaction.inCachedGuild()) {
      return;
    }

    const channel = interaction.member.voice.channel;
    const ReplyControll = replyControll.getInstance(interaction.guild, interaction);

    if (!channel) {
      return interaction.reply("You need to be in a Voice Channel to resume a song.");
    }

    const player = useMainPlayer();
    const guildNodeManager = player.queues;
    const guildQueue = guildNodeManager.get(interaction.guild);

    if (!guildQueue?.connection) {
      return ReplyControll.replyToInteractionWithMessage("Bot is not connected to this channel.", interaction, 3000);
    }

    try {
      if (!guildQueue.isPlaying()) {
        return ReplyControll.replyToInteractionWithMessage("There is no song to resume", interaction, 3000);
      }
      if (guildQueue.node.isPaused()) {
        guildQueue.node.resume();
        return ReplyControll.replyToInteractionWithMessage("Song resumed", interaction, 3000);
      }
      return ReplyControll.replyToInteractionWithMessage("Song is already playing", interaction, 3000);
    } catch (e) {
      console.log(e);
      return ReplyControll.replyToInteractionWithMessage(`Something went wrong: ${e}`, interaction, 3000);
    }
  }
};

export default resume;
