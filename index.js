// ================== НАСТРОЙКИ ==================
const ADMIN_CHAT_ID = 1582980728; 
const SECRET_KEY = 'SredaSecretKey';
const path = require('path');
const DB_FILE = path.join(__dirname, 'db.json');
const BASE_QR_URL = 'https://qr.nspk.ru/AS1A003RTQJV7SPH85OPSMRVK29EOS71';
const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) {
  console.error('❌ НЕ ЗАДАНА ПЕРЕМЕННАЯ ОКРУЖЕНИЯ BOT_TOKEN');
  process.exit(1);
}
const BASE_PARAMS = { type: '01', bank: '100000000111', sum: '0', cur: 'RUB', crc: '2ddf' };

// ================== ИМПОРТЫ ==================
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const { handleMisWebhook } = require('./misWebhook');
const { cleanupLabs } = require('./cleanupLabs');
const { runUpcomingVisitsNotifications } = require('./scheduledNotifications');


const app = express();

app.use(bodyParser.json({ limit: '20mb' }));
app.use(bodyParser.urlencoded({ limit: '20mb', extended: true }));


app.use((req, res, next) => {
  console.log(`🌐 HTTP ${req.method} ${req.url}`);
  next();
});

// Mini App static
app.use('/miniapp', express.static(path.join(__dirname, 'miniapp')));


// ================== БОТ ==================
const bot = new TelegramBot(TOKEN, { polling: true });
console.log('🤖 Bot started (polling mode)');

const { initMisModule } = require('./misModule');

initMisModule({
  bot,
  loadDB,
  saveDB,
  getUsername,
  formatDate 
});

const crypto = require('crypto');

app.post('/api/auth/telegram', express.json(), async (req, res) => {
  try {
    const { initData } = req.body;

    if (!initData) {
      return res.status(403).json({ code: "NO_INIT_DATA" });
    }

    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) {
      return res.status(403).json({ code: "NO_HASH" });
    }

    params.delete('hash');

    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(TOKEN)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (calculatedHash !== hash) {
      return res.status(403).json({ code: "INVALID_SIGNATURE" });
    }

    const userRaw = params.get('user');
    if (!userRaw) {
      return res.status(403).json({ code: "NO_USER" });
    }

    const user = JSON.parse(userRaw);
    const db = loadDB();

    if (!db.whitelist.includes(user.id)) {
      return res.status(403).json({ code: "NOT_AUTHORIZED" });
    }

    const dbUser = db.users?.[String(user.id)];

    if (!dbUser) {
      return res.status(403).json({ code: "USER_NOT_IN_DB" });
    }

    if (!dbUser.mis_id) {
      return res.status(403).json({ code: "NO_MIS_ID" });
    }

    // ===== Проверяем роль в MIS =====
    const body = qs.stringify({
      api_key: process.env.API_KEY,
      clinic_id: 2997
    });

    const url = process.env.BASE_URL.replace(/\/$/, '') + '/getUsers';

    const response = await axios.post(url, body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    if (!response.data || response.data.error !== 0) {
      return res.status(500).json({ code: "MIS_ERROR" });
    }

    const users = response.data.data;

    const misUser = users.find(u =>
      String(u.id) === String(dbUser.mis_id)
    );

    if (!misUser) {
      return res.status(403).json({ code: "MIS_USER_NOT_FOUND" });
    }

    const roles = misUser.role || [];

    const isDoctor = roles.includes("16354");
    const isDirector = roles.includes("16353");

    if (!isDoctor && !isDirector) {
      return res.status(403).json({ code: "ROLE_NOT_ALLOWED" });
    }

    return res.json({
      ok: true,
      isDoctor,
      isDirector
    });

  } catch (err) {
    console.error("Auth error:", err);
    return res.status(500).json({ code: "SERVER_ERROR" });
  }
});
;

// ================== Роутер ==================
const misRouter = require('./routes/mis');
app.use('/api/mis', misRouter);

// ================== БАЗА ДАННЫХ ==================
function loadDB() {

  // базовая структура ТОЛЬКО как шаблон
  let base = {
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

  if (!fs.existsSync(DB_FILE)) {
    console.error('❌ DB FILE NOT FOUND:', DB_FILE);
    return base;   // но НЕ сохраняем!
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');

    if (!raw || raw.trim().length === 0) {
      console.error('❌ DB FILE IS EMPTY — REFUSING TO OVERWRITE');
      return base;
    }

    const data = JSON.parse(raw);

    // аккуратно объединяем шаблон и реальные данные
    let db = { ...base, ...data };

    if (!db.whitelist) db.whitelist = [ADMIN_CHAT_ID];
    if (!db.history) db.history = {};
    if (!db.state) db.state = {};
    if (!db.pending) db.pending = [];
    if (!db.users) db.users = {};

    // защита старого формата users
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

    return db;   // 🔥 ВАЖНО: НЕ СОХРАНЯЕМ ТУТ

  } catch (e) {
    console.error('❌ DB parse error — refusing to recreate DB:', e.message);
    return base;
  }
}


function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

let db = loadDB();

function getUsername(id) {
  if (db.users[id]) {
    if (typeof db.users[id] === 'string') {
      return db.users[id];
    } else {
      return db.users[id].username || id;
    }
  }
  return id;
}


// ================== УТИЛИТЫ ДАТ ==================
function formatDate(d, time) {
  const [h, m] = time.split(':');
  d.setHours(h, m, 0, 0);

  return d
    .toLocaleDateString('ru-RU')
    .replace(/\//g, '.') + ' ' + time;
}


// ================== КНОПКИ ==================
function showNotifyMenu(chatId) {
  if (!db.notify_settings[chatId]) {
    db.notify_settings[chatId] = {};
  }

  const s = db.notify_settings[chatId];

  // автозаполнение отсутствующих полей
  if (!('visit_create' in s)) s.visit_create = 'none';
  if (!('visit_cancel' in s)) s.visit_cancel = 'none';
  if (!('visit_move' in s)) s.visit_move = 'none';
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
    [{ text: `👤 Создание пациента — ${twoLabel(s.patient_create)}`, callback_data: 'set_patient_create' }],
    [{ text: `🩺 Создание визита — ${threeLabel(s.visit_create)}`, callback_data: 'set_visit_create' }],
    [{ text: `❌ Отмена визита — ${threeLabel(s.visit_cancel)}`, callback_data: 'set_visit_cancel' }],
    [{ text: `🔁 Перенос визита — ${threeLabel(s.visit_move)}`, callback_data: 'set_visit_move' }],
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
        ['💰 Финансы', '⚙️ Настройки'],
        [
          {
            text: '🏥 Работа в МИС',
            web_app: { url: 'https://sreda-clinic.bothost.ru/miniapp/' }
          },
          '📅 Визиты'
        ]
      ],
      resize_keyboard: true
    }
  };
}

function settingsKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        ['🔔 Уведомления' , '🆔 Мой ID в МИС'],
        ['📢 Оповещения' , '⬅️ Назад']
      ],
      resize_keyboard: true
    }
  };
}

function misKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        ['📅 Визиты'],
        ['Будет позже'],
        ['⬅️ Назад']
      ],
      resize_keyboard: true
    }
  };
}


function financeKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        ['➕ Создать платёж'],
        ['📜 История'],
        ['⬅️ Назад']
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

bot.on('callback_query', async (query) => {
  const data = query.data;
  const fromId = query.from.id;

  // ===== СКАЧИВАНИЕ PDF АНАЛИЗОВ =====
if (data.startsWith('download_lab_')) {

  const path = require('path');
  const fs = require('fs');

  const fileName = data.replace('download_lab_', '');
  const filePath = path.join(__dirname, 'data',  fileName);

  if (!fs.existsSync(filePath)) {
    return bot.answerCallbackQuery(query.id, {
      text: '❌ Файл уже удалён (старше 7 дней)',
      show_alert: true
    });
  }

  try {
    await bot.sendDocument(fromId, filePath);
    return bot.answerCallbackQuery(query.id);
  } catch (e) {
    console.error('❌ Ошибка отправки PDF:', e.message);
    return bot.answerCallbackQuery(query.id, {
      text: '❌ Не удалось отправить файл',
      show_alert: true
    });
  }
}


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

const username = getUsername(id);

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
 const username = getUsername(userId);


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
      [{ text: `❌ Отмена визита — ${limitLabel('visit_cancel')}`, callback_data: `admin_limit_${userId}_visit_cancel` }],
      [{ text: `🔁 Перенос визита — ${limitLabel('visit_move')}`, callback_data: `admin_limit_${userId}_visit_move` }],
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
const username = getUsername(userId);

    const limits = db.notify_admin_limits[userId];

    function limitLabel(key) {
      return limits[key] === false ? '🚫 запрещено' : '✅ разрешено';
    }

    const buttons = [
      [{ text: `🩺 Создание визита — ${limitLabel('visit_create')}`, callback_data: `admin_limit_${userId}_visit_create` }],
      [{ text: `👤 Создание пациента — ${limitLabel('patient_create')}`, callback_data: `admin_limit_${userId}_patient_create` }],
      [{ text: `❌ Отмена визита — ${limitLabel('visit_cancel')}`, callback_data: `admin_limit_${userId}_visit_cancel` }],
      [{ text: `🔁 Перенос визита — ${limitLabel('visit_move')}`, callback_data: `admin_limit_${userId}_visit_move` }],
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
if (!db.users[chatId]) {
  db.users[chatId] = { username: null, mis_id: null };
}

if (!db.users[chatId].username) {
  db.users[chatId].username = getUsername(chatId);
}


      if (!db.notify_whitelist.includes(chatId)) {
        db.notify_whitelist.push(chatId);
      }

      if (!db.notify_settings[chatId]) {
        db.notify_settings[chatId] = {
          visit_create: "none",
          visit_cancel: "none",
          visit_move: "none",
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
// ================== M I S   I D ==================

if (data === 'alerts_setup') {
  return bot.sendMessage(fromId, '⚙️ Что настроим?', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📅 Визиты', callback_data: 'setup_upcoming_visits' }]
      ]
    }
  });
}

  if (data === 'setup_upcoming_visits') {
  return bot.sendMessage(fromId, 'Для каких визитов?', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '👤 Только мои', callback_data: 'upcoming_mode_self' }],
        [{ text: '👥 Все', callback_data: 'upcoming_mode_all' }]
      ]
    }
  });
}

if (data === 'alerts_show') {
  const list = db.scheduled_notifications?.[fromId]?.upcoming_visits;

  if (!Array.isArray(list) || list.length === 0) {
    return bot.sendMessage(fromId, '📭 Оповещения не настроены');
  }

  const buttons = list.map(o => ([
    {
      text: `📅 ${o.time} · ${o.mode === 'self' ? '👤 мои' : '👥 все'}`,
      callback_data: `alert_view_${o.id}`
    }
  ]));

  return bot.sendMessage(fromId, '📢 Ваши оповещения:', {
    reply_markup: { inline_keyboard: buttons }
  });
}
if (data.startsWith('alert_view_')) {
  const alertId = data.replace('alert_view_', '');
  const list = db.scheduled_notifications[fromId].upcoming_visits;
  const alert = list.find(a => a.id === alertId);

  if (!alert) {
    return bot.sendMessage(fromId, '❌ Оповещение не найдено');
  }

  return bot.sendMessage(
    fromId,
    `📅 Визиты\n\n` +
    `⏰ Время: ${alert.time}\n` +
    `Режим: ${alert.mode === 'self' ? '👤 только мои' : '👥 все'}\n` +
    `Статус: ${alert.enabled ? '✅ включено' : '🔕 выключено'}`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: alert.enabled ? '🔕 Отключить' : '🔔 Включить', callback_data: `alert_toggle_${alertId}` }],
          [{ text: '🗑 Удалить', callback_data: `alert_delete_${alertId}` }],
          [{ text: '⬅️ Назад', callback_data: 'alerts_show' }]
        ]
      }
    }
  );
}

  if (data.startsWith('alert_toggle_')) {
  const id = data.replace('alert_toggle_', '');
  const list = db.scheduled_notifications[fromId].upcoming_visits;
  const alert = list.find(a => a.id === id);

  if (!alert) return;

  alert.enabled = !alert.enabled;
  saveDB(db);

  return bot.answerCallbackQuery(query.id, { text: '✅ Статус изменён' });
}
  
if (data.startsWith('alert_delete_')) {
  const alertId = data.replace('alert_delete_', '');

  if (
    !db.scheduled_notifications ||
    !db.scheduled_notifications[fromId] ||
    !Array.isArray(db.scheduled_notifications[fromId].upcoming_visits)
  ) {
    return bot.answerCallbackQuery(query.id, {
      text: '❌ Оповещение не найдено',
      show_alert: true
    });
  }

  const before = db.scheduled_notifications[fromId].upcoming_visits.length;

  db.scheduled_notifications[fromId].upcoming_visits =
    db.scheduled_notifications[fromId].upcoming_visits.filter(
      a => a.id !== alertId
    );

  const after = db.scheduled_notifications[fromId].upcoming_visits.length;

  saveDB(db);

  // 🔔 ОБЯЗАТЕЛЬНО ответить Telegram
  await bot.answerCallbackQuery(query.id, {
    text: '🗑 Оповещение удалено'
  });

  // 🧼 Если список пуст — сообщение
  if (after === 0) {
    return bot.sendMessage(fromId, '📭 Оповещений больше нет');
  }

  // 🔄 ИНАЧЕ — обновляем список
  return bot.sendMessage(fromId, '📢 Обновлённый список оповещений:', {
    reply_markup: {
      inline_keyboard: db.scheduled_notifications[fromId].upcoming_visits.map(o => ([
        {
          text: `📅 ${o.time} · ${o.mode === 'self' ? '👤 мои' : '👥 все'}`,
          callback_data: `alert_view_${o.id}`
        }
      ]))
    }
  });
}




  if (data.startsWith('upcoming_mode_')) {
  const mode = data.endsWith('self') ? 'self' : 'all';

  if (!db.scheduled_notifications) db.scheduled_notifications = {};
  if (!db.scheduled_notifications[fromId]) db.scheduled_notifications[fromId] = {};

const alertId = 'uv_' + Date.now();

if (!db.scheduled_notifications[fromId].upcoming_visits) {
  db.scheduled_notifications[fromId].upcoming_visits = [];
}

db.scheduled_notifications[fromId].upcoming_visits.push({
  id: alertId,
  enabled: true,
  mode,
  time: null,
  last_sent: null
});

// 🔑 ВАЖНО
db.state[fromId] = {
  type: 'WAIT_UPCOMING_TIME',
  alertId
};

saveDB(db);

return bot.sendMessage(fromId, '⏰ Во сколько присылать? (например 07:00)');
  }

  
  

if (data === 'mis_edit') {
  db.state[fromId] = 'WAIT_MIS_ID';
  saveDB(db);

  bot.answerCallbackQuery(query.id);

  return bot.sendMessage(fromId,
    '🆔 Введите новый ID в МИС:'
  );
}

if (data === 'mis_delete') {
  if (db.users[fromId]) {
    db.users[fromId].mis_id = null;
    saveDB(db);
  }

  bot.answerCallbackQuery(query.id, { text: '🗑 ID удалён' });

  return bot.sendMessage(fromId, '🗑 Ваш ID в МИС удалён.');
}

  // выбор события
if (data.startsWith('set_')) {
  const key = data.replace('set_', '');
  const chatId = fromId;
  const s = db.notify_settings[chatId];

  const threeMode = ['visit_create','visit_cancel','visit_move','visit_finish'];

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
// ================== СООБЩЕНИЯ ==================
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  const mainButtons = [
  '💰 Финансы',
  '⚙️ Настройки',
  '🏥 Работа в МИС',
  '📅 Визиты',
  '⬅️ Назад'
];

if (mainButtons.includes(text)) {
  db.state[chatId] = null;
  saveDB(db);
}

  if (msg.entities && msg.entities.some(e => e.type === 'bot_command')) return;

  console.log(`MSG from ${chatId}: ${text}`);

  if (!db.whitelist.includes(chatId) && chatId !== ADMIN_CHAT_ID) return;

  // ===== ГЛАВНОЕ МЕНЮ =====
  if (text === '💰 Финансы') {
    return bot.sendMessage(chatId, '💰 Финансы', financeKeyboard());
  }

  if (text === '⚙️ Настройки') {
    return bot.sendMessage(chatId, '⚙️ Настройки', settingsKeyboard());
  }

  if (text === '⬅️ Назад') {
    const keyboard = (chatId === ADMIN_CHAT_ID)
      ? adminKeyboard()
      : mainKeyboard();

    return bot.sendMessage(chatId, 'Главное меню', keyboard);
  }


  
if (text === '⬅️ Назад' && db.state[chatId] === 'MIS') {
  db.state[chatId] = null;
  saveDB(db);

  return bot.sendMessage(
    chatId,
    'Главное меню',
    mainKeyboard()
  );
}
if (text === '📅 Визиты' ) {
  bot.emit('mis_upcoming', msg);
  return;
}

  // ===== СОСТОЯНИЯ =====

  // ---- Ожидание ввода MIS ID ----
  if (db.state[chatId] === 'WAIT_MIS_ID') {
    const misId = text.trim();

    if (!/^\d+$/.test(misId)) {
      return bot.sendMessage(
        chatId,
        '❌ ID должен состоять только из цифр. Попробуйте ещё раз:'
      );
    }

    if (!db.users[chatId]) {
      db.users[chatId] = { username: getUsername(chatId), mis_id: null };
    }

    db.users[chatId].mis_id = misId;
    db.state[chatId] = null;
    saveDB(db);

    bot.sendMessage(
      chatId,
      `✅ ID в МИС сохранён: ${misId}\n\nТеперь уведомления могут фильтроваться по вам.`
    );

    const keyboard = (chatId === ADMIN_CHAT_ID)
      ? adminKeyboard()
      : mainKeyboard();

    bot.sendMessage(chatId, 'Выберите действие:', keyboard);
    return;
  }

  // ---- Ожидание суммы ----
  if (db.state[chatId] === 'WAIT_SUM') {
    const amount = Number(text);
    if (isNaN(amount) || amount <= 0) {
      return bot.sendMessage(chatId, '❌ Введите корректную сумму');
    }

    db.state[chatId] = null;
    if (!db.history[chatId]) db.history[chatId] = [];
    db.history[chatId].push({ amount, date: new Date().toISOString() });
    saveDB(db);

    let params = { ...BASE_PARAMS, sum: Math.round(amount * 100).toString() };
    const query = Object.keys(params).map(k => k + '=' + params[k]).join('&');
    const link = `${BASE_QR_URL}?${query}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(link)}`;

    const keyboard = (chatId === ADMIN_CHAT_ID)
      ? adminKeyboard()
      : mainKeyboard();

    return bot.sendPhoto(chatId, qrUrl, {
      caption: `ООО "Медицинская Среда"\n💰 Сумма: ${amount} ₽\n🔗 Ссылка: ${link}`,
      reply_markup: keyboard.reply_markup
    });
  }

  // ===== НАСТРОЙКИ =====

  if (text === '📢 Оповещения') {
  return bot.sendMessage(chatId, '📢 Оповещения', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '👀 Показать оповещения', callback_data: 'alerts_show' }],
        [{ text: '⚙️ Задать оповещения', callback_data: 'alerts_setup' }]
      ]
    }
  });
}
  
if (
  db.state[chatId] &&
  db.state[chatId].type === 'WAIT_UPCOMING_TIME'
) {
  if (!/^\d{2}:\d{2}$/.test(text)) {
    return bot.sendMessage(chatId, '❌ Формат HH:MM, например 07:00');
  }

  const { alertId } = db.state[chatId];

  const list = db.scheduled_notifications?.[chatId]?.upcoming_visits;
  if (!Array.isArray(list)) {
    db.state[chatId] = null;
    saveDB(db);
    return;
  }

  const alert = list.find(a => a.id === alertId);
  if (!alert) {
    db.state[chatId] = null;
    saveDB(db);
    return bot.sendMessage(chatId, '❌ Оповещение не найдено');
  }

  alert.time = text;
  db.state[chatId] = null;
  saveDB(db);

  return bot.sendMessage(
    chatId,
    `✅ Оповещение сохранено\n\n⏰ ${text}\n` +
    `Режим: ${alert.mode === 'self' ? '👤 только мои' : '👥 все'}`
  );
}


  

  if (text === '🔔 Уведомления') {
    if (!db.notify_whitelist.includes(chatId)) {
      if (db.notify_pending.includes(chatId)) {
        return bot.sendMessage(
          chatId,
          '⏳ Заявка на уведомления уже отправлена. Ожидайте решения администратора.'
        );
      }

      const username = getUsername(chatId);
      db.notify_pending.push(chatId);
      saveDB(db);

      bot.sendMessage(
        ADMIN_CHAT_ID,
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

      return bot.sendMessage(
        chatId,
        '📨 Заявка на получение уведомлений отправлена администратору.'
      );
    }

    return showNotifyMenu(chatId);
  }

  if (text === '🆔 Мой ID в МИС') {
    if (!db.users[chatId]) {
      db.users[chatId] = { username: getUsername(chatId), mis_id: null };
      saveDB(db);
    }

    const currentId = db.users[chatId].mis_id;

    if (!currentId) {
      db.state[chatId] = 'WAIT_MIS_ID';
      saveDB(db);

      return bot.sendMessage(
        chatId,
        '🆔 Введите ваш ID в МИС (например doctor_id из системы):\n\n' +
        'Он будет использоваться для фильтрации уведомлений.'
      );
    }

    return bot.sendMessage(
      chatId,
      `🆔 Ваш текущий ID в МИС: ${currentId}\n\nЧто вы хотите сделать?`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '✏️ Изменить ID', callback_data: 'mis_edit' }],
            [{ text: '❌ Удалить ID', callback_data: 'mis_delete' }]
          ]
        }
      }
    );
  }

  // ===== АДМИН =====
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

      if (db.pending.length > 0) {
        buttons.push([{ text: '⏳ Заявки на доступ к QR', callback_data: 'noop' }]);

        db.pending.forEach(id => {
          const username = getUsername(id);
          buttons.push([
            { text: `✅ ${username}`, callback_data: `allow_${id}` },
            { text: `❌ ${username}`, callback_data: `deny_${id}` }
          ]);
        });
      }

      buttons.push([{ text: '📌 Доступ к QR', callback_data: 'noop' }]);

      db.whitelist
        .filter(id => id !== ADMIN_CHAT_ID)
        .forEach(id => {
          const username = getUsername(id);
          buttons.push([
            { text: `❌ Убрать QR у ${username}`, callback_data: `remove_${id}` }
          ]);
        });

      buttons.push([{ text: '🔔 Доступ к уведомлениям', callback_data: 'noop' }]);

      db.notify_whitelist.forEach(id => {
        const username = getUsername(id);
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

  // ===== ФИНАНСЫ =====

  if (text === '➕ Создать платёж') {
    db.state[chatId] = 'WAIT_SUM';
    saveDB(db);
    return bot.sendMessage(chatId, '💰 Введите сумму:');
  }

  if (text === '📜 История') {

    if (chatId === ADMIN_CHAT_ID) {
      const allHistory = Object.keys(db.history)
        .map(cid => {
          const username = getUsername(cid);
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


const PORT = process.env.PORT;

if (!PORT) {
  console.error("PORT not provided by bothost");
  process.exit(1);
}

app.post('/mis', async (req, res) => { await handleMisWebhook(req, res); });

app.listen(PORT, () => {
  console.log('🌐 HTTP server started on port', PORT);

  cleanupLabs();

  setInterval(() => {
    cleanupLabs();
  }, 12 * 60 * 60 * 1000);

  setInterval(() => {
    runUpcomingVisitsNotifications({
      loadDB,
      saveDB,
      formatDate
    });
  }, 60 * 1000);
});





// ================== ОШИБКИ ==================
bot.on('polling_error', (e) => {
  console.error('Polling error:', e.message);
});


























































































