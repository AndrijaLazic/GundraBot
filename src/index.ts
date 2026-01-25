import dotenv from "dotenv";
import { IntentsBitField } from "discord.js";
import { createCommands } from "./commands/index.js";
import { createPlayer } from "./config/player.js";
import { buildServices } from "./di/container.js";
import { BotClient } from "./types/bot.js";
import { registerPlayerEvents } from "./commands/events/playerEvents.js";
import { registerClientEvents } from "./commands/events/clientEvents.js";

dotenv.config();

const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token || !clientId) {
  throw new Error("Missing TOKEN or CLIENT_ID environment variables");
}

const services = buildServices();
const logger = services.logger.child({ component: "process" });
const commands = createCommands(services);

const client = new BotClient(
  {
    intents: [
      IntentsBitField.Flags.Guilds,
      IntentsBitField.Flags.GuildMembers,
      IntentsBitField.Flags.GuildMessages,
      IntentsBitField.Flags.MessageContent,
      IntentsBitField.Flags.GuildVoiceStates
    ]
  },
  commands
);

const player = createPlayer(client);

registerPlayerEvents(player, services);
registerClientEvents(client, token, clientId, services);

process.on("unhandledRejection", reason => {
  logger.error("Unhandled rejection", reason);
});

process.on("uncaughtException", error => {
  logger.error("Uncaught exception", error);
});

client.login(token);
