const axios = require('axios');
const fs = require('fs');
console.log('➡️ СЕЙЧАС БУДЕМ ВЫЗЫВАТЬ getAppointmentById');
const { getAppointmentById } = require('./misApi');
console.log('🧪 misApi import typeof:', typeof getAppointmentById);


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

  console.log('🔥 START HANDLE EVENT:', event);

  // ===== ОПРЕДЕЛЯЕМ ТИП СОБЫТИЯ И КЛЮЧ ФИЛЬТРА =====
  let key = null;

  if (event === 'create_appointment') key = 'visit_create';
  else if (event === 'create_patient') key = 'patient_create';
  else if (event === 'create_invoice') key = 'invoice_create';
  else if (event === 'full_payment_invoice') key = 'invoice_pay';
  else if (event === 'full_ready_lab_result') key = 'lab_full';
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

    const lastName = data.last_name;
    const firstName = data.first_name;
    const thirdName = data.third_name;
    const birthDate = data.birth_date;
    const age = data.age;
    const gender = data.gender;
    const mobile = data.mobile;
    const patientId = data.patient_id;

    if (!lastName && !firstName) {
      console.log('⚠️ Нет ФИО пациента, пропуск (patient)');
      return res.send('OK (no data)');
    }

    message = `👤 Новый пациент\n\n`;

    message += `ФИО: ${lastName || ''} ${firstName || ''} ${thirdName || ''}\n`;
    if (birthDate) message += `🎂 Дата рождения: ${birthDate}\n`;
    if (age) message += `📊 Возраст: ${age}\n`;
    if (gender) message += `⚥ Пол: ${gender}\n`;
    if (mobile) message += `📞 Телефон: ${mobile}\n`;
    if (patientId) message += `🆔 ID пациента в МИС: ${patientId}\n`;
  }

  // ===== 🧾 СОЗДАНИЕ СЧЁТА =====
  else if (event === 'create_invoice') {

    const number = data.number;
    const date = data.date;
    const value = data.value;
    const status = data.status;

    const patient = data.patient;
    const patientBirth = data.patient_birth_date;
    const patientGender = data.patient_gender;
    const patientMobile = data.patient_mobile;
    const patientEmail = data.patient_email;

    if (!number && !patient) {
      console.log('⚠️ Нет данных по счёту, пропуск (invoice)');
      return res.send('OK (no data)');
    }

    message = `🧾 Создан новый счёт\n\n`;

    if (number) message += `🆔 Счёт №: ${number}\n`;
    if (date) message += `📅 Дата: ${date}\n`;
    if (value) message += `💰 Сумма: ${value} ₽\n`;
    if (status) message += `📌 Статус: ${status}\n`;

    message += `\n👤 Пациент:\n`;

    if (patient) message += `ФИО: ${patient}\n`;
    if (patientBirth) message += `🎂 Дата рождения: ${patientBirth}\n`;
    if (patientGender) message += `⚥ Пол: ${patientGender}\n`;
    if (patientMobile) message += `📞 Телефон: ${patientMobile}\n`;
    if (patientEmail) message += `📧 Email: ${patientEmail}\n`;
  }

  // ===== 💳 ПОЛНАЯ ОПЛАТА СЧЁТА =====
  else if (event === 'full_payment_invoice') {

    const number = data.number;
    const date = data.date;
    const value = data.value;
    const status = data.status;
    const paymentType = data.payment_type_name; 

    
    const patient = data.patient;
    const patientBirth = data.patient_birth_date;
    const patientGender = data.patient_gender;
    const patientMobile = data.patient_mobile;
    const patientEmail = data.patient_email;

    if (!number && !patient) {
      console.log('⚠️ Нет данных по оплате счёта, пропуск (invoice pay)');
      return res.send('OK (no data)');
    }

    message = `💳 Счёт полностью оплачен\n\n`;

    if (number) message += `🆔 Счёт №: ${number}\n`;
    if (date) message += `📅 Дата оплаты: ${date}\n`;
    if (value) message += `💰 Оплачено: ${value} ₽\n`;
    if (status) message += `📌 Статус: ${status}\n`;
    if (paymentType) message += `💳 Способ оплаты: ${paymentType}\n`;  
    
    message += `\n👤 Пациент:\n`;

    if (patient) message += `ФИО: ${patient}\n`;
    if (patientBirth) message += `🎂 Дата рождения: ${patientBirth}\n`;
    if (patientGender) message += `⚥ Пол: ${patientGender}\n`;
    if (patientMobile) message += `📞 Телефон: ${patientMobile}\n`;
    if (patientEmail) message += `📧 Email: ${patientEmail}\n`;
  }
// ============================================================
// 🔬 ПОЛНАЯ ГОТОВНОСТЬ АНАЛИЗОВ
// ============================================================
else if (event === 'full_ready_lab_result') {

  console.log('🔥 ВОШЛИ В БЛОК full_ready_lab_result');

  const appointmentId = data.appointment_id;
  const lab = data.lab;
  const date = data.date;
  const services = data.services || [];

  if (!appointmentId) {
    console.log('⚠️ Нет appointment_id, пропуск (lab_full)');
    return res.send('OK (no data)');
  }

  // 🔥 получаем визит из МИС через API
  let appointment = null;

try {
  console.log('➡️ СЕЙЧАС БУДЕМ ВЫЗЫВАТЬ getAppointmentById');
  appointment = await getAppointmentById(appointmentId);
  console.log('⬅️ ВЕРНУЛСЯ ИЗ getAppointmentById, результат:', appointment);
}
catch (e) {
  console.error('🔥 ОШИБКА ПРИ ВЫЗОВЕ getAppointmentById:', e);
  return res.send('OK');
}


  if (!appointment) {
    console.log('❌ Не удалось получить визит из МИС (lab_full)');
    return res.send('OK');
  }

  const patientName = appointment.patient_name;
  const doctor = appointment.doctor;
  doctorId = appointment.doctor_id;        // 🔥 ДЛЯ SELF-ФИЛЬТРА
  const timeStart = appointment.time_start;
  const room = appointment.room;

  message = `🔬 Анализы полностью готовы\n\n`;

  if (patientName) message += `👤 Пациент: ${patientName}\n`;
  if (doctor) message += `👨‍⚕️ Врач: ${doctor}\n`;
  if (timeStart) message += `📅 Визит: ${timeStart}\n`;
  if (room) message += `🚪 Кабинет: ${room}\n`;
  if (lab) message += `🏥 Лаборатория: ${lab}\n`;

  if (services.length > 0) {
    message += `\n🧪 Исследования:\n`;
    services.forEach(s => {
      message += `• ${s}\n`;
    });
  }

  message += `\n📎 Результаты готовы в МИС`;
}



  
  // ===== ЛОГИКА УВЕДОМЛЕНИЙ (НЕ ЛОМАЛ) =====

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

    // 👤 self работает ТОЛЬКО для визитов
    if (mode === 'self') {

      if (event !== 'create_appointment') continue;

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
