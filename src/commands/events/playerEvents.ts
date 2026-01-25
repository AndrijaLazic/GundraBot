import type { Player } from "discord-player";
import type { Guild } from "discord.js";
import type { Services } from "../../di/container.js";

export function registerPlayerEvents(player: Player, services: Services) {
  const logger = services.logger.child({ component: "playerEvents" });

  player.events.on("disconnect", queue => {
    const guild = queue.guild as unknown as Guild;
    // void services.guildManagers.reset(guild);
    logger.info("Player disconnected", { guildId: guild.id, guildName: guild.name });
  });

  player.events.on("playerStart", (queue, track) => {
    const guild = queue.guild as unknown as Guild;
    const guildManager = services.guildManagers.get(guild);
    const musicEmbed = guildManager.musicEmbed;
    try {
      musicEmbed.updateCurrentEmbedWithSong(track);
    } catch (e) {
      logger.error("Failed to update music embed on playerStart", e);
    }
  });

  player.events.on("error", e => logger.error("Player error", e));
}
