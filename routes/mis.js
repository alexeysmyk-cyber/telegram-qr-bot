const express = require('express');
const router = express.Router();

const { getDoctors } = require('../controllers/mis/doctors');
const { getSchedule } = require('../controllers/mis/schedule');

router.post('/doctors', getDoctors);
router.post('/schedule', getSchedule);

module.exports = router;
