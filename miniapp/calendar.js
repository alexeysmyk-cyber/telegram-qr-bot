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

  // ===============================
  // FULL VIEW
  // ===============================
  function buildFull() {

    container.parentElement.classList.remove("compact");
    container.innerHTML = "";

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

    // можно добавить тут сетку дней если нужно
  }

  // ===============================
  // COLLAPSED VIEW
  // ===============================
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

  // ===============================
  // CHANGE DAY
  // ===============================
  function changeDay(offset) {

    if (!selectedDate) return;

    selectedDate.setDate(selectedDate.getDate() + offset);

    // синхронизация месяца
    current = new Date(selectedDate);

    collapse();
    if (onSelect) onSelect(selectedDate);
  }

  // ===============================
  // SWIPE SUPPORT
  // ===============================
  let touchStartX = 0;

  container.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].screenX;
  });

  container.addEventListener("touchend", (e) => {
    const diff = e.changedTouches[0].screenX - touchStartX;

    if (Math.abs(diff) > 50 && selectedDate) {
      if (diff > 0) changeDay(-1);
      else changeDay(1);
    }
  });

  // ===============================
  // INIT
  // ===============================
  if (initialDate) {
    selectedDate = new Date(initialDate);
    current = new Date(initialDate);
    collapse();
    if (onSelect) onSelect(selectedDate);
  } else {
    buildFull();
  }
}
