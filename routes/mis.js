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
  console.log("----- /api/mis/appointments -----");
  console.log("BODY:", req.body);

  try {
    const { date, doctorId } = req.body;

    if (!date) {
      return res.status(400).json({ error: "NO_DATE" });
    }

    const formattedDate = formatDate(date);

    const body = {
      api_key: process.env.API_KEY,
      date_from: formattedDate + " 00:01",
      date_to: formattedDate + " 23:59"
    };

    if (doctorId) {
      body.doctor_id = doctorId;
    }

    console.log("Calling MIS getAppointments:", body);

    const response = await axios.post(
      process.env.BASE_URL + "getAppointments",
      qs.stringify(body),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    console.log("MIS response error:", response.data?.error);

    res.json(response.data);

  } catch (err) {
    console.log(
      "MIS getAppointments error:",
      err.response?.data || err.message
    );

    res.status(500).json({ error: "MIS_ERROR" });
  }
});

// ===============================
// 📌 Формат dd.mm.yyyy
// ===============================
function formatDate(dateString) {
  const d = new Date(dateString);

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();

  return `${dd}.${mm}.${yyyy}`;
}

module.exports = router;
