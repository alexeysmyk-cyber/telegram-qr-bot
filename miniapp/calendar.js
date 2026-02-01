export function renderCalendar(container, onSelect, initialDate = null) {

  let current = new Date();
  current.setHours(0,0,0,0);

  let selectedDate = null;
  let touchStartX = 0;

  const days = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
  const months = [
    "Января","Февраля","Марта","Апреля",
    "Мая","Июня","Июля","Августа",
    "Сентября","Октября","Ноября","Декабря"
  ];

  function formatHeader(date) {
    return `${String(date.getDate()).padStart(2,"0")} ${months[date.getMonth()]} ${date.getFullYear()}`;
  }

  function buildFull() {

    container.parentElement.classList.remove("compact");
    container.innerHTML = "";

    const header = document.createElement("div");
    header.className = "calendar-title full-header";

    const prev = document.createElement("button");
    prev.className = "nav-btn";
    prev.innerText = "‹";

    const next = document.createElement("button");
    next.className = "nav-btn";
    next.innerText = "›";

    const title = document.createElement("div");
    title.className = "collapsed-title";
    title.innerText = `${months[current.getMonth()]} ${current.getFullYear()}`;

    prev.onclick = () => {
      current.setMonth(current.getMonth() - 1);
      buildFull();
    };

    next.onclick = () => {
      current.setMonth(current.getMonth() + 1);
      buildFull();
    };

    header.append(prev, title, next);
    container.appendChild(header);

    // Дни недели
    const weekdays = document.createElement("div");
    weekdays.className = "cal-weekdays";

    days.forEach((d, index) => {
      const el = document.createElement("div");
      el.innerText = d;

      if (index === 5) el.classList.add("saturday");
      if (index === 6) el.classList.add("sunday");

      weekdays.appendChild(el);
    });

    container.appendChild(weekdays);

    // Сетка дней
    const grid = document.createElement("div");
    grid.className = "cal-grid";

    const firstDay = new Date(current.getFullYear(), current.getMonth(), 1);
    let start = firstDay.getDay();
    if (start === 0) start = 7;

    const daysInMonth =
      new Date(current.getFullYear(), current.getMonth()+1, 0).getDate();

    for (let i=1; i<start; i++) {
      grid.appendChild(document.createElement("div"));
    }

    for (let d=1; d<=daysInMonth; d++) {

      const date = new Date(current.getFullYear(), current.getMonth(), d);
      date.setHours(0,0,0,0);

      const btn = document.createElement("button");
      btn.className = "cal-day";
      btn.innerText = d;

      const dow = date.getDay();
      if (dow === 6) btn.classList.add("saturday");
      if (dow === 0) btn.classList.add("sunday");

      // 🔥 Подсветка выбранного дня
      if (
        selectedDate &&
        date.toDateString() === selectedDate.toDateString()
      ) {
        btn.classList.add("selected");
      }

      btn.onclick = () => {
        selectedDate = new Date(date);
        collapse();
        if (onSelect) onSelect(selectedDate);
      };

      grid.appendChild(btn);
    }

    container.appendChild(grid);

    // ✅ Свайп меняет месяц, НЕ выбирает дату
    container.addEventListener("touchstart", (e) => {
      touchStartX = e.changedTouches[0].screenX;
    });

    container.addEventListener("touchend", (e) => {
      const diff = e.changedTouches[0].screenX - touchStartX;

      if (Math.abs(diff) > 60) {
        if (diff > 0) {
          current.setMonth(current.getMonth() - 1);
        } else {
          current.setMonth(current.getMonth() + 1);
        }
        buildFull();
      }
    });
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

    prev.onclick = () => changeDay(-1);
    next.onclick = () => changeDay(1);

    title.onclick = () => buildFull();

    wrapper.append(prev, title, next);
    container.appendChild(wrapper);
  }

  function changeDay(offset) {
    selectedDate.setDate(selectedDate.getDate() + offset);
    current = new Date(selectedDate);
    collapse();
    if (onSelect) onSelect(selectedDate);
  }

  // Инициализация
  if (initialDate) {
    selectedDate = new Date(initialDate);
    current = new Date(initialDate);
    collapse();
  } else {
    buildFull();
  }
}
