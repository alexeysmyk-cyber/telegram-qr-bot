export async function loadSchedule({
  container,
  date,
  doctorId,
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
      html += `
        <div class="slot ${getSlotClass(slot.status)}"
             data-id="${slot.id}">
          <div class="time">
            ${slot.time_start.split(" ")[1]}
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



function attachSlotEvents() {
  document.querySelectorAll(".slot").forEach(slot => {
    slot.addEventListener("click", () => {
      const id = slot.dataset.id;
      alert("Визит ID: " + id + "\nПозже будет перенос/отмена");
    });
  });
}
