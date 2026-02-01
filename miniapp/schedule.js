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

let visits = data.data;

visits = visits.filter(v => {

  // если ни один фильтр не выбран → только upcoming
  if (!showCancelled && !showCompleted) {
    return v.status === "upcoming";
  }

  if (showCancelled && v.status === "refused") return true;
  if (showCompleted && v.status === "completed") return true;
  if (v.status === "upcoming") return true;

  return false;
});

renderScheduleGrid(visits, container);


    
    renderScheduleGrid(data.data, container);

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



function renderScheduleGrid(data, container) {

  if (!data.length) {
    container.innerHTML = `<div class="card">Свободно</div>`;
    return;
  }

  if (!showAll) {
  renderDoctorBlock("Мои визиты", data, container);
  return;
}
const grouped = {};
data.forEach(item => {
  if (!grouped[item.doctor]) {
    grouped[item.doctor] = [];
  }
  grouped[item.doctor].push(item);
});


  let html = "";

  Object.keys(grouped).forEach(doctor => {

    html += `
      <div class="doctor-block">
        <div class="doctor-header">${doctor}</div>
        <div class="slots">
    `;

grouped[doctor].forEach(slot => {

  const timeStart = slot.time_start.split(" ")[1];
  const timeEnd = slot.time_end.split(" ")[1];

  let star = "";
  if (slot.is_first_clinic && slot.is_first_doctor) {
    star = `<span class="star red">★</span>`;
  } else if (!slot.is_first_clinic && slot.is_first_doctor) {
    star = `<span class="star green">★</span>`;
  }

  const isPastVisit = isPast(slot.time_start);

  html += `
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
});


    html += `</div></div>`;
  });

  container.innerHTML = html;

  attachSlotEvents();
}



function getSlotClass(status) {
  if (status === "upcoming") return "slot-active";
  if (status === "refused") return "slot-cancelled";
  return "slot-default";
}

function isPast(dateString) {
  const now = new Date();
  const visitDate = new Date(dateString);
  return visitDate < now;
}

function attachSlotEvents() {
  document.querySelectorAll(".slot").forEach(slot => {
    slot.addEventListener("click", () => {
      const id = slot.dataset.id;
      alert("Визит ID: " + id + "\nПозже будет перенос/отмена");
    });
  });
}
