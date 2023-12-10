const { Track } = require("discord-player");
const {Guild}=require("discord.js")
const musicMessageEmbed  = require("../replyFolder/embedMessageTemplate")
const musicEmbedUI=require("../replyFolder/buttonsUI")

class replyControllSingleton {
    /**
     * @param { (...args: ClientEvents[Event]) => Awaitable<void>} interaction -Interaction you want to reply to
     */
    constructor(interaction) {
        this.interaction=interaction;
        this.currentEmbed=new musicMessageEmbed();
    }
    

    /**
     * @param { (...args: ClientEvents[Event]) => Awaitable<void>} newInteraction -Interaction you want to reply to
     * @param { Number } timeToRemove-time in milliseconds after which reply will be removed
     * @param { string } reply- message/embed to send as a reply
     * @param { string } UIcomponent- UI component 
     */
    async replyToInteractionWithEmbed(reply,newInteraction,UIcomponent=null,timeToRemove=-1){

        const replyObject={
            embeds:[reply]
        }
        if(UIcomponent)
            replyObject.components=[UIcomponent]


        if(timeToRemove!=-1){
            return newInteraction.reply(replyObject).then((reply)=>{
                setTimeout(() => {
                    reply.delete();
                  }, timeToRemove);
            })

        }

        if(this.interaction.replied){
            await this.interaction.editReply(replyObject)

            return newInteraction.reply("Loading embed...").then((reply)=>{
                setTimeout(() => {
                    reply.delete();
                }, 1);
            })
        }

        return this.interaction.reply(replyObject)
    }


    /**
     * @param { (...args: ClientEvents[Event]) => Awaitable<void>} newInteraction -Interaction you want to reply to
     * @param { Number } timeToRemove-time in milliseconds after which reply will be removed
     * @param { String } reply- message/embed to send as a reply
     */
    replyToInteractionWithMessage(reply,newInteraction,timeToRemove=-1){
        if(timeToRemove==-1){
            return newInteraction.reply(reply)
        }
        return newInteraction.reply(reply).then((reply)=>{
            setTimeout(() => {
                reply.delete();
              }, timeToRemove);
        })
    }


    /**
     * Creates embed from the song
     * @param { Track } song-track from search
     * @param { String } embed- message/embed to send as a reply
     */
    songToEmbed(song){
        this.currentEmbed.fields[0].value=song.title;
        this.currentEmbed.image.url=song.thumbnail;
        return this.currentEmbed;
    } 

    /**
     * Returns UI with buttons
     * @returns {Partial<| ActionRowData<ActionRowComponentData | JSONEncodable<APIActionRowComponentTypes>>| APIActionRowComponent<APIMessageActionRowComponent | APIModalActionRowComponent>>}
     */
    getMusicUI(){
        return musicEmbedUI();
    } 



    /**
     * Executes button commands
     */
    buttonClick(interaction,client){
        let customID=interaction.customId;

        let commandName=null;

        switch (customID) {
            case 'skipButton':
                commandName="skip";
                break;
        
            case 'pauseButton':
                commandName="pause";
                break;
        
            case 'resumeButton':
                commandName="resume";
                break;
        }

        if(!commandName)
            throw new Error('There is no button with that customId');
        
        let command=null
        command = client.commands.get(commandName);

        if(!command)
            throw new Error('There is no command with name:'+commandName);

        return command.execute({client, interaction})
        


    }


}


class replyControll {
    constructor() {
        throw new Error('Use replyControll.getInstance()');
    }
    /**
     *
     *
     * @static
     * @param {*} guild
     * @param {*} interaction
     * @return {replyControllSingleton} 
     * @memberof replyControll
     */
    static getInstance(guild,interaction) {
        if (!guild.replyControllSingleton) {
            console.log("Created replyControllSingleton for:"+guild)
            guild.replyControllSingleton = new replyControllSingleton(interaction);
        }
        return guild.replyControllSingleton;
    }
    static resetInstance(guild){
        guild.replyControllSingleton=null;
    }
}


module.exports = {replyControll,replyControllSingleton};