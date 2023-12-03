const {Client,IntentsBitField}=require("discord.js")
require('dotenv').config();//loads in .env config which can be acessed by process.env

const client=new Client({
    intents:[
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
    ]
})

client.on("ready",(c)=>{
    console.log("The bot "+c.user.tag+" is ready.")
})

client.on("messageCreate",(message)=>{
    console.log(message.content)
})

client.login(process.env.TOKEN)