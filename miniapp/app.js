// ===============================
// Telegram Mini App Init
// ===============================
let tg = null;

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

 <div class="slider-wrapper">
  <div class="slider-container">
    <input type="range"
           id="slotDuration"
           min="15"
           max="120"
           step="15"
           value="60" />

    <div class="slider-dots">
      <span data-value="15"></span>
      <span data-value="30"></span>
      <span data-value="60"></span>
      <span data-value="90"></span>
      <span data-value="120"></span>
    </div>
  </div>

  <div class="slider-labels">
    <span>15</span>
    <span>30</span>
    <span>60</span>
    <span>90</span>
    <span>120</span>
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
const slider = document.getElementById("slotDuration");
const label = document.getElementById("slotLabel");
const showBtn = document.getElementById("showScheduleBtn");

let selectedDate = null;

renderCalendar(calendarEl, (date) => {
  selectedDate = date;
});

slider.addEventListener("input", () => {
  label.innerText = slider.value + " минут";
});

showBtn.addEventListener("click", () => {

  if (!selectedDate) {
    alert("Выберите дату");
    return;
  }

  const doctorId = document.getElementById("doctorSelect").value;
  const duration = slider.value;

  console.log({
    doctorId,
    selectedDate,
    duration
  });

  // здесь позже будет fetch расписания
});



  } catch (err) {
    content.innerHTML = `<div class="card">Ошибка загрузки врачей</div>`;
  }
}



  function nextMonth() {
    current.setMonth(current.getMonth() + 1);
    build(current.getFullYear(), current.getMonth());
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
