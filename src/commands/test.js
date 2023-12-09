const { EmbedBuilder ,SlashCommandBuilder } = require("discord.js")
const { QueryType,useMainPlayer,GuildQueue  } = require("discord-player")
const replyControll =require("../replyFolder/replyControll.js")
const musicMessageEmbed  = require("../replyFolder/embedMessageTemplate")


module.exports = {
	data: new SlashCommandBuilder()
		.setName("test")
		.setDescription("Pause current song"),

	execute: async ({ client, interaction }) => {


        let MusicMessageEmbed=new musicMessageEmbed();

        try{
            const ReplyControll=replyControll.getInstance(client.guilds.cache.get(interaction.guildId),interaction);
            
            ReplyControll.replyToInteractionWithEmbed(MusicMessageEmbed);
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