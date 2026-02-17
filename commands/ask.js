const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ask')
        .setDescription('Tanya Lynx AI apapun')
        .addStringOption(option =>
            option
                .setName('pertanyaan')
                .setDescription('Pertanyaan yang ingin ditanyakan ke AI')
                .setRequired(true)
        ),

    async execute(interaction) {
        // Handled in index.js
    }
};
