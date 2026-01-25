// ================== НАСТРОЙКИ ==================
const TOKEN = '8482523179:AAFQzWkCz2LrkTWif6Jfn8sXQ-PVxbp0nvs';
const ADMIN_CHAT_ID = 1582980728; 
const DB_FILE = './db.json';
const BASE_URL = 'https://qr.nspk.ru/AS1A003RTQJV7SPH85OPSMRVK29EOS71';
const BASE_PARAMS = { type: '01', bank: '100000000111', sum: '0', cur: 'RUB', crc: '2ddf' };

// ================== ИМПОРТЫ ==================
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();

app.use(bodyParser.json());

app.use((req, res, next) => {
  console.log(`🌐 HTTP ${req.method} ${req.url}`);
  next();
});

// ================== БОТ ==================
const bot = new TelegramBot(TOKEN, { polling: true });
console.log('🤖 Bot started (polling mode)');

// ================== БАЗА ДАННЫХ ==================
function loadDB() {
  let db = {
  whitelist: [ADMIN_CHAT_ID],
  notify_whitelist: [],
  history: {},
  state: {},
  pending: [],
  notify_pending: [],
  notify_settings: {}, 
  users: {}
};

  if (fs.existsSync(DB_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      db = { ...db, ...data };
      if (!db.whitelist) db.whitelist = [ADMIN_CHAT_ID];
      if (!db.history) db.history = {};
      if (!db.state) db.state = {};
      if (!db.pending) db.pending = [];
      if (!db.users) db.users = {};
      if (!db.notify_whitelist) db.notify_whitelist = [];
      if (!db.notify_pending) db.notify_pending = [];
      if (!db.notify_settings) db.notify_settings = {};
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
function showNotifyMenu(chatId) {
  const s = db.notify_settings[chatId];

  function threeLabel(v) {
    if (v === 'self') return '👤';
    if (v === 'all') return '👥';
    return '🔕';
  }

  function twoLabel(v) {
    return v ? '✅' : '🔕';
  }

  const buttons = [

    [{ text: `🩺 Создание визита — ${threeLabel(s.visit_create)}`, callback_data: 'set_visit_create' }],
    [{ text: `👤 Создание пациента — ${twoLabel(s.patient_create)}`, callback_data: 'set_patient_create' }],
    [{ text: `✏️ Обновление визита — ${threeLabel(s.visit_update)}`, callback_data: 'set_visit_update' }],
    [{ text: `❌ Отмена визита — ${threeLabel(s.visit_cancel)}`, callback_data: 'set_visit_cancel' }],
    [{ text: `✅ Завершение визита — ${threeLabel(s.visit_finish)}`, callback_data: 'set_visit_finish' }],

    [{ text: `🧾 Создание счёта — ${twoLabel(s.invoice_create)}`, callback_data: 'set_invoice_create' }],
    [{ text: `💳 Оплата счёта физ-лица — ${twoLabel(s.invoice_pay)}`, callback_data: 'set_invoice_pay' }],
    [{ text: `🧪 Частичная готовность анализов — ${twoLabel(s.lab_partial)}`, callback_data: 'set_lab_partial' }],
    [{ text: `🔬 Полная готовность анализов — ${twoLabel(s.lab_full)}`, callback_data: 'set_lab_full' }]
  ];

  bot.sendMessage(chatId, '⚙️ Настройки уведомлений\n\nТекущие состояния показаны справа:', {
    reply_markup: { inline_keyboard: buttons }
  });
}



function mainKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        ['➕ Создать платёж'],
        ['📜 История'],
        ['🔔 Уведомления']
      ],
      resize_keyboard: true
    }
  };
}

function adminKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        ['➕ Создать платёж', '📋 Управление whitelist'],
        ['📜 История', '🗑 Очистить историю']
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
      db.users[chatId] = username;
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
    bot.sendMessage(chatId, 'Привет админ 👋\nВыбери действие:', adminKeyboard());
  } else {
    bot.sendMessage(chatId, 'Привет 👋\nВыбери действие:', mainKeyboard());
  }
});

// ================== CALLBACK (Разрешить/Запретить/Удалить) ==================
// ================== CALLBACK (Разрешить/Запретить/Удалить + Уведомления) ==================
// ================== CALLBACK ==================
bot.on('callback_query', (query) => {
  const data = query.data;
  const fromId = query.from.id;

  // игнор пустых заголовков
  if (data === 'noop') {
    return bot.answerCallbackQuery(query.id);
  }

  // ================== АДМИНСКИЕ ДЕЙСТВИЯ ==================

  if (
    data.startsWith('allow_') ||
    data.startsWith('deny_') ||
    data.startsWith('remove_') ||
    data.startsWith('notify_allow_') ||
    data.startsWith('notify_deny_') ||
    data.startsWith('notify_remove_')
  ) {

    // проверка что это админ
    if (fromId !== ADMIN_CHAT_ID) {
      return bot.answerCallbackQuery(query.id, { text: '❌ Только администратор может управлять доступами' });
    }

    // ---- Доступ к боту ----
    if (data.startsWith('allow_')) {
      const chatId = Number(data.split('_')[1]);
      if (!db.whitelist.includes(chatId)) db.whitelist.push(chatId);
      db.pending = db.pending.filter(id => id !== chatId);
      saveDB(db);

      bot.answerCallbackQuery(query.id, { text: '✅ Пользователь разрешен' });
      bot.sendMessage(chatId, '✅ Администратор разрешил вам доступ к боту. Выберите действие:', mainKeyboard());
    }

    else if (data.startsWith('deny_')) {
      const chatId = Number(data.split('_')[1]);
      db.pending = db.pending.filter(id => id !== chatId);
      saveDB(db);

      bot.answerCallbackQuery(query.id, { text: '❌ Пользователь запрещен' });
      bot.sendMessage(chatId, '❌ Администратор отклонил доступ к боту');
    }

    else if (data.startsWith('remove_')) {
      const chatId = Number(data.split('_')[1]);
      db.whitelist = db.whitelist.filter(id => id !== chatId);
      saveDB(db);

      bot.answerCallbackQuery(query.id, { text: '🗑 Доступ удален' });
      bot.sendMessage(chatId, '🗑 Ваш доступ к боту был удален администратором');
    }

    // ---- Уведомления: разрешить / запретить / удалить ----
    else if (data.startsWith('notify_allow_')) {
      const chatId = Number(data.split('_')[2]);

      if (!db.notify_whitelist.includes(chatId)) {
        db.notify_whitelist.push(chatId);
      }

      if (!db.notify_settings[chatId]) {
        db.notify_settings[chatId] = {
          visit_create: "none",
          visit_update: "none",
          visit_cancel: "none",
          visit_finish: "none",
          invoice_create: false,
          patient_create: "false",
          invoice_pay: false,
          lab_partial: false,
          lab_full: false
        };
      }

      db.notify_pending = db.notify_pending.filter(id => id !== chatId);
      saveDB(db);

      bot.answerCallbackQuery(query.id, { text: '✅ Уведомления разрешены' });
      bot.sendMessage(chatId, '🔔 Администратор разрешил вам доступ к уведомлениям.\nТеперь вы можете их настроить.');
    }

    else if (data.startsWith('notify_deny_')) {
      const chatId = Number(data.split('_')[2]);
      db.notify_pending = db.notify_pending.filter(id => id !== chatId);
      saveDB(db);

      bot.answerCallbackQuery(query.id, { text: '❌ Уведомления запрещены' });
      bot.sendMessage(chatId, '❌ Администратор отклонил ваш запрос на уведомления.');
    }

    else if (data.startsWith('notify_remove_')) {
      const chatId = Number(data.split('_')[2]);
      db.notify_whitelist = db.notify_whitelist.filter(id => id !== chatId);
      saveDB(db);

      bot.answerCallbackQuery(query.id, { text: '🗑 Уведомления отключены' });
      bot.sendMessage(chatId, '🔕 Администратор отключил вам доступ к уведомлениям.');
    }

    return;
  }

  // ================== ПОЛЬЗОВАТЕЛЬСКИЕ НАСТРОЙКИ УВЕДОМЛЕНИЙ ==================

  // выбор события
if (data.startsWith('set_')) {
  const key = data.replace('set_', '');
  const chatId = fromId;
  const s = db.notify_settings[chatId];

  const threeMode = ['visit_create','visit_update','visit_cancel','visit_finish'];

  // ----- 3 варианта -----
  if (threeMode.includes(key)) {
    const current = s[key]; // self / all / none

    return bot.sendMessage(chatId, 'Выберите режим уведомлений:', {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: (current === 'self' ? '✅ ' : '') + '👤 Только для себя',
              callback_data: `mode_${key}_self`
            },
            {
              text: (current === 'all' ? '✅ ' : '') + '👥 Для всех',
              callback_data: `mode_${key}_all`
            }
          ],
          [
            {
              text: (current === 'none' ? '✅ ' : '') + '🔕 Не получать',
              callback_data: `mode_${key}_none`
            }
          ]
        ]
      }
    });
  }

  // ----- 2 варианта -----
  const current = s[key]; // true / false

  return bot.sendMessage(chatId, 'Получать уведомления?', {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: (current === true ? '✅ ' : '') + 'Получать',
            callback_data: `mode_${key}_on`
          },
          {
            text: (current === false ? '✅ ' : '') + 'Не получать',
            callback_data: `mode_${key}_off`
          }
        ]
      ]
    }
  });
}


  // сохранение выбора
  if (data.startsWith('mode_')) {
    const parts = data.split('_');
    const key = parts[1];
    const mode = parts[2];
    const chatId = fromId;

    if (!db.notify_settings[chatId]) return;

    if (['self','all','none'].includes(mode)) {
      db.notify_settings[chatId][key] = mode;
    }

    if (mode === 'on') db.notify_settings[chatId][key] = true;
    if (mode === 'off') db.notify_settings[chatId][key] = false;

    saveDB(db);

    bot.answerCallbackQuery(query.id, { text: '✅ Настройка сохранена' });
    showNotifyMenu(chatId);
    return;
  }

});

// ================== СООБЩЕНИЯ ==================
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (msg.entities && msg.entities.some(e => e.type === 'bot_command')) return;

  console.log(`MSG from ${chatId}: ${text}`);

  if (!db.whitelist.includes(chatId) && chatId !== ADMIN_CHAT_ID) return;

  // ---- Меню админа: управление whitelist и история ----
  if (chatId === ADMIN_CHAT_ID) {
   if (text === '📋 Управление whitelist') {
  const buttons = [];

  // ---- Заявки на доступ к боту ----
  if (db.pending.length > 0) {
    buttons.push([{ text: '⏳ Заявки на доступ к QR', callback_data: 'noop' }]);

    db.pending.forEach(id => {
      const username = db.users[id] || id;
      buttons.push([
        { text: `✅ ${username}`, callback_data: `allow_${id}` },
        { text: `❌ ${username}`, callback_data: `deny_${id}` }
      ]);
    });
  }

  // ---- Доступ к QR (боту) ----
  buttons.push([{ text: '📌 Доступ к QR', callback_data: 'noop' }]);

  db.whitelist
    .filter(id => id !== ADMIN_CHAT_ID)
    .forEach(id => {
      const username = db.users[id] || id;
      buttons.push([
        { text: `❌ Убрать QR у ${username}`, callback_data: `remove_${id}` }
      ]);
    });

  // ---- Доступ к уведомлениям ----
  buttons.push([{ text: '🔔 Доступ к уведомлениям', callback_data: 'noop' }]);

  db.notify_whitelist.forEach(id => {
    const username = db.users[id] || id;
    buttons.push([
      { text: `❌ Убрать уведомления у ${username}`, callback_data: `notify_remove_${id}` }
    ]);
  });

  return bot.sendMessage(chatId, '👥 Управление доступами', {
    reply_markup: { inline_keyboard: buttons }
  });
}

    if (text === '🗑 Очистить историю') {
      db.history = {};
      saveDB(db);
      return bot.sendMessage(chatId, '🗑 История очищена');
    }
  }
if (text === '🔔 Уведомления') {

  // нет доступа
  if (!db.notify_whitelist.includes(chatId)) {

    if (db.notify_pending.includes(chatId)) {
      return bot.sendMessage(chatId, '⏳ Заявка на уведомления уже отправлена. Ожидайте решения администратора.');
    }

    const username = db.users[chatId] || msg.from.username || msg.from.first_name;

    db.notify_pending.push(chatId);
    saveDB(db);

    bot.sendMessage(ADMIN_CHAT_ID,
      `🔔 Пользователь @${username} (chatId=${chatId}) запрашивает доступ к уведомлениям.`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Разрешить уведомления', callback_data: `notify_allow_${chatId}` },
              { text: '❌ Запретить', callback_data: `notify_deny_${chatId}` }
            ]
          ]
        }
      }
    );

    return bot.sendMessage(chatId, '📨 Заявка на получение уведомлений отправлена администратору.');
  }

  // есть доступ → показываем меню настроек
  return showNotifyMenu(chatId);
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

  // Выбираем клавиатуру в зависимости от роли
  const keyboard = (chatId === ADMIN_CHAT_ID) ? adminKeyboard() : mainKeyboard();

  return bot.sendPhoto(chatId, qrUrl, {
    caption: `ООО "Медицинская Среда"\n💰 Сумма: ${amount} ₽\n🔗 Ссылка: ${link}`,
    reply_markup: keyboard.reply_markup
  });
}

  // ---- История ----
  if (text === '📜 История') {
    const history = db.history[chatId] || [];
    if (history.length === 0) return bot.sendMessage(chatId, '📭 История пуста');

    const textHistory = history.map((h, i) => `${i + 1}. ${h.amount} ₽ — ${h.date}`).join('\n');
    return bot.sendMessage(chatId, `📜 История:\n\n${textHistory}`);
  }
});

// ================== HTTP SERVER (TEST) ==================


// ================== HTTP SERVER (ДЛЯ WEBHOOK ОТ СЕРВИСОВ) ==================

const PORT = process.env.PORT; // ❗ НЕ ставим 3000 вручную

app.get('/ping', (req, res) => {
  res.send('OK');
});

const server = app.listen(PORT, () => {
  console.log('🌐 HTTP server started on port', PORT);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn('⚠️ Port already in use, HTTP server not started (but bot continues working)');
  } else {
    console.error('HTTP server error:', err);
  }
});


// ================== ОШИБКИ ==================
bot.on('polling_error', (e) => {
  console.error('Polling error:', e.message);
});













