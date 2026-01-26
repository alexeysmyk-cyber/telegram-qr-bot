

const axios = require('axios');
const fs = require('fs');

// ===== НАСТРОЙКИ =====
const BOT_TOKEN = '8482523179:AAFQzWkCz2LrkTWif6Jfn8sXQ-PVxbp0nvs';
const SECRET_KEY = 'SredaSecretKey';
const DB_FILE = './db.json';

// ===== ЗАГРУЗКА БАЗЫ =====
function loadDB() {
  if (!fs.existsSync(DB_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    console.error('❌ Ошибка чтения DB:', e.message);
    return null;
  }
}

// ===== ОТПРАВКА СООБЩЕНИЯ В TELEGRAM =====
async function send(chatId, text) {
  try {
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text
    });
  } catch (e) {
    console.error('❌ Ошибка отправки в Telegram:', e.message);
  }
}

// ===== ОСНОВНОЙ ОБРАБОТЧИК WEBHOOK =====
async function handleMisWebhook(req, res) {
  


  const secret =
    req.headers['x-secret-key'] ||
    req.query.secret ||
    req.body.secret;

  if (secret && secret !== SECRET_KEY) {
    return res.status(403).send('Forbidden');
  }
  console.log('EVENT FIELD:', req.body && req.body.event);
  console.log('==== MIS WEBHOOK RECEIVED ====');
  console.log('Body:', req.body);
  
  const event = req.body.event;
  const data = req.body.data || {};

  // --- ПОКА ОБРАБАТЫВАЕМ ТОЛЬКО СОЗДАНИЕ ВИЗИТА ---
let key = null;

if (event === 'create_appointment') {
  key = 'visit_create';
}
else if (event === 'create_patient') {
  key = 'patient_create';
}
else {
  return res.send('OK (event ignored)');
}

  const timeStart = data.time_start;
  const room = data.room;
  const doctor = data.doctor;
  const doctorId = data.doctor_id;   // 🔥 обязательно нужен для режима "self"
  const patientName = data.patient_name;
  const patientPhone = data.patient_phone;
  const source = data.source || '';

  if (!doctor && !patientName) {
    console.log('⚠️ Нет нужных данных, пропуск');
    return res.send('OK (no data)');
  }

  let message = `🆕 Новый визит\n\n`;

  if (timeStart) message += `📅 Время: ${timeStart}\n`;
  if (room) message += `🚪 Кабинет: ${room}\n`;
  if (doctor) message += `👨‍⚕️ Врач: ${doctor}\n\n`;

  if (patientName) message += `👤 Пациент: ${patientName}\n`;
  if (patientPhone) message += `📞 Телефон: ${patientPhone}\n`;
  if (source) message += `🌐 Источник: ${source}\n`;

  // ===== ЛОГИКА УВЕДОМЛЕНИЙ (ИЗ БОТА) =====

  const db = loadDB();
  if (!db) {
    console.error('❌ База не загружена');
    return res.send('OK');
  }



  for (const chatId of db.notify_whitelist || []) {

    const settings = db.notify_settings[chatId] || {};
    const limits = db.notify_admin_limits[chatId] || {};
    const user = db.users[chatId];

    // 🔒 Админ запретил этот тип?
    if (limits[key] === false) continue;

    const mode = settings[key]; // self / all / none

    if (!mode || mode === 'none') continue;

    // 👤 Только для себя
    if (mode === 'self') {
      if (!user || !user.mis_id) continue;
      if (!doctorId) continue;

      if (String(user.mis_id) !== String(doctorId)) continue;
    }

    // ✅ Всё ок — отправляем
    await send(chatId, message);
  }

  res.send('OK');
}

module.exports = { handleMisWebhook };
