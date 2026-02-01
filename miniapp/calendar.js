export function renderCalendar(container, onSelect) {

  let current = new Date();
  current.setHours(0,0,0,0);

  let selectedDate = null;
  let collapsed = false;

  function formatHeader(date) {
    const days = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
    const months = [
      "Января","Февраля","Марта","Апреля",
      "Мая","Июня","Июля","Августа",
      "Сентября","Октября","Ноября","Декабря"
    ];

    const dayName = days[date.getDay()];
    const dd = String(date.getDate()).padStart(2, "0");
    const monthName = months[date.getMonth()];
    const yyyy = date.getFullYear();

    return `${dayName}. ${dd}-${monthName}-${yyyy}`;
  }

  function buildFull() {

    container.innerHTML = "";
    collapsed = false;

    const header = document.createElement("div");
    header.className = "calendar-title";
    header.innerText = formatHeader(current);

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
    collapsed = true;

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

    prev.onclick = () => changeDay(-1);
    next.onclick = () => changeDay(1);

    wrapper.append(prev, title, next);
    container.appendChild(wrapper);
  }

  function changeDay(offset) {
    selectedDate.setDate(selectedDate.getDate() + offset);
    collapse();
    if (onSelect) onSelect(selectedDate);
  }

  buildFull();
}
