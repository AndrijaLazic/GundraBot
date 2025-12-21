import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Client, ClientOptions, Collection } from "discord.js";
import type { CommandModule } from "./command.js";

export class BotClient extends Client {
  public commands = new Collection<string, CommandModule>();
  public commandData: CommandModule["data"][] = [];
  public readonly commandsReady: Promise<void>;

  constructor(options: ClientOptions) {
    super(options);
    this.commandsReady = this.loadCommands();
  }

  private async loadCommands() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const commandsPath = path.join(__dirname, "..", "commands");
    const commandFiles = fs
      .readdirSync(commandsPath)
      .filter(file => file.endsWith(".ts") || file.endsWith(".js"));

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const imported = (await import(pathToFileURL(filePath).href)) as { default?: CommandModule } | CommandModule;
      const command: CommandModule = (imported as { default?: CommandModule }).default ?? (imported as CommandModule);

      if (command?.data?.name && typeof command.execute === "function") {
        this.commands.set(command.data.name, command);
        this.commandData.push(command.data);
      }
    }
  }
}
