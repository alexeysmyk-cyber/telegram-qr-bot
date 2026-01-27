const axios = require('axios');
const qs = require('querystring');

// ===== ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ =====
const API_KEY = process.env.API_KEY;
const BASE_URL = process.env.BASE_URL;   // https://app.rnova.org/api/public

// итоговый URL:
// https://app.rnova.org/api/public/getAppointment
const GET_APPOINTMENT_URL = `${BASE_URL}/getAppointment`;

if (!API_KEY || !BASE_URL) {
  console.error('❌ НЕ ЗАДАНЫ ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ MIS_API_KEY или MIS_BASE_URL');
}

// ===== ПОЛУЧЕНИЕ ВИЗИТА ПО appointment_id =====
async function getAppointmentById(appointmentId) {
  try {

    const body = qs.stringify({
      api_key: API_KEY,
      appointment_id: appointmentId
    });

    const response = await axios.post(
      GET_APPOINTMENT_URL,
      body,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000
      }
    );

    const result = response.data;

    // проверка формата ответа
    if (!result || typeof result.error === 'undefined') {
      console.error('❌ Неверный формат ответа от МИС:', result);
      return null;
    }

    // ошибка от МИС
    if (result.error !== 0) {
      console.error('❌ Ошибка от МИС getAppointment:', result.data);
      return null;
    }

    const list = result.data;

    if (!Array.isArray(list) || list.length === 0) {
      console.error('❌ Пустой список визитов от МИС');
      return null;
    }

    // 🔥 берём первый визит
    return list[0];

  } catch (e) {
    console.error('❌ Ошибка запроса getAppointment:', e.message);
    return null;
  }
}

module.exports = { getAppointmentById };
