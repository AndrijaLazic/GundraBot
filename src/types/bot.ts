import type { Client, Collection } from "discord.js";
import type { CommandModule } from "./command.js";

export type BotClient = Client & {
  commands: Collection<string, CommandModule>;
};
