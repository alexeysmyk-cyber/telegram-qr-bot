import { selectedSlots } from "./createVisit.js"; // откуда у тебя хранятся слоты

export function openConfirmAppointment(patient) {

  const slot = selectedSlots[0]; // пока 1 слот

  const overlay = document.createElement("div");
  overlay.className = "create-fullscreen";

  overlay.innerHTML = `
    <div class="create-container">

      <div class="create-header">
        <div class="create-title">Подтверждение записи</div>
        <div class="create-close" id="closeConfirm">✕</div>
      </div>

      <!-- ПАЦИЕНТ -->
      <div class="visit-card main-card">

        <div class="patient-name-centered">
          ${formatFio(patient)}
        </div>

        <div class="visit-row right">
          <span>Пол:</span>
          <span>${patient.gender || "—"}</span>
        </div>

        <div class="visit-row right">
          <span>Дата рождения:</span>
          <span>${patient.birth_date || "—"}</span>
        </div>

        <div class="visit-row right">
          <span>Телефон:</span>
          <span>${patient.mobile || "—"}</span>
        </div>

        <div class="visit-row right">
          <span>Email:</span>
          <span>${patient.email || "—"}</span>
        </div>

      </div>

      <!-- ЗАПИСЬ -->
      <div class="visit-title-center" style="margin-top:24px;">
        Запись
      </div>

      <div class="visit-card">

        <div class="visit-row right">
          <span>Дата:</span>
          <span>${formatDate(slot.time_start)}</span>
        </div>

        <div class="visit-row right">
          <span>Время:</span>
          <span>${getTime(slot.time_start)} – ${getTime(slot.time_end)}</span>
        </div>

        <div class="visit-row right">
          <span>Врач:</span>
          <span>${slot.doctor}</span>
        </div>

        <div class="visit-row right">
          <span>Кабинет:</span>
          <span>${slot.room || "—"}</span>
        </div>

      </div>

      <!-- УСЛУГИ -->
      <div class="visit-card" style="margin-top:20px; text-align:center;">
        <button class="secondary-btn" id="addServiceBtn">
          Добавить услугу
        </button>
      </div>

      <!-- КНОПКА ПОДТВЕРЖДЕНИЯ -->
      <div class="visit-actions" style="margin-top:30px;">
        <button class="primary-btn" id="confirmCreateBtn">
          Подтвердить запись
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById("closeConfirm")
    .addEventListener("click", () => overlay.remove());

  document.getElementById("addServiceBtn")
    .addEventListener("click", () => {
      console.log("Открыть выбор услуг");
    });

  document.getElementById("confirmCreateBtn")
    .addEventListener("click", () => {
      console.log("Создать запись", {
        patient_id: patient.patient_id,
        slot
      });
    });

}


// =============================
// HELPERS
// =============================

function formatFio(p) {
  return [p.last_name, p.first_name, p.third_name]
    .filter(Boolean)
    .join(" ") || "Без имени";
}

function getTime(str) {
  return str.split(" ")[1];
}

function formatDate(str) {
  const [d, m, y] = str.split(" ")[0].split(".");
  const date = new Date(y, m - 1, d);

  return date.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}
