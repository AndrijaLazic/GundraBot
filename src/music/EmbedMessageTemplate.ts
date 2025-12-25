import type { APIEmbed } from "discord.js";

export const createMusicMessageEmbed = (): APIEmbed => ({
  color: 0x0099ff,
  title: "GundraBot",
  url: "https://github.com/AndrijaLazic/GundraBot",
  author: {
    name: "AndrijaLazic",
    icon_url: "https://avatars.githubusercontent.com/u/126291636?s=48&v=4",
    url: "https://github.com/AndrijaLazic"
  },
  description: "Bot made for personal use",
  fields: [
    {
      name: "Now playing:",
      value: "Some value here"
    }
  ],
  image: {
    url: "https://i.imgur.com/AfFp7pu.png"
  },
  timestamp: new Date().toISOString(),
  footer: {
    text: "",
    icon_url: "https://i.imgur.com/AfFp7pu.png"
  }
});
