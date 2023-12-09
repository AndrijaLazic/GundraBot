const { EmbedBuilder ,SlashCommandBuilder } = require("discord.js")
const { QueryType,useMainPlayer,GuildQueue  } = require("discord-player")
const {replyControll} =require("../replyFolder/replyControll")

module.exports = {
	data: new SlashCommandBuilder()
		.setName("resume")
		.setDescription("Resume current song"),

	execute: async ({ client, interaction }) => {

        const channel = interaction.member.voice.channel;
        const ReplyControll=replyControll.getInstance(client.guilds.cache.get(interaction.guildId),interaction);

        // Check if user is inside a voice channel
		if (!channel) 
            return interaction.reply("You need to be in a Voice Channel to resume a song.");

        
        // Create a play queue for the server(singleton)
    
        const player = useMainPlayer();
        
        const guildNodeMenager=player.queues;
        //get a queue for the guild that requsted the interaction
        const guildQUEUE=guildNodeMenager.get(client.guilds.cache.get(interaction.guildId));
        
        if(!(guildQUEUE?.connection))
            return ReplyControll.replyToInteractionWithMessage("Bot is not connected to this channel.",interaction,5000);
        



        try{
            if(!guildQUEUE.isPlaying()){
                return ReplyControll.replyToInteractionWithMessage("There is no song to resume",interaction,5000)
            }
            if(guildQUEUE.node.isPaused()){
                guildQUEUE.node.resume();
                return ReplyControll.replyToInteractionWithMessage("Song resumed",interaction,5000)
            }
            return ReplyControll.replyToInteractionWithMessage("Song is already playing",interaction,5000)
                
            
            
        }
        catch (e) {
            // let's return error if something failed
            console.log(e)
            return ReplyControll.replyToInteractionWithMessage(`Something went wrong: ${e}`,interaction,5000)
        }

	},
}