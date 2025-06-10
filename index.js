const express = require('express');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');

const app = express();
const port = process.env.PORT || 3000;

let clientReady = false;
let qrCodeData = null;

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    // Se necessário, defina o caminho do Chromium no seu ambiente:
    // executablePath: '/usr/bin/chromium-browser',
  },
});

const seuNumero = '13988755893@c.us'; // Seu número

const regrasDoGrupo = `📌 *REGRAS DO GRUPO:*
1️⃣ Sem *links*, *fotos* ou *vídeos*.
2️⃣ Permitido: *áudios*, *stickers* e *textos* (máx. 35 palavras).
3️⃣ Regras ignoradas = *banimento* após 1 aviso.
4️⃣ Mantenha o respeito e evite spam.
Obrigado por colaborar.
`;

client.on('qr', (qr) => {
  qrcode.toDataURL(qr, (err, url) => {
    if (err) return console.error(err);
    qrCodeData = url;
    console.log('Código QR gerado! Acesse a página para escanear.');
  });
});

client.on('ready', () => {
  console.log('✅ Shellzinha Privada ON');
  qrCodeData = null;
  clientReady = true;

  setTimeout(() => {
    client.sendMessage(seuNumero, '!help');
  }, 2000);

  iniciarIntervalos();
});

client.on('authenticated', () => {
  console.log('Cliente autenticado com sucesso!');
});

client.on('auth_failure', (msg) => {
  console.error('Falha na autenticação:', msg);
});

client.on('disconnected', (reason) => {
  console.log('Cliente desconectado:', reason);
  clientReady = false;
});

// Banir quem responder mensagem de alguém (simples)
// Basta deletar a mensagem respondida para dar "banimento"
async function banirResponder(msg) {
  if (!msg.hasQuotedMsg) return;
  try {
    await msg.delete(true);
    await msg.reply('⚠️ Você foi banido por responder mensagens no grupo.');
  } catch {
    // Pode não ter permissão para deletar, ignore
  }
}

// Comandos básicos
async function handleCommands(msg) {
  const text = msg.body.trim().toLowerCase();

  if (text === '!help') {
    return msg.reply(`🤖 *Comandos disponíveis:*\n- !help\n- #regras`);
  }

  if (text === '#regras') {
    return msg.reply(regrasDoGrupo);
  }
}

// Moderação (banir responder)
async function moderarMensagem(msg) {
  if (msg.fromMe) return;

  // Banir se respondeu alguém
  if (msg.hasQuotedMsg) {
    await banirResponder(msg);
  }
}

// Evento de mensagem
client.on('message', async (msg) => {
  try {
    await moderarMensagem(msg);
    await handleCommands(msg);
  } catch (err) {
    // Erros não travam o bot
    console.error('Erro no evento message:', err.message || err);
  }
});

// Boas vindas para quem entrar no grupo
client.on('group_join', async (notification) => {
  try {
    const chat = await notification.getChat();
    const user = await notification.getUser();

    chat.sendMessage(`👋 Olá @${user.id.user}, seja bem-vindo(a) ao grupo! Leia as regras:\n\n${regrasDoGrupo}`, {
      mentions: [user]
    });
  } catch (err) {
    console.error('Erro ao enviar boas-vindas:', err.message || err);
  }
});

// Gerenciar grupo por horário (fecha/abre)
// Só roda se clientReady for true
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
  } catch {
    // Se der erro, ignore para não travar o bot
    return;
  }

  const agora = new Date();

  for (const chat of chats) {
    if (!chat.isGroup) continue;

    const chaveChat = chat.id._serialized;

    if (agoraEhHorario(horarioFechar) && ultimoFechamento !== chaveChat + agora.getDate()) {
      try {
        await chat.setMessagesAdminsOnly(true);
        await chat.sendMessage('🔒 Grupo fechado automaticamente. Retornamos às 08:00.');
        ultimoFechamento = chaveChat + agora.getDate();
      } catch {
        // ignorar erro
      }
    }

    if (agoraEhHorario(horarioAbrir) && ultimaAbertura !== chaveChat + agora.getDate()) {
      try {
        await chat.setMessagesAdminsOnly(false);
        await chat.sendMessage('🔓 Grupo aberto novamente. Bom dia a todos!');
        ultimaAbertura = chaveChat + agora.getDate();
      } catch {
        // ignorar erro
      }
    }
  }
}

function iniciarIntervalos() {
  setInterval(gerenciarGrupoPorHorario, 60 * 1000); // verifica a cada minuto
  setInterval(() => {
    if (clientReady) {
      client.sendMessage(seuNumero, '✅ Ping automático - bot ativo.');
    }
  }, 20 * 60 * 1000);
}

client.initialize();

app.get('/', (req, res) => {
  if (qrCodeData) {
    res.send(`
      <h1>Escaneie o QR Code para ativar o bot WhatsApp</h1>
      <img src="${qrCodeData}" />
      <p>Depois que o QR for escaneado, esta tela ficará vazia.</p>
    `);
  } else {
    res.send('<h1>🤖 Bot WhatsApp está conectado e ativo!</h1>');
  }
});

app.listen(port, () => {
  console.log(`🌐 Servidor Express online na porta ${port}`);
});
