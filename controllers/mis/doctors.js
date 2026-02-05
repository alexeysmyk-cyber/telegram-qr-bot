const axios = require('axios');
const qs = require('querystring');
const path = require('path');
const fs = require('fs');

const DB_FILE = path.join(process.cwd(), 'db.json');

function loadDB() {
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

// ===============================
// CACHE getUsers (60 sec)
// ===============================
let doctorsCache = {
  data: null,
  expires: 0
};


exports.getDoctors = async (req, res) => {
  try {

//    console.log("----- /api/mis/doctors -----");
 //   console.log("BODY:", req.body);

    const telegramUserId = req.body?.telegramUserId;

    if (!telegramUserId) {
      console.log("❌ No telegramUserId in body");
      return res.status(400).send("No telegramUserId");
    }

    const db = loadDB();

//    console.log("DB users keys:", Object.keys(db.users || {}));

    const tgUser = db.users?.[String(telegramUserId)];

    if (!tgUser) {
      console.log("❌ Telegram user not found in db.json");
      return res.status(403).send("User not found in DB");
    }

    if (!tgUser.mis_id) {
      console.log("❌ User has no mis_id");
      return res.status(403).send("No MIS ID assigned");
    }

//    console.log("Telegram user MIS ID:", tgUser.mis_id);


// ===============================
// CHECK CACHE
// ===============================
const now = Date.now();

if (doctorsCache.data && doctorsCache.expires > now) {
  console.log("📦 getUsers CACHE HIT");
  
return res.json(
  buildDoctorsResponse(
    doctorsCache.data,
    tgUser.mis_id
  )
);
}


    

    // --- Запрос в МИС ---
    const body = qs.stringify({
      api_key: process.env.API_KEY
       });

    const url = process.env.BASE_URL.replace(/\/$/, '') + '/getUsers';

//    console.log("Calling MIS:", url);

    const response = await axios.post(
      url,
      body,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const result = response.data;

    console.log("MIS response error:", result.error);

    if (!result || result.error !== 0) {
      console.log("❌ MIS returned error:", result);
      return res.status(500).send("MIS error");
    }

    const users = result.data;

    // ===============================
// SAVE CACHE (60 sec)
// ===============================
doctorsCache = {
  data: users,
  expires: Date.now() + 60 * 1000
};


//    console.log("Users count from MIS:", users.length);

    // --- Находим текущего пользователя в МИС ---
  const currentMisUser = users.find(u =>
  String(u.id).trim() === String(tgUser.mis_id).trim()
);

    if (!currentMisUser) {
      console.log("❌ MIS user not found by mis_id");
      return res.status(403).send("MIS user not found");
    }

//    console.log("MIS user roles:", currentMisUser.role);

    const roles = (currentMisUser.role || []).map(r => String(r));

    const isDoctor = roles.includes("16354");
    const isDirector = roles.includes("16353");

    if (!isDoctor && !isDirector) {
      console.log("❌ User is not doctor or director");
      return res.status(403).send("User is not doctor");
    }

    // --- Получаем только врачей ---
    const doctors = users
      .filter(u => (u.role || []).includes("16354"))
      .filter(u => !u.is_deleted)
      .map(u => ({
        id: u.id,
        name: u.name,
        avatar: u.avatar_small || u.avatar || null
      }));

//    console.log("Doctors count:", doctors.length);
let currentDoctorId = null;

if (isDoctor) {
  currentDoctorId = tgUser.mis_id;
} else if (isDirector) {
  currentDoctorId = doctors.length ? doctors[0].id : null;
}

return res.json(
  buildDoctorsResponse(users, tgUser.mis_id)
);

  } catch (err) {
    console.error("🔥 getDoctors fatal error:", err);
    return res.status(500).send("Server error");
  }
};

function buildDoctorsResponse(users, currentMisId) {

  const currentMisUser = users.find(u =>
    String(u.id).trim() === String(currentMisId).trim()
  );

  if (!currentMisUser) {
    throw new Error("MIS user not found");
  }

  const roles = (currentMisUser.role || []).map(r => String(r));

  const isDoctor = roles.includes("16354");
  const isDirector = roles.includes("16353");

  if (!isDoctor && !isDirector) {
    throw new Error("User is not doctor");
  }

  const doctors = users
    .filter(u => (u.role || []).includes("16354"))
    .filter(u => !u.is_deleted)
    .map(u => ({
      id: u.id,
      name: u.name,
      avatar: u.avatar_small || u.avatar || null
    }));

  let currentDoctorId = null;

  if (isDoctor) {
    currentDoctorId = currentMisId;
  } else if (isDirector) {
    currentDoctorId = doctors.length ? doctors[0].id : null;
  }

  return {
    isDirector,
    currentDoctorId,
    doctors
  };
}

