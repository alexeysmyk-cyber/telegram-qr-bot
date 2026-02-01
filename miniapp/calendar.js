export function renderCalendar(container, onSelect, initialDate = null) {

  let current = new Date();
  current.setHours(0,0,0,0);

  let selectedDate = null;

  function formatHeader(date) {
    const days = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];
    const months = [
      "Января","Февраля","Марта","Апреля",
      "Мая","Июня","Июля","Августа",
      "Сентября","Октября","Ноября","Декабря"
    ];

    return `${days[date.getDay()]}. ${String(date.getDate()).padStart(2,"0")}-${months[date.getMonth()]}-${date.getFullYear()}`;
  }

function buildFull() {
  container.parentElement.classList.remove("compact");
  container.innerHTML = "";
  collapsed = false;

  const header = document.createElement("div");
  header.className = "calendar-title full-header";

  const prev = document.createElement("button");
  prev.innerText = "‹";
  prev.className = "nav-btn";

  const next = document.createElement("button");
  next.innerText = "›";
  next.className = "nav-btn";

  const title = document.createElement("div");
  title.className = "collapsed-title";
  title.innerText = formatHeader(current);

  // клик по заголовку → свернуть
  title.style.cursor = "pointer";
  title.onclick = () => {
    selectedDate = new Date(current);
    collapse();
    if (onSelect) onSelect(selectedDate);
  };

  prev.onclick = () => changeDay(-1);
  next.onclick = () => changeDay(1);

  header.append(prev, title, next);
  container.appendChild(header);


  function collapse() {

    if (!selectedDate) return;

    container.innerHTML = "";
    container.parentElement.classList.add("compact");

    const wrapper = document.createElement("div");
    wrapper.className = "calendar-collapsed";

    const prev = document.createElement("button");
    prev.innerText = "‹";

    const next = document.createElement("button");
    next.innerText = "›";

    const title = document.createElement("div");
    title.className = "collapsed-title";
    title.innerText = formatHeader(selectedDate);

    if (selectedDate.getDay() === 6)
      title.classList.add("saturday");

    if (selectedDate.getDay() === 0)
      title.classList.add("sunday");

    title.style.cursor = "pointer";
    title.onclick = () => buildFull();

    prev.onclick = () => changeDay(-1);
    next.onclick = () => changeDay(1);

    wrapper.append(prev, title, next);
    container.appendChild(wrapper);
  }

  function changeDay(offset) {

    selectedDate.setDate(selectedDate.getDate() + offset);

    // 🔥 ВАЖНО — синхронизируем месяц
    current = new Date(selectedDate);

    collapse();
    if (onSelect) onSelect(selectedDate);
  }

  // ===== ИНИЦИАЛИЗАЦИЯ =====

  if (initialDate) {
    selectedDate = new Date(initialDate);
    current = new Date(initialDate);   // 🔥 СИНХРОНИЗАЦИЯ
    collapse();
    if (onSelect) onSelect(selectedDate);
  } else {
    buildFull();
  }
}
