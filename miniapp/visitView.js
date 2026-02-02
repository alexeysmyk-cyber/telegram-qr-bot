// ===============================
// FULLSCREEN VISIT VIEW
// ===============================

export function openVisitView(appointmentId) {

  const overlay = document.createElement("div");
  overlay.className = "visit-overlay";
  overlay.innerHTML = `
    <div class="visit-loading">
      <div class="spinner"></div>
      <div>Загрузка визита...</div>
    </div>
  `;

  document.body.appendChild(overlay);

  loadVisit(appointmentId, overlay);
}



// ===============================
// LOAD VISIT
// ===============================

async function loadVisit(id, overlay) {

  try {

    const response = await fetch("/api/mis/appointment-by-id", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointment_id: id })
    });

    const data = await response.json();

    if (!response.ok || data.error !== 0) {
      throw new Error("LOAD_ERROR");
    }

    const visit = data.data[0];

    if (!visit) {
      throw new Error("NOT_FOUND");
    }

    renderVisit(visit, overlay);

  } catch (err) {

    overlay.innerHTML = `
      <div class="visit-loading">
        <div class="spinner"></div>
        <div>Ошибка загрузки визита</div>
        <button class="primary-btn" id="closeVisitBtn">Закрыть</button>
      </div>
    `;

    document.getElementById("closeVisitBtn")
      .addEventListener("click", () => overlay.remove());
  }
}



// ===============================
// RENDER VISIT
// ===============================

function renderVisit(visit, overlay) {

  const isCompleted = visit.status === "completed";

  overlay.innerHTML = `
    <div class="visit-container">

      <div class="visit-header">
        <div class="visit-title">Визит</div>
        <button class="close-btn" id="closeVisitBtn">✕</button>
      </div>

      <div class="visit-content">

        ${renderMainInfo(visit)}
        ${renderPatientInfo(visit)}
        ${renderMoveInfo(visit)}
        ${renderServices(visit)}

      </div>

      <div class="visit-actions">
        ${!isCompleted ? `
          <button class="primary-btn" id="moveVisitBtn">Перенести</button>
          <button class="danger-btn" id="cancelVisitBtn">Отменить</button>
        ` : ``}
        <button class="secondary-btn" id="closeBottomBtn">Закрыть</button>
      </div>

    </div>
  `;

  document.getElementById("closeVisitBtn")
    .addEventListener("click", () => overlay.remove());

  document.getElementById("closeBottomBtn")
    .addEventListener("click", () => overlay.remove());

  attachServicesToggle(overlay);
}



// ===============================
// MAIN INFO
// ===============================

function renderMainInfo(v) {
  return `
    <div class="visit-card">

      <div class="visit-time">
        ${v.time_start} – ${v.time_end}
      </div>

      <div class="visit-status ${v.status}">
        ${getStatusText(v.status)}
      </div>

      <div class="visit-row">
        <span>Клиника:</span>
        <span>${v.clinic}</span>
      </div>

      <div class="visit-row">
        <span>Кабинет:</span>
        <span>${v.room || "—"}</span>
      </div>

      <div class="visit-row">
        <span>Врач:</span>
        <span>${v.doctor}</span>
      </div>

    </div>
  `;
}



// ===============================
// PATIENT INFO
// ===============================

function renderPatientInfo(v) {

  return `
    <div class="visit-card">

      <div class="card-title">Пациент</div>

      <div class="patient-name clickable"
           data-id="${v.patient_id}">
        ${v.patient_name}
      </div>

      <div class="visit-row">
        <span>Дата рождения:</span>
        <span>${v.patient_birth_date || "—"}</span>
      </div>

      <div class="visit-row">
        <span>Телефон:</span>
        <span>${v.patient_phone || "—"}</span>
      </div>

      <div class="visit-row">
        <span>Email:</span>
        <span>${v.patient_email || "—"}</span>
      </div>

    </div>
  `;
}



// ===============================
// MOVE INFO
// ===============================

function renderMoveInfo(v) {

  if (!v.moved_from && !v.moved_to) return "";

  return `
    <div class="visit-card">

      <div class="card-title">История переноса</div>

      ${v.moved_from ? `
        <div class="visit-row">
          <span>Перенесён из:</span>
          <span class="link" data-visit="${v.moved_from}">
            Визит #${v.moved_from}
          </span>
        </div>
      ` : ""}

      ${v.moved_to ? `
        <div class="visit-row">
          <span>Перенесён в:</span>
          <span class="link" data-visit="${v.moved_to}">
            Визит #${v.moved_to}
          </span>
        </div>
      ` : ""}

    </div>
  `;
}



// ===============================
// SERVICES
// ===============================

function renderServices(v) {

  if (!v.services || !v.services.length) return "";

  let html = `
    <div class="visit-card services-card">

      <div class="services-header">
        <span>Услуги (${v.services.length})</span>
        <span class="services-arrow">▾</span>
      </div>

      <div class="services-content">
  `;

  v.services.forEach(service => {
    html += `
      <div class="service-row">
        <div class="service-name">${service.title}</div>
        <div class="service-price">${service.value} ₽</div>
      </div>
    `;
  });

  html += `
        <div class="services-total">
          Итого: ${v.sum_value || 0} ₽
        </div>
      </div>
    </div>
  `;

  return html;
}



function attachServicesToggle(overlay) {

  const header = overlay.querySelector(".services-header");
  const content = overlay.querySelector(".services-content");
  const arrow = overlay.querySelector(".services-arrow");

  if (!header || !content) return;

  header.addEventListener("click", () => {
    content.classList.toggle("open");
    arrow.classList.toggle("rotated");
  });
}



// ===============================
// STATUS TEXT
// ===============================

function getStatusText(status) {
  if (status === "upcoming") return "Визит ожидается";
  if (status === "refused") return "Визит отменён";
  if (status === "completed") return "Визит завершён";
  return "";
}
