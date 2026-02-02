// ===== RETRY WRAPPER =====
async function fetchWithRetry(body, retries = 1) {

  try {
    const response = await fetch("/api/mis/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok || data.error !== 0) {
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

export async function loadSchedule({
  container,
  date,
  doctorId,
  showAll,
  duration,
  showCancelled,
  showCompleted
}) {

  showLoader(container);

  try {

    const data = await fetchWithRetry({
      date,
      doctorId
    });

    let visits = data.data || [];

    // ===== ФИЛЬТРАЦИЯ =====
    visits = visits.filter(v => {

      if (!showCancelled && !showCompleted) {
        return v.status === "upcoming";
      }

      if (v.status === "upcoming") return true;
      if (showCancelled && v.status === "refused") return true;
      if (showCompleted && v.status === "completed") return true;

      return false;
    });

    renderScheduleGrid(visits, container, showAll, date);

  } catch (err) {

    container.innerHTML = `
      <div class="card empty-state">
        Временно недоступно.<br/>
        Повторите через несколько секунд.
      </div>
    `;
  }
}



function showLoader(container) {
  container.innerHTML = `
    <div class="loader">
      <div class="spinner"></div>
      <div>Загрузка расписания...</div>
    </div>
  `;
}


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
    if (!grouped[item.doctor]) {
      grouped[item.doctor] = [];
    }
    grouped[item.doctor].push(item);
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




function renderSlot(slot) {

  const timeStart = slot.time_start.split(" ")[1];
  const timeEnd = slot.time_end.split(" ")[1];

  let star = "";
  if (slot.is_first_clinic && slot.is_first_doctor) {
    star = `<span class="star red">★</span>`;
  } else if (!slot.is_first_clinic && slot.is_first_doctor) {
    star = `<span class="star green">★</span>`;
  }

  const isPastVisit = isPast(slot.time_start);

  return `
    <div class="slot ${getSlotClass(slot.status)}"
         data-id="${slot.id}">

      <div class="slot-meta">
        <div class="meta-left">
          ${isPastVisit ? "Визит в прошлом" : ""}
        </div>
        <div class="meta-right">
          ${getStatusText(slot.status)}
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



function getStatusText(status) {
  if (status === "upcoming") return "Визит ожидается";
  if (status === "refused") return "Визит отменён";
  if (status === "completed") return "Визит завершён";
  return "";
}



function getSlotClass(status) {
  if (status === "upcoming") return "slot-active";
  if (status === "refused") return "slot-cancelled";
  if (status === "completed") return "slot-default";
  return "slot-default";
}



function isPast(dateString) {

  const [datePart, timePart] = dateString.split(" ");
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



function attachSlotEvents() {
  document.querySelectorAll(".slot").forEach(slot => {
    slot.addEventListener("click", () => {
      const id = slot.dataset.id;
      alert("Визит ID: " + id + "\nПозже будет перенос/отмена");
    });
  });
}
