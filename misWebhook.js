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

  // ===== ОПРЕДЕЛЯЕМ ТИП СОБЫТИЯ =====
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

  let message = '';
  let doctorId = null;

  // ===== СОЗДАНИЕ ВИЗИТА =====
  if (event === 'create_appointment') {

    const timeStart = data.time_start;
    const room = data.room;
    const doctor = data.doctor;
    doctorId = data.doctor_id;
    const patientName = data.patient_name;
    const patientPhone = data.patient_phone;
    const source = data.source || '';

    // проверка ТОЛЬКО для визитов
    if (!doctor && !patientName) {
      console.log('⚠️ Нет нужных данных, пропуск (appointment)');
      return res.send('OK (no data)');
    }

    message = `🆕 Новый визит\n\n`;

    if (timeStart) message += `📅 Время: ${timeStart}\n`;
    if (room) message += `🚪 Кабинет: ${room}\n`;
    if (doctor) message += `👨‍⚕️ Врач: ${doctor}\n\n`;

    if (patientName) message += `👤 Пациент: ${patientName}\n`;
    if (patientPhone) message += `📞 Телефон: ${patientPhone}\n`;
    if (source) message += `🌐 Источник: ${source}\n`;
  }

  // ===== СОЗДАНИЕ ПАЦИЕНТА =====
  else if (event === 'create_patient') {

    const number = data.number;
    const lastName = data.last_name;
    const firstName = data.first_name;
    const thirdName = data.third_name;
    const birthDate = data.birth_date;
    const age = data.age;
    const gender = data.gender;
    const mobile = data.mobile;
    const patientId = data.patient_id;
    const dateCreated = data.date_created;
    const timeCreated = data.time_created;

    if (!lastName && !firstName) {
      console.log('⚠️ Нет ФИО пациента, пропуск (patient)');
      return res.send('OK (no data)');
    }

    message = `👤 Новый пациент\n\n`;

    if (lastName || firstName) {
      message += `ФИО: ${lastName || ''} ${firstName || ''} ${thirdName || ''}\n`;
    }

    if (birthDate) message += `🎂 Дата рождения: ${birthDate}\n`;
    if (age) message += `📊 Возраст: ${age}\n`;
    if (gender) message += `⚥ Пол: ${gender}\n`;
    if (mobile) message += `📞 Телефон: ${mobile}\n`;

    if (number) message += `🆔 Номер пациента: ${number}\n`;
    if (patientId) message += `🆔 ID пациента в МИС: ${patientId}\n`;

    if (dateCreated || timeCreated) {
      message += `\n📅 Создан: ${dateCreated || ''} ${timeCreated || ''}\n`;
    }
  }

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

    const mode = settings[key];

    if (!mode || mode === 'none') continue;

    // 👤 Только для себя (ТОЛЬКО ДЛЯ ВИЗИТОВ)
    if (mode === 'self') {

      if (event === 'create_patient') continue;

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
