const { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');

class musicEmbedUI{
    static skipButton = new ButtonBuilder()
			.setCustomId('skipButton')
			.setLabel('Skip')
			.setStyle(ButtonStyle.Secondary)
            .setEmoji("⏭️")

    static pauseButton = new ButtonBuilder()
			.setCustomId('pauseButton')
			.setLabel('Pause')
			.setStyle(ButtonStyle.Secondary)
            .setEmoji("⏸️");

    static resumeButton = new ButtonBuilder()
			.setCustomId('resumeButton')
			.setLabel('Resume')
			.setStyle(ButtonStyle.Secondary)
            .setEmoji("▶️")

    static exitButton = new ButtonBuilder()
			.setCustomId('exitButton')
			.setLabel('Exit')
			.setStyle(ButtonStyle.Danger)
            .setEmoji("⏹️")


    /**
     * Returns UI components
     */        
    constructor(){
        return new ActionRowBuilder()
			.addComponents(musicEmbedUI.skipButton,musicEmbedUI.pauseButton, musicEmbedUI.resumeButton,musicEmbedUI.exitButton);
    }

}

module.exports={musicEmbedUI}