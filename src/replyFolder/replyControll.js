const { Track,useMainPlayer } = require("discord-player");
const {Guild}=require("discord.js")
const musicMessageEmbed  = require("../replyFolder/embedMessageTemplate")
const {musicEmbedUI}=require("../replyFolder/buttonsUI")


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
            //await this.interaction.editReply(replyObject)

            return newInteraction.reply("Loading "+reply.fields[0].value).then((reply)=>{
                setTimeout(() => {
                    reply.delete();
                }, 2000);
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
     * Remove embed
     */
    removeCurrentEmbed(){
        if(this.interaction){
            this.interaction.deleteReply()
        }
    } 

    /**
     * Exit voice channel
     */
    exitChanell(client,interaction){
        const player = useMainPlayer();
        const guildNodeMenager=player.queues;
        const guildQUEUE=guildNodeMenager.get(client.guilds.cache.get(interaction.guildId))
        if(guildQUEUE && guildQUEUE.connection){
            if(guildQUEUE.connection.disconnect())
                player.events.emit("disconnect",guildQUEUE)
        }
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
            case 'exitButton':
                this.replyToInteractionWithMessage("Exiting...",interaction,1000)
                this.exitChanell(client,interaction)
                return;
        }

        if(!commandName)
            throw new Error('There is no button with that customId');
        
        let command=null
        command = client.commands.get(commandName);

        if(!command)
            throw new Error('There is no command with name:'+commandName);

        return command.execute({client, interaction})
        
    }


    /**
     * Update current embed with 
     * @param {Track} song
     */
    updateCurrentEmbedWithSong(song){
        if(!this.interaction){
            throw new Error('There is no interaction to update');
        }

        if(!this.interaction.replied){
            throw new Error('Cant update interaction if you dont reply to it first');
        }

        
        let MusicMessageEmbed=this.songToEmbed(song);
        const replyObject={
            embeds:[MusicMessageEmbed]
        }
        replyObject.components=[new musicEmbedUI()]
        this.interaction.editReply(replyObject)    
        return

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
    static getInstance(guild,interaction=null) {
        if (!guild.replyControllSingleton) {
            console.log("Created replyControllSingleton for:"+guild)
            guild.replyControllSingleton = new replyControllSingleton(interaction);
        }
        return guild.replyControllSingleton;
    }
    static async resetInstance(guild){
        if(guild.replyControllSingleton){
            await guild.replyControllSingleton.removeCurrentEmbed();
        }
        guild.replyControllSingleton=null;
    }
}


module.exports = {replyControll,replyControllSingleton};