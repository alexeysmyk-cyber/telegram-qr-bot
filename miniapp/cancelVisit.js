export function openCancelModal(visit) {

  const overlay = document.createElement("div");
  overlay.className = "visit-overlay";

  overlay.innerHTML = `
    <div class="visit-container cancel-container">

      <div class="visit-title-center">
        Отмена визита
      </div>

      <div class="visit-card">

        <div class="visit-row right">
          <span>Пациент:</span>
          <span>${visit.patient_name}</span>
        </div>

        <div class="visit-row right">
          <span>Дата:</span>
          <span>${visit.time_start.split(" ")[0]}</span>
        </div>

        <div class="visit-row right">
          <span>Время:</span>
          <span>${visit.time_start.split(" ")[1]}</span>
        </div>

      </div>

      <div class="visit-card">

        <div style="margin-bottom:10px;font-weight:600;">
          Причина отмены
        </div>

        <select id="cancelReasonSelect" class="cancel-select">
          <option value="1">Дорого / Не устраивает цена</option>
          <option value="2">Другое</option>
          <option value="3">Думает / Перезвонит</option>
          <option value="4">Неявка</option>
          <option value="5">Передумал(а) / Нет необходимости</option>
        </select>

        <textarea id="cancelComment"
          placeholder="Комментарий (необязательно)"
          class="cancel-textarea"></textarea>

      </div>

      <div class="visit-actions">
        <button class="danger-btn" id="confirmCancelBtn">
          Отменить визит
        </button>
        <button class="secondary-btn" id="closeCancelBtn">
          Назад
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById("closeCancelBtn")
    .addEventListener("click", () => overlay.remove());

  document.getElementById("confirmCancelBtn")
    .addEventListener("click", async () => {

      const reason = document.getElementById("cancelReasonSelect").value;
      const comment = document.getElementById("cancelComment").value;

      try {

        const response = await fetch("/api/mis/cancel-appointment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appointment_id: visit.id,
            reason,
            comment
          })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error();
        }

        overlay.remove();
        window.location.reload(); // или refreshSchedule()

      } catch {
        alert("Визит не может быть отменён.\nВозможно он завершён или содержит неоплаченные услуги.");
      }

    });

}

