const express = require('express');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { args: ['--no-sandbox'] }
});

const gruposPermitidos = [
  '120363403199317276@g.us',
  '120363351699706014@g.us'
];

const avisados = {};
const seuNumero = '13988755893@c.us';

let qrCodeData = null; // armazena o QR para mostrar na página

// Gera QR e armazena em variável
client.on('qr', (qr) => {
  qrcode.toDataURL(qr, (err, url) => {
    if (err) return console.error(err);
    qrCodeData = url;
    console.log('QR code gerado, acesse a página para escanear!');
  });
});

// Bot pronto
client.on('ready', () => {
  console.log('Shellzinha Private ON');
  qrCodeData = null; // limpa o QR após autenticação
});

// Regras e eventos do seu bot (copie daqui pra baixo o resto do código que já tem)
// ... (adicione aqui todo o seu código de eventos, moderação, comandos, grupos, ping, etc)

const regrasDoGrupo = `
📌 *REGRAS DO GRUPO:*
1️⃣ Sem *links*, *fotos* ou *vídeos*.
2️⃣ Permitido: *áudios*, *stickers* e *textos* (máx. 35 palavras).
3️⃣ Regras ignoradas = *banimento* após 1 aviso.
4️⃣ Mantenha o respeito e evite spam.
Obrigado por colaborar.
`;

client.on('group_join', async (notification) => {
  const chat = await notification.getChat();
  if (!gruposPermitidos.includes(chat.id._serialized)) return;

  const contacts = await notification.getRecipients();
  for (const contact of contacts) {
    const nome = contact.pushname || contact.number || contact.id.user;
    const mensagem = `
👤 *Bem-vindo(a), ${nome}!* 👋
| Leia as regras digitando: *#regras*. 
🔐 Respeite as regras para não ser banido.
Se quiser algum *serviço*, só me chamar!
> ⚠ Não aceite serviços de outra pessoa sem ser os adm.
`;
    await chat.sendMessage(mensagem, { mentions: [contact] });
  }
});

async function moderarMensagem(msg) {
  const chat = await msg.getChat();
  if (!chat.isGroup || !gruposPermitidos.includes(chat.id._serialized) || msg.fromMe) return;

  const sender = msg.author || msg.from;
  const participante = chat.participants.find(p => p.id._serialized === sender);
  if (participante?.isAdmin) return;

  const texto = msg.body?.trim() || '';
  const palavras = texto.split(/\s+/).filter(w => w.length > 0).length;
  const contemLink = /(https?:\/\/|www\.|[a-z0-9\-]+\.(com|net|org|xyz|br|info))/i.test(texto);

  const permitido =
    msg.type === 'sticker' ||
    msg.type === 'audio' ||
    (msg.type === 'chat' && palavras <= 35 && !contemLink);

  if (permitido) return;

  try { await msg.delete(true); } catch {}

  if (!avisados[chat.id]) avisados[chat.id] = {};

  if (avisados[chat.id][sender]) {
    await chat.sendMessage(`Conteúdo proibido apagado: @${sender.split('@')[0]}`, {
      mentions: [sender]
    });
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      await chat.removeParticipants([sender]);
    } catch {
      await chat.sendMessage('Erro ao remover. Verifique permissões do bot.');
    }
  } else {
    avisados[chat.id][sender] = true;
    await chat.sendMessage(
      `@${sender.split('@')[0]} sua mensagem foi removida.\n\nPermitido: áudios, figurinhas.\nProibido: links, imagens ou vídeos.\nCaso mande novamente = ban.`,
      { mentions: [sender] }
    );
  }
}

async function handleCommands(msg) {
  const chat = await msg.getChat();
  if (!chat.isGroup || !gruposPermitidos.includes(chat.id._serialized)) return;

  const text = msg.body.trim().toLowerCase();
  const sender = msg.author || msg.from;
  const participante = chat.participants.find(p => p.id._serialized === sender);
  if (!participante?.isAdmin) return;

  if (text === '!help') {
    const comandosFormatados = `
[ shellzinha private ]
|-- !ban » Banir membro respondendo a msg
|-- @todos » Mencionar todos do grupo
|-- #regras » Exibir regras do grupo
> Criado por: cryptoxxz7
`;
    const mediaPath = path.resolve('./assets/shellzinha.jpeg');
    if (fs.existsSync(mediaPath)) {
      const media = MessageMedia.fromFilePath(mediaPath);
      await chat.sendMessage(media, { caption: comandosFormatados });
    } else {
      await chat.sendMessage(comandosFormatados);
    }
    return;
  }

  if (text.startsWith('!ban')) {
    if (!msg.hasQuotedMsg) return chat.sendMessage('Responda à mensagem e digite *!ban*.');
    try {
      const quotedMsg = await msg.getQuotedMessage();
      const idToRemove = quotedMsg.author || quotedMsg.from;
      await chat.removeParticipants([idToRemove]);
      return chat.sendMessage(`Lixo removido: @${idToRemove.split('@')[0]}`, {
        mentions: [idToRemove]
      });
    } catch {
      return chat.sendMessage('Não consegui remover o participante.');
    }
  }

  if (text.startsWith('@todos')) {
    try {
      const mentions = chat.participants.map(p => p.id._serialized);
      const mensagem = msg.body.replace('@todos', '').trim() || 'Atenção todos!';
      return chat.sendMessage(mensagem, { mentions });
    } catch {
      await chat.sendMessage('Não consegui mencionar todos os membros.');
    }
  }
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

const horarioFechar = { hora: 4, minuto: 0 }; 
const horarioAbrir = { hora: 8, minuto: 0 };   

let ultimoFechamento = null;
let ultimaAbertura = null;

function agoraEhHorario(horario) {
  const agora = new Date();
  return agora.getHours() === horario.hora && agora.getMinutes() === horario.minuto;
}

async function gerenciarGrupoPorHorario() {
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

setInterval(gerenciarGrupoPorHorario, 60000);

setInterval(() => {
  client.sendMessage(seuNumero, '✅ Ping automático - bot ativo.');
}, 20 * 60 * 1000); 

client.initialize();

// -- Express --

// Rota raiz que mostra o QR Code
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
  console.log(`Servidor rodando na porta ${port}`);
});
