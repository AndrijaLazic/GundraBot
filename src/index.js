require('dotenv').config();//loads in .env config which can be acessed by process.env

const {Client,IntentsBitField,Collection}=require("discord.js")
const {REST}=require("discord.js")
const {Routes}=require("discord-api-types/v10")
const {Player}=require("discord-player")
const {replyControll}=require("../src/replyFolder/replyControll")

const fs=require("node:fs")//allows you to work with the file system on your computer
const path=require("node:path")

const client=new Client({
    intents:[
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
        IntentsBitField.Flags.GuildVoiceStates
    ]
})



//Loading commands
const commands=[];
client.commands=new Collection();

const commandsPath=path.join(__dirname,"commands");
const commandFiles=fs.readdirSync(commandsPath).filter(file=> file.endsWith(".js"));

for(const file of commandFiles){
    const filePath=path.join(commandsPath,file);
    const command=require(filePath);
    
    client.commands.set(command.data.name,command)
    commands.push(command.data);
}


const player=new Player(client,{
    ytdlOptions:{
        quality:"highest",//https://github.com/fent/node-ytdl-core/blob/9e15c7381f1eba188aba8b536097264db6ad3f7e/typings/index.d.ts#L24
        highWaterMark:2000000//https://nodejs.org/api/stream.html#streamsetdefaulthighwatermarkobjectmode-value 
    }
});
player.extractors.loadDefault();

player.events.on('disconnect', (queue) => {
    // Emitted when the bot leaves the voice channel
    console.log(replyControll)
    replyControll.resetInstance(queue.guild);
    console.log("Disconnected from guild:"+queue.guild)

    
});


client.on("ready",(c)=>{
    console.log("The bot "+c.user.tag+" is ready.")
    const guild_IDS=client.guilds.cache.map(guild=>guild.id)

    const rest=new REST().setToken(process.env.TOKEN);
    for(const guildID of guild_IDS){
        rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID,guildID),{
            body:commands
        }).then(()=>console.log(`Added commands to ${guildID}`))
          .catch("Failed to add commands to:"+guildID+console.error);
    }
})


client.on("interactionCreate", async interaction => {
    if(!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if(!command) return;

    try
    {
        await command.execute({client, interaction});
    }
    catch(error)
    {
        console.error(error);
        await interaction.reply({content: "There was an error executing this command"});
    }
});


// client.on("messageCreate",(message)=>{
//     console.log(message.content)
// })

client.once('reconnecting', (message) => {
    console.log('Reconnecting!'+message);
});

client.on('disconnect', (message) => {
    console.log('Disconnect!'+message);
});

client.login(process.env.TOKEN)