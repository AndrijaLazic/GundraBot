// src/di/services.ts
import type { Guild } from "discord.js";
import { MusicManager } from "../music/MusicManager.js";
import { GuildManagerProvider } from "./GuildManagerProvider.js";

export type Logger = Console;

export type Services = {
  // Singleton per Services instance
  logger: Logger;

  // Factories (new instance on each call)
  createMusic: (guild: Guild) => MusicManager;

  // Singleton per Services instance (holds per-guild singletons internally)
  guildManagers: GuildManagerProvider;
};

export function buildServices(): Services {
  const logger: Logger = console;
  const createMusic = (guild: Guild) => {
    const musicManager = new MusicManager(guild);
    console.log("Music manager created for guild: " +  guild.name);
    return musicManager;
  };

  const guildManagers = new GuildManagerProvider({
    createMusic,
    logger,
  });

  console.log("SERVICES CREATED");

  return {
    logger,
    createMusic,
    guildManagers,
  };
}
