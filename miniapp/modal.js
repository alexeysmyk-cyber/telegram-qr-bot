export function openVisitModal(slot) {

  const existing = document.getElementById("visitModalOverlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "visitModalOverlay";
  overlay.className = "modal-overlay";

  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-header">
        <div class="modal-time">
          ${slot.time_start.split(" ")[1]} – ${slot.time_end.split(" ")[1]}
        </div>
        <div class="modal-name">
          ${slot.patient_name}
        </div>
      </div>

      <div class="modal-actions">
        <button data-action="visit">Просмотреть визит</button>
        <button data-action="patient">Информация о пациенте</button>
        <button data-action="move">Перенести визит</button>
        <button data-action="cancel" class="danger">Отменить визит</button>
      </div>

      <button class="modal-close">Закрыть</button>
    </div>
  `;

  document.body.appendChild(overlay);

  setTimeout(() => overlay.classList.add("open"), 10);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });

  overlay.querySelector(".modal-close")
    .addEventListener("click", closeModal);

  overlay.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", () => {
      console.log("Action:", btn.dataset.action, "Visit ID:", slot.id);
      closeModal();
    });
  });

  function closeModal() {
    overlay.classList.remove("open");
    setTimeout(() => overlay.remove(), 250);
  }
}
