// ===== CACHE FOR APPOINTMENTS =====
const appointmentsCache = {};
setInterval(() => {
  cleanExpiredCache();
}, 60 * 1000);

const express = require("express");
const router = express.Router();
const axios = require("axios");
const qs = require("querystring");

const { getDoctors } = require("../controllers/mis/doctors");
const { getSchedule } = require("../controllers/mis/schedule");

// ===============================
// 📌 Врачи
// ===============================
router.post("/doctors", getDoctors);

// ===============================
// 📌 Расписание (если используешь отдельный контроллер)
// ===============================
router.post("/schedule", getSchedule);

// ===============================
// 📌 Получение визитов (getAppointments)
// ===============================
router.post("/appointments", async (req, res) => {

  try {

    const { date } = req.body;

    if (!date) {
      return res.status(400).json({ error: "NO_DATE" });
    }

    cleanExpiredCache();

    const now = Date.now();

    // ===== CHECK CACHE =====
    if (
      appointmentsCache[date] &&
      appointmentsCache[date].expires > now
    ) {
      return res.json(appointmentsCache[date].data);
    }

    // ===== FETCH FROM MIS =====
    const formattedDate = formatDate(date);

    const body = {
      api_key: process.env.API_KEY,
      date_from: formattedDate + " 00:01",
      date_to: formattedDate + " 23:59"
    };

    const url =
      process.env.BASE_URL.replace(/\/$/, "") + "/getAppointments";

    const response = await axios.post(
      url,
      qs.stringify(body),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    if (!response.data || response.data.error !== 0) {
      return res.status(500).json({ error: "MIS_ERROR" });
    }

    // ===== SAVE CACHE (30 секунд) =====
    appointmentsCache[date] = {
      data: response.data,
      expires: now + 30 * 1000
    };

    return res.json(response.data);

  } catch (err) {
    console.log("Appointments error:", err.message);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }

});


// Функция очистки кэша
function cleanExpiredCache() {
  const now = Date.now();

  for (const key in appointmentsCache) {
    if (appointmentsCache[key].expires <= now) {
      delete appointmentsCache[key];
    }
  }
}



// ===============================
// 📌 Формат dd.mm.yyyy
// ===============================
function formatDate(dateString) {
  if (dateString.includes(".")) {
    return dateString; // уже в dd.mm.yyyy
  }

  const d = new Date(dateString);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();

  return `${dd}.${mm}.${yyyy}`;
}


module.exports = router;
