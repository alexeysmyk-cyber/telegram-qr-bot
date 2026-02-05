import { renderCalendar } from "./calendar.js";
import { openVisitView } from "./visitView.js";

let selectedSlots = [];
let currentSchedule = [];
let fullSchedule = [];   // 👈 ВОТ СЮДА
let selectedDate = null;
let selectedDuration = 60;


export async function openCreateVisit() {

  
  if (document.getElementById("createOverlay")) return;

  // скрываем FAB
const fab = document.getElementById("fabCreate");
if (fab) fab.style.display = "none";


  let hidePast = false;
  let hideBusy = false;

  const overlay = document.createElement("div");
  overlay.id = "createOverlay";
  overlay.className = "visit-overlay";

  overlay.innerHTML = `
    <div class="visit-container create-container">

      <div class="create-header">
        <div class="create-title">Создание визита</div>
        <div class="create-close" id="closeCreateBtn">✕</div>
      </div>

     <div class="card" id="doctorContainer">
  <div class="doctor-row">
    <div class="doctor-select-wrapper">
      Загрузка врачей...
    </div>
  </div>
</div>

      <div class="card filter-card">

        <div class="filter-header">
          <span class="filter-title">Фильтры</span>
          <button id="editCreateFiltersBtn" class="link-btn">
            Изменить
          </button>
        </div>

        <div class="filter-values" id="createFilterSummary">
          60 мин
        </div>

        <div class="filter-panel collapsing" id="createFilterPanel">

          <label>
            Длительность приёма:
            <span id="createDurationValue">60 минут</span>
          </label>

          <div class="step-slider" id="createDurationSlider">
            <div class="step-track"></div>
            <div class="step-active" id="createActiveTrack"></div>

            <div class="step-point" data-value="15">15</div>
            <div class="step-point" data-value="30">30</div>
            <div class="step-point active" data-value="60">60</div>
            <div class="step-point" data-value="90">90</div>
            <div class="step-point" data-value="120">120</div>
          </div>

          <div class="toggle-line">
            <span>Не показывать прошлые</span>
            <label class="switch">
              <input type="checkbox" id="toggleHidePast">
              <span class="slider"></span>
            </label>
          </div>

          <div class="toggle-line">
            <span>Не показывать занятые</span>
            <label class="switch">
              <input type="checkbox" id="toggleHideBusy">
              <span class="slider"></span>
            </label>
          </div>

        </div>

      </div>

      <div class="card calendar-wrapper">
        <div id="createCalendar"></div>
      </div>

      <div id="createSlotsContainer"></div>

    </div>
  `;

  document.body.appendChild(overlay);
  
const actionBtn = document.createElement("div");
actionBtn.className = "fixed-bottom";
actionBtn.innerHTML = `
  <button class="primary-btn" id="createNextBtn" disabled>
    Выбрать пациента
  </button>
`;
overlay.appendChild(actionBtn);
  

  document.getElementById("closeCreateBtn")
  .addEventListener("click", () => {

    overlay.remove();

    const fab = document.getElementById("fabCreate");
    if (fab) fab.style.display = "flex";
});

  await loadDoctorsForCreate();

  // ===============================
  // ФИЛЬТРЫ
  // ===============================

  const filterPanel = document.getElementById("createFilterPanel");
  const editBtn = document.getElementById("editCreateFiltersBtn");

  editBtn.addEventListener("click", () => {
    if (filterPanel.classList.contains("collapsing")) {
      filterPanel.classList.remove("collapsing");
      editBtn.innerText = "Свернуть";
    } else {
      filterPanel.classList.add("collapsing");
      editBtn.innerText = "Изменить";
    }
  });

  function updateFilterSummary() {
    const summary = document.getElementById("createFilterSummary");
    const parts = [];

    parts.push(selectedDuration + " мин");
    if (hidePast) parts.push("Без прошлых");
    if (hideBusy) parts.push("Без занятых");

    summary.innerText = parts.join(" • ");
  }

  document.getElementById("toggleHidePast")
    .addEventListener("change", (e) => {
      hidePast = e.target.checked;
      updateFilterSummary();
    });

  document.getElementById("toggleHideBusy")
    .addEventListener("change", (e) => {
      hideBusy = e.target.checked;
      updateFilterSummary();
    });

  initCreateSlider((value) => {
    selectedDuration = value;
    updateFilterSummary();
  });

  updateFilterSummary();

  // ===============================
  // КАЛЕНДАРЬ
  // ===============================

 

renderCalendar(
  document.getElementById("createCalendar"),
  (date) => {
    selectedDate = new Date(date);
    loadCreateSchedule();
  },
  new Date()
);

// первая загрузка
selectedDate = new Date();
loadCreateSchedule();




  
}


// ===============================
// ЗАГРУЗКА ВРАЧЕЙ
// ===============================

async function loadDoctorsForCreate() {

  const tg = window.Telegram?.WebApp;
  if (!tg?.initDataUnsafe?.user) return;

  const response = await fetch("/api/mis/doctors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      telegramUserId: tg.initDataUnsafe.user.id
    })
  });

  const data = await response.json();
  const container = document.getElementById("doctorContainer");

  if (!response.ok || data.error) {
    container.innerHTML = "Ошибка загрузки врачей";
    return;
  }

  const { doctors = [], isDirector, currentDoctorId } = data;

  let allowedDoctors = [];

  if (isDirector) {
    allowedDoctors = doctors;
  } else {
    allowedDoctors = doctors.filter(d =>
      String(d.id) === String(currentDoctorId)
    );
  }

container.innerHTML = `
  <div class="doctor-row">
    <div class="doctor-select-wrapper">
      <select id="createDoctorSelect">
        ${allowedDoctors.map(d => `
<option value="${d.id}"
  ${String(d.id) === String(currentDoctorId) ? "selected" : ""}>
  ${d.name}
</option>
        `).join("")}
      </select>
    </div>
  </div>
`;

document
  .getElementById("createDoctorSelect")
  ?.addEventListener("change", () => {
  filterScheduleByDoctor();
});
  
}


// ===============================
// СЛАЙДЕР 15/30/60/90/120
// ===============================

function initCreateSlider(onChange) {

  const points = document.querySelectorAll("#createDurationSlider .step-point");
  const activeTrack = document.getElementById("createActiveTrack");

  const values = [15, 30, 60, 90, 120];

  points.forEach((point, index) => {

    point.addEventListener("click", () => {

      points.forEach(p => p.classList.remove("active"));
      point.classList.add("active");

      const value = Number(point.dataset.value);

      const durationLabel = document.getElementById("createDurationValue");
      durationLabel.innerText = value + " минут";

      const percent = (index / (values.length - 1)) * 100;
      activeTrack.style.width = percent + "%";

      if (onChange) onChange(value);
    });

  });

  const defaultIndex = values.indexOf(60);
  activeTrack.style.width =
    (defaultIndex / (values.length - 1)) * 100 + "%";
}

async function loadCreateSchedule() {

  const doctorSelect = document.getElementById("createDoctorSelect");
  const container = document.getElementById("createSlotsContainer");

  if (!doctorSelect) return;

  container.innerHTML = `
    <div class="loader">
      <div class="spinner"></div>
      <div>Загрузка слотов...</div>
    </div>
  `;

  const date = formatDate(selectedDate);

  const response = await fetch("/api/mis/get-schedule", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date }) // doctor_id можно убрать вообще
  });

const data = await response.json();

if (!response.ok || data.error !== 0) {
  container.innerHTML = "Ошибка загрузки расписания";
  return;
}

// ===============================
// MIS возвращает объект { user_id: [slots] }
// Преобразуем в один массив
// ===============================
const rawData = data.data || {};
fullSchedule = Object.values(rawData).flat();

// Фильтруем по врачу
filterScheduleByDoctor();



function renderSlots() {

  const container = document.getElementById("createSlotsContainer");

  if (!currentSchedule.length) {
    container.innerHTML = `
      <div class="card empty-state">
        Нет доступных слотов
      </div>
    `;
    return;
  }

  let html = "";

  currentSchedule.forEach(slot => {

    // по умолчанию показываем только свободные
    if (slot.is_busy) return;

    let className = "slot slot-free";

    if (slot.is_past) {
      className = "slot slot-past";
    }

    html += `
      <div class="${className}"
           data-id="${slot.time_start}"
           data-start="${slot.time_start}"
           data-end="${slot.time_end}">
        <div class="time">
          ${slot.time}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  attachSlotSelection();
}

function attachSlotSelection() {

  document.querySelectorAll("#createSlotsContainer .slot")
    .forEach(slot => {

      slot.addEventListener("click", () => {

        if (slot.classList.contains("slot-past")) return;

        const id = slot.dataset.id;

        if (slot.classList.contains("selected")) {
          removeSlot(id);
        } else {
          addSlot(id);
        }

        updateCreateButton();
      });

    });
}
function addSlot(id) {

const index = currentSchedule.findIndex(s =>
  String(s.time_start) === String(id)
);

  if (selectedSlots.length === 0) {
    selectedSlots.push(index);
  } else {
    const min = Math.min(...selectedSlots);
    const max = Math.max(...selectedSlots);

    if (index === min - 1 || index === max + 1) {
      selectedSlots.push(index);
    }
  }

  renderSelection();
}

function removeSlot(id) {

const index = currentSchedule.findIndex(s =>
  String(s.time_start) === String(id)
);
  const min = Math.min(...selectedSlots);
  const max = Math.max(...selectedSlots);

  if (index === min || index === max) {
    selectedSlots = selectedSlots.filter(i => i !== index);
  }

  renderSelection();
}

function renderSelection() {

  document.querySelectorAll("#createSlotsContainer .slot")
    .forEach(slot => slot.classList.remove("selected"));

  selectedSlots.forEach(i => {
    const slot = currentSchedule[i];
    const el = document.querySelector(
      `[data-id="${slot.time_start}"]`
    );
    if (el) el.classList.add("selected");
  });
}

function updateCreateButton() {
  const btn = document.getElementById("createNextBtn");
  if (!btn) return;

  btn.disabled = selectedSlots.length === 0;
}

function formatDate(date) {
  const d = new Date(date);

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();

  return `${dd}.${mm}.${yyyy}`;
}

function filterScheduleByDoctor() {

  const doctorSelect = document.getElementById("createDoctorSelect");
  if (!doctorSelect) return;

  const selectedDoctorId = doctorSelect.value;

 currentSchedule = fullSchedule.filter(
  s => String(s.user_id) === String(selectedDoctorId)
);

  selectedSlots = [];
  renderSlots();
}
