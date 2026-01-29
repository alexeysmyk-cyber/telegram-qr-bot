const axios = require('axios');
const qs = require('querystring');

// ⚠️ эти функции мы ПОЛУЧИМ снаружи
// loadDB, saveDB, formatDate

async function runUpcomingVisitsNotifications({ loadDB, saveDB, formatDate }) {
  const now = new Date();
  const nowTime = new Date().toLocaleTimeString(
  'ru-RU',
  {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Moscow'
  }
);

  const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
//  console.log('⏱ runUpcomingVisitsNotifications tick:', nowTime);
  

  const db = loadDB();
  if (!db || !db.scheduled_notifications) return;

  for (const chatId of Object.keys(db.scheduled_notifications)) {
    const config = db.scheduled_notifications[chatId]?.upcoming_visits;
    if (!config || !config.enabled) continue;
    if (config.time !== nowTime) continue;

    // 🔒 защита от повторной отправки
    if (config.last_sent === todayStr) continue;

    // --- даты ---
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dateFrom = formatDate(new Date(tomorrow), '07:00');
    const dateTo = formatDate(new Date(tomorrow), '22:00');

    // --- запрос в МИС ---
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
      console.error('❌ getAppointments error:', e.message);
      continue;
    }

    if (!result || result.error !== 0 || !Array.isArray(result.data)) continue;

    let visits = result.data.filter(v => v.status === 'upcoming');

    // --- фильтр "только свои" ---
    if (config.mode === 'self') {
      const user = db.users?.[chatId];
      if (!user?.mis_id) continue;

      visits = visits.filter(v =>
        String(v.doctor_id) === String(user.mis_id)
      );
    }

    // --- сообщение ---
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

    // --- Telegram ---
    try {
      await axios.post(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
        {
          chat_id: chatId,
          text: message.trim()
        }
      );

      config.last_sent = todayStr;
      saveDB(db);

    } catch (e) {
      console.error('❌ Telegram send error:', e.message);
    }
  }
}

module.exports = { runUpcomingVisitsNotifications };
