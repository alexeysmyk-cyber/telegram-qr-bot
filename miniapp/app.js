

// ===============================
// Telegram Mini App Init
// ===============================
let scheduleTimeout = null;
let tg = null;
let selectedDate = null;
let selectedDuration = 60;
let touchStartX = 0;
let touchStartY = 0;

let gestureLocked = false;
let gestureType = null; // "horizontal" | "vertical"

if (window.Telegram && window.Telegram.WebApp)
{ tg = window.Telegram.WebApp; tg.expand(); tg.ready(); }

if (window.Telegram?.WebApp) {
  Telegram.WebApp.enableClosingConfirmation();
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
      document.body.innerHTML = renderFatal(
        "Приложение доступно только через Telegram."
      );
      return false;
    }

    const response = await fetch('/api/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg.initData })
    });

    const data = await response.json();

    if (!response.ok) {

      let message = "Ошибка доступа.";

      switch (data.code) {
        case "NOT_AUTHORIZED":
          message = "Для работы необходимо авторизоваться в боте.";
          break;

        case "NO_MIS_ID":
          message = "Для работы в МИС необходимо внести MIS ID.";
          break;

        case "ROLE_NOT_ALLOWED":
          message = "Ваша должностная роль не разрешает работу в МИС.";
          break;

        default:
          message = "Доступ запрещён.";
      }

      document.body.innerHTML = renderFatal(message);

      setTimeout(() => {
        tg.close();
      }, 3000);

      return false;
    }

    return true;

  } catch (err) {
    document.body.innerHTML = renderFatal("Ошибка авторизации.");
    return false;
  }
}

function renderFatal(text) {
  return `
    <div class="fatal-screen">
      <div class="fatal-card">
        <div class="fatal-icon">⚠️</div>
        <div class="fatal-text">${text}</div>
      </div>
    </div>
  `;
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

<div class="filter-panel collapsing" id="filterPanel">

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

  if (window.isLongPressActive) return;

  touchStartX = e.changedTouches[0].screenX;
  touchStartY = e.changedTouches[0].screenY;

  gestureLocked = false;
  gestureType = null;
});

  scheduleWrapper.addEventListener("touchmove", (e) => {

  if (gestureLocked) return;

  const diffX = e.changedTouches[0].screenX - touchStartX;
  const diffY = e.changedTouches[0].screenY - touchStartY;

  const absX = Math.abs(diffX);
  const absY = Math.abs(diffY);

  // ждём пока жест станет заметным
  if (absX < 12 && absY < 12) return;

  if (absX > absY * 1.3) {
    gestureType = "horizontal";
  } else {
    gestureType = "vertical";
  }

  gestureLocked = true;
});

  
scheduleWrapper.addEventListener("touchend", (e) => {

  if (window.isLongPressActive) return;
  if (!selectedDate) return;

  if (gestureType !== "horizontal") return;

  const diffX = e.changedTouches[0].screenX - touchStartX;

  if (Math.abs(diffX) < 120) return;

  if (diffX > 0) {
    selectedDate.setDate(selectedDate.getDate() - 1);
  } else {
    selectedDate.setDate(selectedDate.getDate() + 1);
  }

  renderCalendar(
    document.getElementById("calendar"),
    (date) => {
      selectedDate = new Date(date);
      refreshSchedule();
    },
    selectedDate
  );

  refreshSchedule();
});










  
  const toggleCancelled = document.getElementById("toggleCancelled");
  const toggleCompleted = document.getElementById("toggleCompleted");
  const filterSummary = document.getElementById("filterSummary");
  const toggleContainer = document.getElementById("doctorToggle");

  const filterPanel = document.getElementById("filterPanel");
const editFiltersBtn = document.getElementById("editFiltersBtn");


// ===============================
// SMOOTH AUTO CLOSE FILTER ON SCROLL
// ===============================

scheduleContainer.addEventListener("scroll", () => {

  if (
    scheduleContainer.scrollTop > 10 &&
    !filterPanel.classList.contains("collapsing")
  ) {
    filterPanel.classList.add("collapsing");
    editFiltersBtn.innerText = "Изменить";
  }

});




  

editFiltersBtn.addEventListener("click", () => {

  const isHidden = filterPanel.classList.contains("hidden");

if (filterPanel.classList.contains("collapsing")) {
  filterPanel.classList.remove("collapsing");
  editFiltersBtn.innerText = "Свернуть";
} else {
  filterPanel.classList.add("collapsing");
  editFiltersBtn.innerText = "Изменить";
}

});
  

  let showCancelled = false;
  let showCompleted = false;
  let showAll = false;

function refreshSchedule() {
  if (!selectedDate) return;

  if (scheduleTimeout) {
    clearTimeout(scheduleTimeout);
  }

  scheduleTimeout = setTimeout(() => {

    loadSchedule({
      container: scheduleContainer,
      date: formatLocalDate(selectedDate),
      doctorId: showAll ? null : doctorSelect.value,
      showAll,
      duration: selectedDuration,
      showCancelled,
      showCompleted
    });

  }, 350); // 🔥 задержка 350мс
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

