// ===============================
// FULLSCREEN VISIT VIEW
// ===============================

export async function openVisitView(appointmentId) {

  const overlay = document.createElement("div");
  overlay.className = "visit-overlay";
  document.body.appendChild(overlay);

  showCenteredLoader(overlay, "Загрузка визита...");

  try {

    const response = await fetch("/api/mis/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointment_id: appointmentId
      })
    });

    const data = await response.json();

    if (!response.ok || data.error !== 0 || !data.data?.length) {
      showCenteredError(overlay, "Не удалось загрузить визит");
      return;
    }

    const visit = data.data[0];

    renderVisit(overlay, visit);

  } catch (err) {
    showCenteredError(overlay, "Ошибка сервера");
  }
}


// ===============================
// RENDER VISIT
// ===============================

function renderVisit(overlay, visit) {

  overlay.innerHTML = `
    <div class="visit-fullscreen">

      <div class="visit-header">
        <div class="visit-title">
          ${visit.time_start} – ${visit.time_end}
        </div>
        <div class="visit-close">✕</div>
      </div>

      <div class="visit-body">

        <div class="visit-card">
          <div class="visit-row">
            <span class="label">Пациент:</span>
            <span class="value clickable" data-patient="${visit.patient_id}">
              ${visit.patient_name}
            </span>
          </div>

          <div class="visit-row">
            <span class="label">Телефон:</span>
            <span class="value">${visit.patient_phone || "—"}</span>
          </div>

          <div class="visit-row">
            <span class="label">Кабинет:</span>
            <span class="value">${visit.room || "—"}</span>
          </div>

          <div class="visit-row">
            <span class="label">Врач:</span>
            <span class="value">${visit.doctor}</span>
          </div>

          <div class="visit-row">
            <span class="label">Статус:</span>
            <span class="value">${getStatusText(visit.status)}</span>
          </div>

        </div>

        ${renderMoveInfo(visit)}

        ${renderServices(visit)}

      </div>

      <div class="visit-actions">
        ${renderButtons(visit)}
      </div>

    </div>
  `;

  overlay.querySelector(".visit-close")
    .addEventListener("click", () => overlay.remove());

  attachPatientClick(overlay);
}


// ===============================
// MOVE INFO
// ===============================

function renderMoveInfo(visit) {

  let html = "";

  if (visit.moved_from) {
    html += `
      <div class="visit-card move-info">
        Перенесён с визита ID ${visit.moved_from}
      </div>
    `;
  }

  if (visit.moved_to) {
    html += `
      <div class="visit-card move-info">
        Перенесён в визит ID ${visit.moved_to}
      </div>
    `;
  }

  return html;
}


// ===============================
// SERVICES
// ===============================

function renderServices(visit) {

  if (!visit.services || !visit.services.length) return "";

  let html = `
    <div class="visit-card services-card">
      <div class="services-title">Услуги</div>
  `;

  visit.services.forEach(service => {
    html += `
      <div class="service-row">
        <div class="service-name">${service.title}</div>
        <div class="service-price">${service.value} ₽</div>
      </div>
    `;
  });

  html += `
      <div class="services-total">
        Итого: ${visit.sum_value || 0} ₽
      </div>
    </div>
  `;

  return html;
}


// ===============================
// BUTTONS
// ===============================

function renderButtons(visit) {

  const isFinished = visit.status === "completed" || visit.status === "refused";

  if (isFinished) {
    return `
      <button class="primary-btn close-btn">Закрыть</button>
    `;
  }

  return `
    <button class="secondary-btn move-btn">Перенести</button>
    <button class="danger-btn cancel-btn">Отменить</button>
    <button class="primary-btn close-btn">Закрыть</button>
  `;
}


// ===============================
// HELPERS
// ===============================

function showCenteredLoader(container, text) {
  container.innerHTML = `
    <div class="visit-fullscreen visit-loading">
      <div class="visit-loader">
        <div class="visit-spinner"></div>
        <div class="visit-loading-text">${text}</div>
      </div>
    </div>
  `;
}

function showCenteredError(container, text) {
  container.innerHTML = `
    <div class="visit-fullscreen visit-loading">
      <div class="visit-loader">
        <div class="visit-error-icon">⚠</div>
        <div class="visit-loading-text">${text}</div>
        <button class="primary-btn close-btn">Закрыть</button>
      </div>
    </div>
  `;

  container.querySelector(".close-btn")
    .addEventListener("click", () => container.remove());
}

function attachPatientClick(overlay) {
  overlay.querySelectorAll(".clickable").forEach(el => {
    el.addEventListener("click", () => {
      const patientId = el.dataset.patient;
      alert("Открыть карточку пациента ID: " + patientId);
    });
  });
}

function getStatusText(status) {
  if (status === "upcoming") return "Ожидается";
  if (status === "completed") return "Завершён";
  if (status === "refused") return "Отменён";
  return "";
}
