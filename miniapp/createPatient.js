import { openConfirmAppointment } from "./confirmAppointment.js";
import { getSelectedSlotObject } from "./createVisit.js";

export function openCreatePatient() {

  const overlay = document.createElement("div");
  overlay.className = "patient-overlay";

  overlay.innerHTML = `
    <div class="patient-container">

      <div class="patient-header">
        <div class="patient-title">Новый пациент</div>
        <div class="patient-close" id="closeCreatePatient">✕</div>
      </div>

      <div class="patient-search-block">

        <input
          type="text"
          id="lastName"
          placeholder="Фамилия *"
          autocomplete="off"
        />

        <input
          type="text"
          id="firstName"
          placeholder="Имя *"
          autocomplete="off"
          style="margin-top:12px;"
        />

        <input
          type="text"
          id="thirdName"
          placeholder="Отчество"
          autocomplete="off"
          style="margin-top:12px;"
        />

        <input
          type="date"
          id="birthDate"
          placeholder="Дата рождения"
          style="margin-top:12px;"
        />

        <input
          type="tel"
          id="phone"
          placeholder="+7 (___) ___ __-__"
          style="margin-top:12px;"
        />

      </div>

      <div class="patient-bottom">
        <button class="primary-btn" id="createPatientNext" disabled>
          Далее
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(overlay);

  const lastName = document.getElementById("lastName");
  const firstName = document.getElementById("firstName");
  const phone = document.getElementById("phone");
  const nextBtn = document.getElementById("createPatientNext");

  document
    .getElementById("closeCreatePatient")
    .addEventListener("click", () => overlay.remove());

  // ==============================
  // ВАЛИДАЦИЯ
  // ==============================

  function validate() {

    const valid =
      lastName.value.trim().length > 0 &&
      firstName.value.trim().length > 0;

    nextBtn.disabled = !valid;
  }

  lastName.addEventListener("input", validate);
  firstName.addEventListener("input", validate);

  // ==============================
  // МАСКА ТЕЛЕФОНА
  // ==============================

  phone.addEventListener("input", (e) => {
    let digits = e.target.value.replace(/\D/g, "");

    if (digits.startsWith("8")) {
      digits = "7" + digits.slice(1);
    }

    if (!digits.startsWith("7")) {
      digits = "7" + digits;
    }

    digits = digits.substring(0, 11);

    const formatted = digits.replace(
      /(\d)(\d{3})(\d{3})(\d{2})(\d{0,2})/,
      "+$1 ($2) $3 $4-$5"
    );

    e.target.value = formatted;
  });

  // ==============================
  // КНОПКА ДАЛЕЕ
  // ==============================

  nextBtn.addEventListener("click", () => {

    const slot = getSelectedSlotObject();
    if (!slot) return;

    const patient = {
      isNew: true,
      last_name: lastName.value.trim(),
      first_name: firstName.value.trim(),
      third_name: document.getElementById("thirdName").value.trim(),
      birth_date: document.getElementById("birthDate").value,
      mobile: phone.value
    };

    overlay.remove();

    openConfirmAppointment(patient, slot);

  });

}
