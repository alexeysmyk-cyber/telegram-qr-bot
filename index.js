const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// ========== НАСТРОЙКИ ==========
const TELEGRAM_TOKEN = '8482523179:AAFQzWkCz2LrkTWif6Jfn8sXQ-PVxbp0nvs';
const ADMIN_CHAT_ID = 1582980728;

const BASE_URL = 'https://qr.nspk.ru/AS1A003RTQJV7SPH85OPSMRVK29EOS71';
const BASE_PARAMS = {
  type: '01',
  bank: '100000000111',
  sum: '0',
  cur: 'RUB',
  crc: '2ddf'
};

// ========== BOT ==========
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// ========== БАЗА ==========
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

// ========== КНОПКИ ==========
const mainKeyboard = {
  reply_markup: {
    keyboard: [
      ['Создать платёж'],
      ['История платежей']
    ],
    resize_keyboard: true
  }
};

// ========== ОБРАБОТКА СООБЩЕНИЙ ==========
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  const username = msg.from.username || msg.from.first_name;

  console.log(`MSG from ${chatId}: ${text}`);

  const db = loadDB();

  // ---- WHITELIST ----
  if (!db.whitelist.includes(chatId)) {
    await bot.sendMessage(
      ADMIN_CHAT_ID,
      `🔐 Запрос доступа\n@${username}\nID: ${chatId}\n\nЧтобы разрешить — напиши:\n/allow ${chatId}`
    );
    await bot.sendMessage(chatId, '⛔ Доступ не разрешён. Ожидайте подтверждения.');
    return;
  }

  // ---- АДМИНСКАЯ КОМАНДА ----
  if (text.startsWith('/allow') && chatId === ADMIN_CHAT_ID) {
    const allowId = Number(text.split(' ')[1]);
    if (!allowId) {
      await bot.sendMessage(chatId, '❌ Укажите chatId');
      return;
    }
    if (!db.whitelist.includes(allowId)) {
      db.whitelist.push(allowId);
      saveDB(db);
    }
    await bot.sendMessage(chatId, `✅ Пользователь ${allowId} добавлен`);
    return;
  }

  // ---- СОСТОЯНИЕ: ОЖИДАНИЕ СУММЫ ----
  if (db.state[chatId] === 'WAIT_SUM') {
    const rub = parseFloat(text.replace(',', '.'));
    if (isNaN(rub) || rub <= 0) {
      await bot.sendMessage(chatId, '❌ Введите сумму, например 150.50');
      return;
    }

    const kop = Math.round(rub * 100);
    const params = { ...BASE_PARAMS, sum: kop };
    const query = Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&');
    const link = `${BASE_URL}?${query}`;
    const qr = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(link)}`;

    if (!db.history[chatId]) db.history[chatId] = [];
    db.history[chatId].push({
      date: new Date().toISOString(),
      rub,
      link
    });

    db.state[chatId] = null;
    saveDB(db);

    await bot.sendPhoto(chatId, qr, {
      caption: `💰 ${rub} ₽\n🔗 ${link}`
    });
    return;
  }

  // ---- КНОПКИ ----
  if (text === 'Создать платёж') {
    db.state[chatId] = 'WAIT_SUM';
    saveDB(db);
    await bot.sendMessage(chatId, 'Введите сумму в рублях:', mainKeyboard);
    return;
  }

  if (text === 'История платежей') {
    const history = db.history[chatId] || [];
    if (!history.length) {
      await bot.sendMessage(chatId, '📭 История пуста', mainKeyboard);
      return;
    }

    let msgText = '📊 Последние платежи:\n\n';
    history.slice(-10).reverse().forEach(h => {
      msgText += `💰 ${h.rub} ₽\n🔗 ${h.link}\n\n`;
    });

    await bot.sendMessage(chatId, msgText, mainKeyboard);
    return;
  }

  // ---- СТАРТ ----
  await bot.sendMessage(chatId, 'Выберите действие:', mainKeyboard);
});

console.log('🤖 Bot started (polling mode)');
