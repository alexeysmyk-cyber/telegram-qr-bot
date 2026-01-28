const axios = require('axios');
const qs = require('querystring');

// ===== ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ (ТВОИ ИМЕНА) =====
const API_KEY = process.env.API_KEY;
const BASE_URL = process.env.BASE_URL;   // например: https://app.rnova.org/api/public


if (!API_KEY) {
  console.error('❌ НЕ ЗАДАНА ПЕРЕМЕННАЯ ОКРУЖЕНИЯ API_KEY');
}

if (!BASE_URL) {
  console.error('❌ НЕ ЗАДАНА ПЕРЕМЕННАЯ ОКРУЖЕНИЯ BASE_URL');
}

// итоговый URL
const GET_APPOINTMENT_URL = `${BASE_URL}getAppointments`;

console.log('🧪 GET_APPOINTMENT_URL =', GET_APPOINTMENT_URL);

// ===== ПОЛУЧЕНИЕ ВИЗИТА ПО appointment_id =====
async function getAppointmentById(appointmentId) {
  try {

    console.log('➡️ misApi: отправляем запрос getAppointments, appointment_id =', appointmentId);

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

//    console.log('⬅️ misApi: ответ от МИС:', result);

    // проверка формата ответа
    if (!result || typeof result.error === 'undefined') {
      console.error('❌ Неверный формат ответа от МИС:', result);
      return null;
    }

    // ошибка от МИС
    if (result.error !== 0) {
      console.error('❌ Ошибка от МИС getAppointments:', result.data);
      return null;
    }

    const list = result.data;

    if (!Array.isArray(list) || list.length === 0) {
      console.error('❌ Пустой список визитов от МИС');
      return null;
    }

    // 🔥 берём первый визит
    const appointment = list[0];

    console.log('✅ misApi: визит получен:', appointment.id);

    return appointment;

  } catch (e) {
    console.error('🔥 ОШИБКА В misApi.getAppointmentById:', e);
    return null;
  }
}

module.exports = { getAppointmentById };
