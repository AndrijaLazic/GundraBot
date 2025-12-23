import { Client, ClientOptions, Collection } from "discord.js";
import type { CommandModule } from "./command.js";

export class BotClient extends Client {
  public commands = new Collection<string, CommandModule>();
  public commandData: CommandModule["data"][];

  constructor(options: ClientOptions, commands: CommandModule[]) {
    super(options);
    const validCommands = commands.filter(
      command => command?.data?.name && typeof command.execute === "function"
    );
    this.commandData = validCommands.map(command => command.data);
    validCommands.forEach(command => this.commands.set(command.data.name, command));
  }
}
