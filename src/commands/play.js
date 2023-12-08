const { EmbedBuilder ,SlashCommandBuilder } = require("discord.js")
const { QueryType,useMainPlayer,GuildQueue  } = require("discord-player")
const musicMessageEmbed  = require("../replyFolder/embedMessageTemplate")
let MusicMessageEmbed=new musicMessageEmbed();

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
            leaveOnStop: false,
            leaveOnEmpty: true,
            leaveOnEmptyCooldown: 30000,
            leaveOnEnd: true,
            leaveOnEndCooldown: 30000,
            pauseOnEmpty: true
            
        })//creates a queue if it doesnt exist or returns a current queue
                

        if (!searchResult.hasTracks()) {
            // If player didn't find any songs for this query
            await interaction.reply(`Bad url, use valid url please.`);
            return;
        } else {
            try {
                
                if(!guildQUEUE.connection)
                    await guildQUEUE.connect(channel);
                
                guildQUEUE.addTrack(searchResult.tracks[0])

                
                if(!guildQUEUE.isPlaying()){
                    await guildQUEUE.node.play();
                }
                
                
                
                //await interaction.deleteReply();
                // channel.send({ embeds: [musicEmbedMessage] });
                
                console.log(MusicMessageEmbed)
                MusicMessageEmbed.fields[0].value=searchResult.tracks[0].title;
                MusicMessageEmbed.image.url=searchResult.tracks[0].thumbnail;
                await interaction.reply({
                    embeds: [MusicMessageEmbed]
                })
            } catch (e) {
                // let's return error if something failed
                console.log(e)
                return interaction.reply(`Something went wrong: ${e}`);
            }
        }

	},
}