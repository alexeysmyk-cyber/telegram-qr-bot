// ===============================
// Telegram Mini App Init
// ===============================
let tg = null;
let selectedDate = null;
let selectedDuration = 60;

if (window.Telegram && window.Telegram.WebApp) {
  tg = window.Telegram.WebApp;
  tg.expand();
  tg.ready();
}

// ===============================
// DOM элементы
// ===============================
const content = document.getElementById('content');
const visitsTab = document.getElementById('visitsTab');
const scheduleTab = document.getElementById('scheduleTab');

import { renderCalendar } from './calendar.js';

// ===============================
// Авторизация через backend
// ===============================
async function authorize() {
  try {
    if (!tg) {
      document.body.innerHTML = "Доступ только через Telegram";
      return false;
    }

    const initData = tg.initData;

    if (!initData) {
      document.body.innerHTML = "Нет данных авторизации";
      return false;
    }

    const response = await fetch('/api/auth/telegram', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ initData })
    });

 if (!response.ok) {
  const text = await response.text();
  content.innerHTML = `<div class="card">Ошибка: ${response.status}<br>${text}</div>`;
  return;
}

    return true;

  } catch (err) {
    console.error("Authorization error:", err);
    document.body.innerHTML = "Ошибка авторизации";
    return false;
  }
}

// ===============================
// UI логика
// ===============================
function setActive(tab) {
  visitsTab.classList.remove('active');
  scheduleTab.classList.remove('active');
  tab.classList.add('active');
}

async function renderVisits() {
  content.innerHTML = `<div class="card">Загрузка врачей...</div>`;

  try {
    const response = await fetch('/api/mis/doctors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramUserId: tg.initDataUnsafe.user.id
      })
    });

    const data = await response.json();

    if (!response.ok) {
      content.innerHTML = `<div class="card">Ошибка доступа</div>`;
      return;
    }

    const { doctors, isDirector, currentDoctorId } = data;

let html = `
  <div class="card">
    <label>Врач:</label>
    <select id="doctorSelect" ${!isDirector ? 'disabled' : ''}>
      ${doctors.map(d => `
        <option value="${d.id}" ${d.id == currentDoctorId ? 'selected' : ''}>
          ${d.name}
        </option>
      `).join('')}
    </select>
  </div>

  <div class="card">
    <div id="calendar"></div>
  </div>

 <div class="card">
  <label>Длительность приёма:</label>

  <div class="step-slider" id="durationSlider">
    <div class="step-track"></div>
    <div class="step-active" id="activeTrack"></div>

    <div class="step-point" data-value="15">15</div>
    <div class="step-point" data-value="30">30</div>
    <div class="step-point active" data-value="60">60</div>
    <div class="step-point" data-value="90">90</div>
    <div class="step-point" data-value="120">120</div>
  </div>

  <div class="slot-value">
    <span id="slotLabel">60 минут</span>
  </div>
</div>


  <button id="showScheduleBtn" class="primary-btn">
    Показать
  </button>
</div>
`;


content.innerHTML = html;

const calendarEl = document.getElementById("calendar");
const showBtn = document.getElementById("showScheduleBtn");



renderCalendar(calendarEl, (date) => {
  selectedDate = date;
});

initStepSlider(); // 👈 ОБЯЗАТЕЛЬНО

showBtn.addEventListener("click", () => {

  if (!selectedDate) {
    alert("Выберите дату");
    return;
  }

  const doctorId = document.getElementById("doctorSelect").value;

  console.log({
    doctorId,
    selectedDate,
    duration: selectedDuration
  });

});




  } catch (err) {
    content.innerHTML = `<div class="card">Ошибка загрузки врачей</div>`;
  }
}


function initStepSlider() {
  const points = document.querySelectorAll(".step-point");
  const activeTrack = document.getElementById("activeTrack");
  const label = document.getElementById("slotLabel");

  const values = [15, 30, 60, 90, 120];

  points.forEach((point, index) => {
    point.addEventListener("click", () => {
      document.querySelectorAll(".step-point")
        .forEach(p => p.classList.remove("active"));

      point.classList.add("active");

      const value = Number(point.dataset.value);
      label.innerText = value + " минут";

      selectedDuration = value; // 👈 сохраняем

      const percent = (index / (values.length - 1)) * 100;
      activeTrack.style.width = percent + "%";
    });
  });

  const defaultIndex = values.indexOf(60);
  activeTrack.style.width =
    (defaultIndex / (values.length - 1)) * 100 + "%";
}










function renderSchedule() {
  content.innerHTML = `
    <div class="card">
      <b>Расписание</b><br/>
      Здесь будет управление слотами врача.
    </div>
  `;
}

function attachEvents() {
  visitsTab.addEventListener('click', () => {
    setActive(visitsTab);
    renderVisits();
  });

  scheduleTab.addEventListener('click', () => {
    setActive(scheduleTab);
    renderSchedule();
  });
}

// ===============================
// Инициализация
// ===============================
async function init() {
  const authorized = await authorize();
  if (!authorized) return;

  attachEvents();
  renderVisits();
}

init();
