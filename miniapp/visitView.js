// ===============================
// FULLSCREEN VISIT VIEW
// ===============================

let visitOverlay = null;

export async function openVisitView(appointmentId) {

  createOverlay();
  showLoader();

  try {

    const response = await fetch("/api/mis/appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointment_id: appointmentId
      })
    });

    const data = await response.json();

    if (!response.ok || data.error !== 0 || !data.data?.length) {
      renderError();
      return;
    }

    const visit = data.data[0];

    renderVisit(visit);

  } catch (err) {
    renderError();
  }
}

// ===============================

function createOverlay() {

  visitOverlay = document.createElement("div");
  visitOverlay.className = "visit-overlay";

  document.body.appendChild(visitOverlay);
}

// ===============================

function showLoader() {
  visitOverlay.innerHTML = `
    <div class="visit-loader">
      <div class="spinner"></div>
      <div>Загрузка визита...</div>
    </div>
  `;
}

// ===============================

function renderError() {
  visitOverlay.innerHTML = `
    <div class="visit-container">
      <div class="visit-error">
        Ошибка загрузки визита
      </div>
      <button class="primary-btn" id="closeVisitBtn">Закрыть</button>
    </div>
  `;

  attachClose();
}

// ===============================

function renderVisit(v) {

  const isCompleted = v.status === "completed";
  const canModify = v.status === "upcoming";

  visitOverlay.innerHTML = `
    <div class="visit-container">

      <div class="visit-header">
        <div class="visit-title">
          ${v.time_start} – ${v.time_end}
        </div>
        <div class="visit-status ${v.status}">
          ${getStatusText(v.status)}
        </div>
      </div>

      <div class="visit-section">

        <div class="visit-row">
          <span>Пациент</span>
          <span class="link" id="openPatient">${v.patient_name}</span>
        </div>

        <div class="visit-row">
          <span>Телефон</span>
          <span>${v.patient_phone || "-"}</span>
        </div>

        <div class="visit-row">
          <span>Врач</span>
          <span>${v.doctor}</span>
        </div>

        <div class="visit-row">
          <span>Кабинет</span>
          <span>${v.room || "-"}</span>
        </div>

        <div class="visit-row">
          <span>Создан</span>
          <span>${v.date_created}</span>
        </div>

      </div>

      ${renderMoveBlock(v)}

      ${renderServicesBlock(v)}

      <div class="visit-actions">
        ${canModify ? `
          <button class="primary-btn" id="moveVisitBtn">Перенести</button>
          <button class="danger-btn" id="cancelVisitBtn">Отменить</button>
        ` : ``}
        <button class="secondary-btn" id="closeVisitBtn">Закрыть</button>
      </div>

    </div>
  `;

  attachEvents(v);
}

// ===============================

function renderMoveBlock(v) {

  let html = "";

  if (v.moved_from) {
    html += `
      <div class="visit-section">
        <div class="visit-row">
          <span>Перенесён с</span>
          <span class="link" data-move-id="${v.moved_from}">
            ID ${v.moved_from}
          </span>
        </div>
      </div>
    `;
  }

  if (v.moved_to) {
    html += `
      <div class="visit-section">
        <div class="visit-row">
          <span>Перенесён на</span>
          <span class="link" data-move-id="${v.moved_to}">
            ID ${v.moved_to}
          </span>
        </div>
      </div>
    `;
  }

  return html;
}

// ===============================

function renderServicesBlock(v) {

  if (!v.services || !v.services.length) return "";

  return `
    <div class="visit-section">

      <div class="services-header" id="toggleServices">
        Услуги (${v.services.length})
      </div>

      <div class="services-list hidden" id="servicesList">
        ${v.services.map(s => `
          <div class="service-item">
            <div class="service-title">${s.title}</div>
            <div class="service-price">${s.value} ₽</div>
          </div>
        `).join("")}
      </div>

      <div class="visit-row total">
        <span>Итого</span>
        <span>${v.sum_value || 0} ₽</span>
      </div>

    </div>
  `;
}

// ===============================

function attachEvents(v) {

  document.getElementById("closeVisitBtn")
    .addEventListener("click", closeVisit);

  const toggle = document.getElementById("toggleServices");
  if (toggle) {
    toggle.addEventListener("click", () => {
      document.getElementById("servicesList")
        .classList.toggle("hidden");
    });
  }

  document.querySelectorAll("[data-move-id]").forEach(el => {
    el.addEventListener("click", () => {
      openVisitView(el.dataset.moveId);
    });
  });

  const patient = document.getElementById("openPatient");
  if (patient) {
    patient.addEventListener("click", () => {
      alert("Открыть карточку пациента позже");
    });
  }
}

// ===============================

function closeVisit() {
  visitOverlay.remove();
  visitOverlay = null;
}

// ===============================

function getStatusText(status) {
  if (status === "upcoming") return "Ожидается";
  if (status === "completed") return "Завершён";
  if (status === "refused") return "Отменён";
  return "";
}
