export function renderCalendar(container, onSelect) {

  let current = new Date();
  current.setDate(1);

  const today = new Date();
  today.setHours(0,0,0,0);

  let touchStartX = 0;
  let touchEndX = 0;

  function build(year, month) {
    container.innerHTML = "";

    const header = document.createElement("div");
    header.className = "cal-header";

    const title = document.createElement("div");
    title.className = "cal-title";
    title.innerText =
      new Date(year, month)
        .toLocaleString("ru-RU", { month: "long", year: "numeric" });

    header.appendChild(title);
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
      grid.appendChild(document.createElement("div"));
    }

    for (let d=1; d<=daysInMonth; d++){
      const date = new Date(year, month, d);
      date.setHours(0,0,0,0);

      const btn = document.createElement("button");
      btn.className = "cal-day";
      btn.innerText = d;

      const dayOfWeek = date.getDay();

      if (date >= today) {
        if (dayOfWeek === 6) btn.classList.add("saturday");
        if (dayOfWeek === 0) btn.classList.add("sunday");
      }

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

  function nextMonth() {
    current.setMonth(current.getMonth() + 1);
    build(current.getFullYear(), current.getMonth());
  }

  function prevMonth() {
    const test = new Date(current);
    test.setMonth(test.getMonth() - 1);

    if (test < new Date(today.getFullYear(), today.getMonth(), 1)) return;

    current.setMonth(current.getMonth() - 1);
    build(current.getFullYear(), current.getMonth());
  }

  container.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].screenX;
  });

  container.addEventListener("touchend", (e) => {
    touchEndX = e.changedTouches[0].screenX;
    const delta = touchEndX - touchStartX;

    if (delta < -50) nextMonth();
    if (delta > 50) prevMonth();
  });

  build(current.getFullYear(), current.getMonth());
}
