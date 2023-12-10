const { EmbedBuilder ,SlashCommandBuilder } = require("discord.js")
const { QueryType,useMainPlayer,GuildQueue  } = require("discord-player")
const {replyControll} =require("../replyFolder/replyControll")
const musicMessageEmbed  = require("../replyFolder/embedMessageTemplate")
const {musicEmbedUI}  = require("../replyFolder/buttonsUI")


module.exports = {
	data: new SlashCommandBuilder()
		.setName("test")
		.setDescription("Pause current song"),

	execute: async ({ client, interaction }) => {


        let MusicMessageEmbed=new musicMessageEmbed();

        try{
            const ReplyControll=replyControll.getInstance(client.guilds.cache.get(interaction.guildId),interaction);
            await ReplyControll.replyToInteractionWithEmbed(MusicMessageEmbed,interaction,new musicEmbedUI());
            
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