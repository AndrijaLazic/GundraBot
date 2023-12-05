const { MessageEmbed,SlashCommandBuilder } = require("discord.js")
const { QueryType,useMainPlayer,GuildQueue  } = require("discord-player")

module.exports = {
	data: new SlashCommandBuilder()
		.setName("play")
		.setDescription("play a song from YouTube.")
		.addSubcommand(subcommand =>
			subcommand
				.setName("url")
				.setDescription("Plays a single song from youtube url")
				.addStringOption(option => option.setName("url").setDescription("the song's url").setRequired(true))
		),
	execute: async ({ client, interaction }) => {

        const channel = interaction.member.voice.channel;

        // Check if user is inside a voice channel
		if (!channel) 
            return interaction.reply("You need to be in a Voice Channel to play a song.");

        // Create a play queue for the server(singleton)
    
        const player = useMainPlayer();
        const query = interaction.options.getString('url', true);
        const searchResult = await player.search(query, { requestedBy: interaction.user });
        

        await interaction.deferReply();

        if (!searchResult.hasTracks()) {
            // If player didn't find any songs for this query
            console.log(searchResult)
            await interaction.editReply(`Bad url, use valid url please.`);
            return;
        } else {
            try {
                await player.play(channel, searchResult, {
                    nodeOptions: {
                        metadata: interaction // we can access this metadata object using queue.metadata later on
                    }
                });
                await interaction.editReply(`Loading your track`);
            } catch (e) {
                // let's return error if something failed
                return interaction.followUp(`Something went wrong: ${e}`);
            }
        }

	},
}