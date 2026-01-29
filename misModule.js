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
  bot.on('message', (msg) => {
    if (msg.text !== '🏥 Работа в МИС') return;

    const chatId = msg.chat.id;

    bot.sendMessage(chatId, '🏥 Работа в МИС', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📅 Предстоящие визиты', callback_data: 'mis_upcoming' }]
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
            [{ text: '📅 Сегодня', callback_data: 'mis_date_today' }],
            [{ text: '📅 Завтра', callback_data: 'mis_date_tomorrow' }],
            [{ text: '🗓 Выбрать дату', callback_data: 'mis_date_custom' }]
          ]
        }
      });
    }

    // --- быстрые даты ---
    if (data === 'mis_date_today' || data === 'mis_date_tomorrow') {
      const db = loadDB();
      const state = db.state[chatId];
      if (!state) return;

      const date = new Date();
      if (data === 'mis_date_tomorrow') {
        date.setDate(date.getDate() + 1);
      }

      db.state[chatId] = null;
      saveDB(db);

      await sendVisits({
        chatId,
        mode: state.mis_mode,
        date,
        bot,
        loadDB,
        formatDate
      });

      return bot.answerCallbackQuery(query.id);
    }

    // --- календарь ---
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
      const [, , , y, m, d] = data.split('_');

      const date = new Date(Number(y), Number(m), Number(d));

      const db = loadDB();
      const state = db.state[chatId];
      if (!state) return;

      db.state[chatId] = null;
      saveDB(db);

      await sendVisits({
        chatId,
        mode: state.mis_mode,
        date,
        bot,
        loadDB,
        formatDate
      });

      return bot.answerCallbackQuery(query.id);
    }
  });
}

// ===============================
// 🗓 INLINE КАЛЕНДАРЬ
// ===============================
function buildCalendar(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay() || 7;

  const rows = [];

  rows.push([
    { text: 'Пн', callback_data: 'noop' },
    { text: 'Вт', callback_data: 'noop' },
    { text: 'Ср', callback_data: 'noop' },
    { text: 'Чт', callback_data: 'noop' },
    { text: 'Пт', callback_data: 'noop' },
    { text: 'Сб', callback_data: 'noop' },
    { text: 'Вс', callback_data: 'noop' }
  ]);

  let row = [];
  for (let i = 1; i < firstDay; i++) {
    row.push({ text: ' ', callback_data: 'noop' });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    row.push({
      text: String(day),
      callback_data: `mis_pick_date_${year}_${month}_${day}`
    });

    if (row.length === 7) {
      rows.push(row);
      row = [];
    }
  }

  if (row.length) rows.push(row);

  return rows;
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

module.exports = { initMisModule };
