import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export class MusicEmbedUI extends ActionRowBuilder<ButtonBuilder> {
  constructor() {
    super();
    this.addComponents(
      new ButtonBuilder().setCustomId("skipButton").setLabel("Skip").setStyle(ButtonStyle.Secondary).setEmoji("⏭️"),
      new ButtonBuilder().setCustomId("pauseButton").setLabel("Pause").setStyle(ButtonStyle.Secondary).setEmoji("⏸️"),
      new ButtonBuilder().setCustomId("resumeButton").setLabel("Resume").setStyle(ButtonStyle.Secondary).setEmoji("▶️"),
      new ButtonBuilder().setCustomId("exitButton").setLabel("Exit").setStyle(ButtonStyle.Danger).setEmoji("🛑")
    );
  }
}
