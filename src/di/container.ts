// src/di/services.ts
import type { Guild } from "discord.js";
import { GuildLock } from "../guild/ServerGuildManager.js";
import { MusicManager } from "../music/MusicManager.js";
import { ReplyControll } from "../reply/ReplyControll.js";
import type { BotInteraction } from "../types/command.js";
import { GuildManagerProvider } from "./GuildManagerProvider.js";

export type Logger = Console;

export type Services = {
  // Singleton per Services instance
  logger: Logger;

  // Factories (new instance on each call)
  createLock: () => GuildLock;
  createReplies: (interaction: BotInteraction | null) => ReplyControll;
  createMusic: (guild: Guild, lock: GuildLock) => MusicManager;

  // Singleton per Services instance (holds per-guild singletons internally)
  guildManagers: GuildManagerProvider;
};

export function buildServices(): Services {
  const logger: Logger = console;
  const createLock = () => new GuildLock();
  const createReplies = (interaction: BotInteraction | null) => new ReplyControll(interaction);
  const createMusic = (guild: Guild, lock: GuildLock) => new MusicManager(guild, lock);

  const guildManagers = new GuildManagerProvider({
    createLock,
    createReplies,
    createMusic,
    logger,
  });

  console.log("SERVICES CREATED");

  return {
    logger,
    createLock,
    createReplies,
    createMusic,
    guildManagers,
  };
}
