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

  const header = document.createElement("div");
header.className = "calendar-title";
header.innerText = formatHeader(current);

// 👉 добавляем возможность свернуть календарь
header.style.cursor = "pointer";
header.onclick = () => {
  if (!selectedDate) {
    selectedDate = new Date(current);
  }
  collapse();
  if (onSelect) onSelect(selectedDate);
};

    container.appendChild(header);

    const grid = document.createElement("div");
    grid.className = "cal-grid";

    const firstDay = new Date(current.getFullYear(), current.getMonth(), 1);
    let start = firstDay.getDay();
    if (start === 0) start = 7;

    const daysInMonth =
      new Date(current.getFullYear(), current.getMonth()+1, 0).getDate();

    for (let i = 1; i < start; i++) {
      grid.appendChild(document.createElement("div"));
    }

    for (let d = 1; d <= daysInMonth; d++) {

      const date = new Date(current.getFullYear(), current.getMonth(), d);
      date.setHours(0,0,0,0);

      const btn = document.createElement("button");
      btn.className = "cal-day";
      btn.innerText = d;

      if (selectedDate &&
          date.getTime() === selectedDate.getTime()) {
        btn.classList.add("selected");
      }

      const dow = date.getDay();
      if (dow === 6) btn.classList.add("saturday");
      if (dow === 0) btn.classList.add("sunday");

      btn.onclick = () => {
        selectedDate = new Date(date);
        collapse();
        if (onSelect) onSelect(selectedDate);
      };

      grid.appendChild(btn);
    }

    container.appendChild(grid);
  }

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
