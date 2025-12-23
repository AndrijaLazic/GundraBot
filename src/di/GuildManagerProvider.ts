import type { Guild } from "discord.js";
import type { BotInteraction } from "../types/command.js";
import { ServerGuildManager, type GuildLock } from "../guild/ServerGuildManager.js";
import type { MusicManager } from "../music/MusicManager.js";
import type { ReplyControll } from "../reply/ReplyControll.js";

export type GuildManagerFactoryDeps = {
  createLock: () => GuildLock;
  createReplies: (interaction: BotInteraction | null) => ReplyControll;
  createMusic: (guild: Guild, lock: GuildLock) => MusicManager;
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

      const lock = this.deps.createLock();
      const replies = this.deps.createReplies(interaction);
      const music = this.deps.createMusic(guild, lock);

      manager = new ServerGuildManager(guild, interaction, 
        lock,
        replies,
        music,
        this.logger,
        () => this.instances.delete(guild),
      );

      this.instances.set(guild, manager);
    } else if (interaction) {
      console.log("ServerGuildManager for guild " + guild.name + " already exists");
      manager.repliesController.setInteraction(interaction);
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
