import { renderCalendar } from "./calendar.js";

let createOverlay = null;

export async function openCreateVisit(onClose = null) {

  // защита от повторного открытия
  if (createOverlay) return;

  createOverlay = document.createElement("div");
  createOverlay.className = "create-overlay";

  createOverlay.innerHTML = `
    <div class="create-sheet">

      <div class="visit-title-center">
        Создание визита
      </div>

      <div class="visit-card" id="doctorContainer">
        Загрузка врачей...
      </div>

      <div class="visit-card">

        <div class="toggle-line">
          <span>Не показывать прошлые</span>
          <label class="switch">
            <input type="checkbox" id="toggleHidePast">
            <span class="slider"></span>
          </label>
        </div>

        <div class="toggle-line" style="margin-top:12px;">
          <span>Не показывать занятые</span>
          <label class="switch">
            <input type="checkbox" id="toggleFreeOnly">
            <span class="slider"></span>
          </label>
        </div>

      </div>

      <div class="visit-card">
        <div id="createCalendar"></div>
      </div>

      <div id="createSlotsContainer"></div>

      <div class="visit-actions">
        <button class="secondary-btn" id="closeCreateBtn">
          Закрыть
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(createOverlay);

  const sheet = createOverlay.querySelector(".create-sheet");

  // Закрытие по клику вне sheet
  createOverlay.addEventListener("click", (e) => {
    if (e.target === createOverlay) close();
  });

  document.getElementById("closeCreateBtn")
    .addEventListener("click", close);

  function close() {

    sheet.classList.add("closing");

    setTimeout(() => {
      if (createOverlay) {
        createOverlay.remove();
        createOverlay = null;
      }
      if (onClose) onClose();
    }, 250);
  }

  await loadDoctorsForCreate();

  renderCalendar(
    document.getElementById("createCalendar"),
    (date) => {
      console.log("Selected date for create:", date);
      // позже подключим слоты
    },
    new Date()
  );
}


// =======================================
// Загрузка врачей
// =======================================

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

  if (!allowedDoctors.length) {
    container.innerHTML = "Нет доступных врачей";
    return;
  }

  container.innerHTML = `
    <select id="createDoctorSelect">
      ${allowedDoctors.map(d => `
        <option value="${d.id}">
          ${d.name}
        </option>
      `).join("")}
    </select>
  `;
}

