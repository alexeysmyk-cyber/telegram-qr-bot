const axios = require('axios');
const qs = require('querystring');

/**
 * Инициализация модуля МИС
 * вызывать из index.js
 */
function initMisModule({
  bot,
  loadDB,
  saveDB,
  formatDate
}) {

  // ===============================
  // 📌 КНОПКА "Работа в МИС"
  // ===============================
bot.on('mis_upcoming', (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(chatId, 'Для каких визитов?', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '👤 Только мои', callback_data: 'mis_mode_self' }],
        [{ text: '👥 Все клиники', callback_data: 'mis_mode_all' }]
      ]
    }
  });
});

      

  // ===============================
  // 📅 ПРЕДСТОЯЩИЕ ВИЗИТЫ
  // ===============================
  bot.on('callback_query', async (query) => {
    const chatId = query.from.id;
    const data = query.data;

    // --- выбор режима ---
    if (data === 'mis_upcoming') {
      return bot.sendMessage(chatId, 'Для каких визитов?', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '👤 Только мои', callback_data: 'mis_mode_self' }],
            [{ text: '👥 Все клиники', callback_data: 'mis_mode_all' }]
          ]
        }
      });
    }

    if (data === 'mis_mode_self' || data === 'mis_mode_all') {
      const mode = data.endsWith('self') ? 'self' : 'all';

      const db = loadDB();
      db.state[chatId] = { mis_mode: mode };
      saveDB(db);

    return bot.sendMessage(chatId, 'На какую дату?', {
  reply_markup: {
    inline_keyboard: [
      [
        { text: '   📅 Сегодня   ', callback_data: 'mis_date_today' },
        { text: '   📅 Завтра    ', callback_data: 'mis_date_tomorrow' }
      ],
      [
        { text: '🗓 Выбрать дату', callback_data: 'mis_date_custom' }
      ]
    ]
  }
});

    }

    // --- быстрые даты ---
if (data === 'mis_date_today' || data === 'mis_date_tomorrow') {
  // 🔒 закрываем callback СРАЗУ
  await bot.answerCallbackQuery(query.id);

  const db = loadDB();
  const state = db.state[chatId];

  if (!state || !state.mis_mode) {
    await bot.sendMessage(
      chatId,
      '⚠️ Сессия выбора сброшена, попробуйте ещё раз'
    );
    return;
  }

  const date = new Date();
  if (data === 'mis_date_tomorrow') {
    date.setDate(date.getDate() + 1);
  }

  db.state[chatId] = null;
  saveDB(db);

  console.log('MIS sendVisits:', {
    chatId,
    mode: state.mis_mode,
    date
  });

  await sendVisits({
    chatId,
    mode: state.mis_mode,
    date,
    bot,
    loadDB,
    formatDate
  });

  return;
}



    // --- календарь ---
// ===== Навигация по месяцам =====
if (data.startsWith('mis_cal_prev_') || data.startsWith('mis_cal_next_')) {
  const [, , dir, y, m] = data.split('_');
  let year = Number(y);
  let month = Number(m);

  if (dir === 'prev') {
    month--;
    if (month < 0) {
      month = 11;
      year--;
    }
  } else {
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }

  await bot.editMessageReplyMarkup(
    {
      inline_keyboard: buildCalendar(year, month)
    },
    {
      chat_id: chatId,
      message_id: query.message.message_id
    }
  );

  return bot.answerCallbackQuery(query.id);
}



    
    if (data === 'mis_date_custom') {
      const now = new Date();

      return bot.sendMessage(chatId, '🗓 Выберите дату', {
        reply_markup: {
          inline_keyboard: buildCalendar(
            now.getFullYear(),
            now.getMonth()
          )
        }
      });
    }

    // --- выбор даты в календаре ---
if (data.startsWith('mis_pick_date_')) {
  // 🔒 закрываем callback СРАЗУ (чтобы кнопки не залипали)
  await bot.answerCallbackQuery(query.id);

  const [, , , y, m, d] = data.split('_');
  const date = new Date(Number(y), Number(m), Number(d));
  date.setHours(0, 0, 0, 0);

  // ===== защита от прошедших дат =====
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (date < today) {
    await bot.sendMessage(
      chatId,
      '⛔ Прошедшие даты недоступны для «Предстоящих визитов»'
    );
    return;
  }

  const db = loadDB();
  const state = db.state[chatId];

  if (!state || !state.mis_mode) {
    await bot.sendMessage(
      chatId,
      '⚠️ Сессия выбора сброшена, попробуйте ещё раз'
    );
    return;
  }

  // очищаем состояние
  db.state[chatId] = null;
  saveDB(db);

  console.log('MIS sendVisits (calendar):', {
    chatId,
    mode: state.mis_mode,
    date
  });

  await sendVisits({
    chatId,
    mode: state.mis_mode,
    date,
    bot,
    loadDB,
    formatDate
  });

  return;
}


  });
}

// ===============================
// 🗓 INLINE КАЛЕНДАРЬ
// ===============================
function buildCalendar(year, month) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let firstDay = new Date(year, month, 1).getDay();
  if (firstDay === 0) firstDay = 7;

  const keyboard = [];

  // ===== Заголовок =====
  keyboard.push([
    { text: '⬅️', callback_data: `mis_cal_prev_${year}_${month}` },
    { text: `📅 ${monthNames[month]} ${year}`, callback_data: 'noop' },
    { text: '➡️', callback_data: `mis_cal_next_${year}_${month}` }
  ]);

  // ===== Дни недели =====
  keyboard.push([
    { text: 'Пн', callback_data: 'noop' },
    { text: 'Вт', callback_data: 'noop' },
    { text: 'Ср', callback_data: 'noop' },
    { text: 'Чт', callback_data: 'noop' },
    { text: 'Пт', callback_data: 'noop' },
    { text: ' Сб', callback_data: 'noop' },
    { text: ' Вс', callback_data: 'noop' }
  ]);

  let row = [];

  // ===== Пустые ячейки =====
  for (let i = 1; i < firstDay; i++) {
    row.push({ text: ' ', callback_data: 'noop' });
  }

  // ===== Дни =====
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    date.setHours(0, 0, 0, 0);

    const isPast = date < today;
    const isToday = date.getTime() === today.getTime();

    let text = String(day);
    let callback = `mis_pick_date_${year}_${month}_${day}`;

    if (isToday) {
      text = `🟦 ${day}`;
    }

    if (isPast) {
      text = `· ${day}`;        // визуально "приглушено"
      callback = 'noop';        // ❌ нельзя нажать
    }

    row.push({ text, callback_data: callback });

    if (row.length === 7) {
      keyboard.push(row);
      row = [];
    }
  }

  if (row.length) keyboard.push(row);

  return keyboard;
}



// ===============================
// 📡 ЗАПРОС + ОТПРАВКА ВИЗИТОВ
// ===============================
async function sendVisits({
  chatId,
  mode,
  date,
  bot,
  loadDB,
  formatDate
}) {
  const db = loadDB();

  const dateFrom = formatDate(new Date(date), '07:00');
  const dateTo = formatDate(new Date(date), '22:00');

  let result;
  try {
    const body = qs.stringify({
      api_key: process.env.API_KEY,
      date_from: dateFrom,
      date_to: dateTo
    });

    const response = await axios.post(
      `${process.env.BASE_URL}getAppointments`,
      body,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    result = response.data;
  } catch (e) {
    return bot.sendMessage(chatId, '❌ Ошибка получения визитов');
  }

  if (!result || result.error !== 0 || !Array.isArray(result.data)) {
    return bot.sendMessage(chatId, '❌ Нет данных от МИС');
  }

  let visits = result.data.filter(v => v.status === 'upcoming');

  if (mode === 'self') {
    const user = db.users?.[chatId];
    if (!user?.mis_id) {
      return bot.sendMessage(chatId, '❌ У вас не задан ID в МИС');
    }

    visits = visits.filter(v =>
      String(v.doctor_id) === String(user.mis_id)
    );
  }

  let message = `📅 Визиты на ${dateFrom.split(' ')[0]}\n\n`;

  if (visits.length === 0) {
    message += '📭 Визитов нет';
  } else {
    for (const v of visits) {
      message +=
        `⏰ ${v.time_start.split(' ')[1]}–${v.time_end.split(' ')[1]}\n` +
        `👨‍⚕️ ${v.doctor}\n` +
        `👤 ${v.patient_name}\n` +
        `🚪 ${v.room}\n\n`;
    }
  }

  await bot.sendMessage(chatId, message.trim());
}

module.exports = {
  initMisModule
};

