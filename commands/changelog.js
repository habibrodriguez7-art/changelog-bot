const { SlashCommandBuilder, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('changelog')
        .setDescription('Kirim pesan changelog/update ke channel yang dipilih')
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('Channel tujuan pengiriman changelog')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
        )
        .addRoleOption(option =>
            option
                .setName('role_ping')
                .setDescription('Role yang akan di-mention (opsional)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

        // Simpan channel & role ke custom ID agar bisa diambil saat modal submit
        const channel = interaction.options.getChannel('channel');
        const role = interaction.options.getRole('role_ping');

        const customId = `changelog_modal_${channel.id}_${role ? role.id : 'none'}`;

        const modal = new ModalBuilder()
            .setCustomId(customId)
            .setTitle('📝 Buat Changelog');

        // Field 1: Judul (e.g. "Update Games")
        const titleInput = new TextInputBuilder()
            .setCustomId('changelog_title')
            .setLabel('Judul')
            .setPlaceholder('Contoh: Update Games')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100);

        // Field 2: Nama Project & Versi
        const projectInput = new TextInputBuilder()
            .setCustomId('changelog_project')
            .setLabel('Nama Project & Versi')
            .setPlaceholder('Contoh: Fish It [v1.1.2] [Major Added]')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(200);

        // Field 3: Changelog (multi-line)
        const changelogInput = new TextInputBuilder()
            .setCustomId('changelog_changes')
            .setLabel('Daftar Perubahan')
            .setPlaceholder('[-] Removed feature\n[/] Fixed bug\n[+] Added feature')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(2000);

        // Field 4: Footer (optional)
        const footerInput = new TextInputBuilder()
            .setCustomId('changelog_footer')
            .setLabel('Footer / Teks Tambahan (opsional)')
            .setPlaceholder('Teks tambahan di bagian bawah...')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(1000);

        // Tambahkan ke modal
        modal.addComponents(
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(projectInput),
            new ActionRowBuilder().addComponents(changelogInput),
            new ActionRowBuilder().addComponents(footerInput)
        );

        await interaction.showModal(modal);
    }
};
