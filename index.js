const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

const app = express();
const port = process.env.PORT || 3000;

let clientReady = false;
let qrCodeData = null;

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

const seuNumero = '13988755893@c.us';

// Evento QR
client.on('qr', (qr) => {
  qrcode.toDataURL(qr, (err, url) => {
    if (err) return console.error(err);
    qrCodeData = url;
    console.log('QR code gerado, acesse a página para escanear!');
  });
});

// Evento ready
client.on('ready', () => {
  console.log('Shellzinha Private ON');
  qrCodeData = null;
  clientReady = true;

  setTimeout(() => {
    client.sendMessage(seuNumero, '!help');
  }, 2000);

  iniciarIntervalos();
});

const regrasDoGrupo = `📌 *REGRAS DO GRUPO:*
1️⃣ Sem *links*, *fotos* ou *vídeos*.
2️⃣ Permitido: *áudios*, *stickers* e *textos* (máx. 35 palavras).
3️⃣ Regras ignoradas = *banimento* após 1 aviso.
4️⃣ Mantenha o respeito e evite spam.
Obrigado por colaborar.
`;

// Função para responder comandos
async function handleCommands(msg) {
  const text = msg.body.trim().toLowerCase();

  if (text === '!help') {
    const helpMsg = `🤖 *Comandos disponíveis:*
!help - Mostrar essa ajuda
#regras - Mostrar as regras do grupo
... (adicione seus comandos aqui)
`;
    await msg.reply(helpMsg);
  }
  // Adicione mais comandos aqui se quiser
}

// Evento message (mensagens recebidas)
client.on('message', async msg => {
  try {
    if (msg.fromMe) return; // Ignora mensagens do próprio bot

    const chat = await msg.getChat();

    // Se for grupo e permitido
    if (chat.isGroup) {
      // Proteção para acessar _serialized
      if (!chat.id || !chat.id._serialized) return;

      if (!gruposPermitidos.includes(chat.id._serialized)) return;

      const text = msg.body.trim().toLowerCase();

      if (text === '#regras') {
        return chat.sendMessage(regrasDoGrupo);
      }

      await handleCommands(msg);
      // Aqui pode entrar sua moderação se quiser
    } else {
      // Mensagem privada, responde só ao !help
      if (msg.body.trim().toLowerCase() === '!help') {
        await handleCommands(msg);
      }
    }
  } catch (error) {
    console.error('Erro no evento message:', error);
  }
});

// Horários para fechar e abrir grupo
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

  let chats;
  try {
    chats = await client.getChats();
  } catch (error) {
    console.error('Erro ao obter chats:', error);
    return;
  }

  for (const chat of chats) {
    if (!chat.isGroup) continue;
    if (!chat.id || !chat.id._serialized) continue;

    if (!gruposPermitidos.includes(chat.id._serialized)) continue;

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

// Inicia intervalos após o client estar pronto
function iniciarIntervalos() {
  setInterval(gerenciarGrupoPorHorario, 60000);

  setInterval(() => {
    if (clientReady) {
      client.sendMessage(seuNumero, '✅ Ping automático - bot ativo.');
    }
  }, 20 * 60 * 1000);
}

client.initialize();

// Express para servir página com QR Code
app.get('/', (req, res) => {
  if (qrCodeData) {
    res.send(`
      <h1>Escaneie o QR Code para ativar o bot WhatsApp</h1>
      <img src="${qrCodeData}" />
      <p>Depois que o QR for escaneado, esta tela ficará vazia.</p>
    `);
  } else {
    res.send('<h1>Bot está conectado e ativo novamente 2!</h1>');
  }
});

app.listen(port, () => {
  console.log(`Servidor Express rodando na porta ${port}`);
});
