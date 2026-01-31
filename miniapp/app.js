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
import { loadSchedule } from "./schedule.js";

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

    if (!response.ok || data.error) {
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

        ${isDirector ? `
          <div class="toggle-all">
            <button id="toggleAllBtn" class="secondary-btn">
              Показать для всех
            </button>
          </div>
        ` : ``}
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

      <div id="scheduleContainer"></div>

      <div class="fixed-bottom">
        <button id="showScheduleBtn" class="primary-btn">
          Показать
        </button>
      </div>
    `;

    content.innerHTML = html;

    // ===============================
    // ИНИЦИАЛИЗАЦИЯ
    // ===============================

    const calendarEl = document.getElementById("calendar");
    const showBtn = document.getElementById("showScheduleBtn");
    const doctorSelect = document.getElementById("doctorSelect");
    const scheduleContainer = document.getElementById("scheduleContainer");

    let selectedDate = null;
    let selectedDuration = 60;
    let showAll = false;

    renderCalendar(calendarEl, (date) => {
      selectedDate = date;
    });

    initStepSlider((value) => {
      selectedDuration = value;
    });

    // ===== ДЛЯ ДИРЕКТОРА =====
    const toggleBtn = document.getElementById("toggleAllBtn");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        showAll = !showAll;

        toggleBtn.innerText = showAll
          ? "Показать только выбранного"
          : "Показать для всех";

        doctorSelect.disabled = showAll;
      });
    }

    // ===== ЗАГРУЗКА РАСПИСАНИЯ =====
    showBtn.addEventListener("click", async () => {

      if (!selectedDate) {
        alert("Выберите дату");
        return;
      }

      showLoader(scheduleContainer);

      try {

        const response = await fetch("/api/mis/appointments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: selectedDate,
            doctorId: showAll ? null : doctorSelect.value
          })
        });

        const result = await response.json();

        if (!response.ok || result.error !== 0) {
          scheduleContainer.innerHTML =
            `<div class="card">Ошибка загрузки</div>`;
          return;
        }

        renderScheduleGrid(result.data, scheduleContainer);

      } catch (err) {
        scheduleContainer.innerHTML =
          `<div class="card">Ошибка сервера</div>`;
      }

    });

  } catch (err) {
    content.innerHTML = `<div class="card">Ошибка загрузки врачей</div>`;
  }
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
