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

        <input type="text" id="lastName"
          placeholder="Фамилия *"
          autocomplete="off" />

        <input type="text" id="firstName"
          placeholder="Имя *"
          autocomplete="off"
          style="margin-top:12px;" />

        <input type="text" id="thirdName"
          placeholder="Отчество"
          autocomplete="off"
          style="margin-top:12px;" />

        <select id="gender"
          style="margin-top:12px;">
          <option value="">Пол</option>
          <option value="male">Мужской</option>
          <option value="female">Женский</option>
        </select>

        <input type="date"
          id="birthDate"
          style="margin-top:12px;" />

        <input type="tel"
          id="phone"
          placeholder="+7 (___) ___ __-__ *"
          style="margin-top:12px;" />

        <input type="email"
          id="email"
          placeholder="E-mail"
          style="margin-top:12px;" />

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
  const thirdName = document.getElementById("thirdName");
  const phone = document.getElementById("phone");
  const email = document.getElementById("email");
  const nextBtn = document.getElementById("createPatientNext");

  document
    .getElementById("closeCreatePatient")
    .addEventListener("click", () => overlay.remove());

  // ===============================
  // ВАЛИДАЦИЯ ФИО (только русские)
  // ===============================

  const fioRegex = /^[А-Яа-яЁё\-]+$/;

  function validateFio(input) {
    if (!input.value) return true;
    return fioRegex.test(input.value.trim());
  }

  // ===============================
  // ВАЛИДАЦИЯ EMAIL
  // ===============================

  function validateEmail(value) {
    if (!value) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  // ===============================
  // МАСКА ТЕЛЕФОНА
  // ===============================

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
    validateForm();
  });

  // ===============================
  // ОБЩАЯ ВАЛИДАЦИЯ
  // ===============================

  function validateForm() {

    const isLastValid =
      lastName.value.trim().length > 0 &&
      validateFio(lastName);

    const isFirstValid =
      firstName.value.trim().length > 0 &&
      validateFio(firstName);

    const isPhoneValid =
      phone.value.replace(/\D/g, "").length === 11;

    const isEmailValid = validateEmail(email.value.trim());

    toggleError(lastName, !validateFio(lastName));
    toggleError(firstName, !validateFio(firstName));
    toggleError(email, !isEmailValid);

    const formValid =
      isLastValid &&
      isFirstValid &&
      isPhoneValid &&
      isEmailValid;

    nextBtn.disabled = !formValid;
  }

  function toggleError(input, hasError) {
    input.classList.toggle("input-error", hasError);
  }

  lastName.addEventListener("input", validateForm);
  firstName.addEventListener("input", validateForm);
  thirdName.addEventListener("input", () => {
    toggleError(thirdName, !validateFio(thirdName));
  });
  email.addEventListener("input", validateForm);

  // ===============================
  // КНОПКА ДАЛЕЕ
  // ===============================

  nextBtn.addEventListener("click", () => {

    const slot = getSelectedSlotObject();
    if (!slot) return;

    const patient = {
      isNew: true,
      last_name: lastName.value.trim(),
      first_name: firstName.value.trim(),
      third_name: thirdName.value.trim(),
      gender: document.getElementById("gender").value,
      birth_date: document.getElementById("birthDate").value,
      mobile: phone.value,
      email: email.value.trim()
    };

    overlay.remove();
    openConfirmAppointment(patient, slot);

  });

}
