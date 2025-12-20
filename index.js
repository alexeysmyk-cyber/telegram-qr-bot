// ===== Импорты =====
import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';

// ===== Настройки =====
const TELEGRAM_TOKEN = "8482523179:AAFQzWkCz2LrkTWif6Jfn8sXQ-PVxbp0nvs";
const BASE_URL = "https://qr.nspk.ru/AS1A003RTQJV7SPH85OPSMRVK29EOS71";
const BASE_PARAMS = { type: "01", bank: "100000000111", sum: "0", cur: "RUB", crc: "2ddf" };

// Путь к базе данных lowdb
const adapter = new JSONFile('db.json');
const db = new Low(adapter);

// Админский chatId
const ADMIN_CHAT_ID = 1582980728;

// ===== Инициализация Express =====
const app = express();
app.use(express.json());

// ===== Инициализация бота =====
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

// ===== Инициализация базы =====
await db.read();
db.data ||= { whitelist: [ADMIN_CHAT_ID], history: [], userState: {} };
await db.write();

// ===== Функция обработки обновлений =====
async function handleUpdate(update) {
  if (!update.message) return;

  const chatId = update.message.chat.id;
  const text = update.message.text?.trim();

  console.log("=== Telegram Update ===");
  console.log(JSON.stringify(update, null, 2));

  // Проверка whitelist
  if (!db.data.whitelist.includes(chatId)) {
    const username = update.message.from.username || update.message.from.first_name;
    const link = `https://bot_1766222536_1405_alexey-smyk.bothost.ru/webhook?action=allow&chatId=${chatId}`;
    await bot.sendMessage(ADMIN_CHAT_ID,
      `Пользователь @${username} (chatId=${chatId}) хочет использовать бота.\nСумма: ${text}\n[Разрешить](${link})`,
      { parse_mode: "Markdown" }
    );
    await bot.sendMessage(chatId, "❌ Вы пока не добавлены в белый список. Доступ можно получить через администратора.");
    return;
  }

  // Команда /history
  if (text === "/history") {
    sendHistory(chatId);
    return;
  }

  // Проверка состояния пользователя для кнопок
  if (db.data.userState[chatId] === "WAIT_SUM") {
    let rubles = parseFloat(text.replace(",", "."));
    if (isNaN(rubles) || rubles <= 0) {
      await bot.sendMessage(chatId, "❌ Введите корректную сумму, например: 150.50");
      return;
    }

    const kop = Math.round(rubles * 100);

    let params = Object.assign({}, BASE_PARAMS);
    params.sum = kop.toString();
    const query = Object.keys(params).map(k => k + "=" + params[k]).join("&");
    const link = `${BASE_URL}?${query}`;

    const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=" + encodeURIComponent(link);

    // Сохраняем в history
    db.data.history.push({ chatId, date: new Date().toISOString(), rubles, kop, link, qrUrl });
    await db.write();

    await bot.sendPhoto(chatId, qrUrl, `💰 Сумма: ${rubles} ₽\n🔢 В копейках: ${kop}\n🔗 Ссылка: ${link}`);
    db.data.userState[chatId] = null;
    await db.write();
    return;
  }

  // Главное меню с кнопками
  const opts = {
    reply_markup: {
      keyboard: [
        ["Создать платеж", "История платежей"]
      ],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  };

  if (text === "Создать платеж") {
    db.data.userState[chatId] = "WAIT_SUM";
    await db.write();
    await bot.sendMessage(chatId, "Введите сумму в рублях:", opts);
  } else if (text === "История платежей") {
    sendHistory(chatId);
  } else {
    await bot.sendMessage(chatId, "Выберите действие:", opts);
  }
}

// ===== Функция вывода истории =====
async function sendHistory(chatId) {
  const userRows = db.data.history.filter(row => row.chatId === chatId);
  if (!userRows.length) {
    await bot.sendMessage(chatId, "📭 У вас ещё нет истории QR.");
    return;
  }

  const lastRows = userRows.slice(-10).reverse();
  let messageText = "📊 Последние QR:\n\n";
  lastRows.forEach(row => {
    const date = new Date(row.date).toLocaleString("ru-RU");
    messageText += `💰 ${row.rubles} ₽ — ${date}\n🔗 ${row.link}\n\n`;
  });

  await bot.sendMessage(chatId, messageText);
}

// ===== Webhook обработка =====
app.post('/webhook', async (req, res) => {
  console.log("=== Received webhook ===");
  console.log(JSON.stringify(req.body, null, 2));
  await handleUpdate(req.body);
  res.sendStatus(200);
});

// ===== Добавление в whitelist через ссылку =====
app.get('/webhook', async (req, res) => {
  const { action, chatId } = req.query;
  if (action === "allow" && chatId) {
    if (!db.data.whitelist.includes(Number(chatId))) {
      db.data.whitelist.push(Number(chatId));
      await db.write();
    }
    res.send("✅ Пользователь добавлен в белый список");
  } else {
    res.send("⚠ Неверный запрос");
  }
});

// ===== Запуск сервера =====
app.listen(3000, () => console.log("Server running on port 3000"));
