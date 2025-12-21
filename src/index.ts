import dotenv from "dotenv";
import { IntentsBitField } from "discord.js";
import { createPlayer } from "./config/player.js";
import { registerClientEvents, registerPlayerEvents } from "./config/events.js";
import { BotClient } from "./types/bot.js";

dotenv.config();

const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token || !clientId) {
  throw new Error("Missing TOKEN or CLIENT_ID environment variables");
}

const client = new BotClient({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildVoiceStates
  ]
});

await client.commandsReady;

const player = createPlayer(client);

registerPlayerEvents(player);
registerClientEvents(client, token, clientId);

client.login(token);
