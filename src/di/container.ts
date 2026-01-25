// src/di/services.ts
import type { Guild } from "discord.js";
import { createLogger, type Logger } from "../logging/logger.js";
import { MusicManager } from "../music/MusicManager.js";
import { GuildManagerProvider } from "./GuildManagerProvider.js";

export type Services = {
  // Singleton per Services instance
  logger: Logger;

  // Factories (new instance on each call)
  createMusic: (guild: Guild) => MusicManager;

  // Singleton per Services instance (holds per-guild singletons internally)
  guildManagers: GuildManagerProvider;
};

export function buildServices(): Services {
  const logger = createLogger({ base: { service: "gundrabot" } });
  const musicLogger = logger.child({ component: "music" });
  const createMusic = (guild: Guild) => {
    const musicManager = new MusicManager(guild);
    musicLogger.info("Music manager created", { guildId: guild.id, guildName: guild.name });
    return musicManager;
  };

  const guildManagers = new GuildManagerProvider({
    createMusic,
    logger: logger.child({ component: "guildManagerProvider" })
  });

  logger.info("Services created");

  return {
    logger,
    createMusic,
    guildManagers,
  };
}
