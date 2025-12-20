import { SlashCommandBuilder } from "discord.js";
import { useMainPlayer } from "discord-player";
import { replyControll } from "../replyFolder/replyControll.js";
import type { CommandModule } from "../types/command.js";

const skip: CommandModule = {
  data: new SlashCommandBuilder().setName("skip").setDescription("Skip current song"),

  execute: async ({ client, interaction }) => {
    if (!interaction.inCachedGuild()) {
      return;
    }

    const channel = interaction.member.voice.channel;
    const ReplyControll = replyControll.getInstance(interaction.guild, interaction);

    if (!channel) {
      return interaction.reply("You need to be in a Voice Channel to skip a song.");
    }

    const player = useMainPlayer();
    const guildNodeManager = player.queues;
    const guildQueue = guildNodeManager.get(interaction.guild);

    if (!guildQueue?.connection) {
      return ReplyControll.replyToInteractionWithMessage("Bot is not connected to this channel.", interaction, 3000);
    }

    try {
      if (guildQueue.isPlaying() || !guildQueue.isEmpty()) {
        guildQueue.node.skip();
      } else {
        return ReplyControll.replyToInteractionWithMessage("There are no songs to be skipped. Queue is empty.", interaction, 3000);
      }
      return ReplyControll.replyToInteractionWithMessage("Song removed from queue", interaction, 3000);
    } catch (e) {
      console.log(e);
      return ReplyControll.replyToInteractionWithMessage(`Something went wrong: ${e}`, interaction, 5000);
    }
  }
};

export default skip;
