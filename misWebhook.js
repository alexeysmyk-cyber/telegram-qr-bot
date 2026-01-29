const axios = require('axios');
const fs = require('fs');
const { getAppointmentById } = require('./misApi');

// ===== НАСТРОЙКИ =====
const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('❌ НЕ ЗАДАНА ПЕРЕМЕННАЯ ОКРУЖЕНИЯ BOT_TOKEN');
}


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
else if (
  event === 'cancel_appointment' ||
  event === 'update_appointment'
) {
  // ❗ key будет определён внутри логики события
}
else {
  return res.send('OK (event ignored)');
}




  let message = '';
  let doctorId = null;

  // ===== СОЗДАНИЕ ВИЗИТА =====
// ===== СОЗДАНИЕ ВИЗИТА =====
if (event === 'create_appointment') {

  // ❗ ФИЛЬТР ПЕРЕНОСОВ / КОПИЙ
  if (data.moved_from) {
    console.log(
      `↪️ create_appointment проигнорирован (перенос визита), moved_from=${data.moved_from}`
    );
    return res.send('OK (appointment moved)');
  }

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

// ===== ✅ ЗАВЕРШЕНИЕ ВИЗИТА =====
else if (event === 'update_appointment') {

  // ❗ data ВСЕГДА массив
  if (!Array.isArray(data) || data.length === 0) {
    console.log('⚠️ update_appointment: пустой data');
    return res.send('OK');
  }

  const item = data[0];

  // ❗ интересует ТОЛЬКО completed
  if (item.status !== 'completed') {
    return res.send('OK (status ignored)');
  }
  key = 'visit_finish'; // ← ВОТ ТУТ
  const patientName = item.patient_name;
  const doctorName = item.doctor;
  const timeStart = item.time_start;
  const timeEnd = item.time_end;
  const room = item.room;

  doctorId = item.doctor_id;

  message = `✅ Визит завершён\n\n`;

  if (patientName) message += `👤 Пациент: ${patientName}\n`;
  if (doctorName) message += `👨‍⚕️ Врач: ${doctorName}\n`;

  if (timeStart && timeEnd) {
    message += `⏱ Время: ${timeStart} — ${timeEnd}\n`;
  } else if (timeStart) {
    message += `⏱ Начало: ${timeStart}\n`;
  }

  if (room) message += `🚪 Кабинет: ${room}\n`;

  // ⛔ НЕ return здесь — пусть дойдёт до общей рассылки
}




  
// ===== ❌ ОТМЕНА / 🔁 ПЕРЕНОС ВИЗИТА =====
// ===== ❌ ОТМЕНА / 🔁 ПЕРЕНОС ВИЗИТА =====
else if (event === 'cancel_appointment') {

  const patientName = data.patient_name;
  const oldTime = data.time_start;
  const oldDoctor = data.doctor;
  const oldRoom = data.room;
  const movedTo = data.moved_to;

  doctorId = data.doctor_id; // 🔥 ОБЯЗАТЕЛЬНО для self-фильтра

  // ==================================================
  // ❌ ИСТИННАЯ ОТМЕНА ВИЗИТА
  // ==================================================
  if (!movedTo) {

    key = 'visit_cancel'; // ✅ ОТДЕЛЬНЫЙ КЛЮЧ

    message = `❌ Визит отменён\n\n`;

    if (patientName) message += `👤 Пациент: ${patientName}\n`;
    if (oldTime) message += `📅 Дата и время: ${oldTime}\n`;
    if (oldDoctor) message += `👨‍⚕️ Врач: ${oldDoctor}\n`;
    if (oldRoom) message += `🚪 Кабинет: ${oldRoom}\n`;

  }

  // ==================================================
  // 🔁 ПЕРЕНОС ВИЗИТА
  // ==================================================
  else {

    key = 'visit_move'; // ✅ НОВЫЙ КЛЮЧ

    console.log(
      `↪️ Перенос визита: старый отменён, новый appointment_id=${movedTo}`
    );

    let newAppointment;
    try {
      newAppointment = await getAppointmentById(movedTo);
    } catch (e) {
      console.error('❌ Ошибка получения нового визита:', e.message);
      return res.send('OK');
    }

    if (!newAppointment) {
      console.error('❌ Новый визит не найден');
      return res.send('OK');
    }

    message = `↪️ Визит перенесён\n\n`;

    if (patientName) {
      message += `👤 Пациент: ${patientName}\n\n`;
    }

    // ---------- ОТКУДА ----------
    message += `❌ Отменён визит:\n`;
    if (oldTime) message += `📅 Дата и время: ${oldTime}\n`;
    if (oldDoctor) message += `👨‍⚕️ Врач: ${oldDoctor}\n`;
    if (oldRoom) message += `🚪 Кабинет: ${oldRoom}\n`;

    // ---------- КУДА ----------
    message += `\n✅ Новый визит:\n`;
    if (newAppointment.time_start) {
      message += `📅 Дата и время: ${newAppointment.time_start}\n`;
    }
    if (newAppointment.doctor) {
      message += `👨‍⚕️ Врач: ${newAppointment.doctor}\n`;
    }
    if (newAppointment.room) {
      message += `🚪 Кабинет: ${newAppointment.room}\n`;
    }
  }

  // ⛔ НЕ return — пусть уйдёт в общую рассылку
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

  let appointment;
  try {
    appointment = await getAppointmentById(appointmentId);
  } catch (e) {
    console.error('❌ Ошибка получения визита:', e.message);
    return res.send('OK');
  }

  if (!appointment) {
    console.error('❌ Визит не найден');
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
    services.forEach(s => message += `• ${s}\n`);
  }
// ===== 🧾 ИСТОРИЯ АНАЛИЗОВ — ПИШЕМ ВСЕГДА =====

  const db = loadDB();
  if (!db) return res.send('OK');
  
  
  // 🔐 защита от лимита Telegram
  function safeCaption(text) {
    return text.length > 900
      ? text.slice(0, 900) + '\n\n… (сообщение сокращено)'
      : text;
  }

  // ===== сохраняем PDF ОДИН РАЗ =====
  let fileInfo = null;
  if (Array.isArray(data.files) && data.files.length > 0) {
    try {
      const { saveLabFile } = require('./labFiles');
      fileInfo = saveLabFile(data.files[0], appointmentId);
    } catch (e) {
      console.error('❌ Ошибка сохранения PDF:', e.message);
    }
  }

  if (!db.lab_history) db.lab_history = [];

db.lab_history.push({
  event,
  appointment_id: appointmentId,
  patient: patientName,
  doctor: doctorName,
  file: fileInfo ? fileInfo.fileName : null,
  date: new Date().toISOString()
});

if (db.lab_history.length > 5000) {
  db.lab_history = db.lab_history.slice(-3000);
}

  
saveDB(db);
 

  for (const chatId of db.notify_whitelist || []) {

    const settings = db.notify_settings[chatId] || {};
    const limits = db.notify_admin_limits[chatId] || {};

    if (limits[key] === false) continue;
    if (settings[key] !== true) continue;

  let sentPdf = false;

if (fileInfo) {
  try {
    const FormData = require('form-data');
    const form = new FormData();

    form.append('chat_id', chatId);
    form.append('document', fs.createReadStream(fileInfo.filePath));
    form.append('caption', '📄 Результаты анализов'); // КОРОТКО

    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`,
      form,
      { headers: form.getHeaders() }
    );

    sentPdf = true;
  } catch (e) {
    console.error('❌ Ошибка отправки PDF:', e.message);
  }
}

// 📝 ТЕКСТ — ВСЕГДА ОТДЕЛЬНО
await send(chatId, message);


    // 🧾 история пишется независимо от PDF
  
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

  // self работает для визитных событий
  if (!['visit_create', 'visit_cancel', 'visit_move', 'visit_finish'].includes(key)) {
  continue;
}


  if (!user || !user.mis_id) continue;
  if (!doctorId) continue;
  if (String(user.mis_id) !== String(doctorId)) continue;
}

    await send(chatId, message);
  }

  return res.send('OK');
}

module.exports = { handleMisWebhook };
