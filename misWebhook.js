const axios = require('axios');
const fs = require('fs');
const { getAppointmentById } = require('./misApi');

// ===== НАСТРОЙКИ =====
const BOT_TOKEN = '8482523179:AAFQzWkCz2LrkTWif6Jfn8sXQ-PVxbp0nvs';
const SECRET_KEY = 'SredaSecretKey';
const DB_FILE = './db.json';

// ===== ЗАГРУЗКА / СОХРАНЕНИЕ БАЗЫ =====
function loadDB() {
  if (!fs.existsSync(DB_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
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
          const path = require('path');

          await axios.post(
            `https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`,
            {
              chat_id: chatId,
              document: fs.createReadStream(fileInfo.filePath),
              caption: message,
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: '📥 Скачать результат',
                      callback_data: `download_lab_${fileInfo.fileName}`
                    }
                  ]
                ]
              }
            },
            { headers: { 'Content-Type': 'multipart/form-data' } }
          );
        } else {
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
