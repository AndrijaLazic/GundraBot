import { REST, Events } from "discord.js";
import { Routes } from "discord-api-types/v10";
import type { Player } from "discord-player";
import { replyControll } from "../replyFolder/replyControll.js";
import type { BotClient } from "../types/bot.js";

export function registerPlayerEvents(player: Player) {
  player.events.on("disconnect", queue => {
    replyControll.resetInstance(queue.guild);
    console.log("Disconnected from guild:" + queue.guild);
  });

  player.events.on("playerStart", (queue, track) => {
    const ReplyControll = replyControll.getInstance(queue.guild);
    try {
      ReplyControll.updateCurrentEmbedWithSong(track);
    } catch (e) {
      console.log(e);
    }
  });

  player.events.on("error", e => console.error("PLAYER ERROR", e));
}

export function registerClientEvents(client: BotClient, token: string, clientId: string) {
  client.once(Events.ClientReady, async readyClient => {
    console.log("The bot " + readyClient.user.tag + " is ready.");
    const guildIds = client.guilds.cache.map(guild => guild.id);
    const rest = new REST({ version: "10" }).setToken(token);

    for (const guildID of guildIds) {
      rest
        .put(Routes.applicationGuildCommands(clientId, guildID), {
          body: client.commandData
        })
        .then(() => console.log(`Added commands to ${guildID}`))
        .catch(error => console.error("Failed to add commands to:" + guildID, error));
    }
  });

  client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.inCachedGuild()) {
      return;
    }

    const guild = interaction.guild;
    if (!guild) {
      return;
    }

    const ReplyControll = replyControll.getInstance(guild, interaction);

    if (interaction.isButton()) {
      try {
        await ReplyControll.buttonClick(interaction, client);
      } catch (e) {
        console.log(e);
        await interaction.reply({ content: "There was an error executing this command" });
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute({ client, interaction });
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: "There was an error executing this command" });
    }
  });

  client.once("reconnecting", message => {
    console.log("Reconnecting!" + message);
  });

  client.on("disconnect", message => {
    console.log("Disconnect!" + message);
  });
}
