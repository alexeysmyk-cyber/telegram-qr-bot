const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// ===== НАСТРОЙКИ =====
const TELEGRAM_TOKEN = "8482523179:AAFQzWkCzLrkTWif6Jfn8sXQ-PVxbp0nvs";
const ADMIN_CHAT_ID = 1582980728;
const BASE_URL = "https://qr.nspk.ru/AS1A003RTQJV7SPH85OPSMRVK29EOS71";
const BASE_PARAMS = { type: "01", bank: "100000000111", sum: "0", cur: "RUB", crc: "2ddf" };

const PORT = 3000;
const DB_FILE = './db.json';

// ===== ПРОСТАЯ БАЗА (без lowdb, чтобы НЕ ЛОМАЛОСЬ) =====
let db = { whitelist: [ADMIN_CHAT_ID], history: [], state: {} };

if (fs.existsSync(DB_FILE)) {
  db = JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ===== EXPRESS =====
const app = express();
app.use(express.json());

// ===== TELEGRAM BOT =====
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

// ===== WEBHOOK =====
app.post('/webhook', async (req, res) => {
  console.log("INCOMING UPDATE:", JSON.stringify(req.body));

  const msg = req.body.message;
  if (!msg) return res.sendStatus(200);

  const chatId = msg.chat.id;
  const text = msg.text?.trim();

  // --- whitelist ---
  if (!db.whitelist.includes(chatId)) {
    const allowLink = `https://bot_1766222536_1405_alexey-smyk.bothost.ru/allow?chatId=${chatId}`;
    await bot.sendMessage(
      ADMIN_CHAT_ID,
      `Новый запрос доступа\nchatId: ${chatId}\n[РАЗРЕШИТЬ](${allowLink})`,
      { parse_mode: "Markdown" }
    );
    await bot.sendMessage(chatId, "⛔ Доступ не разрешён. Ожидайте подтверждения.");
    return res.sendStatus(200);
  }

  // --- ожидание суммы ---
  if (db.state[chatId] === 'WAIT_SUM') {
    const rub = parseFloat(text.replace(',', '.'));
    if (isNaN(rub) || rub <= 0) {
      await bot.sendMessage(chatId, "❌ Введите корректную сумму");
      return res.sendStatus(200);
    }

    const kop = Math.round(rub * 100);
    const params = { ...BASE_PARAMS, sum: kop };
    const query = Object.entries(params).map(([k,v]) => `${k}=${v}`).join('&');
    const link = `${BASE_URL}?${query}`;
    const qr = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(link)}`;

    db.history.push({ chatId, rub, link, date: new Date() });
    db.state[chatId] = null;
    saveDB();

    await bot.sendPhoto(chatId, qr, { caption: `💰 ${rub} ₽\n🔗 ${link}` });
    return res.sendStatus(200);
  }

  // --- меню ---
  if (text === 'Создать платеж') {
    db.state[chatId] = 'WAIT_SUM';
    saveDB();
    await bot.sendMessage(chatId, "Введите сумму:");
  } else if (text === 'История платежей') {
    const rows = db.history.filter(h => h.chatId === chatId);
    if (!rows.length) {
      await bot.sendMessage(chatId, "История пуста");
    } else {
      let msgText = "📊 История:\n\n";
      rows.slice(-10).forEach(r => {
        msgText += `💰 ${r.rub} ₽\n🔗 ${r.link}\n\n`;
      });
      await bot.sendMessage(chatId, msgText);
    }
  } else {
    await bot.sendMessage(chatId, "Выберите действие:", {
      reply_markup: {
        keyboard: [["Создать платеж", "История платежей"]],
        resize_keyboard: true
      }
    });
  }

  res.sendStatus(200);
});

// ===== ДОБАВЛЕНИЕ В WHITELIST =====
app.get('/allow', (req, res) => {
  const chatId = Number(req.query.chatId);
  if (!db.whitelist.includes(chatId)) {
    db.whitelist.push(chatId);
    saveDB();
  }
  res.send("✅ Пользователь добавлен");
});

// ===== START =====
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// ===== Запуск сервера =====
app.listen(3000, () => console.log("Server running on port 3000"));

