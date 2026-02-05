import { renderCalendar } from "./calendar.js";
import { openVisitView } from "./visitView.js";

export async function openCreateVisit() {

  
  if (document.getElementById("createOverlay")) return;

  // скрываем FAB
const fab = document.getElementById("fabCreate");
if (fab) fab.style.display = "none";

  let selectedDuration = 60;
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
      console.log("Дата создания:", date);
      // позже сюда подключим построение слотов
    },
    new Date()
  );
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
