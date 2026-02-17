require('dotenv').config();
const { Client, GatewayIntentBits, Collection, EmbedBuilder, Events, MessageFlags } = require('discord.js');
const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');

// Inisialisasi Groq AI
let groq = null;
if (process.env.GROQ_API_KEY) {
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
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
//  Helper: DuckDuckGo Web Search (Direct HTML)
// ═══════════════════════════════════════════

async function searchWeb(query, maxResults = 5) {
    try {
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `q=${encodeURIComponent(query)}`,
        });

        if (!response.ok) {
            console.error('Search HTTP error:', response.status);
            return null;
        }

        const html = await response.text();
        const results = [];

        // Parse snippets from DuckDuckGo HTML
        const snippetRegex = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
        const titleRegex = /class="result__a"[^>]*>([\s\S]*?)<\/a>/g;
        const urlRegex = /class="result__url"[^>]*>([\s\S]*?)<\/a>/g;

        // Get all titles
        const titles = [];
        let m;
        while ((m = titleRegex.exec(html)) !== null) {
            titles.push(m[1].replace(/<[^>]*>/g, '').trim());
        }

        // Get all snippets
        const snippets = [];
        while ((m = snippetRegex.exec(html)) !== null) {
            snippets.push(m[1].replace(/<[^>]*>/g, '').trim());
        }

        // Get all URLs
        const urls = [];
        while ((m = urlRegex.exec(html)) !== null) {
            urls.push(m[1].replace(/<[^>]*>/g, '').trim());
        }

        // Combine results
        const count = Math.min(maxResults, titles.length, snippets.length);
        for (let i = 0; i < count; i++) {
            results.push(`[${i + 1}] ${titles[i]}\n${snippets[i]}${urls[i] ? '\nSource: ' + urls[i] : ''}`);
        }

        if (results.length === 0) {
            console.log('[SEARCH] No results parsed from HTML');
            return null;
        }

        console.log(`[SEARCH] Found ${results.length} results`);
        return results.join('\n\n');
    } catch (error) {
        console.error('Web search error:', error.message);
        return null;
    }
}

// ═══════════════════════════════════════════
//  Handler: /ask Command (Groq AI + Web Search)
// ═══════════════════════════════════════════

async function handleAskCommand(interaction) {
    if (!groq) {
        return interaction.reply({
            content: 'Groq AI belum dikonfigurasi. Tambahkan GROQ_API_KEY di environment variables.',
            flags: MessageFlags.Ephemeral
        });
    }

    const question = interaction.options.getString('pertanyaan');
    await interaction.deferReply();

    try {
        // Step 1: Search web dulu untuk data terbaru
        console.log(`[ASK] Searching web for: ${question}`);
        const searchResults = await searchWeb(question);

        // Step 2: Build system prompt dengan tanggal hari ini + hasil search
        const today = new Date().toLocaleDateString('id-ID', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        let systemPrompt = `Kamu adalah asisten AI yang helpful dan up-to-date. Hari ini adalah ${today}.`;
        systemPrompt += ` Jawab dalam bahasa yang sama dengan pertanyaan user (jika Bahasa Indonesia, jawab dalam Bahasa Indonesia).`;

        let userMessage = question;

        if (searchResults) {
            systemPrompt += `\n\nBerikut adalah hasil pencarian web terbaru yang relevan. Gunakan informasi ini untuk memberikan jawaban yang akurat dan up-to-date. Jika informasi dari web bertentangan dengan knowledge kamu, prioritaskan informasi dari web karena lebih baru. Selalu sebutkan sumber jika memungkinkan.`;
            userMessage = `Pertanyaan: ${question}\n\n--- Hasil Pencarian Web ---\n${searchResults}\n--- Akhir Hasil Pencarian ---\n\nBerdasarkan informasi di atas dan pengetahuanmu, jawab pertanyaan tersebut secara lengkap dan akurat.`;
            console.log(`[ASK] Web search found results, using as context`);
        } else {
            systemPrompt += `\n\nJika kamu tidak yakin dengan jawaban atau informasinya mungkin sudah berubah, sampaikan bahwa jawabanmu mungkin tidak up-to-date.`;
            console.log(`[ASK] No web search results, answering from knowledge`);
        }

        // Step 3: Kirim ke Groq dengan konteks web
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
            ],
            model: 'llama-3.3-70b-versatile',
            max_tokens: 2048,
        });

        const response = chatCompletion.choices[0]?.message?.content || 'Tidak ada jawaban.';

        // Discord embed max 4096 chars
        const trimmed = response.length > 4000
            ? response.substring(0, 4000) + '\n\n... (terpotong)'
            : response;

        const embed = new EmbedBuilder()
            .setTitle(question.length > 256 ? question.substring(0, 253) + '...' : question)
            .setDescription(trimmed)
            .setColor(0xF55036)
            .setFooter({ text: `Dijawab oleh Groq AI ${searchResults ? '🌐 + Web Search' : '🧠'} | Ditanya oleh ${interaction.user.username}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error Groq AI:', error.message);
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
