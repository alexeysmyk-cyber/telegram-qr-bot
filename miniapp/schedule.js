import { openVisitView } from "./visitView.js";
import { openCancelModal } from "./cancelVisit.js"; // если нужно
import { openMoveVisitFlow } from "./moveVisit.js";
import { openCreateVisit } from "./createVisit.js";

function hideVisitLoader() {
  const loader = document.getElementById("visitLoaderOverlay");
  if (loader) loader.remove();
}


function showVisitLoader() {

  const overlay = document.createElement("div");
  overlay.className = "visit-overlay";
  overlay.id = "visitLoaderOverlay";

overlay.innerHTML = `
  <div class="visit-loading">
    <div class="visit-spinner"></div>
    <div class="visit-loading-text">
      Загрузка визита...
    </div>
  </div>
`;


  document.body.appendChild(overlay);
}
// ===============================
// REQUEST GUARD (защита от гонок)
// ===============================
let currentRequestId = 0;
// ===============================
// LAST SCHEDULE STATE
// ===============================
let lastScheduleParams = null;


// ===============================
// RETRY WRAPPER
// ===============================
async function fetchWithRetry(body, retries = 1) {

  try {

    const response = await fetch("/api/mis/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error("HTTP_ERROR");
    }

    const data = await response.json();

    if (data.error !== 0) {
      throw new Error("MIS_ERROR");
    }

    return data;

  } catch (err) {

    if (retries > 0) {
      await new Promise(r => setTimeout(r, 600));
      return fetchWithRetry(body, retries - 1);
    }

    throw err;
  }
}


// ===============================
// LOAD SCHEDULE
// ===============================
export async function loadSchedule({
  container,
  date,
  doctorId,
  showAll,
  duration,
  showCancelled,
  showCompleted
}) {

    lastScheduleParams = {
    container,
    date,
    doctorId,
    showAll,
    duration,
    showCancelled,
    showCompleted
  };

 

  
  showLoader(container);

  const requestId = ++currentRequestId;

  try {

    const data = await fetchWithRetry({
      date
    });

    // если уже ушёл новый запрос — этот игнорируем
    if (requestId !== currentRequestId) return;

    let visits = data.data || [];

    // ===== ФИЛЬТРАЦИЯ ПО ВРАЧУ (фронт) =====
    if (!showAll && doctorId) {
      visits = visits.filter(v =>
        String(v.doctor_id) === String(doctorId)
      );
    }

    // ===== ФИЛЬТРАЦИЯ ПО СТАТУСАМ =====
visits = visits.filter(v => {

  const status = normalizeStatus(v);

  if (!showCancelled && !showCompleted) {
    return status === "upcoming";
  }

  if (status === "upcoming") return true;
  if (showCancelled && (status === "refused" || status === "moved")) return true;
  if (showCompleted && status === "completed") return true;

  return false;
});
window.currentVisits = visits;
    renderScheduleGrid(visits, container, showAll, date);

  } catch (err) {

    if (requestId !== currentRequestId) return;

    container.innerHTML = `
      <div class="card empty-state">
        Временно недоступно.<br/>
        Повторите через несколько секунд.
      </div>
    `;
  }
}


// ===============================
// LOADER
// ===============================
function showLoader(container) {
  container.innerHTML = `
    <div class="loader">
      <div class="spinner"></div>
      <div>Загрузка расписания...</div>
    </div>
  `;
}


// ===============================
// RENDER GRID
// ===============================
function renderScheduleGrid(data, container, showAll, date) {

  // ===== ЕСЛИ ВИЗИТОВ НЕТ =====
  if (!data || data.length === 0) {
    container.innerHTML = `
      <div class="card empty-state">
        Записей на ${date} нет
      </div>
    `;
    return;
  }

  // ===== ЕСЛИ ОДИН ВРАЧ =====
  if (!showAll) {

    let html = "";
    data.forEach(slot => {
      html += renderSlot(slot);
    });

    container.innerHTML = html;
    attachSlotEvents();
    return;
  }

  // ===== ГРУППИРОВКА ПО ВРАЧАМ =====
  const grouped = {};

  data.forEach(item => {

    const doctorName = item.doctor || "Неизвестный врач";

    if (!grouped[doctorName]) {
      grouped[doctorName] = [];
    }

    grouped[doctorName].push(item);
  });

  const doctors = Object.keys(grouped);
  let html = "";

  doctors.forEach(doctor => {

    const visits = grouped[doctor];
    if (!visits.length) return;

    const autoOpen = doctors.length === 1;

    html += `
      <div class="doctor-block">
        <div class="doctor-header ${autoOpen ? "open" : ""}">
          <span>${doctor} (${visits.length})</span>
          <span class="arrow ${autoOpen ? "rotated" : ""}">▾</span>
        </div>

        <div class="slots ${autoOpen ? "open" : ""}">
    `;

    visits.forEach(slot => {
      html += renderSlot(slot);
    });

    html += `
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  document.querySelectorAll(".doctor-header").forEach(header => {

    header.addEventListener("click", () => {

      const slots = header.nextElementSibling;
      const arrow = header.querySelector(".arrow");

      header.classList.toggle("open");
      slots.classList.toggle("open");
      arrow.classList.toggle("rotated");

    });

  });

  attachSlotEvents();
}


// ===============================
// SLOT RENDER
// ===============================
function renderSlot(slot) {

  const status = normalizeStatus(slot);

 const timeStart = slot.time_start?.split(" ")[1] || "";
const timeEnd = slot.time_end?.split(" ")[1] || "";

 let star = "";

if (status === "moved") {
  star = `<span style="color:#f59e0b">↔</span>`;
}
else if (slot.is_first_clinic && slot.is_first_doctor) {
  star = `<span class="star red">★</span>`;
}
else if (!slot.is_first_clinic && slot.is_first_doctor) {
  star = `<span class="star green">★</span>`;
}


  const isPastVisit = isPast(slot.time_start);

  return `
    <div class="slot ${getSlotClass(status)}"
         data-id="${slot.id}">

      <div class="slot-meta">
        <div class="meta-left">
          ${isPastVisit ? "Визит в прошлом" : ""}
        </div>
        <div class="meta-right">
          ${getStatusText(status)}
        </div>
      </div>

      <div class="slot-top">
        <div class="time">
          ${timeStart} – ${timeEnd}
        </div>
        ${star}
      </div>

      <div class="name">
        ${slot.patient_name}
      </div>

    </div>
  `;
}


// ===============================
// STATUS HELPERS
// ===============================
function getStatusText(status) {
  if (status === "upcoming") return "Визит ожидается";
  if (status === "refused") return "Визит отменён";
  if (status === "completed") return "Визит завершён";
  if (status === "moved") return "Визит перенесён";
  return "";
}

function getSlotClass(status) {
  if (status === "upcoming") return "slot-active";
  if (status === "refused") return "slot-cancelled";
  if (status === "moved") return "slot-moved"; // такой же стиль
  if (status === "completed") return "slot-default";
  return "slot-default";
}



// ===============================
// PAST CHECK
// ===============================
function isPast(dateString) {

    if (!dateString) return false;

  const parts = dateString.split(" ");
  if (parts.length < 2) return false;

  const [datePart, timePart] = parts;
  const [dd, mm, yyyy] = datePart.split(".");

  const visitUTC = Date.UTC(
    yyyy,
    mm - 1,
    dd,
    ...timePart.split(":")
  );

  const now = new Date();

  const nowMoscow = new Date(
    now.toLocaleString("en-US", { timeZone: "Europe/Moscow" })
  );

  const nowUTC = Date.UTC(
    nowMoscow.getFullYear(),
    nowMoscow.getMonth(),
    nowMoscow.getDate(),
    nowMoscow.getHours(),
    nowMoscow.getMinutes(),
    nowMoscow.getSeconds()
  );

  return visitUTC < nowUTC;
}


// ===============================
// SLOT EVENTS
// ===============================
window.isLongPressActive = false;
function attachSlotEvents() {
   console.log("attachSlotEvents called");



  document.querySelectorAll(".slot").forEach(slot => {

  let pressTimer = null;
  let isLongPress = false;

  let startX = 0;
  let startY = 0;
  let moved = false;   // ← ДОБАВИТЬ
    const appointmentId = slot.dataset.id;

    // ===============================
    // TOUCH START
    // ===============================
    slot.addEventListener("touchstart", (e) => {

e.stopPropagation();
      
      isLongPress = false;
    moved = false;

  startX = e.touches[0].clientX;
  startY = e.touches[0].clientY;;

      pressTimer = setTimeout(() => {
          console.log("LONG PRESS ACTIVATED");

        isLongPress = true;
        activateLongPressMode(slot);

      }, 600);

    });

    // ===============================
    // TOUCH MOVE
    // ===============================
slot.addEventListener("touchmove", (e) => {

  const currentX = e.touches[0].clientX;
  const currentY = e.touches[0].clientY;

  const diffX = currentX - startX;
  const diffY = currentY - startY;

  // фиксируем движение
  if (Math.abs(diffX) > 5 || Math.abs(diffY) > 5) {
    moved = true;
    clearTimeout(pressTimer);
  }

  // если это long press — двигаем слот
  if (isLongPress) {
    e.stopPropagation();
    e.preventDefault();
    slot.style.transform = `translateX(${diffX}px)`;
  }
});




    // ===============================
    // TOUCH END
    // ===============================
slot.addEventListener("touchend", (e) => {

  clearTimeout(pressTimer);

  const endX = e.changedTouches[0].clientX;
  const diff = endX - startX;

  const threshold = 60;

  // ❗ если не было long press — ничего не делаем
  if (!isLongPress) {
    slot.style.transform = "";
    return;
  }

  // если был long press — блокируем наружу
  e.stopPropagation();
  e.preventDefault();

if (diff > threshold) {

  showVisitLoader(); // 🔥 показываем лоадер сразу

  fetch("/api/mis/appointment-by-id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appointment_id: appointmentId })
  })
  .then(res => res.json())
  .then(data => {

    if (data.error !== 0 || !data.data?.length) {
      hideVisitLoader();
      alert("Ошибка загрузки визита");
      return;
    }

    const fullVisit = data.data[0];

    // небольшая пауза чтобы loader точно отрисовался
    setTimeout(() => {

      openCreateVisit({
        mode: "move",
        visit: fullVisit
      });

      // скрываем loader после открытия
      setTimeout(() => {
        hideVisitLoader();
      }, 400);

    }, 100);

  })
  .catch(() => {
    hideVisitLoader();
    alert("Ошибка соединения");
  });
}






  else if (diff < -threshold) {
    const visit = window.currentVisits?.find(v => v.id == appointmentId);
    if (visit) openCancelModal(visit);
  }

  deactivateLongPressMode(slot);
  slot.style.transform = "";
});



    slot.addEventListener("click", (e) => {

  if (moved) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }

  openVisitView(appointmentId);
});


  });

}

function activateLongPressMode(slot) {

  window.isLongPressActive = true;

  // создаём overlay
 const overlay = document.createElement("div");
overlay.className = "longpress-overlay";
document.body.appendChild(overlay);

  slot.classList.add("slot-lifted");

  const hint = document.createElement("div");
  hint.className = "longpress-hint";
  hint.innerHTML = `
    <div class="hint-wrapper">
      <div class="hint-left">⬅ Удалить</div>
      <div class="hint-right">Перенести ➡</div>
    </div>
  `;
  document.body.appendChild(hint);
}

function stopPropagation(e) {
  e.stopPropagation();
}

function deactivateLongPressMode(slot) {

  window.isLongPressActive = false;

  slot.classList.remove("slot-lifted");

const overlay = document.querySelector(".longpress-overlay");
if (overlay) overlay.remove();

  const hint = document.querySelector(".longpress-hint");
  if (hint) hint.remove();
}

function normalizeStatus(slot) {

  const status = slot.status;

  // если отменён, но есть перенос — это перенесённый визит
  if (
    status === "refused" &&
    slot.moved_to &&
    String(slot.moved_to).length > 0
  ) {
    return "moved";
  }

  return status;
}


// ===============================
// RELOAD LAST SCHEDULE
// ===============================
window.reloadSchedule = function(dateOverride = null) {

  if (!lastScheduleParams) return;

  const params = { ...lastScheduleParams };

  if (dateOverride) {
    params.date = dateOverride;
  }

  loadSchedule(params);
};

