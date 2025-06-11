const express = require('express');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

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
const gruposPermitidos = [
  '120363351699706014@g.us',
  '120363403199317276@g.us',
];

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
    console.log('🔄 QR gerado. Escaneie para iniciar.');
  });
});

client.on('ready', () => {
  console.log('✅ Bot iniciado com sucesso.');
  qrCodeData = null;
  clientReady = true;

  setTimeout(() => {
    client.sendMessage(seuNumero, '!help');
  }, 2000);

  iniciarIntervalos();
});

// 🔒 Moderação de mensagens
async function moderarMensagem(msg) {
  try {
    const chat = await msg.getChat();
    if (!chat.isGroup || !gruposPermitidos.includes(chat.id._serialized)) return;

    const sender = msg.author || msg.from;
    const botId = client.info.wid._serialized;
    const botIsAdmin = chat.participants.find(p => p.id._serialized === botId)?.isAdmin;
    const senderIsAdmin = chat.participants.find(p => p.id._serialized === sender)?.isAdmin;

    const contato = await client.getContactById(sender);

    if ((msg.type === 'video' || msg.type === 'image') && !senderIsAdmin && botIsAdmin) {
      await msg.delete(true);
      await chat.sendMessage(
        `⚠️ @${sender.split('@')[0]} enviou ${msg.type} e foi removido.`,
        { mentions: [contato] }
      );
      await chat.removeParticipants([sender]);
      return;
    }

    if (msg.type === 'chat' && !senderIsAdmin && botIsAdmin) {
      const wordCount = msg.body.trim().split(/\s+/).length;
      if (wordCount > 35) {
        await msg.delete(true);
        await chat.sendMessage(
          `⚠️ @${sender.split('@')[0]} enviou mensagem com ${wordCount} palavras (máx 35) e foi removido.`,
          { mentions: [contato] }
        );
        await chat.removeParticipants([sender]);
        return;
      }
    }

  } catch (err) {
    console.error('Erro na moderação:', err);
  }
}

// 📩 Comandos
async function handleCommands(msg) {
  const text = msg.body.trim().toLowerCase();

  if (text === '!help') {
    try {
      const imagePath = path.join(__dirname, 'assets/shellzinha.jpeg');
      const imageData = fs.readFileSync(imagePath, { encoding: 'base64' });
      const media = new MessageMedia('image/jpeg', imageData, 'menu.jpeg');

      const legenda = `🤖 *Comandos disponíveis:*

📌 *Moderador automático:*
- Apaga fotos, vídeos e textos com +35 palavras.
- Remove quem desrespeita regras.

🧠 *Comandos úteis:*
• !help – Ver comandos
• #regras – Ver as regras do grupo
• #ban – (responder a msg de quem será removido)

⚠️ *Atenção:* Comandos só funcionam nos grupos autorizados.`;

      await msg.reply(media, undefined, { caption: legenda });
    } catch (err) {
      console.error('Erro ao enviar imagem no !help:', err);
      msg.reply('⚠️ Ocorreu um erro ao carregar o menu com imagem.');
    }
    return;
  }

  if (text === '#regras') {
    return msg.reply(regrasDoGrupo);
  }

  if (text === '#ban' && msg.hasQuotedMsg) {
    const chat = await msg.getChat();
    if (!chat.isGroup || !gruposPermitidos.includes(chat.id._serialized)) return;

    const quotedMsg = await msg.getQuotedMessage();
    const botId = client.info.wid._serialized;
    const botIsAdmin = chat.participants.find(p => p.id._serialized === botId)?.isAdmin;
    const authorIsAdmin = chat.participants.find(p => p.id._serialized === msg.author)?.isAdmin;

    if (!authorIsAdmin) return msg.reply('❌ Apenas administradores podem usar este comando.');
    if (!botIsAdmin) return msg.reply('⚠️ Preciso ser administrador para remover membros.');

    const target = quotedMsg.author || quotedMsg.from;
    if (!target) return msg.reply('❌ Não identifiquei quem remover.');

    try {
      await chat.removeParticipants([target]);
      await msg.reply('👋 Usuário removido com sucesso.');
    } catch (err) {
      console.error('Erro ao banir:', err);
      await msg.reply('⚠️ Erro ao tentar remover.');
    }
  }
}

// 📥 Mensagens recebidas
client.on('message', async msg => {
  try {
    if (msg.fromMe) return;
    await moderarMensagem(msg);
    await handleCommands(msg);
  } catch (error) {
    console.error('Erro em message:', error);
  }
});

// 👋 Boas-vindas
client.on('group_join', async (notification) => {
  try {
    const chat = await notification.getChat();
    if (!gruposPermitidos.includes(chat.id._serialized)) return;

    const participant = notification.id.participant;
    await chat.sendMessage(
      `👤 *Bem-vindo(a), @${participant.split('@')[0]}!* 👨‍💻\n\nDigite *#regras* para conhecer as normas.\n\n⚠️ Respeite as regras ou será removido.`,
      { mentions: [participant] }
    );
  } catch (err) {
    console.error('Erro na boas-vindas:', err);
  }
});

// ⏰ Fechar grupo 04h - Abrir 08h
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
  } catch (err) {
    return;
  }

  for (const chat of chats) {
    if (!chat.isGroup || !gruposPermitidos.includes(chat.id._serialized)) continue;

    const agora = new Date();
    const chaveChat = chat.id._serialized;

    if (agoraEhHorario(horarioFechar) && ultimoFechamento !== chaveChat + agora.getDate()) {
      await chat.setMessagesAdminsOnly(true);
      await chat.sendMessage('🔒 Grupo fechado automaticamente. Retornamos às 08:00.');
      ultimoFechamento = chaveChat + agora.getDate();
    }

    if (agoraEhHorario(horarioAbrir) && ultimaAbertura !== chaveChat + agora.getDate()) {
      await chat.setMessagesAdminsOnly(false);
      await chat.sendMessage('🔓 Grupo aberto novamente. Bom dia!');
      ultimaAbertura = chaveChat + agora.getDate();
    }
  }
}

// 🔁 Intervalos
function iniciarIntervalos() {
  setInterval(gerenciarGrupoPorHorario, 60000);
  setInterval(() => {
    if (clientReady) {
      client.sendMessage(seuNumero, '✅ Ping automático - bot ativo.');
    }
  }, 20 * 60 * 1000);
}

// 🌐 Web QR Code
client.initialize();

app.get('/', (req, res) => {
  if (qrCodeData) {
    res.send(`<h1>Escaneie o QR Code</h1><img src="${qrCodeData}" />`);
  } else {
    res.send('<h1>🤖 Bot do WhatsApp rodando.</h1>');
  }
});

app.listen(port, () => {
  console.log(`🌐 Servidor Express rodando na porta ${port}`);
});
