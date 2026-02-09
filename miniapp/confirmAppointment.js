let selectedServices = [];

export function openConfirmAppointment(patient, slot, options = {}) {
  const previousOverlay = options.previousOverlay || null;
 const isMove = options.mode === "move";
  const oldVisit = options.oldVisit || null;
  const defaultServices = options.defaultServices || [];

  
selectedServices = [];

let doctorChanged = false;

if (isMove && oldVisit) {

  const oldDoctorId = oldVisit.doctor_id || oldVisit.user_id;
  const newDoctorId = slot.user_id;

  doctorChanged = String(oldDoctorId) !== String(newDoctorId);
//  const doctorChanged = String(oldDoctorId) !== String(newDoctorId);

  if (!doctorChanged && defaultServices.length) {
    // Врач тот же — переносим услуги
    selectedServices = defaultServices.map(s => ({
      id: s.service_id || s.id,
      name: s.title || s.name,
      price: s.value || s.price
    }));
  } else {
    // Врач изменён — очищаем услуги
    selectedServices = [];
  }
}

  
  if (!slot) {
    console.error("Slot не передан");
    return;
  }

  const overlay = document.createElement("div");
  overlay.className = "create-fullscreen";

  overlay.innerHTML = `
    <div class="create-container">

      <div class="create-header">
        <div class="create-title">
  ${isMove ? "Подтвердить перенос" : "Подтверждение записи"}
</div>
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
    ${isMove ? `
  <div class="visit-title-center" style="margin-top:24px;">
    Старый приём
  </div>

  <div class="visit-card">
    <div class="visit-row right">
      <span>Дата:</span>
      <span>${formatDate(oldVisit.time_start)}</span>
    </div>

    <div class="visit-row right">
      <span>Время:</span>
      <span>${formatTimeRange(oldVisit.time_start, oldVisit.time_end)}</span>
    </div>

    <div class="visit-row right">
      <span>Врач:</span>
      <span>${oldVisit.doctor || oldVisit.doctor_name || "—"}</span>
    </div>

    <div class="visit-row right">
      <span>Кабинет:</span>
      <span>${oldVisit.room || "—"}</span>
    </div>
  </div>

  ${renderOldServices(oldVisit)}

  <div class="visit-title-center" style="margin-top:24px;">
    Новый приём
  </div>
` : `
  <div class="visit-title-center" style="margin-top:24px;">
    Запись
  </div>
`}


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

${isMove && doctorChanged ? `
  <div class="visit-warning" style="
      background:#fff3cd;
      padding:10px;
      border-radius:8px;
      margin-bottom:12px;
      font-size:14px;
  ">
    Услуги были очищены, так как выбран другой врач
  </div>
` : ""}

      
      <div class="visit-card" style="margin-top:20px; text-align:center;">
        <button class="secondary-btn" id="addServiceBtn">
          Добавить услугу
        </button>
      </div>
      <div id="selectedServicesBlock" style="margin-top:16px;"></div>

      <!-- КНОПКА ПОДТВЕРЖДЕНИЯ -->
      <div class="visit-actions" style="margin-top:30px;">
       <button class="primary-btn" id="confirmCreateBtn">
  ${isMove ? "Перенести" : "Подтвердить запись"}
</button>

${isMove ? `
  <button class="secondary-btn" id="cancelMoveBtn">
    Отмена
  </button>
` : ""}

      </div>

    </div>
  `;

  document.body.appendChild(overlay);

// 🔥 если перенос — сразу показать услуги
if (isMove && selectedServices.length) {
  renderSelectedServices();
  updateTotalPrice();
}
  
if (isMove) {
  const cancelBtn = document.getElementById("cancelMoveBtn");

  if (cancelBtn) {
cancelBtn.addEventListener("click", () => {

  selectedServices = [];
  overlay.remove();



  const fab = document.getElementById("fabCreate");
  if (fab) fab.style.display = "flex";
});

  }
}



  
document.getElementById("closeConfirm")
  .addEventListener("click", () => {

    selectedServices = [];
    overlay.remove();

    if (previousOverlay) {
      previousOverlay.classList.remove("hidden");
    }

    const fab = document.getElementById("fabCreate");
    if (fab) fab.style.display = "flex";
  });


document.getElementById("addServiceBtn")
  .addEventListener("click", () => {
    openSelectServices(slot.user_id);
  });

document.getElementById("confirmCreateBtn")
  .addEventListener("click", createAppointmentRequest);


  async function createAppointmentRequest() {

showCreateLoader(overlay);
  try {

    const response = await fetch("/api/mis/create-appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient_id: patient.isNew ? null : patient.patient_id,
        first_name: patient.isNew ? patient.first_name : null,
        last_name: patient.isNew ? patient.last_name : null,
        third_name: patient.isNew ? patient.third_name : null,
        birth_date: patient.isNew && patient.birth_date
          ? patient.birth_date.replaceAll("-", ".")
          : null,
        mobile: patient.isNew ? patient.mobile : null,
        gender: patient.isNew
          ? (patient.gender === "М" ? 1 : 2)
          : null,
        email: patient.isNew ? patient.email : null,
        doctor_id: slot.user_id,
        time_start: slot.time_start,
        time_end: slot.time_end,
        room: slot.room,
        services: selectedServices.map(s => s.id)
      })
    });

    const data = await response.json();

    if (!response.ok || data.error !== 0) {

showCreateError(
  overlay,
  data?.data?.desc || "Ошибка создания визита",
   retryCreate,
  previousOverlay
);
      return;
    }

    showSuccessCheckmark(overlay);

    setTimeout(() => {
      overlay.remove();
      if (window.reloadSchedule) {
        window.reloadSchedule(slot.time_start.split(" ")[0]);
      }
    }, 2000);

  } catch (err) {

  showCreateError(
      overlay,
      "Ошибка соединения",
      retryCreate,
      previousOverlay
);
  }
}
function retryCreate() {
  overlay.remove();

  openConfirmAppointment(patient, slot, {
    previousOverlay,
    mode: isMove ? "move" : undefined,
    oldVisit,
    defaultServices
  });
}

}


// =============================
// HELPERS
// =============================

function showCreateError(overlay, message, retryCallback, previousOverlay) {

  overlay.innerHTML = `
    <div class="visit-loading">
      <div style="font-size:40px;color:#d9534f;">✖</div>
      <div class="visit-loading-text" style="color:#d9534f;">
        ${message}
      </div>

      <div style="margin-top:20px;">
        <button class="primary-btn" id="retryCreateBtn">
          Попробовать снова
        </button>
      </div>

      <div style="margin-top:10px;">
        <button class="secondary-btn" id="closeCreateBtn">
          Назад
        </button>
      </div>
    </div>
  `;

  const retryBtn = document.getElementById("retryCreateBtn");
  const closeBtn = document.getElementById("closeCreateBtn");

  if (retryBtn && retryCallback) {
    retryBtn.addEventListener("click", () => {
  retryCallback();
});
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      overlay.remove();

      // 🔥 ВОССТАНАВЛИВАЕМ ПРЕДЫДУЩИЙ OVERLAY
    if (previousOverlay && document.body.contains(previousOverlay)) {
  previousOverlay.classList.remove("hidden");
}}

      const fab = document.getElementById("fabCreate");
      if (fab) fab.style.display = "flex";
    });
  }
}





function showSuccessCheckmark(overlay) {

  overlay.innerHTML = `
    <div class="visit-loading">
      <div style="font-size:60px;color:#00a4c7;">✔</div>
      <div class="visit-loading-text">
        Визит успешно создан
      </div>
    </div>
  `;
}


function showCreateLoader(overlay) {

  overlay.innerHTML = `
    <div class="visit-loading">
      <div class="visit-spinner"></div>
      <div class="visit-loading-text">
        Создание визита...
      </div>
    </div>
  `;
}


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

  let date;

  // Если формат MIS: 10.02.2026 14:30
  if (str.includes(".")) {

    const [datePart] = str.split(" ");
    const [dd, mm, yyyy] = datePart.split(".");

    date = new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd)
    );

  } else {
    // если ISO
    date = new Date(str);
  }

  if (isNaN(date)) return "—";

  const formatted = date.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  });

  // Делаем первую букву заглавной
  const capitalized =
    formatted.charAt(0).toUpperCase() +
    formatted.slice(1);

  return capitalized + " г";
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

// если перенос — сразу отрисовываем услуги



  
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
  if (!container) return;

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
    <div><span>${s.title || s.name || "Услуга"}</span></div>
    <div><span>${s.value || s.price || 0} ₽</span></div>
  </div>
`).join("");


container.querySelectorAll(".service-item-select")
  .forEach(el => {

    el.addEventListener("click", () => {

      const id = el.dataset.id;

      const service = services.find(
  s => String(s.service_id || s.id) === String(id)
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
        if (!service) return;
       selectedServices.push({
  id: service.service_id || service.id,
  name: service.title || service.name,
  price: service.value || service.price || 0
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
function renderOldServices(visit) {

  if (!visit.services || !visit.services.length) return "";

  return `
    <div class="visit-card" style="margin-top:12px;">
      <div style="font-weight:600;margin-bottom:8px;">
        Услуги старого приёма
      </div>

      ${visit.services.map(s => `
        <div class="visit-row right">
          <span>${s.title || s.name || "Услуга"}</span>
          <span>${s.value || s.price || 0} ₽</span>
        </div>
      `).join("")}
    </div>
  `;
}
