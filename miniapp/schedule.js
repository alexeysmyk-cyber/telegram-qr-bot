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

    const response = await fetch("/api/mis/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        doctorId
      })
    });

    const data = await response.json();

    if (!response.ok || data.error !== 0) {
      container.innerHTML = `<div class="card">Ошибка загрузки</div>`;
      return;
    }

    let visits = data.data || [];

    // ===== ФИЛЬТРАЦИЯ =====
    visits = visits.filter(v => {

      // если фильтры не выбраны → только upcoming
      if (!showCancelled && !showCompleted) {
        return v.status === "upcoming";
      }

      // если выбран хоть один фильтр
      if (v.status === "upcoming") return true;

      if (showCancelled && v.status === "refused") return true;

      if (showCompleted && v.status === "completed") return true;

      return false;
    });

    renderScheduleGrid(visits, container, showAll);

  } catch (err) {
    container.innerHTML = `<div class="card">Ошибка сервера</div>`;
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



function renderScheduleGrid(data, container, showAll) {

  // если нет визитов — ничего не показываем
  if (!data.length) {
    container.innerHTML = "";
    return;
  }

  let html = "";

  // ===== ЕСЛИ ОДИН ВРАЧ — БЕЗ ГРУППИРОВКИ =====
  if (!showAll) {

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

  Object.keys(grouped).forEach(doctor => {

    const count = grouped[doctor].length;

    html += `
      <div class="doctor-block">

        <div class="doctor-header">
          ${doctor}
          <span class="count">(${count})</span>
        </div>

        <div class="slots hidden">
    `;

    grouped[doctor].forEach(slot => {
      html += renderSlot(slot);
    });

    html += `</div></div>`;
  });

  container.innerHTML = html;

  // ===== СВОРАЧИВАНИЕ =====
  document.querySelectorAll(".doctor-header").forEach(header => {
    header.addEventListener("click", () => {
      const slots = header.nextElementSibling;
      slots.classList.toggle("hidden");
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

      ${isPastVisit ? `<div class="past-label">Визит в прошлом</div>` : ""}

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



function getSlotClass(status) {
  if (status === "upcoming") return "slot-active";
  if (status === "refused") return "slot-cancelled";
  if (status === "completed") return "slot-default";
  return "slot-default";
}



function isPast(dateString) {

  const [datePart, timePart] = dateString.split(" ");
  const [dd, mm, yyyy] = datePart.split(".");

  // создаём дату визита как московское время
  const visitUTC = Date.UTC(
    yyyy,
    mm - 1,
    dd,
    ...timePart.split(":")
  );

  // получаем текущее московское время
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
