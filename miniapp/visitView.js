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

      <div class="visit-top-bar">
        <div class="visit-type-top">
          ${getVisitType(visit)}
        </div>

        <div class="visit-status-top ${visit.status}">
          ${getPrettyStatus(visit)}
        </div>
      </div>

      <div class="visit-content padded">

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

  document.getElementById("closeBottomBtn")
    .addEventListener("click", () => overlay.remove());

  attachServicesToggle(overlay);
  attachMoveLinks(overlay);
}





// ===============================
// MAIN INFO
// ===============================

function renderMainInfo(v) {

  const statusText = getPrettyStatus(v);
  const visitType = getVisitType(v);

  return `
    <div class="visit-card main-card">

      <div class="status-badge ${v.status}">
        ${statusText}
      </div>

      <div class="visit-date">
        ${formatFullDate(v.time_start)}
      </div>

      <div class="visit-time">
        с ${getTime(v.time_start)} до ${getTime(v.time_end)}
      </div>

      <div class="visit-type">
        ${visitType}
      </div>

      <div class="visit-row right">
        <span>Клиника:</span>
        <span>${v.clinic}</span>
      </div>

      <div class="visit-row right">
        <span>Кабинет:</span>
        <span>${v.room || "—"}</span>
      </div>

      <div class="visit-row right">
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
function getPrettyStatus(v) {

  if (v.moved_to) return "Перенесён";
  if (v.status === "upcoming") return "Ожидается";
  if (v.status === "refused") return "Отменён";
  if (v.status === "completed") return "Завершён";

  return "";
}
function getVisitType(v) {

  if (v.is_first_doctor && v.is_first_clinic)
    return "Первичный визит в клинику";

  if (v.is_first_doctor && !v.is_first_clinic)
    return "Первичный визит к врачу";

  return "Повторный визит";
}
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
function getTime(dateString) {
  return dateString.split(" ")[1];
}
function renderMoveInfo(v) {

  if (!v.moved_from && !v.moved_to) return "";

  return `
    <div class="visit-card">

      <div class="card-title">История переноса</div>

      ${v.moved_from ? `
        <div class="move-block">
          <div class="move-header" data-id="${v.moved_from}">
            Перенесён из визита #${v.moved_from}
            <span class="services-arrow">▾</span>
          </div>
          <div class="move-content"></div>
        </div>
      ` : ""}

      ${v.moved_to ? `
        <div class="move-block">
          <div class="move-header" data-id="${v.moved_to}">
            Перенесён в визит #${v.moved_to}
            <span class="services-arrow">▾</span>
          </div>
          <div class="move-content"></div>
        </div>
      ` : ""}

    </div>
  `;
}
function attachMoveLinks(overlay) {

  overlay.querySelectorAll(".move-header").forEach(header => {

    header.addEventListener("click", async () => {

      const id = header.dataset.id;
      const content = header.nextElementSibling;

      if (content.classList.contains("open")) {
        content.classList.remove("open");
        content.innerHTML = "";
        return;
      }

      content.innerHTML = `
        <div class="spinner"></div>
      `;

      content.classList.add("open");

      try {

        const response = await fetch("/api/mis/appointment-by-id", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appointment_id: id })
        });

        const data = await response.json();

        if (!response.ok || data.error !== 0) {
          content.innerHTML = "Ошибка загрузки";
          return;
        }

        const visit = data.data[0];

        content.innerHTML = `
          <div class="visit-row">
            ${visit.time_start} – ${visit.time_end}
          </div>
          <div class="visit-row">
            ${visit.patient_name}
          </div>
        `;

      } catch {
        content.innerHTML = "Ошибка загрузки";
      }

    });

  });

}

