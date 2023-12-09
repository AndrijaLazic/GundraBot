const {Guild}=require("discord.js")






class replyControllSingleton {
    /**
     * @param { (...args: ClientEvents[Event]) => Awaitable<void>} interaction -Interaction you want to reply to
     */
    constructor(interaction) {
        this.interaction=interaction;
        this.currentEmbed=null;
    }
    

    /**
     * @param { (...args: ClientEvents[Event]) => Awaitable<void>} newInteraction -Interaction you want to reply to
     * @param { Number } timeToRemove-time in milliseconds after which reply will be removed
     * @param { String } reply- message/embed to send as a reply
     */
    async replyToInteractionWithEmbed(reply,newInteraction,timeToRemove=-1){

        if(timeToRemove!=-1){
            return newInteraction.reply({
                embeds: [reply]
            }).then((reply)=>{
                setTimeout(() => {
                    reply.delete();
                  }, timeToRemove);
            })

        }

        if(this.interaction.replied){
            await this.interaction.editReply({
                embeds: [reply]
            })

            return newInteraction.reply("Loading embed...").then((reply)=>{
                setTimeout(() => {
                    reply.delete();
                }, 1);
            })
        }

        await this.interaction.reply({
            embeds: [reply]
        })
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