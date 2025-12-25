import type { Track } from "discord-player";
import type { APIEmbed } from "discord.js";
import { MusicEmbedUI } from "./ButtonsUI.js";
import { createMusicMessageEmbed } from "./EmbedMessageTemplate.js";
import type { BotInteraction } from "../types/command.js";
import type { TrackInfo } from "./MusicManager.js";

type MusicEmbedOptions = {
  interaction?: BotInteraction | null;
};

export class MusicEmbed {
  private interaction: BotInteraction | null;
  private currentEmbed: APIEmbed;

  constructor(options: MusicEmbedOptions = {}) {
    this.interaction = options.interaction ?? null;
    this.currentEmbed = createMusicMessageEmbed();
  }

  setInteraction(interaction: BotInteraction | null) {
    this.interaction = interaction;
  }

  songToEmbed(song: Track | TrackInfo) {
    if (!this.currentEmbed.fields) this.currentEmbed.fields = [];

    if (!this.currentEmbed.fields[0]) {
      this.currentEmbed.fields[0] = { name: "Now playing:", value: song.title };
    } else {
      this.currentEmbed.fields[0].value = song.title;
    }

    const rawThumbnail = (song as Track)?.raw as Record<string, any> | undefined;
    const thumbnailUrl =
      rawThumbnail?.thumbnail?.url ?? (song as TrackInfo)?.thumbnailUrl ?? "";

    this.currentEmbed.image = { url: thumbnailUrl };

    return this.currentEmbed;
  }

  getMusicUI() {
    return new MusicEmbedUI();
  }

  updateCurrentEmbedWithSong(song: Track | TrackInfo) {
    if (!this.interaction) throw new Error("There is no interaction to update");

    // editReply works for both deferred and replied interactions
    if (!this.interaction.deferred && !this.interaction.replied) {
      throw new Error("Cannot update interaction before replying/defering it");
    }

    const musicMessageEmbed = this.songToEmbed(song);
    const replyObject = {
      embeds: [musicMessageEmbed],
      components: [new MusicEmbedUI()]
    };

    return this.interaction.editReply(replyObject as any);
  }

  async shutdown() {
    if (this.interaction && (this.interaction.deferred || this.interaction.replied)) {
      await this.interaction.deleteReply().catch(() => {});
    }
    this.interaction = null;
  }
}
