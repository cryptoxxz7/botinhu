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

const seuNumero = '13988755893@c.us';

client.on('qr', (qr) => {
  qrcode.toDataURL(qr, (err, url) => {
    if (err) return console.error(err);
    qrCodeData = url;
    console.log('QR code gerado! Acesse a página para escanear.');
  });
});

client.on('ready', () => {
  console.log('✅ Shellzinha Private ON');
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

async function moderarMensagem(msg) {
  // (você pode adicionar lógica futuramente)
}

async function handleCommands(msg) {
  const text = msg.body.trim().toLowerCase();

  if (text === '!help') {
    return msg.reply(
      `🤖 *Shellzinha Bot - Menu de Comandos*\n\n` +
      `📌 *Comandos Gerais:*\n` +
      `• !help → Mostrar este menu\n` +
      `• #regras → Ver as regras do grupo\n\n` +
      `🛡️ *Comandos de Admin (grupo):*\n` +
      `• !ban @usuario → Remove o membro (só se você for admin)\n`
    );
  }

  if (text === '#regras') {
    return msg.reply(regrasDoGrupo);
  }

  if (text.startsWith('!ban')) {
    const chat = await msg.getChat();

    if (!chat.isGroup) {
      return msg.reply('❌ Este comando só funciona em grupos.');
    }

    const autor = chat.participants.find(p => p.id._serialized === msg.author);
    if (!autor?.isAdmin) {
      return msg.reply('❌ Apenas administradores podem usar o comando `!ban`.');
    }

    if (msg.mentionedIds.length === 0) {
      return msg.reply('❌ Marque o usuário que você deseja remover.');
    }

    const targetId = msg.mentionedIds[0];

    try {
      await chat.removeParticipants([targetId]);
      await msg.reply(`✅ Usuário removido com sucesso.`);
    } catch (error) {
      console.error('Erro ao banir:', error);
      msg.reply('⚠️ Ocorreu um erro ao tentar remover o usuário.');
    }
  }
}

client.on('message', async msg => {
  try {
    if (msg.fromMe) return;
    await moderarMensagem(msg);
    await handleCommands(msg);
  } catch (error) {
    console.error('Erro no evento message:', error);
  }
});

client.on('message_create', async msg => {
  try {
    if (!msg.fromMe) return;
    await handleCommands(msg);
  } catch (error) {
    console.error('Erro no evento message_create:', error);
  }
});

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

function iniciarIntervalos() {
  setInterval(gerenciarGrupoPorHorario, 60000);
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
