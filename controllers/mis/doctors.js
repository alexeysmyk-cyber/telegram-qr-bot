const axios = require('axios');
const qs = require('querystring');
const path = require('path');
const fs = require('fs');

const DB_FILE = path.join(process.cwd(), 'db.json');

function loadDB() {
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

exports.getDoctors = async (req, res) => {
  try {

    const telegramUserId = req.body.telegramUserId;
    if (!telegramUserId) {
      return res.status(400).json({ error: 'No telegram user id' });
    }

    const db = loadDB();
   const tgUser = db.users?.[String(telegramUserId)];

    if (!tgUser || !tgUser.mis_id) {
      return res.status(403).json({ error: 'No MIS ID assigned' });
    }

    // 🔹 Запрос getUsers
    const body = qs.stringify({
      api_key: process.env.API_KEY,
      clinic_id: 2997
    });

    const response = await axios.post(
      process.env.BASE_URL.replace(/\/$/, '') + '/getUsers',
      body,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const result = response.data;

    if (!result || result.error !== 0) {
      return res.status(500).json({ error: 'MIS error' });
    }

    const users = result.data;

    // 🔹 Находим текущего пользователя в МИС
    const currentMisUser = users.find(u =>
      String(u.id) === String(tgUser.mis_id)
    );

    if (!currentMisUser) {
      return res.status(403).json({ error: 'MIS user not found' });
    }

    const roles = currentMisUser.role || [];

    const isDoctor = roles.includes("16354");
    const isDirector = roles.includes("16353");

    if (!isDoctor && !isDirector) {
      return res.status(403).json({ error: 'User is not doctor' });
    }

    // 🔹 Получаем только врачей
    const doctors = users
      .filter(u => (u.role || []).includes("16354"))
      .filter(u => !u.is_deleted)
      .map(u => ({
        id: u.id,
        name: u.name,
        avatar: u.avatar_small || u.avatar
      }));

    return res.json({
      isDirector,
      currentDoctorId: tgUser.mis_id,
      doctors
    });

  } catch (err) {
    console.error("getDoctors error:", err);
    return res.status(500).json({ error: 'Server error' });
  }
};
