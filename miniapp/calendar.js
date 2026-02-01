export function renderCalendar(container, onSelect, initialDate = null) {

  let current = new Date();
  current.setHours(0,0,0,0);

  let selectedDate = null;

  let touchStartX = 0;
  let swipeTriggered = false;

  const daysShort = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
  const daysFull = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];

  const monthsNominative = [
    "Январь","Февраль","Март","Апрель",
    "Май","Июнь","Июль","Август",
    "Сентябрь","Октябрь","Ноябрь","Декабрь"
  ];

  const monthsGenitive = [
    "Января","Февраля","Марта","Апреля",
    "Мая","Июня","Июля","Августа",
    "Сентября","Октября","Ноября","Декабря"
  ];

  function formatFullDate(date) {
    return `${daysFull[date.getDay()]}, ${
      date.getDate()
    }-${monthsGenitive[date.getMonth()]}-${
      date.getFullYear()
    }`;
  }

  function formatMonthYear(date) {
    return `${monthsNominative[date.getMonth()]} ${date.getFullYear()}`;
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
    prev.className = "nav-btn";
    prev.innerText = "‹";

    const next = document.createElement("button");
    next.className = "nav-btn";
    next.innerText = "›";

    const title = document.createElement("div");
    title.className = "collapsed-title";
    title.innerText = formatMonthYear(current);

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

    const weekdays = document.createElement("div");
    weekdays.className = "cal-weekdays";

    daysShort.forEach((d, index) => {
      const el = document.createElement("div");
      el.innerText = d;

      if (index === 5) el.classList.add("saturday");
      if (index === 6) el.classList.add("sunday");

      weekdays.appendChild(el);
    });

    container.appendChild(weekdays);

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

      if (selectedDate &&
          date.toDateString() === selectedDate.toDateString()) {
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
    title.innerText = formatFullDate(selectedDate);

    if (selectedDate.getDay() === 6)
      title.classList.add("saturday");

    if (selectedDate.getDay() === 0)
      title.classList.add("sunday");

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

  // ===============================
  // SWIPE (ИСПРАВЛЕННЫЙ БЕЗ GHOST CLICK)
  // ===============================
  container.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].screenX;
    swipeTriggered = false;
  });

  container.addEventListener("touchmove", (e) => {
    const diff = e.changedTouches[0].screenX - touchStartX;
    if (Math.abs(diff) > 20) {
      swipeTriggered = true;
    }
  });

  container.addEventListener("touchend", (e) => {

    const diff = e.changedTouches[0].screenX - touchStartX;

    if (!container.parentElement.classList.contains("compact") &&
        Math.abs(diff) > 60) {

      if (diff > 0) {
        current.setMonth(current.getMonth() - 1);
      } else {
        current.setMonth(current.getMonth() + 1);
      }

      buildFull();

      // 🔥 Блокируем ghost click после свайпа
      container.style.pointerEvents = "none";

      setTimeout(() => {
        container.style.pointerEvents = "auto";
      }, 300);
    }
  });

  // ===============================
  // INIT
  // ===============================
  if (initialDate) {
    selectedDate = new Date(initialDate);
    current = new Date(initialDate);
    collapse();
  } else {
    buildFull();
  }
}
