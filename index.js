
// ================== НАСТРОЙКИ ==================
const TOKEN = '8482523179:AAFQzWkCz2LrkTWif6Jfn8sXQ-PVxbp0nvs';

const ADMIN_CHAT_ID = 1582980728; // <-- твой chat_id
const DB_FILE = './db.json';
const BASE_URL = 'https://qr.nspk.ru/AS1A003RTQJV7SPH85OPSMRVK29EOS71';
const BASE_PARAMS = { type: '01', bank: '100000000111', sum: '0', cur: 'RUB', crc: '2ddf' };

// ================== ИМПОРТЫ ==================
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// ================== БОТ ==================
const bot = new TelegramBot(TOKEN, { polling: true });
console.log('🤖 Bot started (polling mode)');

// ================== БАЗА ДАННЫХ ==================
function loadDB() {
  let db = { whitelist: [ADMIN_CHAT_ID], history: {}, state: {}, pending: [] };
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      db = { ...db, ...data };
      if (!db.whitelist) db.whitelist = [ADMIN_CHAT_ID];
      if (!db.history) db.history = {};
      if (!db.state) db.state = {};
      if (!db.pending) db.pending = [];
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

function adminMenuKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        ['📋 Управление whitelist'],
        ['📜 История'],
        ['⬅ Назад']
      ],
      resize_keyboard: true
    }
  };
}

// ================== /start ==================
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  if (!db.whitelist.includes(chatId)) {
    const username = msg.from.username || msg.from.first_name;

    if (!db.pending.includes(chatId)) {
      db.pending.push(chatId);
      saveDB(db);

      bot.sendMessage(ADMIN_CHAT_ID,
        `Новый пользователь @${username} (chatId=${chatId}) хочет использовать бота.`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Разрешить', callback_data: `allow_${chatId}` },
                { text: '❌ Запретить', callback_data: `deny_${chatId}` }
              ]
            ]
          }
        }
      );
    }

    return bot.sendMessage(chatId, '⛔ Вы пока не добавлены в белый список. Ожидайте одобрения администратора.');
  }

  db.state[chatId] = null;
  saveDB(db);

  if (chatId === ADMIN_CHAT_ID) {
    bot.sendMessage(chatId, 'Привет админ 👋\nВыбери действие:', adminMenuKeyboard());
  } else {
    bot.sendMessage(chatId, 'Привет 👋\nВыбери действие:', mainKeyboard());
  }
});

// ================== CALLBACK ==================
bot.on('callback_query', (query) => {
  const data = query.data;
  const chatIdAdmin = query.from.id;

  if (chatIdAdmin !== ADMIN_CHAT_ID) {
    return bot.answerCallbackQuery(query.id, { text: '❌ Только админ может управлять доступом' });
  }

  if (data.startsWith('allow_')) {
    const chatId = Number(data.split('_')[1]);
    if (!db.whitelist.includes(chatId)) db.whitelist.push(chatId);
    db.pending = db.pending.filter(id => id !== chatId);
    db.state[chatId] = null; // Инициализируем состояние
    saveDB(db);

    bot.answerCallbackQuery(query.id, { text: '✅ Пользователь разрешен' });
    bot.sendMessage(chatId, '✅ Администратор разрешил вам доступ к боту.\nВыберите действие:', mainKeyboard());

  } else if (data.startsWith('deny_')) {
    const chatId = Number(data.split('_')[1]);
    db.pending = db.pending.filter(id => id !== chatId);
    saveDB(db);

    bot.answerCallbackQuery(query.id, { text: '❌ Пользователь запрещен' });
    bot.sendMessage(chatId, '❌ Администратор отклонил доступ к боту');

  } else if (data.startsWith('remove_')) {
    const chatId = Number(data.split('_')[1]);
    db.whitelist = db.whitelist.filter(id => id !== chatId);
    saveDB(db);

    bot.answerCallbackQuery(query.id, { text: '🗑 Доступ удален' });
    bot.sendMessage(chatId, '🗑 Ваш доступ к боту был удален администратором');
  }
});

// ================== СООБЩЕНИЯ ==================
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (msg.entities && msg.entities.some(e => e.type === 'bot_command')) return;

  console.log(`MSG from ${chatId}: ${text}`);

  if (!db.whitelist.includes(chatId) && chatId !== ADMIN_CHAT_ID) return;

  // ---- Меню админа ----
  if (chatId === ADMIN_CHAT_ID && text === '📋 Управление whitelist') {
    const buttons = [];

    db.pending.forEach(id => {
      buttons.push([
        { text: `Разрешить ${id}`, callback_data: `allow_${id}` },
        { text: `Запретить ${id}`, callback_data: `deny_${id}` }
      ]);
    });

    db.whitelist.filter(id => id !== ADMIN_CHAT_ID).forEach(id => {
      buttons.push([{ text: `Удалить ${id}`, callback_data: `remove_${id}` }]);
    });

    return bot.sendMessage(chatId, '👥 Управление whitelist', { reply_markup: { inline_keyboard: buttons } });
  }

  if (text === '⬅ Назад' && chatId === ADMIN_CHAT_ID) {
    return bot.sendMessage(chatId, 'Главное меню:', adminMenuKeyboard());
  }

  // ---- Создание платежа ----
  if (text === '➕ Создать платёж') {
    db.state[chatId] = 'WAIT_SUM';
    saveDB(db);
    return bot.sendMessage(chatId, '💰 Введите сумму:');
  }

  // ---- Ожидание суммы ----
  if (db.state[chatId] === 'WAIT_SUM') {
    const amount = Number(text);
    if (isNaN(amount) || amount <= 0) return bot.sendMessage(chatId, '❌ Введите корректную сумму');

    db.state[chatId] = null;
    if (!db.history[chatId]) db.history[chatId] = [];
    db.history[chatId].push({ amount, date: new Date().toISOString() });
    saveDB(db);

    // Формируем ссылку
    let params = { ...BASE_PARAMS, sum: Math.round(amount * 100).toString() };
    const query = Object.keys(params).map(k => k + '=' + params[k]).join('&');
    const link = `${BASE_URL}?${query}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(link)}`;

    return bot.sendPhoto(chatId, qrUrl, {
      caption: `ООО "Медицинская Среда"\n💰 Сумма: ${amount} ₽\n🔗 Ссылка: ${link}`,
      ...mainKeyboard().reply_markup ? { reply_markup: mainKeyboard().reply_markup } : {}
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
