const axios = require('axios');
const fs = require('fs');
const { getAppointmentById } = require('./misApi');

// ===== НАСТРОЙКИ =====
const BOT_TOKEN = '8482523179:AAFQzWkCz2LrkTWif6Jfn8sXQ-PVxbp0nvs';
const SECRET_KEY = 'SredaSecretKey';
const path = require('path');
const DB_FILE = path.join(__dirname, 'db.json');


// ===== ЗАГРУЗКА / СОХРАНЕНИЕ БАЗЫ =====
function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    console.error('❌ DB FILE NOT FOUND:', DB_FILE);
    return null;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');

    if (!raw || raw.trim().length === 0) {
      console.error('❌ DB FILE IS EMPTY, REFUSING TO OVERWRITE');
      return null;
    }

    return JSON.parse(raw);
  } catch (e) {
    console.error('❌ Ошибка чтения DB:', e.message);
    return null;
  }
}


function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ===== ОТПРАВКА СООБЩЕНИЯ =====
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

// ===== ОСНОВНОЙ ОБРАБОТЧИК =====
async function handleMisWebhook(req, res) {

  const secret =
    req.headers['x-secret-key'] ||
    req.query.secret ||
    req.body.secret;

  if (secret && secret !== SECRET_KEY) {
    return res.status(403).send('Forbidden');
  }

  const event = req.body.event;
  const data = req.body.data || {};

  console.log('🔥 START HANDLE EVENT:', event);

  // ===== ОПРЕДЕЛЯЕМ КЛЮЧ ФИЛЬТРА =====
  let key = null;

  if (event === 'create_appointment') key = 'visit_create';
  else if (event === 'create_patient') key = 'patient_create';
  else if (event === 'create_invoice') key = 'invoice_create';
  else if (event === 'full_payment_invoice') key = 'invoice_pay';
  else if (event === 'full_ready_lab_result') key = 'lab_full';
  else if (event === 'part_ready_lab_result') key = 'lab_partial';
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
  // 🔬 ГОТОВНОСТЬ АНАЛИЗОВ (ПОЛНАЯ И ЧАСТИЧНАЯ)
  // ============================================================
  if (event === 'full_ready_lab_result' || event === 'part_ready_lab_result') {

    const appointmentId = data.appointment_id;
    const lab = data.lab || '';
    const date = data.date || '';
    const services = data.services || [];

    if (!appointmentId) {
      console.log('⚠️ Нет appointment_id, пропуск анализов');
      return res.send('OK');
    }

    const isFull = (event === 'full_ready_lab_result');
    const title = isFull
      ? '🔬 Анализы полностью готовы'
      : '🧪 Частично выполненные анализы';

    let appointment = null;

    try {
      appointment = await getAppointmentById(appointmentId);
    } catch (e) {
      console.error('❌ Ошибка получения визита:', e.message);
      return res.send('OK');
    }

    if (!appointment) {
      console.error('❌ Не удалось получить визит из МИС');
      return res.send('OK');
    }

    const patientName = appointment.patient_name;
    const doctorName = appointment.doctor;

    let message = `${title}\n\n`;

    if (patientName) message += `👤 Пациент: ${patientName}\n`;
    if (doctorName) message += `👨‍⚕️ Врач: ${doctorName}\n`;
    if (lab) message += `🧪 Лаборатория: ${lab}\n`;
    if (date) message += `📅 Дата: ${date}\n`;

    if (Array.isArray(services) && services.length > 0) {
      message += `\n📋 Исследования:\n`;
      services.forEach(s => {
        message += `• ${s}\n`;
      });
    }

    const db = loadDB();
    if (!db) return res.send('OK');

    for (const chatId of db.notify_whitelist || []) {

      const settings = db.notify_settings[chatId] || {};
      const limits = db.notify_admin_limits[chatId] || {};

      if (limits[key] === false) continue;
      if (settings[key] !== true) continue;

      let fileInfo = null;

      if (data.files && Array.isArray(data.files) && data.files.length > 0) {
        try {
          const { saveLabFile } = require('./labFiles');
          fileInfo = saveLabFile(data.files[0], appointmentId);
        } catch (e) {
          console.error('❌ Ошибка сохранения PDF:', e.message);
        }
      }

      try {
        if (fileInfo) {
     

  const FormData = require('form-data');

  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('document', fs.createReadStream(fileInfo.filePath));
  form.append('caption', message);

  await axios.post(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`,
    form,
    { headers: form.getHeaders() }
  );

} else {
  // 🔔 если PDF нет — просто уведомление текстом
  await send(chatId, message);
}


        if (!db.lab_history) db.lab_history = [];

        db.lab_history.push({
          event,
          appointment_id: appointmentId,
          patient: patientName,
          doctor: doctorName,
          file: fileInfo ? fileInfo.fileName : null,
          sent_to: chatId,
          date: new Date().toISOString()
        });

        saveDB(db);

      } catch (e) {
        console.error('❌ Ошибка отправки анализов:', e.message);
      }
    }

    return res.send('OK');
  }

  // ============================================================
  // 🔔 ВСЕ ОСТАЛЬНЫЕ СОБЫТИЯ (визит, пациент, счёт, оплата)
  // ============================================================

  const db = loadDB();
  if (!db) return res.send('OK');

  for (const chatId of db.notify_whitelist || []) {

    const settings = db.notify_settings[chatId] || {};
    const limits = db.notify_admin_limits[chatId] || {};
    const user = db.users[chatId];

    if (limits[key] === false) continue;

    const mode = settings[key];
    if (!mode || mode === 'none') continue;

    if (mode === 'self') {

      if (event !== 'create_appointment') continue;
      if (!user || !user.mis_id) continue;
      if (!doctorId) continue;
      if (String(user.mis_id) !== String(doctorId)) continue;
    }

    await send(chatId, message);
  }

  return res.send('OK');
}

module.exports = { handleMisWebhook };
