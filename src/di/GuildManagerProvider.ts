import type { Guild } from "discord.js";
import type { BotInteraction } from "../types/command.js";
import { ServerGuildManager } from "../guild/ServerGuildManager.js";
import type { MusicManager } from "../music/MusicManager.js";

export type GuildManagerFactoryDeps = {
  createMusic: (guild: Guild) => MusicManager;
  logger?: Console;
};

export class GuildManagerProvider {
  private instances = new WeakMap<Guild, ServerGuildManager>();
  private logger: Console;

  constructor(private deps: GuildManagerFactoryDeps) {
    this.logger = deps.logger ?? console;
  }

  get(guild: Guild, interaction: BotInteraction | null = null): ServerGuildManager {
    let manager = this.instances.get(guild);

    if (!manager) {
      console.log("Creating ServerGuildManager for:" + guild.name);

      const music = this.deps.createMusic(guild);

      manager = new ServerGuildManager(guild, interaction, 
        music,
        this.logger,
        () => this.instances.delete(guild),
      );

      this.instances.set(guild, manager);
    } else if (interaction) {
      console.log("ServerGuildManager for guild " + guild.name + " already exists");
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
