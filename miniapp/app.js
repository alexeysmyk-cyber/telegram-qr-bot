// ===============================
// Telegram Mini App Init
// ===============================
let tg = null;

if (window.Telegram && window.Telegram.WebApp) {
  tg = window.Telegram.WebApp;
  tg.expand();
  tg.ready();
}

// ===============================
// DOM элементы
// ===============================
const content = document.getElementById('content');
const visitsTab = document.getElementById('visitsTab');
const scheduleTab = document.getElementById('scheduleTab');

import { renderCalendar } from './calendar.js';

// ===============================
// Авторизация через backend
// ===============================
async function authorize() {
  try {
    if (!tg) {
      document.body.innerHTML = "Доступ только через Telegram";
      return false;
    }

    const initData = tg.initData;

    if (!initData) {
      document.body.innerHTML = "Нет данных авторизации";
      return false;
    }

    const response = await fetch('/api/auth/telegram', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ initData })
    });

 if (!response.ok) {
  const text = await response.text();
  content.innerHTML = `<div class="card">Ошибка: ${response.status}<br>${text}</div>`;
  return;
}

    return true;

  } catch (err) {
    console.error("Authorization error:", err);
    document.body.innerHTML = "Ошибка авторизации";
    return false;
  }
}

// ===============================
// UI логика
// ===============================
function setActive(tab) {
  visitsTab.classList.remove('active');
  scheduleTab.classList.remove('active');
  tab.classList.add('active');
}

async function renderVisits() {
  content.innerHTML = `<div class="card">Загрузка врачей...</div>`;

  try {
    const response = await fetch('/api/mis/doctors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramUserId: tg.initDataUnsafe.user.id
      })
    });

    const data = await response.json();

    if (!response.ok) {
      content.innerHTML = `<div class="card">Ошибка доступа</div>`;
      return;
    }

    const { doctors, isDirector, currentDoctorId } = data;

    let html = `
  <div class="card">
    <label>Врач:</label>
    <select id="doctorSelect" ${!isDirector ? 'disabled' : ''}>
      ${doctors.map(d => `
        <option value="${d.id}" ${d.id == currentDoctorId ? 'selected' : ''}>
          ${d.name}
        </option>
      `).join('')}
    </select>
  </div>
  <div class="card">
    <div id="calendar"></div>
  </div>
`;


    content.innerHTML = html;

    const calendarEl = document.getElementById("calendar");

renderCalendar(calendarEl, (date) => {
  console.log("Выбрана дата:", date);

  // здесь позже будем делать fetch расписания
});


  } catch (err) {
    content.innerHTML = `<div class="card">Ошибка загрузки врачей</div>`;
  }
}



  function nextMonth() {
    current.setMonth(current.getMonth() + 1);
    build(current.getFullYear(), current.getMonth());
  }

  function prevMonth() {
    const test = new Date(current);
    test.setMonth(test.getMonth() - 1);

    // нельзя уйти в прошлые месяцы полностью
    if (test < new Date(today.getFullYear(), today.getMonth(), 1)) return;

    current.setMonth(current.getMonth() - 1);
    build(current.getFullYear(), current.getMonth());
  }

  // 👇 свайп логика
  container.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].screenX;
  });

  container.addEventListener("touchend", (e) => {
    touchEndX = e.changedTouches[0].screenX;

    const delta = touchEndX - touchStartX;

    if (delta < -50) {
      nextMonth();
    }

    if (delta > 50) {
      prevMonth();
    }
  });

  build(current.getFullYear(), current.getMonth());
}


function renderSchedule() {
  content.innerHTML = `
    <div class="card">
      <b>Расписание</b><br/>
      Здесь будет управление слотами врача.
    </div>
  `;
}

function attachEvents() {
  visitsTab.addEventListener('click', () => {
    setActive(visitsTab);
    renderVisits();
  });

  scheduleTab.addEventListener('click', () => {
    setActive(scheduleTab);
    renderSchedule();
  });
}

// ===============================
// Инициализация
// ===============================
async function init() {
  const authorized = await authorize();
  if (!authorized) return;

  attachEvents();
  renderVisits();
}

init();
