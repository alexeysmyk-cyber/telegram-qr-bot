export function renderCalendar(container, onSelect) {

  let current = new Date();
  current.setDate(1);

  function build(year, month) {
    container.innerHTML = "";

    const today = new Date();
    today.setHours(0,0,0,0);

    const header = document.createElement("div");
    header.className = "cal-header";

    const prev = document.createElement("button");
    prev.innerHTML = "‹";
    prev.onclick = () => {
      current.setMonth(current.getMonth() - 1);
      build(current.getFullYear(), current.getMonth());
    };

    const next = document.createElement("button");
    next.innerHTML = "›";
    next.onclick = () => {
      current.setMonth(current.getMonth() + 1);
      build(current.getFullYear(), current.getMonth());
    };

    const title = document.createElement("div");
    title.className = "cal-title";
    title.innerText =
      current.toLocaleString("ru-RU", { month: "long", year: "numeric" });

    header.append(prev, title, next);
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
      const empty = document.createElement("div");
      grid.appendChild(empty);
    }

    for (let d=1; d<=daysInMonth; d++){
      const date = new Date(year, month, d);
      date.setHours(0,0,0,0);

      const btn = document.createElement("button");
      btn.className = "cal-day";
      btn.innerText = d;

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

  build(current.getFullYear(), current.getMonth());
}
