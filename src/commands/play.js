const { EmbedBuilder ,SlashCommandBuilder } = require("discord.js")
const { QueryType,useMainPlayer,GuildQueue  } = require("discord-player")
let musicEmbedMessage=new EmbedBuilder(require("../embedObjects/musicEmbedMessage"))
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
        
        const guildNodeMenager=player.queues;
        const guildQUEUE=guildNodeMenager.create(client.guilds.cache.get(interaction.guildId),
        {
            leaveOnEmpty:true,
            leaveOnEmptyCooldown:30000
        })//creates a queue if it doesnt exist or returns a current queue
        
        //musicEmbedMessage

        
        await interaction.reply(`Loading your track`);

        if (!searchResult.hasTracks()) {
            // If player didn't find any songs for this query
            await interaction.editReply(`Bad url, use valid url please.`);
            return;
        } else {
            try {
                
                if(!guildQUEUE.connection)
                    await guildQUEUE.connect(channel);
                
                guildQUEUE.addTrack(searchResult.tracks[0])
                console.log(guildQUEUE.tracks.size)
                if(!guildQUEUE.isPlaying()){
                    
                    await guildQUEUE.play(guildQUEUE.tracks.at(0), {
                        nodeOptions: {
                            metadata: interaction // we can access this metadata object using queue.metadata later on
                        }
                    });
                }
                
                
                
                await interaction.deleteReply();
                
                console.log(musicEmbedMessage)
                
                // channel.send({ embeds: [musicEmbed] });
            } catch (e) {
                // let's return error if something failed
                console.log(e)
                return interaction.followUp(`Something went wrong: ${e}`);
            }
        }

	},
}