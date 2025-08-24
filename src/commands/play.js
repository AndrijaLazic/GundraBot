const { EmbedBuilder ,SlashCommandBuilder } = require("discord.js")
const { QueryType,useMainPlayer,GuildQueue  } = require("discord-player")
const {replyControll} =require("../replyFolder/replyControll")
const {musicEmbedUI}  = require("../replyFolder/buttonsUI")
const url = require('url');
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
                const ReplyControll=replyControll.getInstance(client.guilds.cache.get(interaction.guildId),interaction);

                // Check if user is inside a voice channel
                if (!channel) 
                    return interaction.reply("You need to be in a Voice Channel to play a song.");

                
                // Create a play queue for the server(singleton)
            
                const player = useMainPlayer();
                const query = interaction.options.getString('url', true);

                const parsedUrl = new URL(query);

                if(parsedUrl.hostname)
                    if(!(parsedUrl.hostname.includes('youtube.com') || parsedUrl.hostname.includes('youtu.be'))){
                        return ReplyControll.replyToInteractionWithMessage(`You can only use YOUTUBE as a source`,interaction,3000)
                    }
                        
                

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
                    await ReplyControll.replyToInteractionWithMessage(`Bad url, use valid url please.`,interaction,3000)
                    return;
                } else {
                    try {
                        
                        if(!guildQUEUE.connection){
                            await guildQUEUE.connect(channel);
                        }
                            
                        
                        guildQUEUE.addTrack(searchResult.tracks[0])

                        MusicMessageEmbed=ReplyControll.songToEmbed(searchResult.tracks[0])
                        await ReplyControll.replyToInteractionWithEmbed(MusicMessageEmbed,interaction,new musicEmbedUI())
                        if(!guildQUEUE.isPlaying()){
                            await guildQUEUE.node.play();
                        }
                        
                        
                        
                        
                    } catch (e) {
                        // let's return error if something failed
                        console.log(e)
                        return interaction.reply(`Something went wrong: ${e}`);
                    }
                }

            },
}