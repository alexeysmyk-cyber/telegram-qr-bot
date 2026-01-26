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
  notify_admin_limits: {}, 
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
// защита старого формата users (если там был просто username)
for (const id in db.users) {
  if (typeof db.users[id] === 'string') {
    db.users[id] = {
      username: db.users[id],
      mis_id: null
    };
  } else {
    if (!('mis_id' in db.users[id])) {
      db.users[id].mis_id = null;
    }
  }
}

if (!db.notify_whitelist) db.notify_whitelist = [];
      if (!db.notify_pending) db.notify_pending = [];
      if (!db.notify_settings) db.notify_settings = {};
      if (!db.notify_admin_limits) db.notify_admin_limits = {};


      
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
  if (!db.notify_settings[chatId]) {
    db.notify_settings[chatId] = {};
  }

  const s = db.notify_settings[chatId];

  // автозаполнение отсутствующих полей
  if (!('visit_create' in s)) s.visit_create = 'none';
  if (!('visit_update' in s)) s.visit_update = 'none';
  if (!('visit_cancel' in s)) s.visit_cancel = 'none';
  if (!('visit_finish' in s)) s.visit_finish = 'none';

  if (!('patient_create' in s)) s.patient_create = false;

  if (!('invoice_create' in s)) s.invoice_create = false;
  if (!('invoice_pay' in s)) s.invoice_pay = false;
  if (!('lab_partial' in s)) s.lab_partial = false;
  if (!('lab_full' in s)) s.lab_full = false;

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
        ['➕ Создать платёж' , '📜 История'],
        ['🔔 Уведомления', '🆔 Мой ID в МИС']
         ],
      resize_keyboard: true
    }
  };
}

function adminKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        ['➕ Создать платёж', '📋 Управление доступами'],
        ['📜 История', '🔔 Уведомления (админ)']
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
      db.users[chatId] = {
  username: username,
  mis_id: null
};
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

bot.on('callback_query', (query) => {
  const data = query.data;
  const fromId = query.from.id;

  // игнор пустых заголовков
  if (data === 'noop') {
    return bot.answerCallbackQuery(query.id);
  }

    // ================== АДМИН: ОЧИСТКА ИСТОРИИ ==================
  // ================== АДМИН: ПОДТВЕРЖДЕНИЕ ОЧИСТКИ ИСТОРИИ ==================

  if (data === 'admin_clear_history_ask') {

    // защита: только админ
    if (fromId !== ADMIN_CHAT_ID) {
      return bot.answerCallbackQuery(query.id, { text: '❌ Только администратор может это сделать' });
    }

    return bot.sendMessage(fromId,
      '⚠️ Вы уверены, что хотите удалить ВСЮ историю?\n\nЭто действие нельзя отменить.',
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Да, удалить', callback_data: 'admin_clear_history_yes' },
              { text: '❌ Отмена', callback_data: 'admin_clear_history_no' }
            ]
          ]
        }
      }
    );
  }

  // подтверждение "ДА"
  if (data === 'admin_clear_history_yes') {

    if (fromId !== ADMIN_CHAT_ID) {
      return bot.answerCallbackQuery(query.id, { text: '❌ Только администратор может это сделать' });
    }

    db.history = {};
    saveDB(db);

    bot.answerCallbackQuery(query.id, { text: '🗑 История очищена' });

    return bot.sendMessage(fromId, '🗑 Вся история успешно очищена');
  }

  // отмена
  if (data === 'admin_clear_history_no') {

    if (fromId !== ADMIN_CHAT_ID) {
      return bot.answerCallbackQuery(query.id, { text: '❌ Только администратор может это сделать' });
    }

    bot.answerCallbackQuery(query.id, { text: 'Отменено' });

    return bot.sendMessage(fromId, '❎ Очистка истории отменена');
  }

 

    // ================== АДМИН-МЕНЮ УВЕДОМЛЕНИЙ ==================

  if (data === 'admin_notify_self') {
    // админ настраивает себя как обычный пользователь
    return showNotifyMenu(fromId);
  }

  if (data === 'admin_notify_users') {
    const buttons = [];

    if (db.notify_whitelist.length === 0) {
      return bot.sendMessage(fromId, '📭 Нет пользователей с доступом к уведомлениям');
    }

    db.notify_whitelist.forEach(id => {
      const username = db.users[id] || id;
      buttons.push([
        { text: `👤 ${username}`, callback_data: `admin_user_${id}` }
      ]);
    });

    return bot.sendMessage(fromId, '👥 Пользователи с доступом к уведомлениям:', {
      reply_markup: { inline_keyboard: buttons }
    });
  }

    // ================== АДМИН: ВЫБОР ПОЛЬЗОВАТЕЛЯ ==================

  if (data.startsWith('admin_user_')) {
    const userId = Number(data.replace('admin_user_', ''));
    const username = db.users[userId] || userId;

    if (!db.notify_admin_limits[userId]) {
      db.notify_admin_limits[userId] = {};
    }

    const limits = db.notify_admin_limits[userId];

    function limitLabel(key) {
      return limits[key] === false ? '🚫 запрещено' : '✅ разрешено';
    }

    const buttons = [
      [{ text: `🩺 Создание визита — ${limitLabel('visit_create')}`, callback_data: `admin_limit_${userId}_visit_create` }],
      [{ text: `👤 Создание пациента — ${limitLabel('patient_create')}`, callback_data: `admin_limit_${userId}_patient_create` }],
      [{ text: `✏️ Обновление визита — ${limitLabel('visit_update')}`, callback_data: `admin_limit_${userId}_visit_update` }],
      [{ text: `❌ Отмена визита — ${limitLabel('visit_cancel')}`, callback_data: `admin_limit_${userId}_visit_cancel` }],
      [{ text: `✅ Завершение визита — ${limitLabel('visit_finish')}`, callback_data: `admin_limit_${userId}_visit_finish` }],

      [{ text: `🧾 Создание счёта — ${limitLabel('invoice_create')}`, callback_data: `admin_limit_${userId}_invoice_create` }],
      [{ text: `💳 Оплата счёта — ${limitLabel('invoice_pay')}`, callback_data: `admin_limit_${userId}_invoice_pay` }],
      [{ text: `🧪 Частичная готовность — ${limitLabel('lab_partial')}`, callback_data: `admin_limit_${userId}_lab_partial` }],
      [{ text: `🔬 Полная готовность — ${limitLabel('lab_full')}`, callback_data: `admin_limit_${userId}_lab_full` }],

      [{ text: '⬅️ Назад', callback_data: 'admin_notify_users' }]
    ];

    return bot.sendMessage(fromId, `👤 ${username} — ограничения уведомлений`, {
      reply_markup: { inline_keyboard: buttons }
    });
  }

  // ================== АДМИН: ПЕРЕКЛЮЧЕНИЕ ОГРАНИЧЕНИЙ ==================

  if (data.startsWith('admin_limit_')) {
    // формат: admin_limit_<userId>_<key>
    const parts = data.split('_');
    const userId = Number(parts[2]);
    const key = parts.slice(3).join('_'); // visit_create и т.п.

    if (!db.notify_admin_limits[userId]) {
      db.notify_admin_limits[userId] = {};
    }

    // переключаем: если было false → удаляем (разрешаем), иначе запрещаем
    if (db.notify_admin_limits[userId][key] === false) {
      delete db.notify_admin_limits[userId][key];
    } else {
      db.notify_admin_limits[userId][key] = false;
    }

    saveDB(db);

    // обновляем экран пользователя
    const username = db.users[userId] || userId;
    const limits = db.notify_admin_limits[userId];

    function limitLabel(key) {
      return limits[key] === false ? '🚫 запрещено' : '✅ разрешено';
    }

    const buttons = [
      [{ text: `🩺 Создание визита — ${limitLabel('visit_create')}`, callback_data: `admin_limit_${userId}_visit_create` }],
      [{ text: `👤 Создание пациента — ${limitLabel('patient_create')}`, callback_data: `admin_limit_${userId}_patient_create` }],
      [{ text: `✏️ Обновление визита — ${limitLabel('visit_update')}`, callback_data: `admin_limit_${userId}_visit_update` }],
      [{ text: `❌ Отмена визита — ${limitLabel('visit_cancel')}`, callback_data: `admin_limit_${userId}_visit_cancel` }],
      [{ text: `✅ Завершение визита — ${limitLabel('visit_finish')}`, callback_data: `admin_limit_${userId}_visit_finish` }],

      [{ text: `🧾 Создание счёта — ${limitLabel('invoice_create')}`, callback_data: `admin_limit_${userId}_invoice_create` }],
      [{ text: `💳 Оплата счёта — ${limitLabel('invoice_pay')}`, callback_data: `admin_limit_${userId}_invoice_pay` }],
      [{ text: `🧪 Частичная готовность — ${limitLabel('lab_partial')}`, callback_data: `admin_limit_${userId}_lab_partial` }],
      [{ text: `🔬 Полная готовность — ${limitLabel('lab_full')}`, callback_data: `admin_limit_${userId}_lab_full` }],

      [{ text: '⬅️ Назад', callback_data: 'admin_notify_users' }]
    ];

    return bot.sendMessage(fromId, `👤 ${username} — ограничения уведомлений`, {
      reply_markup: { inline_keyboard: buttons }
    });
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
          patient_create: false,
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

  // mode_visit_create_self
  // parts = ["mode","visit","create","self"]

  const key = parts[1] + '_' + parts[2];   // visit_create
  const mode = parts[3];                  // self / all / none / on / off
  const chatId = fromId;

  if (!db.notify_settings[chatId]) {
    db.notify_settings[chatId] = {};
  }

  // 3 варианта
  if (['self','all','none'].includes(mode)) {
    db.notify_settings[chatId][key] = mode;
  }

  // 2 варианта
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

  // ---- Меню админа: 
  if (chatId === ADMIN_CHAT_ID) {

     if (text === '🔔 Уведомления (админ)') {
      return bot.sendMessage(chatId, '🔔 Управление уведомлениями', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '👤 Мои настройки', callback_data: 'admin_notify_self' }],
            [{ text: '👥 Пользователи', callback_data: 'admin_notify_users' }]
          ]
        }
      });
    }



    
  if (text === '📋 Управление доступами') {

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
// ---- История ----
if (text === '📜 История') {

  // 👑 Админ — видит историю всех + кнопку очистки
  if (chatId === ADMIN_CHAT_ID) {

    const allHistory = Object.keys(db.history)
      .map(cid => {

        // 🔥 правильно получаем username
        let username = cid;
        if (db.users[cid]) {
          if (typeof db.users[cid] === 'string') {
            username = db.users[cid];
          } else {
            username = db.users[cid].username || cid;
          }
        }

        const history = db.history[cid];
        if (!history || history.length === 0) return null;

        const list = history
          .map((h, i) => `${i + 1}. ${h.amount} ₽ — ${h.date}`)
          .join('\n');

        return `👤 @${username}:\n${list}`;
      })
      .filter(Boolean)
      .join('\n\n');

    return bot.sendMessage(chatId, allHistory || '📭 История пуста', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🗑 Очистить всю историю', callback_data: 'admin_clear_history_ask' }]
        ]
      }
    });
  }

  // 👤 Обычный пользователь — только своя история
  const history = db.history[chatId] || [];
  if (history.length === 0) {
    return bot.sendMessage(chatId, '📭 История пуста');
  }

  const textHistory = history
    .map((h, i) => `${i + 1}. ${h.amount} ₽ — ${h.date}`)
    .join('\n');

  return bot.sendMessage(chatId, `📜 Ваша история:\n\n${textHistory}`);
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
























