const express = require('express');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

let clientReady = false;
let qrCodeData = null; // Armazena o QR para mostrar na página

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

const gruposPermitidos = [
  '120363403199317276@g.us',
  '120363351699706014@g.us',
];

const avisados = {};
const seuNumero = '13988755893@c.us';

client.on('qr', (qr) => {
  qrcode.toDataURL(qr, (err, url) => {
    if (err) return console.error(err);
    qrCodeData = url;
    console.log('QR code gerado, acesse a página para escanear!');
  });
});

client.on('ready', () => {
  console.log('Shellzinha Private ON');
  qrCodeData = null;
  clientReady = true;

  // Inicia os intervalos somente quando o client estiver pronto
  iniciarIntervalos();
});

// ========== FUNÇÕES E EVENTOS ==========
// (Aqui você pode manter todas suas funções: moderarMensagem, handleCommands, comandos, regras, etc.)
// Copiei direto do seu código, sem alterar nada do seu funcionamento

const regrasDoGrupo = `📌 *REGRAS DO GRUPO:*
1️⃣ Sem *links*, *fotos* ou *vídeos*.
2️⃣ Permitido: *áudios*, *stickers* e *textos* (máx. 35 palavras).
3️⃣ Regras ignoradas = *banimento* após 1 aviso.
4️⃣ Mantenha o respeito e evite spam.
Obrigado por colaborar.
`;

// Supondo que você tenha essas funções implementadas no seu código original:
async function moderarMensagem(msg) {
  // seu código de moderação aqui
}
async function handleCommands(msg) {
  // seu código de comandos aqui
}

client.on('message', async msg => {
  const chat = await msg.getChat();
  if (!chat.isGroup || !gruposPermitidos.includes(chat.id._serialized)) return;

  const text = msg.body.trim().toLowerCase();
  if (text === '#regras') return chat.sendMessage(regrasDoGrupo);
  if (msg.fromMe) return;

  await moderarMensagem(msg);
  await handleCommands(msg);
});

client.on('message_create', async msg => {
  if (!msg.fromMe) return;
  const chat = await msg.getChat();
  if (!chat.isGroup || !gruposPermitidos.includes(chat.id._serialized)) return;
  await handleCommands(msg);
});

// Grupo por horário
const horarioFechar = { hora: 4, minuto: 0 };
const horarioAbrir = { hora: 8, minuto: 0 };
let ultimoFechamento = null;
let ultimaAbertura = null;

function agoraEhHorario(horario) {
  const agora = new Date();
  return agora.getHours() === horario.hora && agora.getMinutes() === horario.minuto;
}

async function gerenciarGrupoPorHorario() {
  if (!clientReady) return;

  const chats = await client.getChats();
  for (const chat of chats) {
    if (!chat.isGroup || !gruposPermitidos.includes(chat.id._serialized)) continue;

    const agora = new Date();
    const chaveChat = chat.id._serialized;

    if (agoraEhHorario(horarioFechar) && ultimoFechamento !== chaveChat + agora.getDate()) {
      try {
        await chat.setMessagesAdminsOnly(true);
        await chat.sendMessage('🔒 Grupo fechado automaticamente. Retornamos às 08:00.');
        ultimoFechamento = chaveChat + agora.getDate();
      } catch (err) {
        console.log('Erro ao fechar grupo:', err);
      }
    }

    if (agoraEhHorario(horarioAbrir) && ultimaAbertura !== chaveChat + agora.getDate()) {
      try {
        await chat.setMessagesAdminsOnly(false);
        await chat.sendMessage('🔓 Grupo aberto novamente. Bom dia a todos!');
        ultimaAbertura = chaveChat + agora.getDate();
      } catch (err) {
        console.log('Erro ao abrir grupo:', err);
      }
    }
  }
}

// Função para iniciar os intervalos APENAS quando o client estiver pronto
function iniciarIntervalos() {
  setInterval(gerenciarGrupoPorHorario, 60000);

  setInterval(() => {
    if (clientReady) {
      client.sendMessage(seuNumero, '✅ Ping automático - bot ativo.');
    }
  }, 20 * 60 * 1000);
}

// Inicializa o bot
client.initialize();

// ========= EXPRESS PARA QR CODE =========
app.get('/', (req, res) => {
  if (qrCodeData) {
    res.send(`
      <h1>Escaneie o QR Code para ativar o bot WhatsApp</h1>
      <img src="${qrCodeData}" />
      <p>Depois que o QR for escaneado, esta tela ficará vazia.</p>
    `);
  } else {
    res.send('<h1>Bot está conectado e ativo!</h1>');
  }
});

app.listen(port, () => {
  console.log(`Servidor Express rodando na porta ${port}`);
});
