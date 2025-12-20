// ================== НАСТРОЙКИ ==================
const TOKEN = '8482523179:AAFQzWkCz2LrkTWif6Jfn8sXQ-PVxbp0nvs';
const ADMIN_CHAT_ID = 1582980728; // <-- твой chat_id
const DB_FILE = './db.json';

// ================== ИМПОРТЫ ==================
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// ================== БОТ ==================
const bot = new TelegramBot(TOKEN, { polling: true });
console.log('🤖 Bot started (polling mode)');

// ================== БАЗА ДАННЫХ ==================
function loadDB() {
  let db = { whitelist: [ADMIN_CHAT_ID], history: {}, state: {} };
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      db = { ...db, ...data };
      if (!db.whitelist) db.whitelist = [ADMIN_CHAT_ID];
      if (!db.history) db.history = {};
      if (!db.state) db.state = {};
    } catch (e) {
      console.error('❌ DB parse error, recreating');
    }
  }
  saveDB(db);
  return db;
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

let db = loadDB();

// ================== БАЗОВАЯ ССЫЛКА ==================
const BASE_URL = "https://qr.nspk.ru/AS1A003RTQJV7SPH85OPSMRVK29EOS71";
const BASE_PARAMS = { type: "01", bank: "100000000111", sum: "0", cur: "RUB", crc: "2ddf" };

// ================== КНОПКИ ==================
function mainKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        ['➕ Создать платёж'],
        ['📜 История']
      ],
      resize_keyboard: true
    }
  };
}

// ================== /start ==================
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  if (!db.whitelist.includes(chatId)) return bot.sendMessage(chatId, '⛔ Доступ запрещён');

  db.state[chatId] = null;
  saveDB(db);

  bot.sendMessage(chatId, 'Привет 👋\nВыбери действие:', mainKeyboard());
});

// ================== СООБЩЕНИЯ ==================
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  console.log(`MSG from ${chatId}: ${text}`);

  if (!db.whitelist.includes(chatId)) return;
  if (text === '/start') return;

  // ---- Создание платежа ----
  if (text === '➕ Создать платёж') {
    db.state[chatId] = 'WAIT_SUM';
    saveDB(db);
    return bot.sendMessage(chatId, '💰 Введите сумму:');
  }

  // ---- Ожидание суммы ----
  if (db.state[chatId] === 'WAIT_SUM') {
    const amount = Number(text);

    if (isNaN(amount) || amount <= 0) {
      return bot.sendMessage(chatId, '❌ Введите корректную сумму');
    }

    db.state[chatId] = null;

    // ---- Создаём историю платежей ----
    if (!db.history[chatId]) db.history[chatId] = [];
    db.history[chatId].push({
      amount,
      date: new Date().toISOString()
    });

    saveDB(db);

    // ---- Формируем ссылку ----
    const kop = Math.round(amount * 100);
    let params = { ...BASE_PARAMS, sum: kop.toString() };
    const query = Object.keys(params).map(k => k + "=" + params[k]).join("&");
    const link = `${BASE_URL}?${query}`;

    // ---- QR код ----
    const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=" + encodeURIComponent(link);

    // ---- Отправляем пользователю ----
    return bot.sendPhoto(chatId, qrUrl, {
  caption: `✅ Платёж создан\n🏢 ООО "Медицинская Среда"\n💰 Сумма: ${amount} ₽\n🔗 Ссылка: ${link}`,
  ...mainKeyboard()
});
  }

  // ---- История ----
  if (text === '📜 История') {
    const history = db.history[chatId] || [];

    if (history.length === 0) return bot.sendMessage(chatId, '📭 История пуста');

    const textHistory = history
      .map((h, i) => `${i + 1}. ${h.amount} ₽ — ${h.date}`)
      .join('\n');

    return bot.sendMessage(chatId, `📜 История:\n\n${textHistory}`);
  }
});

// ================== ОШИБКИ ==================
bot.on('polling_error', (e) => {
  console.error('Polling error:', e.message);
});

