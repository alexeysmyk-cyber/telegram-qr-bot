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

function getShortName(fullName) {
  const parts = fullName.split(" ");
  if (parts.length < 2) return fullName;

  const lastName = parts[0];
  const initials = parts.slice(1)
    .map(p => p[0] + ".")
    .join("");

  return `${lastName} ${initials}`;
}

function initDoctorSelect() {
  const select = document.getElementById("doctorSelect");
  if (!select) return;

  function updateClosedText() {
    const selectedOption = select.options[select.selectedIndex];
    const short = selectedOption.dataset.short;
    selectedOption.textContent = short;
  }

  function restoreFullText() {
    Array.from(select.options).forEach(option => {
      option.textContent = option.dataset.full;
    });
  }

  // При открытии
  select.addEventListener("mousedown", restoreFullText);

  // При выборе
  select.addEventListener("change", () => {
    updateClosedText();
  });

  // Инициализация
  updateClosedText();
}


function setActive(tab) {
  visitsTab.classList.remove('active');
  scheduleTab.classList.remove('active');
  tab.classList.add('active');
}

async function renderVisits() {

  content.innerHTML = `<div class="card">Загрузка врачей...</div>`;

  try {

    if (!tg || !tg.initDataUnsafe || !tg.initDataUnsafe.user) {
      content.innerHTML = `<div class="card">Ошибка Telegram WebApp</div>`;
      return;
    }

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

    const { doctors = [], isDirector = false, currentDoctorId = null } = data;

    if (!Array.isArray(doctors) || doctors.length === 0) {
      content.innerHTML = `<div class="card">Нет врачей</div>`;
      return;
    }

let html = `
  <div class="card doctor-row">

    <div class="doctor-select-wrapper">
      <select id="doctorSelect" ${!isDirector ? 'disabled' : ''}>
        ${doctors.map(d => `
          <option value="${d.id}" 
                  data-short="${getShortName(d.name)}"
                  data-full="${d.name}"
                  ${String(d.id) === String(currentDoctorId) ? 'selected' : ''}>
            ${d.name}
          </option>
        `).join('')}
      </select>
    </div>

    ${isDirector ? `
      <div class="doctor-toggle" id="doctorToggle">
        <div class="toggle-btn active" data-mode="self">Мои</div>
        <div class="toggle-btn" data-mode="all">Все</div>
      </div>
    ` : ``}

  </div>



<div class="card filter-summary">

  <div class="filter-header">
    <span class="filter-title">Фильтры</span>

    <button id="editFiltersBtn" class="link-btn">
      Изменить
    </button>
  </div>

  <div class="filter-values" id="filterSummary">
    60 мин · Предстоящие
  </div>

</div>

<div class="card filter-panel hidden" id="filterPanel">

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

  <div class="toggles">

    <div class="toggle-line">
      <span>Показать отменённые</span>
      <label class="switch">
        <input type="checkbox" id="toggleCancelled">
        <span class="slider"></span>
      </label>
    </div>

    <div class="toggle-line">
      <span>Показать завершённые</span>
      <label class="switch">
        <input type="checkbox" id="toggleCompleted">
        <span class="slider"></span>
      </label>
    </div>

  </div>

</div>



<div class="card calendar-wrapper">
  <div id="calendarHeader" class="calendar-header hidden">
    <button id="prevDayBtn" class="nav-btn">‹</button>
    <div id="selectedDateLabel" class="selected-date"></div>
    <button id="nextDayBtn" class="nav-btn">›</button>
  </div>

  <div id="calendar"></div>
</div>


  <div id="scheduleContainer"></div>

  <div class="fixed-bottom">
    <button id="showScheduleBtn" class="primary-btn">
      Показать
    </button>
  </div>
`;


    content.innerHTML = html;

let showCancelled = false;
let showCompleted = false;

const filterPanel = document.getElementById("filterPanel");
const toggleFiltersBtn = document.getElementById("editFiltersBtn");
const filterSummary = document.getElementById("filterSummary");
const toggleCancelled = document.getElementById("toggleCancelled");
const toggleCompleted = document.getElementById("toggleCompleted");

toggleFiltersBtn.addEventListener("click", () => {
  filterPanel.classList.toggle("hidden");
});

toggleCancelled.addEventListener("change", () => {
  showCancelled = toggleCancelled.checked;
  updateFilterSummary();
});

toggleCompleted.addEventListener("change", () => {
  showCompleted = toggleCompleted.checked;
  updateFilterSummary();
});

initStepSlider((value) => {
  selectedDuration = value;
  updateFilterSummary();
});

function updateFilterSummary() {
  let parts = [];

  parts.push(selectedDuration + " мин");

  if (!showCancelled && !showCompleted) {
    parts.push("Все");
  } else {
    if (showCancelled) parts.push("Отменённые");
    if (showCompleted) parts.push("Завершённые");
  }

  filterSummary.innerText = parts.join(" • ");
}


    // ===============================
    // ИНИЦИАЛИЗАЦИЯ
    // ===============================
   initDoctorSelect();
    const calendarEl = document.getElementById("calendar");
    const showBtn = document.getElementById("showScheduleBtn");
    const doctorSelect = document.getElementById("doctorSelect");
    const scheduleContainer = document.getElementById("scheduleContainer");

    let showAll = false;
    let selectedDate = null;
  //  let selectedDuration = 60;
if (showBtn) {

}


    // календарь
    renderCalendar(calendarEl, (date) => {
  selectedDate = date;

  if (!date) return;

  loadSchedule({
    container: scheduleContainer,
    date: formatLocalDate(date),
    doctorId: showAll ? null : doctorSelect.value,
    duration: selectedDuration,
    showCancelled,
    showCompleted
  });
});

    // слайдер
    if (typeof initStepSlider === "function") {
      initStepSlider((value) => {
        selectedDuration = value;
      });
    }

    // директор — показать всех


const toggleContainer = document.getElementById("doctorToggle");

if (toggleContainer) {

  const buttons = toggleContainer.querySelectorAll(".toggle-btn");

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {

      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      showAll = btn.dataset.mode === "all";

      doctorSelect.disabled = showAll;
    });
  });
}


    // ===============================
    // ЗАГРУЗКА РАСПИСАНИЯ
    // ===============================

showBtn.addEventListener("click", () => {

  if (!selectedDate) {
    alert("Выберите дату");
    return;
  }

loadSchedule({
  container: scheduleContainer,
  date: formatLocalDate(selectedDate),
  doctorId: showAll ? null : doctorSelect.value,
  duration: selectedDuration,
  showCancelled: showCancelled,
  showCompleted: showCompleted
});


});


  } catch (err) {

    console.error("renderVisits error:", err);

    content.innerHTML =
      `<div class="card">Ошибка загрузки врачей</div>`;
  }
}

function formatLocalDate(date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function formatPrettyDate(date) {
  const days = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const months = [
    "Января","Февраля","Марта","Апреля","Мая","Июня",
    "Июля","Августа","Сентября","Октября","Ноября","Декабря"
  ];

  const dayName = days[date.getDay()];
  const dd = String(date.getDate()).padStart(2, "0");
  const month = months[date.getMonth()];
  const yyyy = date.getFullYear();

  return `${dayName}. ${dd}-${month}-${yyyy}`;
}



function initStepSlider(onChange) {
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

      const percent = (index / (values.length - 1)) * 100;
      activeTrack.style.width = percent + "%";

      if (onChange) onChange(value);
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
