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

import { renderCalendar } from './calendar.js';
import { loadSchedule } from "./schedule.js";

// ===============================
// DOM
// ===============================
const content = document.getElementById('content');
const visitsTab = document.getElementById('visitsTab');
const scheduleTab = document.getElementById('scheduleTab');

// ===============================
// AUTH
// ===============================
async function authorize() {
  try {
    if (!tg) {
      document.body.innerHTML = "Доступ только через Telegram";
      return false;
    }

    const response = await fetch('/api/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg.initData })
    });

    if (!response.ok) {
      const text = await response.text();
      content.innerHTML = `<div class="card">Ошибка: ${response.status}<br>${text}</div>`;
      return false;
    }

    return true;

  } catch (err) {
    document.body.innerHTML = "Ошибка авторизации";
    return false;
  }
}

// ===============================
// UI helpers
// ===============================
function getShortName(fullName) {
  const parts = fullName.split(" ");
  if (parts.length < 2) return fullName;
  return `${parts[0]} ${parts.slice(1).map(p => p[0] + ".").join("")}`;
}

function setActive(tab) {
  visitsTab.classList.remove('active');
  scheduleTab.classList.remove('active');
  tab.classList.add('active');
}

// ===============================
// VISITS PAGE
// ===============================
async function renderVisits() {

  content.innerHTML = `<div class="card">Загрузка врачей...</div>`;

  if (!tg?.initDataUnsafe?.user) {
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

  if (!doctors.length) {
    content.innerHTML = `<div class="card">Нет врачей</div>`;
    return;
  }

  // ===============================
  // HTML
  // ===============================
  content.innerHTML = `
    <div class="card doctor-row">
      <div class="doctor-select-wrapper">
        <select id="doctorSelect" ${!isDirector ? 'disabled' : ''}>
          ${doctors.map(d => `
            <option value="${d.id}"
        data-full="${d.name}"
        data-short="${getShortName(d.name)}"
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

    <div class="card filter-card">
      <div class="filter-header">
        <span class="filter-title">Фильтры</span>
        <button id="editFiltersBtn" class="link-btn">Изменить</button>
      </div>

      <div class="filter-values" id="filterSummary">
        60 мин · Предстоящие
      </div>

<div class="filter-panel hidden" id="filterPanel">

 <label>
  Длительность приёма:
  <span id="durationValue">60 минут</span>
</label>

  <div class="step-slider" id="durationSlider">
    <div class="step-track"></div>
    <div class="step-active" id="activeTrack"></div>

    <div class="step-point" data-value="15">15</div>
    <div class="step-point" data-value="30">30</div>
    <div class="step-point active" data-value="60">60</div>
    <div class="step-point" data-value="90">90</div>
    <div class="step-point" data-value="120">120</div>
  </div>

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
      <div id="calendar"></div>
    </div>

    <div id="scheduleContainer"></div>
  `;

  // ===============================
  // STATE
  // ===============================
  const doctorSelect = document.getElementById("doctorSelect");

function initDoctorSelect() {

  if (!doctorSelect) return;

  function updateClosedText() {
    const selectedOption = doctorSelect.options[doctorSelect.selectedIndex];
    selectedOption.textContent = selectedOption.dataset.short;
  }

  function restoreFullText() {
    Array.from(doctorSelect.options).forEach(option => {
      option.textContent = option.dataset.full;
    });
  }

  doctorSelect.addEventListener("mousedown", restoreFullText);

  doctorSelect.addEventListener("change", () => {
    updateClosedText();
  });

  updateClosedText();
}

initDoctorSelect();

  

doctorSelect.addEventListener("change", () => {
  refreshSchedule();
});





  
const scheduleContainer = document.getElementById("scheduleContainer");
const scheduleWrapper = scheduleContainer.parentElement;

let touchStartX = 0;

scheduleWrapper.addEventListener("touchstart", (e) => {
  touchStartX = e.changedTouches[0].screenX;
});

scheduleWrapper.addEventListener("touchend", (e) => {

  if (!selectedDate) return;

  const diff = e.changedTouches[0].screenX - touchStartX;

  if (Math.abs(diff) < 60) return;

  if (diff > 0) {
    selectedDate.setDate(selectedDate.getDate() - 1);
  } else {
    selectedDate.setDate(selectedDate.getDate() + 1);
  }

  // обновляем календарь
  renderCalendar(
    document.getElementById("calendar"),
    (date) => {
      selectedDate = new Date(date);
      refreshSchedule();
    },
    selectedDate
  );

});








  
  const toggleCancelled = document.getElementById("toggleCancelled");
  const toggleCompleted = document.getElementById("toggleCompleted");
  const filterSummary = document.getElementById("filterSummary");
  const toggleContainer = document.getElementById("doctorToggle");

  const filterPanel = document.getElementById("filterPanel");
const editFiltersBtn = document.getElementById("editFiltersBtn");

editFiltersBtn.addEventListener("click", () => {

  const isHidden = filterPanel.classList.contains("hidden");

  if (isHidden) {
    filterPanel.classList.remove("hidden");
    editFiltersBtn.innerText = "Свернуть";
  } else {
    filterPanel.classList.add("hidden");
    editFiltersBtn.innerText = "Изменить";
  }

});
  

  let showCancelled = false;
  let showCompleted = false;
  let showAll = false;

  function refreshSchedule() {
  if (!selectedDate) return;

  loadSchedule({
    container: scheduleContainer,
    date: formatLocalDate(selectedDate),
    doctorId: showAll ? null : doctorSelect.value,
    showAll,
    duration: selectedDuration,
    showCancelled,
    showCompleted
  });
}

function updateFilterSummary() {
  let parts = [];

  parts.push(selectedDuration + " мин");

 
    parts.push("Предстоящие");

    if (showCancelled) parts.push("Отменённые");
    if (showCompleted) parts.push("Завершённые");
  

  filterSummary.innerText = parts.join(" • ");
}

  

  // ===============================
  // Director toggle
  // ===============================
  if (toggleContainer) {
    toggleContainer.querySelectorAll(".toggle-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        toggleContainer.querySelectorAll(".toggle-btn")
          .forEach(b => b.classList.remove("active"));

        btn.classList.add("active");
        showAll = btn.dataset.mode === "all";
        doctorSelect.disabled = showAll;
        
        refreshSchedule();
        
      });
    });
  }

  // ===============================
  // Filters
  // ===============================

toggleCancelled.addEventListener("change", () => {
  showCancelled = toggleCancelled.checked;
  updateFilterSummary();
  refreshSchedule(); // ← добавили
});
toggleCompleted.addEventListener("change", () => {
  showCompleted = toggleCompleted.checked;
  updateFilterSummary();
  refreshSchedule();
});
  
initStepSlider((value) => {
  selectedDuration = value;
  updateFilterSummary();
  refreshSchedule();
});

  
  // ===============================
  // Calendar
  // ===============================
  selectedDate = new Date();

renderCalendar(
  document.getElementById("calendar"),
  (date) => {
    selectedDate = new Date(date);

    loadSchedule({
      container: scheduleContainer,
      date: formatLocalDate(selectedDate),
      doctorId: showAll ? null : doctorSelect.value,
      showAll,
      duration: selectedDuration,
      showCancelled,
      showCompleted
    });
  },
  selectedDate
);


  // 🔥 Автозагрузка сегодняшнего дня
  loadSchedule({
    container: scheduleContainer,
    date: formatLocalDate(selectedDate),
    doctorId: showAll ? null : doctorSelect.value,
    showAll,
    duration: selectedDuration,
    showCancelled,
    showCompleted
  });
}

// ===============================





function formatLocalDate(date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}
function initStepSlider(onChange) {

  const points = document.querySelectorAll(".step-point");
  const activeTrack = document.getElementById("activeTrack");

  const values = [15, 30, 60, 90, 120];

  points.forEach((point, index) => {

    point.addEventListener("click", () => {

      document.querySelectorAll(".step-point")
        .forEach(p => p.classList.remove("active"));

      point.classList.add("active");

      const value = Number(point.dataset.value);
const durationValue = document.getElementById("durationValue");
if (durationValue) {
  durationValue.innerText = value + " минут";
}
      

      const percent = (index / (values.length - 1)) * 100;
      activeTrack.style.width = percent + "%";

      if (onChange) onChange(value);
    });

  });

  const defaultIndex = values.indexOf(60);
  activeTrack.style.width =
    (defaultIndex / (values.length - 1)) * 100 + "%";
}


// ===============================
function renderSchedule() {
  content.innerHTML = `
    <div class="card">
      <b>Расписание</b><br/>
      Здесь будет управление слотами врача.
    </div>
  `;
}

// ===============================
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
async function init() {
  const ok = await authorize();
  if (!ok) return;

  attachEvents();
  renderVisits();
}

init();

