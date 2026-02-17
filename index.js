require('dotenv').config();
const { Client, GatewayIntentBits, Collection, EmbedBuilder, Events, MessageFlags } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

// Inisialisasi Gemini AI
let genAI = null;
let geminiModel = null;
if (process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    geminiModel = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        tools: [{ googleSearch: {} }],
    });
}

// ═══════════════════════════════════════════
//  Inisialisasi Bot
// ═══════════════════════════════════════════

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
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
            console.log(`Command loaded: /${command.data.name}`);
        }
    }
}

// ═══════════════════════════════════════════
//  Event: Bot Ready
// ═══════════════════════════════════════════

client.once(Events.ClientReady, (readyClient) => {
    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║     Changelog Bot - Online!              ║');
    console.log(`║     Logged in as: ${readyClient.user.tag.padEnd(22)}║`);
    console.log(`║     Servers: ${String(readyClient.guilds.cache.size).padEnd(27)}║`);
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
});

// ═══════════════════════════════════════════
//  Event: Interaction Handler
// ═══════════════════════════════════════════

client.on(Events.InteractionCreate, async (interaction) => {
    // Handle Slash Commands
    if (interaction.isChatInputCommand()) {
        // Handle /ask command khusus
        if (interaction.commandName === 'ask') {
            await handleAskCommand(interaction);
            return;
        }

        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`Error executing /${interaction.commandName}:`, error);
            const reply = { content: 'Terjadi error saat menjalankan command.', flags: MessageFlags.Ephemeral };
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
            console.error('Error handling modal:', error);
            const reply = { content: 'Terjadi error saat mengirim changelog.', flags: MessageFlags.Ephemeral };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(reply);
            } else {
                await interaction.reply(reply);
            }
        }
    }
});

// ═══════════════════════════════════════════
//  Handler: /ask Command (Gemini AI + Search)
// ═══════════════════════════════════════════

async function handleAskCommand(interaction) {
    if (!geminiModel) {
        return interaction.reply({
            content: 'Gemini AI belum dikonfigurasi. Tambahkan GEMINI_API_KEY di environment variables.',
            flags: MessageFlags.Ephemeral
        });
    }

    const question = interaction.options.getString('pertanyaan');
    await interaction.deferReply();

    try {
        const result = await geminiModel.generateContent(question);
        const response = result.response.text() || 'Tidak ada jawaban.';

        // Cek apakah Gemini menggunakan Google Search
        const groundingMetadata = result.response.candidates?.[0]?.groundingMetadata;
        const usedSearch = groundingMetadata?.searchEntryPoint || groundingMetadata?.groundingChunks?.length > 0;

        // Discord embed max 4096 chars
        const trimmed = response.length > 4000
            ? response.substring(0, 4000) + '\n\n... (terpotong)'
            : response;

        const embed = new EmbedBuilder()
            .setTitle(question.length > 256 ? question.substring(0, 253) + '...' : question)
            .setDescription(trimmed)
            .setColor(0x4285F4)
            .setFooter({ text: `Dijawab oleh Gemini AI${usedSearch ? ' 🔍 + Google Search' : ''} | Ditanya oleh ${interaction.user.username}` })
            .setTimestamp();

        // Tambahkan sumber dari Google Search jika ada
        if (groundingMetadata?.groundingChunks?.length > 0) {
            const sources = groundingMetadata.groundingChunks
                .filter(chunk => chunk.web?.uri)
                .slice(0, 3)
                .map(chunk => `[${chunk.web.title || 'Sumber'}](${chunk.web.uri})`)
                .join(' • ');
            if (sources) {
                embed.addFields({ name: '🔗 Sumber', value: sources });
            }
        }

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error Gemini AI:', error.message);
        await interaction.editReply({
            content: `Gagal mendapatkan jawaban dari AI: ${error.message}`
        });
    }
}

// ═══════════════════════════════════════════
//  Helper: Auto-resolve @username → <@userId>
// ═══════════════════════════════════════════

async function resolveUserMentions(text, guild) {
    if (!text || !guild) return text;
    // Cari semua pattern @username
    const mentions = text.match(/@([\w.]+)/g);
    if (!mentions) return text;

    let result = text;
    for (const mention of mentions) {
        const username = mention.slice(1); // Hapus @ di depan
        try {
            // Search member by username (hemat RAM, tidak load semua member)
            const members = await guild.members.search({ query: username, limit: 1 });
            const member = members.first();
            if (member && (
                member.user.username.toLowerCase() === username.toLowerCase() ||
                (member.nickname && member.nickname.toLowerCase() === username.toLowerCase()) ||
                (member.user.globalName && member.user.globalName.toLowerCase() === username.toLowerCase())
            )) {
                result = result.replace(mention, `<@${member.id}>`);
            }
        } catch (e) {
            // Skip jika gagal search
        }
    }
    return result;
}

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

        console.log(`Processing changelog - Channel: ${channelId}, Role: ${roleId}`);

        // Ambil data dari modal
        let title = interaction.fields.getTextInputValue('changelog_title');
        let project = interaction.fields.getTextInputValue('changelog_project');
        let changes = interaction.fields.getTextInputValue('changelog_changes');
        let footer = interaction.fields.getTextInputValue('changelog_footer') || '';

        console.log(`Title: ${title}, Project: ${project}`);

        // Ambil channel langsung via client (lebih reliable)
        const channel = await interaction.client.channels.fetch(channelId);
        if (!channel) {
            return interaction.editReply({ content: 'Channel tidak ditemukan.' });
        }

        console.log(`Channel found: #${channel.name}`);

        // Auto-resolve @username menjadi mention Discord
        const guild = interaction.guild || await interaction.client.guilds.fetch(channel.guildId);
        if (guild) {
            title = await resolveUserMentions(title, guild);
            project = await resolveUserMentions(project, guild);
            changes = await resolveUserMentions(changes, guild);
            footer = await resolveUserMentions(footer, guild);
        }

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
        description += `**${title}**\n`;
        description += `${project}\n`;
        description += `─\n`;
        description += `${changes}\n`;
        description += `─`;

        if (footer.trim()) {
            description += `\n${footer}`;
        }

        description += `\n${timestamp}`;

        // Buat embed
        const embed = new EmbedBuilder()
            .setDescription(description)
            .setColor(0xFF8C00); // Warna orange

        // Kirim pesan
        const messageContent = {};

        // Tambahkan role mention di atas embed jika ada
        if (roleId) {
            messageContent.content = `<@&${roleId}>`;
        }

        messageContent.embeds = [embed];

        await channel.send(messageContent);

        await interaction.editReply({
            content: `Changelog berhasil dikirim ke ${channel}.`
        });

        console.log(`Changelog sent to #${channel.name} by ${interaction.user.tag}`);
    } catch (err) {
        console.error('Detail error:', err.message);
        console.error(err.stack);
        throw err;
    }
}

// ═══════════════════════════════════════════
//  Login
// ═══════════════════════════════════════════

if (!process.env.DISCORD_TOKEN || process.env.DISCORD_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
    console.error('');
    console.error('ERROR: Bot token belum dikonfigurasi!');
    console.error('   Buka file .env dan isi DISCORD_TOKEN dengan token bot Anda.');
    console.error('   Dapatkan token di: https://discord.com/developers/applications');
    console.error('');
    process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
