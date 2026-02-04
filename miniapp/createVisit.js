import { renderCalendar } from "./calendar.js";

export async function openCreateVisit() {

  const overlay = document.createElement("div");
  overlay.className = "visit-overlay";

  overlay.innerHTML = `
    <div class="visit-container">

      <div class="visit-title-center">
        Создание визита
      </div>

      <div class="visit-card" id="doctorContainer">
        Загрузка врачей...
      </div>

      <div class="visit-card">
        <div class="toggle-line">
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

  document.body.appendChild(overlay);

  document.getElementById("closeCreateBtn")
    .addEventListener("click", () => overlay.remove());

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
 
