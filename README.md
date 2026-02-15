# 📋 Changelog Bot

Bot Discord untuk mengirim pesan changelog/update yang terformat rapi ke channel Discord.

## 🚀 Setup

### 1. Buat Bot di Discord Developer Portal

1. Buka [Discord Developer Portal](https://discord.com/developers/applications)
2. Klik **"New Application"** → beri nama bot → **Create**
3. Di menu **Bot**:
   - Klik **"Reset Token"** → **Copy** token bot (simpan baik-baik!)
   - Aktifkan **Message Content Intent** (opsional)
4. Di menu **OAuth2**:
   - Copy **Client ID** (Application ID)
5. Di menu **OAuth2 → URL Generator**:
   - Centang: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Embed Links`, `Mention Everyone`
   - Copy URL yang dihasilkan → buka di browser → invite bot ke server

### 2. Konfigurasi

Edit file `.env`:

```env
DISCORD_TOKEN=paste_token_bot_disini
CLIENT_ID=paste_client_id_disini
GUILD_ID=paste_server_id_disini
```

> Untuk mendapatkan **Guild ID**: Aktifkan Developer Mode di Discord (Settings → Advanced → Developer Mode), lalu klik kanan nama server → Copy Server ID.

### 3. Install & Jalankan

```bash
# Install dependencies
npm install

# Daftarkan slash commands
npm run deploy

# Jalankan bot
npm start
```

## 📖 Cara Penggunaan

1. Ketik `/changelog` di Discord
2. Pilih **channel** tujuan
3. (Opsional) Pilih **role** untuk di-mention
4. Isi form yang muncul:
   - **Judul**: Contoh → `Update Games`
   - **Nama Project & Versi**: Contoh → `Fish It [v1.1.2] [Major Added]`
   - **Daftar Perubahan**: Gunakan format:
     - `[-]` untuk removed
     - `[/]` untuk fixed/changed
     - `[+]` untuk added
   - **Footer**: Teks tambahan (opsional)
5. Submit → pesan terformat akan dikirim ke channel yang dipilih!

## 📝 Format Output

```
@Role Mention

**Update Games**

Fish It [v1.1.2] [Major Added]

─

[-] Remove Blatant (patched Method)
[/] Add Back Input on webhook
[/] Fixed Webhook not sending
[+] Add New Place Teleported

─

Footer text...

15/02/2026 06:54
```
