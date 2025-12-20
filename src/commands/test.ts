import { SlashCommandBuilder } from "discord.js";
import { replyControll } from "../replyFolder/replyControll.js";
import { createMusicMessageEmbed } from "../replyFolder/embedMessageTemplate.js";
import { musicEmbedUI } from "../replyFolder/buttonsUI.js";
import type { CommandModule } from "../types/command.js";

const test: CommandModule = {
  data: new SlashCommandBuilder().setName("test").setDescription("Send sample music embed"),

  execute: async ({ client, interaction }) => {
    if (!interaction.inCachedGuild()) {
      return;
    }

    const musicMessageEmbed = createMusicMessageEmbed();

    try {
      const ReplyControll = replyControll.getInstance(interaction.guild, interaction);
      await ReplyControll.replyToInteractionWithEmbed(musicMessageEmbed, interaction, new musicEmbedUI());
    } catch (e) {
      console.log(e);
      return interaction.reply(`Something went wrong: ${e}`).then(reply => {
        setTimeout(() => {
          reply.delete();
        }, 5000);
      });
    }
  }
};

export default test;
