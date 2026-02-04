import { renderCalendar } from "./calendar.js";

let createOverlay = null;
let selectedDuration = 60;
let selectedDate = new Date();
let hidePast = false;
let freeOnly = false;

export async function openCreateVisit(onClose = null) {

  if (createOverlay) return;

  createOverlay = document.createElement("div");
  createOverlay.className = "create-fullscreen";

  createOverlay.innerHTML = `
    <div class="create-container">

      <div class="create-header">
        <div class="create-title">Создание визита</div>
        <button class="close-btn" id="closeCreateBtn">✕</button>
      </div>

      <div class="visit-card doctor-card" id="doctorContainer">
        Загрузка врачей...
      </div>

      <div class="visit-card filter-card">

        <div class="filter-header">
          <span class="filter-title">Фильтры</span>
          <button id="editCreateFiltersBtn" class="link-btn">Изменить</button>
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
              <input type="checkbox" id="toggleFreeOnly">
              <span class="slider"></span>
            </label>
          </div>

        </div>

      </div>

      <div class="visit-card">
        <div id="createCalendar"></div>
      </div>

      <div id="createSlotsContainer"></div>

    </div>
  `;

  document.body.appendChild(createOverlay);

  document.getElementById("closeCreateBtn")
    .addEventListener("click", close);

  function close() {
    createOverlay.remove();
    createOverlay = null;
    if (onClose) onClose();
  }

  initFilterLogic();
  await loadDoctorsForCreate();

  renderCalendar(
    document.getElementById("createCalendar"),
    (date) => {
      selectedDate = new Date(date);
      refreshCreateSlots();
    },
    selectedDate
  );

  refreshCreateSlots();
}

//
// ===============================
// ФИЛЬТРЫ (такая же логика как на главном)
// ===============================
//

function initFilterLogic() {

  const panel = document.getElementById("createFilterPanel");
  const btn = document.getElementById("editCreateFiltersBtn");
  const summary = document.getElementById("createFilterSummary");

  btn.addEventListener("click", () => {
    panel.classList.toggle("collapsing");
    btn.innerText = panel.classList.contains("collapsing")
      ? "Изменить"
      : "Свернуть";
  });

  initCreateSlider((val) => {
    selectedDuration = val;
    updateSummary();
    refreshCreateSlots();
  });

  document.getElementById("toggleHidePast")
    .addEventListener("change", (e) => {
      hidePast = e.target.checked;
      updateSummary();
      refreshCreateSlots();
    });

  document.getElementById("toggleFreeOnly")
    .addEventListener("change", (e) => {
      freeOnly = e.target.checked;
      updateSummary();
      refreshCreateSlots();
    });

  function updateSummary() {
    let parts = [];
    parts.push(selectedDuration + " мин");
    if (hidePast) parts.push("без прошлых");
    if (freeOnly) parts.push("только свободные");
    summary.innerText = parts.join(" • ");
  }

  updateSummary();
}

function initCreateSlider(onChange) {

  const points = document.querySelectorAll("#createDurationSlider .step-point");
  const activeTrack = document.getElementById("createActiveTrack");

  const values = [15, 30, 60, 90, 120];

  points.forEach((point, index) => {

    point.addEventListener("click", () => {

      points.forEach(p => p.classList.remove("active"));
      point.classList.add("active");

      const value = Number(point.dataset.value);

      document.getElementById("createDurationValue")
        .innerText = value + " минут";

      const percent = (index / (values.length - 1)) * 100;
      activeTrack.style.width = percent + "%";

      if (onChange) onChange(value);
    });

  });

  const defaultIndex = values.indexOf(60);
  activeTrack.style.width =
    (defaultIndex / (values.length - 1)) * 100 + "%";
}


//
// ===============================
// ВРАЧИ
// ===============================
//

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

  let allowedDoctors = isDirector
    ? doctors
    : doctors.filter(d =>
        String(d.id) === String(currentDoctorId)
      );

  container.innerHTML = `
    <div class="doctor-select-modern">
      <select id="createDoctorSelect">
        ${allowedDoctors.map(d => `
          <option value="${d.id}">
            ${d.name}
          </option>
        `).join("")}
      </select>
    </div>
  `;

  document.getElementById("createDoctorSelect")
    .addEventListener("change", refreshCreateSlots);
}

//
// ===============================
// СЛОТЫ (пока заглушка)
// ===============================
//

function refreshCreateSlots() {

  const container = document.getElementById("createSlotsContainer");
  if (!container) return;

  container.innerHTML = `
    <div class="card empty-state">
      Здесь будут свободные слоты<br/>
      ${selectedDate.toLocaleDateString("ru-RU")}
    </div>
  `;
}
