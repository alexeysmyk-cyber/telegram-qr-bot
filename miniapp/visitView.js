// ======================================================
// ОТКРЫТИЕ КАРТОЧКИ ВИЗИТА
// ======================================================

export async function openVisitView(appointmentId) {

  const overlay = document.createElement("div");
  overlay.className = "visit-overlay";

  overlay.innerHTML = `
    <div class="visit-loader">
      <div class="spinner"></div>
      <div>Загрузка визита...</div>
    </div>
  `;

  document.body.appendChild(overlay);

  try {

    const response = await fetch("/api/mis/appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointment_id: appointmentId })
    });

    const data = await response.json();

    if (!response.ok || data.error !== 0) {
      throw new Error("LOAD_ERROR");
    }

    const visit = data.data[0];

    await renderVisit(visit, overlay);

  } catch (err) {

    overlay.innerHTML = `
      <div class="visit-loader">
        <div>Ошибка загрузки визита</div>
        <button class="secondary-btn" id="closeErrorBtn">Закрыть</button>
      </div>
    `;

    document.getElementById("closeErrorBtn")
      .addEventListener("click", () => overlay.remove());
  }
}


// ======================================================
// РЕНДЕР КАРТОЧКИ
// ======================================================

async function renderVisit(visit, overlay) {

  const isCompleted = visit.status === "completed";
  const statusText = getVisitStatus(visit);

  overlay.innerHTML = `
    <div class="visit-container">

      <div class="visit-header">
        <div class="visit-title">Карточка визита</div>
        <button class="close-btn" id="closeVisitBtn">✕</button>
      </div>

      <div class="visit-content">

        <div class="visit-card">

          <div class="visit-status-badge ${visit.status}">
            ${statusText}
          </div>

          <div class="visit-date">
            ${formatFullDate(visit.time_start)}
          </div>

          <div class="visit-time">
            ${formatTimeRange(visit.time_start, visit.time_end)}
          </div>

          <div class="visit-type">
            ${getVisitType(visit)}
          </div>

          <div class="visit-row right">
            <span>Клиника:</span>
            <span>${visit.clinic}</span>
          </div>

          <div class="visit-row right">
            <span>Кабинет:</span>
            <span>${visit.room || "—"}</span>
          </div>

          <div class="visit-row right">
            <span>Врач:</span>
            <span>${visit.doctor}</span>
          </div>

        </div>

        ${renderPatientInfo(visit)}
        ${await renderMoveBlocks(visit)}
        ${renderServices(visit)}

      </div>

      <div class="visit-actions">
        ${!isCompleted ? `
          <button class="primary-btn">Перенести</button>
          <button class="danger-btn">Отменить</button>
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
  attachMoveToggle(overlay);
}


// ======================================================
// СТАТУС
// ======================================================

function getVisitStatus(v) {

  if (v.moved_to) return "Перенесён";
  if (v.status === "completed") return "Завершён";
  if (v.status === "refused") return "Отменён";
  if (v.status === "upcoming") return "Ожидается";

  return "";
}


// ======================================================
// ТИП ВИЗИТА
// ======================================================

function getVisitType(v) {

  if (v.is_first_doctor && v.is_first_clinic) {
    return "Первичный визит в клинику";
  }

  if (v.is_first_doctor && !v.is_first_clinic) {
    return "Первичный визит к врачу";
  }

  return "Повторный визит";
}


// ======================================================
// ФОРМАТ ДАТЫ
// ======================================================

function formatFullDate(dateString) {

  const [datePart] = dateString.split(" ");
  const [dd, mm, yyyy] = datePart.split(".");

  const date = new Date(yyyy, mm - 1, dd);

  return date.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}


// ======================================================
// ФОРМАТ ВРЕМЕНИ
// ======================================================

function formatTimeRange(start, end) {

  const timeStart = start.split(" ")[1];
  const timeEnd = end.split(" ")[1];

  return `с ${timeStart} до ${timeEnd}`;
}


// ======================================================
// ПАЦИЕНТ
// ======================================================

function renderPatientInfo(v) {

  return `
    <div class="visit-card">

      <div class="visit-section-title">Пациент</div>

      <div class="visit-row">
        <span>ФИО:</span>
        <span class="patient-link">${v.patient_name}</span>
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


// ======================================================
// УСЛУГИ
// ======================================================

function renderServices(v) {

  if (!v.services || !v.services.length) return "";

  let html = `
    <div class="visit-card">
      <div class="services-header">
        Услуги (${v.services.length})
        <span class="services-arrow">▾</span>
      </div>
      <div class="services-content">
  `;

  v.services.forEach(s => {

    html += `
      <div class="service-item">
        <div class="service-title">${s.title}</div>
        <div class="service-meta">
          ${s.count} × ${s.price} ₽ = ${s.value} ₽
        </div>
      </div>
    `;
  });

  html += `
        <div class="service-total">
          Итого: ${v.sum_value} ₽
        </div>
      </div>
    </div>
  `;

  return html;
}


function attachServicesToggle(overlay) {

  overlay.querySelectorAll(".services-header").forEach(header => {

    header.addEventListener("click", () => {

      const content = header.nextElementSibling;
      const arrow = header.querySelector(".services-arrow");

      content.classList.toggle("open");
      arrow.classList.toggle("rotated");

    });

  });
}


// ======================================================
// ПЕРЕНОСЫ
// ======================================================

async function renderMoveBlocks(v) {

  let html = "";

  if (v.moved_from) {
    html += await buildMoveBlock(v.moved_from, "Перенесён из");
  }

  if (v.moved_to) {
    html += await buildMoveBlock(v.moved_to, "Перенесён в");
  }

  return html;
}


async function buildMoveBlock(id, title) {

  try {

    const response = await fetch("/api/mis/appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointment_id: id })
    });

    const data = await response.json();

    if (!response.ok || data.error !== 0) return "";

    const v = data.data[0];

    return `
      <div class="visit-card move-card">
        <div class="move-header">
          ${title}
          <span class="services-arrow">▾</span>
        </div>
        <div class="move-content">
          <div>${formatFullDate(v.time_start)}</div>
          <div>${formatTimeRange(v.time_start, v.time_end)}</div>
          <div>${v.doctor}</div>
        </div>
      </div>
    `;

  } catch {
    return "";
  }
}


function attachMoveToggle(overlay) {

  overlay.querySelectorAll(".move-header").forEach(header => {

    header.addEventListener("click", () => {

      const content = header.nextElementSibling;
      const arrow = header.querySelector(".services-arrow");

      content.classList.toggle("open");
      arrow.classList.toggle("rotated");

    });

  });
}
