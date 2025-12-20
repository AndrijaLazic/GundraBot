import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Client, IntentsBitField, Collection, REST, Events } from "discord.js";
import { Routes } from "discord-api-types/v10";
import { Player } from "discord-player";
import { DefaultExtractors } from "@discord-player/extractor";
import { YoutubeiExtractor } from "discord-player-youtubei";
import { replyControll } from "./replyFolder/replyControll.js";
import type { CommandModule } from "./types/command.js";
import type { BotClient } from "./types/bot.js";

dotenv.config();

const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token || !clientId) {
  throw new Error("Missing TOKEN or CLIENT_ID environment variables");
}

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildVoiceStates
  ]
}) as BotClient;

const commands: CommandModule["data"][] = [];
client.commands = new Collection<string, CommandModule>();

// Recreate __dirname for ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".ts") || file.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const imported = (await import(pathToFileURL(filePath).href)) as { default?: CommandModule } | CommandModule;
  const command: CommandModule = (imported as { default?: CommandModule }).default ?? (imported as CommandModule);

  if (command?.data?.name && typeof command.execute === "function") {
    client.commands.set(command.data.name, command);
    commands.push(command.data);
  }
}

const player = new Player(client, {
  ytdlOptions: {
    quality: "highest",
    highWaterMark: 2000000
  }
});
player.extractors.loadMulti(DefaultExtractors);
player.extractors.register(YoutubeiExtractor, {});

player.events.on("disconnect", queue => {
  replyControll.resetInstance(queue.guild);
  console.log("Disconnected from guild:" + queue.guild);
});

player.events.on("playerStart", (queue, track) => {
  const ReplyControll = replyControll.getInstance(queue.guild);
  try {
    ReplyControll.updateCurrentEmbedWithSong(track);
  } catch (e) {
    console.log(e);
  }
});

client.once(Events.ClientReady, async readyClient => {
  console.log("The bot " + readyClient.user.tag + " is ready.");
  const guildIds = client.guilds.cache.map(guild => guild.id);
  const rest = new REST({ version: "10" }).setToken(token);

  for (const guildID of guildIds) {
    rest
      .put(Routes.applicationGuildCommands(clientId, guildID), {
        body: commands
      })
      .then(() => console.log(`Added commands to ${guildID}`))
      .catch(error => console.error("Failed to add commands to:" + guildID, error));
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.inCachedGuild()) {
    return;
  }

  const guild = interaction.guild;
  if (!guild) {
    return;
  }

  const ReplyControll = replyControll.getInstance(guild, interaction);

  if (interaction.isButton()) {
    try {
      await ReplyControll.buttonClick(interaction, client);
    } catch (e) {
      console.log(e);
      await interaction.reply({ content: "There was an error executing this command" });
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute({ client, interaction });
  } catch (error) {
    console.error(error);
    await interaction.reply({ content: "There was an error executing this command" });
  }
});

client.once("reconnecting", message => {
  console.log("Reconnecting!" + message);
});

client.on("disconnect", message => {
  console.log("Disconnect!" + message);
});

client.login(token);
