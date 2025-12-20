const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const fs = require('fs');
const shortid = require('shortid');
const axios = require('axios');

// ===== Настройки =====
const TOKEN = '8482523179:AAFQzWkCz2LrkTWif6Jfn8sXQ-PVxbp0nvs'; // замените на свой токен
const PORT = process.env.PORT || 3000;
const BASE_URL = "https://qr.nspk.ru/AS1A003RTQJV7SPH85OPSMRVK29EOS71";
const BASE_PARAMS = { type: "01", bank: "100000000111", sum: "0", cur: "RUB", crc: "2ddf" };
const DB_FILE = './db.json';

// ===== Работа с JSON DB =====
function readDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  } catch {
    return { whitelist: [], history: [], userState: {} };
  }
}

function writeDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ===== Express сервер =====
const app = express();
app.use(express.json());
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// ===== Telegram бот =====
const bot = new TelegramBot(TOKEN, { polling: false });

// ===== Webhook =====
app.post('/webhook', async (req, res) => {
  const update = req.body;
  await handleUpdate(update);
  res.sendStatus(200);
});

// ===== Логика бота =====
async function handleUpdate(update) {
  const db = readDB();

  if (update.callback_query) {
    const chatId = update.callback_query.from.id;
    const data = update.callback_query.data;
    await bot.answerCallbackQuery(update.callback_query.id);

    if (data === 'create_payment') {
      db.userState[chatId] = 'awaiting_amount';
      writeDB(db);
      bot.sendMessage(chatId, '💰 Пожалуйста, пришлите сумму для платежа:');
    } else if (data === 'show_history') {
      sendHistory(chatId, db);
    }
    return;
  }

  if (!update.message) return;
  const chatId = update.message.chat.id;
  const text = update.message.text.trim();

  if (!db.whitelist.includes(chatId)) {
    bot.sendMessage(chatId, '❌ Вы не в белом списке. Обратитесь к администратору.');
    return;
  }

  if (db.userState[chatId] === 'awaiting_amount') {
    let rub = parseFloat(text.replace(',', '.'));
    if (isNaN(rub) || rub <= 0) {
      bot.sendMessage(chatId, '❌ Введите корректную сумму, например 150.50');
      return;
    }

    const kop = Math.round(rub * 100);
    const params = Object.assign({}, BASE_PARAMS, { sum: kop.toString() });
    const query = Object.keys(params).map(k => `${k}=${params[k]}`).join('&');
    const link = `${BASE_URL}?${query}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(link)}`;

    db.history.push({ id: shortid.generate(), chatId, rub, kop, link, qrUrl, date: new Date().toISOString() });
    delete db.userState[chatId];
    writeDB(db);

    bot.sendPhoto(chatId, qrUrl, { caption: `💰 Сумма: ${rub} ₽\n🔢 В копейках: ${kop}\n🔗 ${link}` });
    return;
  }

  if (text === '/history') {
    sendHistory(chatId, db);
    return;
  }

  sendMenu(chatId);
}

// ===== Меню =====
function sendMenu(chatId) {
  bot.sendMessage(chatId, 'Выберите действие:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Создать платеж', callback_data: 'create_payment' }],
        [{ text: 'Посмотреть список платежей', callback_data: 'show_history' }]
      ]
    }
  });
}

// ===== История =====
function sendHistory(chatId, db) {
  const userRows = db.history.filter(h => h.chatId === chatId);
  if (!userRows.length) return bot.sendMessage(chatId, '📭 У вас ещё нет истории QR.');

  const lastRows = userRows.slice(-10).reverse();
  let message = '📊 Последние платежи:\n\n';
  lastRows.forEach(r => {
    const date = new Date(r.date).toLocaleString('ru-RU');
    message += `💰 ${r.rub} ₽ — ${date}\n🔗 ${r.link}\n\n`;
  });

  bot.sendMessage(chatId, message);
}
