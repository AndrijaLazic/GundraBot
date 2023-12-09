const {Guild}=require("discord.js")
/**
 * @param { (...args: ClientEvents[Event]) => Awaitable<void>} interaction -Interaction you want to reply to
 * @param { Number } timeToRemove-time in milliseconds after which reply will be removed
 * @param { String } reply- message/embed to send as a reply
 * @param { Guild } guild- message/embed to send as a reply
 */





class replyControllSingleton {
    constructor(interaction,) {
        this.interaction=interaction;
        this.alreadyReplied=false;
        this.currentEmbed=null;
    }
    
    replyToInteractionWithEmbed(reply,timeToRemove=-1){
        if(timeToRemove==-1){
            if(this.alreadyReplied){
                return this.interaction.editReply({
                    embeds: [reply]
                })
            }

            this.alreadyReplied=true;
            return this.interaction.reply({
                embeds: [reply]
            })
        }

        if(this.alreadyReplied){
            return this.interaction.editReply({
                embeds: [reply]
            }).then((reply)=>{
                setTimeout(() => {
                    reply.delete();
                    this.alreadyReplied=false;
                  }, timeToRemove);
            })
        }

        return this.interaction.reply({
            embeds: [reply]
        }).then((reply)=>{
            setTimeout(() => {
                reply.delete();
              }, timeToRemove);
        })
    }
    
    replyToInteractionWithMessage(reply,timeToRemove=-1){
        if(timeToRemove==-1){
            return this.interaction.reply(reply)
        }
        return this.interaction.reply(reply).then((reply)=>{
            setTimeout(() => {
                reply.delete();
              }, timeToRemove);
        })
    }

    getCurrentEmbed(){
        return this.currentEmbed;
    }


}


class replyControll {
    constructor() {
        throw new Error('Use replyControll.getInstance()');
    }    
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


module.exports = replyControll;