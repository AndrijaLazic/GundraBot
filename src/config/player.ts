import { DefaultExtractors } from "@discord-player/extractor";
import { Player } from "discord-player";
import { YoutubeiExtractor } from "discord-player-youtubei";
import type { BotClient } from "../types/bot.js";

export function createPlayer(client: BotClient) {
  const player = new Player(client as any, {
    ytdlOptions: {
      quality: "highest",
      highWaterMark: 2000000
    }
  } as any);

  player.extractors.loadMulti(DefaultExtractors);
  // player.extractors.register(YoutubeiExtractor, {});

  return player;
}
