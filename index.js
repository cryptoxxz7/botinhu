const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app = express();
const port = process.env.PORT || 3000;

// === Início do seu bot WhatsApp ===

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

let clientReady = false;

const seuNumero = '13988755893@c.us';

const gruposPermitidos = [
  '120363403199317276@g.us',
  '120363351699706014@g.us',
];

client.on('qr', (qr) => {
  console.clear();
  console.log('QR para escanear:\n');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('✅ Bot ativo!');
  clientReady = true;

  setTimeout(() => {
    client.sendMessage(seuNumero, '!help');
  }, 2000);
});

client.on('message', async (msg) => {
  if (msg.fromMe) return;

  const chat = await msg.getChat();
  const chatId = chat?.id?._serialized;

  if (chat.isGroup && gruposPermitidos.includes(chatId)) {
    const text = msg.body.trim().toLowerCase();
    if (text === '#regras') {
      return msg.reply('📌 Regras do grupo...');
    }

    if (text === '!help') {
      return msg.reply('🤖 *Comandos:*\n!help - ajuda\n#regras - regras do grupo');
    }
  } else if (!chat.isGroup && msg.body.trim().toLowerCase() === '!help') {
    return msg.reply('🤖 *Comandos:*\n!help - ajuda\n#regras - regras do grupo');
  }
});

client.initialize();

// === Express só pra manter o Render vivo ===
app.get('/', (req, res) => {
  res.send('🤖 Bot WhatsApp está rodando.');
});

app.listen(port, () => {
  console.log(`Servidor web no ar na porta ${port} (Render ativo)`);
});
