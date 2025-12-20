import { SlashCommandBuilder } from "discord.js";
import { useMainPlayer } from "discord-player";
import { replyControll } from "../replyFolder/replyControll.js";
import type { CommandModule } from "../types/command.js";

const pause: CommandModule = {
  data: new SlashCommandBuilder().setName("pause").setDescription("Pause current song"),

  execute: async ({ client, interaction }) => {
    if (!interaction.inCachedGuild()) {
      return;
    }

    const channel = interaction.member.voice.channel;
    const ReplyControll = replyControll.getInstance(interaction.guild, interaction);

    if (!channel) {
      return ReplyControll.replyToInteractionWithMessage("You need to be in a Voice Channel to pause a song.", interaction, 3000);
    }

    const player = useMainPlayer();
    const guildNodeManager = player.queues;
    const guildQueue = guildNodeManager.get(interaction.guild);

    if (!guildQueue?.connection) {
      return ReplyControll.replyToInteractionWithMessage("Bot is not connected to this channel.", interaction, 3000);
    }

    try {
      if (guildQueue.isPlaying() || !guildQueue.isEmpty()) {
        guildQueue.node.pause();
        return ReplyControll.replyToInteractionWithMessage("Song paused", interaction, 3000);
      }
      return ReplyControll.replyToInteractionWithMessage("No song is playing", interaction, 3000);
    } catch (e) {
      console.log(e);
      return ReplyControll.replyToInteractionWithMessage(`Something went wrong: ${e}`, interaction);
    }
  }
};

export default pause;
