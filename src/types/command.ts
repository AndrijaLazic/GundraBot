import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  SlashCommandBuilder,
} from "discord.js";

export type BotInteraction =
  | ChatInputCommandInteraction<"cached">
  | ButtonInteraction<"cached">;

export class CommandExecuteArgs {
  constructor(
    public readonly client: Client,
    public readonly interaction: BotInteraction
  ) {}
}


export abstract class CommandModule {
  public abstract readonly data: SlashCommandBuilder;

  public abstract execute(args: CommandExecuteArgs): Promise<unknown>;
}
