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

        <label>Фамилия *</label>
        <input type="text" id="newLastName" class="form-input" />

        <label>Имя *</label>
        <input type="text" id="newFirstName" class="form-input" />

        <label>Отчество</label>
        <input type="text" id="newThirdName" class="form-input" />

        <label>Пол</label>
        <select id="newGender" class="form-input">
          <option value="">Не указан</option>
          <option value="male">Мужской</option>
          <option value="female">Женский</option>
        </select>

        <label>Дата рождения</label>
        <input type="date" id="newBirthDate" class="form-input" />

        <label>Телефон *</label>
        <input type="tel" id="newPhone" class="form-input" placeholder="+7 (___) ___ __-__" />

        <label>Email</label>
        <input type="email" id="newEmail" class="form-input" />

      </div>

      <div class="patient-bottom">
        <button class="primary-btn" id="createPatientNext" disabled>
          Далее
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(overlay);

  const lastName = document.getElementById("newLastName");
  const firstName = document.getElementById("newFirstName");
  const thirdName = document.getElementById("newThirdName");
  const phone = document.getElementById("newPhone");
  const email = document.getElementById("newEmail");
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

    if (digits.length >= 1) {
      let formatted = "+" + digits[0];

      if (digits.length >= 4) {
        formatted += " (" + digits.slice(1, 4) + ")";
      }

      if (digits.length >= 7) {
        formatted += " " + digits.slice(4, 7);
      }

      if (digits.length >= 9) {
        formatted += " " + digits.slice(7, 9);
      }

      if (digits.length >= 11) {
        formatted += "-" + digits.slice(9, 11);
      }

      e.target.value = formatted;
    }

    validateForm();
  });

  // ===============================
  // ПРОВЕРКА ВОЗРАСТА
  // ===============================

  function capitalizeFio(value) {
  if (!value) return "";
  const trimmed = value.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}


  function isUnder18(dateString) {

    if (!dateString) return false;

    const birth = new Date(dateString);
    const today = new Date();

    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();

    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    return age < 18;
  }

  // ===============================
  // ОБЩАЯ ВАЛИДАЦИЯ
  // ===============================

  function toggleError(input, hasError) {
    input.classList.toggle("input-error", hasError);
  }

  function validateForm() {

    const isLastValid =
      lastName.value.trim().length > 0 &&
      validateFio(lastName);

    const isFirstValid =
      firstName.value.trim().length > 0 &&
      validateFio(firstName);

    const isPhoneValid =
      phone.value.replace(/\D/g, "").length === 11;

    const emailValue = email.value.trim();
    const isEmailValid =
      emailValue === "" || validateEmail(emailValue);

    toggleError(lastName, !validateFio(lastName));
    toggleError(firstName, !validateFio(firstName));
    toggleError(thirdName, thirdName.value && !validateFio(thirdName));
    toggleError(email, emailValue !== "" && !validateEmail(emailValue));

    const formValid =
      isLastValid &&
      isFirstValid &&
      isPhoneValid &&
      isEmailValid;

    nextBtn.disabled = !formValid;
  }

lastName.addEventListener("input", (e) => {
  e.target.value = capitalizeFio(e.target.value);
  validateForm();
});

firstName.addEventListener("input", (e) => {
  e.target.value = capitalizeFio(e.target.value);
  validateForm();
});

thirdName.addEventListener("input", (e) => {
  e.target.value = capitalizeFio(e.target.value);
  validateForm();
});

  email.addEventListener("input", validateForm);

  // ===============================
  // FORMAT HELPERS
  // ===============================

  function formatGender(gender) {
    if (gender === "male") return "М";
    if (gender === "female") return "Ж";
    return "—";
  }

  function formatBirthDate(dateString) {
    if (!dateString) return "—";

    const d = new Date(dateString);

    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();

    return `${dd}-${mm}-${yyyy}`;
  }

  // ===============================
  // КНОПКА ДАЛЕЕ
  // ===============================

  nextBtn.addEventListener("click", () => {

    const birthValue = document.getElementById("newBirthDate").value;
    const genderValue = document.getElementById("newGender").value;

    if (birthValue && isUnder18(birthValue)) {
      alert("Пациенту меньше 18 лет. Проверьте корректность данных.");
    }

    const slot = getSelectedSlotObject();
    if (!slot) return;

    const patient = {
      isNew: true,
      last_name: lastName.value.trim(),
      first_name: firstName.value.trim(),
      third_name: thirdName.value.trim(),
      gender: formatGender(genderValue),
      birth_date: formatBirthDate(birthValue),
      mobile: phone.value,
      email: email.value.trim()
    };

    overlay.remove();
    openConfirmAppointment(patient, slot);

  });

}
