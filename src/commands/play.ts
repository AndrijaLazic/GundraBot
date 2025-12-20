import { SlashCommandBuilder } from "discord.js";
import { useMainPlayer } from "discord-player";
import { replyControll } from "../replyFolder/replyControll.js";
import { musicEmbedUI } from "../replyFolder/buttonsUI.js";
import type { CommandModule } from "../types/command.js";

const play: CommandModule = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song from YouTube.")
    .addSubcommand(subcommand =>
      subcommand
        .setName("url")
        .setDescription("Plays a single song from youtube url")
        .addStringOption(option => option.setName("url").setDescription("the song's url").setRequired(true))
    ),
  execute: async ({ client, interaction }) => {
    if (!interaction.isChatInputCommand() || !interaction.inCachedGuild()) {
      return;
    }

    const channel = interaction.member.voice.channel;
    const ReplyControll = replyControll.getInstance(interaction.guild, interaction);

    if (!channel) {
      return interaction.reply("You need to be in a Voice Channel to play a song.");
    }

    const player = useMainPlayer();
    const query = interaction.options.getString("url", true);
    const parsedUrl = new URL(query);

    if (parsedUrl.hostname && !(parsedUrl.hostname.includes("youtube.com") || parsedUrl.hostname.includes("youtu.be"))) {
      return ReplyControll.replyToInteractionWithMessage("You can only use YOUTUBE as a source", interaction, 3000);
    }

    const searchResult = await player.search(query, { requestedBy: interaction.user });

    const guildNodeManager = player.queues;
    const guildQueue = guildNodeManager.create(interaction.guild, {
      leaveOnStop: false,
      leaveOnEmpty: true,
      leaveOnEmptyCooldown: 30000,
      leaveOnEnd: true,
      leaveOnEndCooldown: 30000,
      pauseOnEmpty: true
    });

    if (!searchResult.hasTracks()) {
      await ReplyControll.replyToInteractionWithMessage("Bad url, use valid url please.", interaction, 3000);
      return;
    }

    try {
      if (!guildQueue.connection) {
        await guildQueue.connect(channel);
      }

      const track = searchResult.tracks[0];
      guildQueue.addTrack(track);

      const musicMessageEmbed = ReplyControll.songToEmbed(track);
      await ReplyControll.replyToInteractionWithEmbed(musicMessageEmbed, interaction, new musicEmbedUI());

      if (!guildQueue.isPlaying()) {
        await guildQueue.node.play();
      }
    } catch (e) {
      console.log(e);
      return interaction.reply(`Something went wrong: ${e}`);
    }
  }
};

export default play;
