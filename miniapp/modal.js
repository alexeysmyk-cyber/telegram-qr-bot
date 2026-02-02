export function openVisitModal(slotData) {

  // Блокируем скролл (без дерганий)
  document.body.style.position = "fixed";
  document.body.style.width = "100%";

  // Overlay
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-handle"></div>

      <div class="modal-title">
        ${slotData.patient_name}
      </div>

      <div class="modal-time">
        ${slotData.time_start.split(" ")[1]} – ${slotData.time_end.split(" ")[1]}
      </div>

      <div class="modal-actions">
        <button class="modal-btn" data-action="visit">
          Просмотреть визит
        </button>

        <button class="modal-btn" data-action="patient">
          Просмотреть пациента
        </button>

        <button class="modal-btn danger" data-action="cancel">
          Отменить визит
        </button>

        <button class="modal-btn" data-action="move">
          Перенести визит
        </button>

        <button class="modal-btn secondary" data-action="close">
          Закрыть
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Анимация появления
  requestAnimationFrame(() => {
    overlay.classList.add("open");
    overlay.querySelector(".modal-sheet")
      .classList.add("open");
  });

  // Закрытие по клику вне sheet
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeModal(overlay);
    }
  });

  // Обработка кнопок
  overlay.querySelectorAll(".modal-btn").forEach(btn => {
    btn.addEventListener("click", () => {

      const action = btn.dataset.action;

      if (action === "close") {
        closeModal(overlay);
        return;
      }

      if (action === "visit") {
        alert("Просмотр визита (будет реализовано)");
      }

      if (action === "patient") {
        alert("Просмотр пациента (будет реализовано)");
      }

      if (action === "cancel") {
        alert("Отмена визита (будет реализовано)");
      }

      if (action === "move") {
        alert("Перенос визита (будет реализовано)");
      }

    });
  });

}



function closeModal(overlay) {

  overlay.classList.remove("open");
  overlay.querySelector(".modal-sheet")
    .classList.remove("open");

  setTimeout(() => {
    overlay.remove();

    // Возвращаем скролл
    document.body.style.position = "";
    document.body.style.width = "";

  }, 250);
}
