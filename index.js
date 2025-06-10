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
  // Lógica de moderação futura
}

async function handleCommands(msg) {
  const text = msg.body.trim().toLowerCase();

  if (text === '!help') {
    return msg.reply(`🤖 *Comandos disponíveis:*
- !help
- #regras
- !perfil
- !voz
- !conexoes
- !creditos`);
  }

  if (text === '#regras') {
    return msg.reply(regrasDoGrupo);
  }

  if (text === '!perfil') {
    const contato = await msg.getContact();
    const nome = contato.pushname || 'Desconhecido';
    const numero = contato.number;
    return msg.reply(`👤 *Seu perfil:*\n• Nome: ${nome}\n• Número: ${numero}`);
  }

  if (text === '!voz') {
    return msg.reply('🎙️ Envie um áudio com no máximo 30 segundos para ser aceito. Exemplo de comando futuro.');
  }

  if (text === '!conexoes') {
    const chats = await client.getChats();
    const total = chats.length;
    const grupos = chats.filter(c => c.isGroup).length;
    const pv = total - grupos;
    return msg.reply(`📡 *Conexões ativas:*\n• Total: ${total}\n• Grupos: ${grupos}\n• Privados: ${pv}`);
  }

  if (text === '!creditos') {
    return msg.reply(`👑 *Shellzinha Bot 2025*\nDesenvolvido por: você mesmo\nCom base no whatsapp-web.js`);
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

// Gerenciamento automático de grupo
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

// Página QR
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
