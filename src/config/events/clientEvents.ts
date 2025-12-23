import { REST, Events } from "discord.js";
import { Routes } from "discord-api-types/v10";
import type { Services } from "../../di/container.js";
import type { BotClient } from "../../types/bot.js";

export function registerClientEvents(
  client: BotClient,
  token: string,
  clientId: string,
  services: Services
) {
  client.once(Events.ClientReady, async readyClient => {
    console.log("The bot " + readyClient.user.tag + " is ready.");

    const guilds = client.guilds.cache.map(guild => ({
      id: guild.id,
      name: guild.name
    }));

    const rest = new REST({ version: "10" }).setToken(token);

    for (const { id, name } of guilds) {
      rest
        .put(Routes.applicationGuildCommands(clientId, id), {
          body: client.commandData
        })
        .then(() => console.log(`Added commands to ${name} (${id})`))
        .catch(error => console.error(`Failed to add commands to: ${name} (${id})`, error));
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

    if (interaction.isButton()) {
      const guildManager = services.guildManagers.get(guild, interaction);
      const ReplyControll = guildManager.repliesController;

      try {
        await ReplyControll.buttonClick(interaction, client, guildManager.musicController);
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
