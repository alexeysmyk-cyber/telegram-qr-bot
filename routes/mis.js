

const express = require("express");
const router = express.Router();
const axios = require("axios");
const qs = require("querystring");

const { getDoctors } = require('../controllers/mis/doctors');
const { getSchedule } = require('../controllers/mis/schedule');

router.post('/doctors', getDoctors);
router.post('/schedule', getSchedule);

router.post("/appointments", async (req, res) => {
  try {
    const { date, doctorId } = req.body;

    if (!date) {
      return res.status(400).json({ error: "NO_DATE" });
    }

    const formatted = formatDate(date); // dd.mm.yyyy

    const body = {
      api_key: process.env.API_KEY,
      date_from: formatted + " 00:01",
      date_to: formatted + " 23:59"
    };

    if (doctorId) {
      body.doctor_id = doctorId;
    }

    const response = await axios.post(
      process.env.BASE_URL + "getAppointments",
      qs.stringify(body),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      }
    );

    res.json(response.data);

  } catch (err) {
    console.log("MIS getAppointments error:", err.response?.data || err.message);
    res.status(500).json({ error: "MIS_ERROR" });
  }
});

function formatDate(dateString) {
  const d = new Date(dateString);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

module.exports = router;

