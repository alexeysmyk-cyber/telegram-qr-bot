const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// ================= НАСТРОЙКИ =================
const TELEGRAM_TOKEN = 'ВАШ_BOT_TOKEN';
const TELEGRAM_TOKEN = "8482523179:AAFQzWkCzLrkTWif6Jfn8sXQ-PVxbp0nvs";
const BASE_URL = 'https://qr.nspk.ru/AS1A003RTQJV7SPH85OPSMRVK29EOS71';
const BASE_PARAMS = {
  type: '01',
  bank: '100000000111',
  sum: '0',
  cur: 'RUB',
  crc: '2ddf'
};

// ================= EXPRESS =================
const app = express();
app.use(express.json());

// ================= BOT =================
const bot = new TelegramBot(TELEGRAM_TOKEN);

// ================= ХРАНИЛИЩЕ =================
const DB_FILE = './db.json';

function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({
      whitelist: [ADMIN_CHAT_ID],
      history: {},
      state: {}
    }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ================= WEBHOOK =================
app.post('/webhook', async (req, res) => {
  const update = req.body;
  console.log('UPDATE:', JSON.stringify(update));

  if (!update.message) return res.sendStatus(200);

  const chatId = update.message.chat.id;
  const text = update.message.text || '';
  const username = update.message.from.username || update.message.from.first_name;

  const db = loadDB();

  // ---------- WHITELIST ----------
  if (!db.whitelist.includes(chatId)) {
    const allowLink = `https://bot_1766222536_1405_alexey-smyk.bothost.ru/allow?chatId=${chatId}`;
    await bot.sendMessage(
      ADMIN_CHAT_ID,
      `🔐 Запрос доступа\n@${username}\nID: ${chatId}\n[Разрешить](${allowLink})`,
      { parse_mode: 'Markdown' }
    );
    await bot.sendMessage(chatId, '⛔ Доступ не разрешён. Ожидайте подтверждения.');
    return res.sendStatus(200);
  }

  // ---------- СОСТОЯНИЯ ----------
  if (db.state[chatId] === 'WAIT_SUM') {
    const rub = parseFloat(text.replace(',', '.'));
    if (isNaN(rub) || rub <= 0) {
      await bot.sendMessage(chatId, '❌ Введите сумму, например 150.50');
      return res.sendStatus(200);
    }

    const kop = Math.round(rub * 100);
    const params = { ...BASE_PARAMS, sum: kop };
    const query = Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&');
    const link = `${BASE_URL}?${query}`;
    const qr = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(link)}`;

    if (!db.history[chatId]) db.history[chatId] = [];
    db.history[chatId].push({ date: new Date().toISOString(), rub, link });

    db.state[chatId] = null;
    saveDB(db);

    await bot.sendPhoto(chatId, qr, {
      caption: `💰 ${rub} ₽\n🔗 ${link}`
    });
    return res.sendStatus(200);
  }

  // ---------- КНОПКИ ----------
  const keyboard = {
    reply_markup: {
      keyboard: [
        ['Создать платёж'],
        ['История платежей']
      ],
      resize_keyboard: true
    }
  };

  if (text === 'Создать платёж') {
    db.state[chatId] = 'WAIT_SUM';
    saveDB(db);
    await bot.sendMessage(chatId, 'Введите сумму в рублях:', keyboard);
  } else if (text === 'История платежей') {
    const history = db.history[chatId] || [];
    if (!history.length) {
      await bot.sendMessage(chatId, '📭 История пуста', keyboard);
    } else {
      let msg = '📊 Последние платежи:\n\n';
      history.slice(-10).reverse().forEach(h => {
        msg += `💰 ${h.rub} ₽\n🔗 ${h.link}\n\n`;
      });
      await bot.sendMessage(chatId, msg, keyboard);
    }
  } else {
    await bot.sendMessage(chatId, 'Выберите действие:', keyboard);
  }

  res.sendStatus(200);
});

// ================= ALLOW =================
app.get('/allow', (req, res) => {
  const chatId = Number(req.query.chatId);
  if (!chatId) return res.send('Ошибка');

  const db = loadDB();
  if (!db.whitelist.includes(chatId)) {
    db.whitelist.push(chatId);
    saveDB(db);
  }

  res.send('✅ Пользователь добавлен в белый список');
});

// ================= START =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('Server running on port', PORT);
});

