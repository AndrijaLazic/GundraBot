import type { Guild } from "discord.js";
import { createLogger, type Logger } from "../logging/logger.js";
import type { BotInteraction } from "../types/command.js";
import { ServerGuildManager } from "../guild/ServerGuildManager.js";
import type { MusicManager } from "../music/MusicManager.js";

export type GuildManagerFactoryDeps = {
  createMusic: (guild: Guild) => MusicManager;
  logger?: Logger;
};

export class GuildManagerProvider {
  private instances = new WeakMap<Guild, ServerGuildManager>();
  private logger: Logger;

  constructor(private deps: GuildManagerFactoryDeps) {
    this.logger = deps.logger ?? createLogger({ base: { component: "guildManagerProvider" } });
  }

  get(guild: Guild, interaction: BotInteraction | null = null): ServerGuildManager {
    let manager = this.instances.get(guild);

    if (!manager) {
      this.logger.info("Creating ServerGuildManager", {
        guildId: guild.id,
        guildName: guild.name
      });

      const music = this.deps.createMusic(guild);

      const managerLogger = this.logger.child({
        guildId: guild.id,
        guildName: guild.name,
        component: "guildManager"
      });

      manager = new ServerGuildManager(
        guild,
        interaction,
        music,
        managerLogger,
        () => this.instances.delete(guild)
      );

      this.instances.set(guild, manager);
    } else if (interaction) {
      this.logger.debug("ServerGuildManager already exists", {
        guildId: guild.id,
        guildName: guild.name
      });
      manager.musicEmbed.setInteraction(interaction);
    }

    return manager;
  }

  async reset(guild: Guild): Promise<void> {
    const manager = this.instances.get(guild);
    if (!manager) return;

    await manager.reset();
    this.instances.delete(guild);
  }

  has(guild: Guild): boolean {
    return this.instances.has(guild);
  }

  disposeAll(): void {
    this.instances = new WeakMap();
  }
}
