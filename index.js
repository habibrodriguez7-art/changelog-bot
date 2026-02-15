require('dotenv').config();
const { Client, GatewayIntentBits, Collection, EmbedBuilder, Events, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════
//  Inisialisasi Bot
// ═══════════════════════════════════════════

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
    ]
});

// Load commands
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');

if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const command = require(path.join(commandsPath, file));
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            console.log(`✅ Command loaded: /${command.data.name}`);
        }
    }
}

// ═══════════════════════════════════════════
//  Event: Bot Ready
// ═══════════════════════════════════════════

client.once(Events.ClientReady, (readyClient) => {
    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║     📋 Changelog Bot - Online!           ║');
    console.log(`║     🤖 Logged in as: ${readyClient.user.tag.padEnd(19)}║`);
    console.log(`║     📡 Servers: ${String(readyClient.guilds.cache.size).padEnd(24)}║`);
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
});

// ═══════════════════════════════════════════
//  Event: Interaction Handler
// ═══════════════════════════════════════════

client.on(Events.InteractionCreate, async (interaction) => {
    // Handle Slash Commands
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`❌ Error executing /${interaction.commandName}:`, error);
            const reply = { content: '❌ Terjadi error saat menjalankan command!', flags: MessageFlags.Ephemeral };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(reply);
            } else {
                await interaction.reply(reply);
            }
        }
        return;
    }

    // Handle Modal Submits (Changelog)
    if (interaction.isModalSubmit() && interaction.customId.startsWith('changelog_modal_')) {
        try {
            await handleChangelogModal(interaction);
        } catch (error) {
            console.error('❌ Error handling modal:', error);
            const reply = { content: '❌ Terjadi error saat mengirim changelog!', flags: MessageFlags.Ephemeral };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(reply);
            } else {
                await interaction.reply(reply);
            }
        }
    }
});

// ═══════════════════════════════════════════
//  Handler: Changelog Modal Submit
// ═══════════════════════════════════════════

async function handleChangelogModal(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        // Parse channel & role dari custom ID
        // Format: changelog_modal_{channelId}_{roleId|none}
        const parts = interaction.customId.split('_');
        const channelId = parts[2];
        const roleId = parts[3] !== 'none' ? parts[3] : null;

        console.log(`📋 Processing changelog - Channel: ${channelId}, Role: ${roleId}`);

        // Ambil data dari modal
        const title = interaction.fields.getTextInputValue('changelog_title');
        const project = interaction.fields.getTextInputValue('changelog_project');
        const changes = interaction.fields.getTextInputValue('changelog_changes');
        const footer = interaction.fields.getTextInputValue('changelog_footer') || '';

        console.log(`📋 Title: ${title}, Project: ${project}`);

        // Ambil channel langsung via client (lebih reliable)
        const channel = await interaction.client.channels.fetch(channelId);
        if (!channel) {
            return interaction.editReply({ content: '❌ Channel tidak ditemukan!' });
        }

        console.log(`📋 Channel found: #${channel.name}`);

        // Format timestamp
        const now = new Date();
        const timestamp = now.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }) + ' ' + now.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        // Build embed description
        let description = '';
        description += `**${title}**\n\n`;
        description += `${project}\n\n`;
        description += `─\n\n`;
        description += `${changes}\n\n`;
        description += `─`;

        if (footer.trim()) {
            description += `\n\n${footer}`;
        }

        description += `\n\n${timestamp}`;

        // Buat embed
        const embed = new EmbedBuilder()
            .setDescription(description)
            .setColor(0x2B2D31); // Warna gelap seperti di contoh

        // Kirim pesan
        const messageContent = {};

        // Tambahkan role mention jika ada
        if (roleId) {
            messageContent.content = `<@&${roleId}>`;
        }

        messageContent.embeds = [embed];

        await channel.send(messageContent);

        await interaction.editReply({
            content: `✅ Changelog berhasil dikirim ke ${channel}!`
        });

        console.log(`📋 Changelog sent to #${channel.name} by ${interaction.user.tag}`);
    } catch (err) {
        console.error('❌ Detail error:', err.message);
        console.error(err.stack);
        throw err;
    }
}

// ═══════════════════════════════════════════
//  Login
// ═══════════════════════════════════════════

if (!process.env.DISCORD_TOKEN || process.env.DISCORD_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
    console.error('');
    console.error('❌ ERROR: Bot token belum dikonfigurasi!');
    console.error('   Buka file .env dan isi DISCORD_TOKEN dengan token bot Anda.');
    console.error('   Dapatkan token di: https://discord.com/developers/applications');
    console.error('');
    process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
