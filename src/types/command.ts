import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";

export type BotInteraction =
  | ChatInputCommandInteraction<"cached">
  | ButtonInteraction<"cached">;

export type CommandExecuteArgs = {
  client: Client;
  interaction: BotInteraction;
};

export type CommandModule = {
  readonly data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
  execute(args: CommandExecuteArgs): Promise<unknown>;
};
