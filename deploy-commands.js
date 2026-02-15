require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════
//  Deploy Slash Commands ke Discord API
// ═══════════════════════════════════════════

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if ('data' in command) {
        commands.push(command.data.toJSON());
        console.log(`📦 Loaded command: /${command.data.name}`);
    }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('');
        console.log(`🔄 Mendaftarkan ${commands.length} slash command(s)...`);

        if (process.env.GUILD_ID && process.env.GUILD_ID !== 'YOUR_GUILD_ID_HERE') {
            // Deploy ke guild tertentu (instant, untuk development)
            const data = await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commands },
            );
            console.log(`✅ Berhasil mendaftarkan ${data.length} command(s) ke guild!`);
        } else {
            // Deploy global (bisa sampai 1 jam untuk update)
            const data = await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands },
            );
            console.log(`✅ Berhasil mendaftarkan ${data.length} command(s) secara global!`);
            console.log('⏳ Command global bisa memakan waktu hingga 1 jam untuk muncul.');
        }

        console.log('');
    } catch (error) {
        console.error('❌ Error mendaftarkan commands:', error);
    }
})();
