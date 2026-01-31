// ===============================
// Telegram Mini App Init
// ===============================
const tg = window.Telegram?.WebApp;

if (!tg) {
  document.body.innerHTML = "Откройте приложение через Telegram";
  throw new Error("Telegram WebApp not found");
}

tg.expand();
tg.ready();

// ===============================
// DOM элементы
// ===============================
const content = document.getElementById('content');
const visitsTab = document.getElementById('visitsTab');
const scheduleTab = document.getElementById('scheduleTab');

// ===============================
// Авторизация через backend
// ===============================
async function authorize() {
  try {
    const initData = tg.initData;

    if (!initData) {
      document.body.innerHTML = "Доступ только через Telegram";
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
      document.body.innerHTML = "Нет доступа";
      return false;
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

function renderVisits() {
  content.innerHTML = `
    <div class="card">
      <b>Визиты</b><br/>
      Здесь будет список врачей, календарь и слоты.
    </div>
  `;
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

