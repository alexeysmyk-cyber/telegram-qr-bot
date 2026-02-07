let selectedServices = [];

export function openConfirmAppointment(patient, slot) {
selectedServices = []; // 🔥 сброс при каждом открытии
  if (!slot) {
    console.error("Slot не передан");
    return;
  }

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
          <span>${formatTimeRange(slot.time_start, slot.time_end)}</span>
        </div>

        <div class="visit-row right">
  <span>Врач:</span>
  <span>${slot.doctor_name || "Не указан"}</span>
</div>

<div class="visit-row right">
  <span>Кабинет:</span>
  <span>${slot.room || "Не указан"}</span>
</div>
<div class="visit-row right" id="totalPriceRow" style="display:none;">
  <span>Стоимость визита:</span>
  <span id="totalPriceValue">—</span>
</div>
      </div>

      <!-- УСЛУГИ -->
      <div class="visit-card" style="margin-top:20px; text-align:center;">
        <button class="secondary-btn" id="addServiceBtn">
          Добавить услугу
        </button>
      </div>
      <div id="selectedServicesBlock" style="margin-top:16px;"></div>

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
  .addEventListener("click", () => {
    selectedServices = [];  // 🔥 очистка
    overlay.remove();
  });

document.getElementById("addServiceBtn")
  .addEventListener("click", () => {
    openSelectServices(slot.user_id);
  });

document.getElementById("confirmCreateBtn")
  .addEventListener("click", () => {

    const servicesIds = selectedServices.map(s => s.id);

console.log("Создать запись", {

  patient_id: patient.isNew ? null : patient.patient_id,

  new_patient: patient.isNew ? {
    last_name: patient.last_name,
    first_name: patient.first_name,
    third_name: patient.third_name,
    birth_date: patient.birth_date,
    mobile: patient.mobile
  } : null,

  doctor_id: slot.user_id,
  time_start: slot.time_start,
  time_end: slot.time_end,
  services: servicesIds
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

  if (!str) return "—";

  // Приводим к ISO формату
  const date = new Date(str.replace(" ", "T"));

  if (isNaN(date)) return "—";

  const formatted = date.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  // Первая буква заглавная
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}



function formatTimeRange(start, end) {
  return `${extractTime(start)} – ${extractTime(end)}`;
}

function extractTime(str) {
  if (!str) return "--:--";

  if (str.includes(".")) {
    return str.split(" ")[1];
  }

  const d = new Date(str);
  return d.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit"
  });
}
async function openSelectServices(doctorId) {

  const overlay = document.createElement("div");
  overlay.className = "services-overlay";

  overlay.innerHTML = `
    <div class="services-sheet">

      <div class="services-header">
        <div class="services-title">Выбор услуг</div>
        <div class="services-close" id="closeServices">✕</div>
      </div>

      <div id="servicesList" class="services-list">
        <div class="loader">
          <div class="spinner"></div>
        </div>
      </div>

      <div class="services-bottom">
        <button class="primary-btn" id="confirmServicesBtn">
          Добавить
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById("closeServices")
    .addEventListener("click", () => overlay.remove());

  await loadServices(doctorId);

  document.getElementById("confirmServicesBtn")
    .addEventListener("click", () => {
      renderSelectedServices();
      overlay.remove();
    });
}
async function loadServices(doctorId) {

  const container = document.getElementById("servicesList");

  try {

    const response = await fetch("/api/mis/get-services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: doctorId })
    });

    const data = await response.json();

    if (!response.ok || data.error !== 0) {
      container.innerHTML = "Ошибка загрузки услуг";
      return;
    }

    const services = data.data || [];

container.innerHTML = services.map(s => `
  <div class="service-item-select" 
       data-id="${s.service_id}">
    <div>${s.title}</div>
    <div>${s.price} ₽</div>
  </div>
`).join("");


container.querySelectorAll(".service-item-select")
  .forEach(el => {

    el.addEventListener("click", () => {

      const id = el.dataset.id;

      const service = services.find(
        s => String(s.service_id) === String(id)
      );

      const existing = selectedServices.find(
        s => String(s.id) === String(id)
      );

      if (existing) {
        selectedServices = selectedServices.filter(
          s => String(s.id) !== String(id)
        );
        el.classList.remove("selected");
      } else {
        selectedServices.push({
          id: service.service_id,
          name: service.title,
          price: service.price
        });
        el.classList.add("selected");
      }
updateTotalPrice();
    });

  });


  } catch (err) {
  console.error("loadServices error:", err);
  container.innerHTML = "Ошибка соединения";
}
// подсветка уже выбранных
selectedServices.forEach(s => {
  const el = container.querySelector(`[data-id="${s.id}"]`);
  if (el) el.classList.add("selected");
});




}
function renderSelectedServices() {

  const container = document.getElementById("selectedServicesBlock");

  if (!selectedServices.length) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = selectedServices.map(s => `
    <div class="selected-service" data-id="${s.id}">
      ${s.name} — ${s.price} ₽
    </div>
  `).join("");

  container.querySelectorAll(".selected-service")
    .forEach(el => {

      el.addEventListener("click", () => {

        const id = el.dataset.id;
        selectedServices = selectedServices.filter(x => x.id != id);
        renderSelectedServices();
        updateTotalPrice();


      });

    });
  updateTotalPrice();   // ← И В САМЫЙ КОНЕЦ ФУНКЦИИ
}

function updateTotalPrice() {

  const row = document.getElementById("totalPriceRow");
  const value = document.getElementById("totalPriceValue");

  if (!row || !value) return;

  if (!selectedServices.length) {
    row.style.display = "none";
    return;
  }

  const total = selectedServices.reduce((sum, s) => {
    return sum + Number(s.price || 0);
  }, 0);

  value.innerText = total + " ₽";
  row.style.display = "flex";
}
