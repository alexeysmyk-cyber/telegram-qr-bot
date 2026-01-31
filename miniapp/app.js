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

//import { renderCalendar } from './calendar.js';

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


function renderCalendar(container, onSelect) {

  let current = new Date();
  current.setDate(1);

  function build(year, month) {
    container.innerHTML = "";

    const today = new Date();
    today.setHours(0,0,0,0);

    const header = document.createElement("div");
    header.className = "cal-header";

    const prev = document.createElement("button");
    prev.innerHTML = "‹";
    prev.onclick = () => {
      current.setMonth(current.getMonth() - 1);
      build(current.getFullYear(), current.getMonth());
    };

    const next = document.createElement("button");
    next.innerHTML = "›";
    next.onclick = () => {
      current.setMonth(current.getMonth() + 1);
      build(current.getFullYear(), current.getMonth());
    };

    const title = document.createElement("div");
    title.className = "cal-title";
    title.innerText =
      current.toLocaleString("ru-RU", { month: "long", year: "numeric" });

    header.append(prev, title, next);
    container.appendChild(header);

    const grid = document.createElement("div");
    grid.className = "cal-grid";

    const daysOfWeek = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
    daysOfWeek.forEach(d => {
      const el = document.createElement("div");
      el.className = "cal-day-name";
      el.innerText = d;
      grid.appendChild(el);
    });

    const firstDay = new Date(year, month, 1);
    let start = firstDay.getDay();
    if (start === 0) start = 7;

    const daysInMonth = new Date(year, month+1, 0).getDate();

    for (let i=1;i<start;i++){
      const empty = document.createElement("div");
      grid.appendChild(empty);
    }

    for (let d=1; d<=daysInMonth; d++){
      const date = new Date(year, month, d);
      date.setHours(0,0,0,0);

      const btn = document.createElement("button");
      btn.className = "cal-day";
      btn.innerText = d;

      if (date < today) {
        btn.classList.add("disabled");
        btn.disabled = true;
      } else {
        btn.onclick = () => {
          document.querySelectorAll(".cal-day")
            .forEach(x => x.classList.remove("selected"));
          btn.classList.add("selected");
          onSelect(date);
        };
      }

      grid.appendChild(btn);
    }

    container.appendChild(grid);
  }

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
