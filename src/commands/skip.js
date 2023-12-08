const { EmbedBuilder ,SlashCommandBuilder } = require("discord.js")
const { QueryType,useMainPlayer,GuildQueue  } = require("discord-player")
const embedMusicMessage  = require("../replyFolder/embedMessageTemplate")
let musicEmbedMessage=new embedMusicMessage();


module.exports = {
	data: new SlashCommandBuilder()
		.setName("skip")
		.setDescription("Skip current song"),

	execute: async ({ client, interaction }) => {

        const channel = interaction.member.voice.channel;
        
        // Check if user is inside a voice channel
		if (!channel) 
            return interaction.reply("You need to be in a Voice Channel to skip a song.");

        
        // Create a play queue for the server(singleton)
    
        const player = useMainPlayer();
        
        const guildNodeMenager=player.queues;
        //get a queue for the guild that requsted the interaction
        const guildQUEUE=guildNodeMenager.get(client.guilds.cache.get(interaction.guildId));
        
        if(!(guildQUEUE?.connection))
            return interaction.reply("Bot is not connected to this channel.").then((reply)=>{
                setTimeout(() => {
                    reply.delete();
                  }, 5000);
        });



        try{
            console.log(guildQUEUE.getSize())
            if(guildQUEUE.isPlaying() || !(guildQUEUE.isEmpty())){
                guildQUEUE.node.skip();
            }
            else{
                return interaction.reply("There are no songs to be skipped. Queue is empty.").then((reply)=>{
                    setTimeout(() => {
                        reply.delete();
                      }, 5000);
                })
            }
                
            return interaction.reply("Song removed from queue").then((reply)=>{
                setTimeout(() => {
                    reply.delete();
                  }, 5000);
            })
            
        }
        catch (e) {
            // let's return error if something failed
            console.log(e)
            return interaction.reply(`Something went wrong: ${e}`).then((reply)=>{
                setTimeout(() => {
                    reply.delete();
                  }, 5000);
            })
        }

	},
}