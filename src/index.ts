import dotenv from "dotenv";
import { IntentsBitField } from "discord.js";
import { startYtDlpCookieRefresher } from "./cookieRefresher.js";
import { createCommands } from "./commands/index.js";
import { buildServices } from "./di/container.js";
import { BotClient } from "./types/bot.js";
import { registerClientEvents } from "./commands/events/clientEvents.js";

dotenv.config();

const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token || !clientId) {
  throw new Error("Missing TOKEN or CLIENT_ID environment variables");
}

const services = buildServices();
const logger = services.logger.child({ component: "process" });
const cookieRefresher = startYtDlpCookieRefresher(
  services.logger.child({ component: "cookieRefresher" })
);
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
registerClientEvents(client, token, clientId, services);

process.on("unhandledRejection", reason => {
  logger.error("Unhandled rejection", reason);
});

process.on("uncaughtException", error => {
  logger.error("Uncaught exception", error);
});

process.on("SIGTERM", () => {
  cookieRefresher?.stop();
});

process.on("SIGINT", () => {
  cookieRefresher?.stop();
});

client.login(token);
