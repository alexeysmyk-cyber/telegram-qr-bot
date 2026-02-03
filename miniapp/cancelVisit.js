export function openCancelModal(visit) {

  const overlay = document.createElement("div");
  overlay.className = "visit-overlay";

  overlay.innerHTML = `
    <div class="visit-container cancel-container">

      <div class="visit-title-center" style="margin-bottom:20px;">
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

        <div class="visit-row right">
          <span>Врач:</span>
          <span>${visit.doctor || "—"}</span>
        </div>

        <div class="visit-row right">
          <span>Кабинет:</span>
          <span>${visit.room || "—"}</span>
        </div>

      </div>

      <div class="visit-card">

        <div style="margin-bottom:12px;font-weight:600;font-size:15px;">
          Причина отмены
        </div>

        <select id="cancelReasonSelect" class="cancel-select">
          <option value="" selected disabled hidden>
            Выберите причину
          </option>
          <option value="1">Дорого / Не устраивает цена</option>
          <option value="2">Другое</option>
          <option value="3">Думает / Перезвонит</option>
          <option value="4">Неявка</option>
          <option value="5">Передумал(а) / Нет необходимости</option>
        </select>

        <textarea 
          id="cancelComment"
          placeholder="Введите комментарий..."
          class="cancel-textarea"
        ></textarea>

      </div>

      <div class="visit-actions">
        <button class="secondary-btn pressable" id="closeCancelBtn">
          Назад
        </button>

        <button class="danger-btn pressable" id="confirmCancelBtn" disabled>
          Отменить визит
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(overlay);

// ===== DOM ELEMENTS =====
const reasonSelect = document.getElementById("cancelReasonSelect");
const commentInput = document.getElementById("cancelComment");
const confirmBtn = document.getElementById("confirmCancelBtn");
const closeBtn = document.getElementById("closeCancelBtn");

// ===== ERROR MESSAGE =====
let errorMessage = document.createElement("div");
errorMessage.className = "cancel-error";
reasonSelect.parentElement.appendChild(errorMessage);

// ===== INITIAL STATE =====
confirmBtn.disabled = true;
confirmBtn.classList.add("btn-disabled");
  
function validateCancelForm() {

  const reason = reasonSelect.value;
  const comment = commentInput.value.trim();

  if (!reason) {
    confirmBtn.disabled = true;
  } else if (reason === "2" && comment.length === 0) {
    // "Другое" требует комментарий
    confirmBtn.disabled = true;
  } else {
    confirmBtn.disabled = false;
  }

  confirmBtn.classList.toggle("btn-disabled", confirmBtn.disabled);
  confirmBtn.classList.toggle("btn-active", !confirmBtn.disabled);
}

reasonSelect.addEventListener("change", validateCancelForm);
commentInput.addEventListener("input", validateCancelForm);


  // ===============================
  // BUTTON EFFECT (визуальный отклик)
  // ===============================
 function addPressEffect(btn) {

  btn.addEventListener("touchstart", () => {
    if (btn.disabled) return;
    btn.style.transform = "scale(0.96)";
    btn.style.opacity = "0.9";
  });

  btn.addEventListener("touchend", () => {
    btn.style.transform = "";
    btn.style.opacity = "";
  });

  btn.addEventListener("mousedown", () => {
    if (btn.disabled) return;
    btn.style.transform = "scale(0.96)";
    btn.style.opacity = "0.9";
  });

  btn.addEventListener("mouseup", () => {
    btn.style.transform = "";
    btn.style.opacity = "";
  });
}

addPressEffect(confirmBtn);
addPressEffect(closeBtn);


  // ===============================
  // CLOSE
  // ===============================
  closeBtn.addEventListener("click", () => overlay.remove());

  // ===============================
  // CONFIRM CANCEL
  // ===============================
confirmBtn.addEventListener("click", async () => {

  const reason = reasonSelect.value;
  const comment = commentInput.value.trim();

  // ===== ВАЛИДАЦИЯ =====
  if (!reason) {
    showCancelError("Выберите причину отмены");
    reasonSelect.classList.add("input-error");
    return;
  }

  if (reason === "2" && comment.length === 0) {
    showCancelError("Укажите комментарий для причины 'Другое'");
    commentInput.classList.add("input-error");
    return;
  }

  clearCancelError();

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
    window.location.reload();

  } catch {
    showCancelError(
      "Визит не может быть отменён.\nВозможно он завершён или содержит неоплаченные услуги."
    );
  }
});

function showCancelError(text) {
  errorMessage.innerText = text;
  errorMessage.classList.add("visible");
}

function clearCancelError() {
  errorMessage.innerText = "";
  errorMessage.classList.remove("visible");
  reasonSelect.classList.remove("input-error");
  commentInput.classList.remove("input-error");
}

reasonSelect.addEventListener("change", clearCancelError);
commentInput.addEventListener("input", clearCancelError);

  

}
