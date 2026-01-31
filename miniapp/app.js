const tg = window.Telegram.WebApp;
tg.expand();

const content = document.getElementById('content');
const visitsTab = document.getElementById('visitsTab');
const scheduleTab = document.getElementById('scheduleTab');

const tg = window.Telegram.WebApp;
tg.expand();

async function authorize() {
  const initData = tg.initData;

  if (!initData) {
    document.body.innerHTML = "Доступ только через Telegram";
    return;
  }

  const res = await fetch('/api/auth/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData })
  });

  if (!res.ok) {
    document.body.innerHTML = "Нет доступа";
    return;
  }
}

authorize();


function setActive(tab) {
  visitsTab.classList.remove('active');
  scheduleTab.classList.remove('active');
  tab.classList.add('active');
}

visitsTab.onclick = () => {
  setActive(visitsTab);
  renderVisits();
};

scheduleTab.onclick = () => {
  setActive(scheduleTab);
  renderSchedule();
};

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

renderVisits();
