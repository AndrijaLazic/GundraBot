import type { Player } from "discord-player";
import type { Guild } from "discord.js";
import type { Services } from "../../di/container.js";

export function registerPlayerEvents(player: Player, services: Services) {
  player.events.on("disconnect", queue => {
    const guild = queue.guild as unknown as Guild;
    // void services.guildManagers.reset(guild);
    console.log("Disconnected player from guild:" + guild);
  });

  player.events.on("playerStart", (queue, track) => {
    const guild = queue.guild as unknown as Guild;
    const guildManager = services.guildManagers.get(guild);
    const musicEmbed = guildManager.musicEmbed;
    try {
      musicEmbed.updateCurrentEmbedWithSong(track);
    } catch (e) {
      console.log(e);
    }
  });

  player.events.on("error", e => console.error("PLAYER ERROR", e));
}
