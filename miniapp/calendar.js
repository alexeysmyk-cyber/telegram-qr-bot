export function renderCalendar(container, onSelect, initialDate = null) {

  let current = new Date();
  current.setHours(0,0,0,0);

  let selectedDate = null;
  let touchStartX = 0;

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

    // клик по дате → свернуть
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

    const grid = document.createElement("div");
    grid.className = "cal-grid";

    const firstDay = new Date(current.getFullYear(), current.getMonth(), 1);
    let start = firstDay.getDay();
    if (start === 0) start = 7;

    const daysInMonth =
      new Date(current.getFullYear(), current.getMonth()+1, 0).getDate();

    for (let i=1;i<start;i++){
      grid.appendChild(document.createElement("div"));
    }

    for (let d=1; d<=daysInMonth; d++) {

      const date = new Date(current.getFullYear(), current.getMonth(), d);
      date.setHours(0,0,0,0);

      const btn = document.createElement("button");
      btn.className = "cal-day";
      btn.innerText = d;

      btn.onclick = () => {
        selectedDate = new Date(date);
        collapse();
        if (onSelect) onSelect(selectedDate);
      };

      grid.appendChild(btn);
    }

    container.appendChild(grid);

    // ===== СВАЙП В РАЗВЁРНУТОМ =====
    container.addEventListener("touchstart", (e) => {
      touchStartX = e.changedTouches[0].screenX;
    });

    container.addEventListener("touchend", (e) => {
      const diff = e.changedTouches[0].screenX - touchStartX;

      if (Math.abs(diff) > 50) {
        changeDay(diff > 0 ? -1 : 1);
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

    title.style.cursor = "pointer";
    title.onclick = () => buildFull();

    prev.onclick = () => changeDay(-1);
    next.onclick = () => changeDay(1);

    wrapper.append(prev, title, next);
    container.appendChild(wrapper);

    // свайп в свернутом
    container.addEventListener("touchstart", (e) => {
      touchStartX = e.changedTouches[0].screenX;
    });

    container.addEventListener("touchend", (e) => {
      const diff = e.changedTouches[0].screenX - touchStartX;

      if (Math.abs(diff) > 50) {
        changeDay(diff > 0 ? -1 : 1);
      }
    });
  }

  function changeDay(offset) {

    if (!selectedDate) return;

    selectedDate.setDate(selectedDate.getDate() + offset);
    current = new Date(selectedDate);

    collapse();
    if (onSelect) onSelect(selectedDate);
  }

  // ===== INIT =====

  if (initialDate) {
    selectedDate = new Date(initialDate);
    current = new Date(initialDate);
    collapse();
    if (onSelect) onSelect(selectedDate);
  } else {
    buildFull();
  }
}
