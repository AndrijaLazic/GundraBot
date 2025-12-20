import type { ButtonInteraction, ChatInputCommandInteraction, Client, SlashCommandBuilder } from "discord.js";

export type BotInteraction = ChatInputCommandInteraction<"cached"> | ButtonInteraction<"cached">;

export type CommandExecuteArgs = {
  client: Client;
  interaction: BotInteraction;
};

export interface CommandModule {
  data: SlashCommandBuilder;
  execute: (args: CommandExecuteArgs) => Promise<unknown>;
}
