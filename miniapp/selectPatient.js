import { openConfirmAppointment } from "./confirmAppointment.js";

import { getSelectedSlotObject } from "./createVisit.js";

let searchTimeout = null;

export function openSelectPatient(onSelect) {

  const overlay = document.createElement("div");
  overlay.id = "patientOverlay";
  overlay.className = "patient-overlay";

  overlay.innerHTML = `
    <div class="patient-container">

      <div class="patient-header">
        <div class="patient-title">Выбор пациента</div>
        <div class="patient-close" id="closePatient">✕</div>
      </div>

      <div class="patient-search-block">
        <input 
          type="text"
          id="patientSearchInput"
          placeholder="Фамилия или номер телефона"
          autocomplete="off"
        />
      </div>

      <div id="patientResults" class="patient-results"></div>

      <div class="patient-bottom">
        <button class="primary-btn" id="addNewPatientBtn">
          Новый пациент
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(overlay);

  // закрытие
  document
    .getElementById("closePatient")
    .addEventListener("click", () => overlay.remove());

  // поле поиска
  const input = document.getElementById("patientSearchInput");

  input.addEventListener("input", (e) => {
    const value = e.target.value.trim();
    handleSearch(value, onSelect);
  });
}

/* ================================
   SEARCH LOGIC
================================ */

function handleSearch(value, onSelect) {

  clearTimeout(searchTimeout);

  const resultsContainer = document.getElementById("patientResults");

  if (!value) {
    resultsContainer.innerHTML = "";
    return;
  }

  // если ввод цифр → телефон
  if (/^[\d+\s()-]+$/.test(value)) {

    const normalized = normalizePhone(value);

    // поиск только когда номер полностью введён
    if (normalized.length === 11) {
      searchPatients({ mobile: normalized }, onSelect);
    }

    return;
  }

  // если русские буквы → фамилия
  if (/^[А-Яа-яЁё]+$/.test(value)) {

    if (value.length < 3) return;

    searchTimeout = setTimeout(() => {
      searchPatients({ last_name: value }, onSelect);
    }, 400);
  }
}

/* ================================
   NORMALIZE PHONE
================================ */

function normalizePhone(phone) {

  let digits = phone.replace(/\D/g, "");

  if (digits.startsWith("8")) {
    return "7" + digits.slice(1);
  }

  if (digits.startsWith("7")) {
    return digits;
  }

  return digits;
}

/* ================================
   API REQUEST
================================ */

let lastSearchTime = 0;

async function searchPatients(params, onSelect, retry = false) {

  const resultsContainer = document.getElementById("patientResults");

  const now = Date.now();

  // защита от частых запросов (1 запрос в секунду)
  if (now - lastSearchTime < 1000) {
    return;
  }

  lastSearchTime = now;

  resultsContainer.innerHTML = `
    <div class="loader">
      <div class="spinner"></div>
    </div>
  `;

  try {

    const response = await fetch("/api/mis/get-patient", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params)
    });

    // если сервер вернул HTML (502)
    const text = await response.text();

    if (!response.ok || text.startsWith("<!DOCTYPE")) {

      if (!retry) {
        console.log("🔁 Retry searchPatients...");
        setTimeout(() => {
          searchPatients(params, onSelect, true);
        }, 1100);
        return;
      }

      resultsContainer.innerHTML = "Ошибка поиска";
      return;
    }

const data = JSON.parse(text);

if (data.error !== 0) {
  resultsContainer.innerHTML = "Ошибка поиска";
  return;
}

let patients = data.data || [];

if (!Array.isArray(patients)) {
  patients = [patients];
}

renderResults(patients, onSelect);

  } catch (err) {

    if (!retry) {
      console.log("🔁 Retry after network error...");
      setTimeout(() => {
        searchPatients(params, onSelect, true);
      }, 1100);
      return;
    }

    resultsContainer.innerHTML = "Ошибка соединения";
  }
}


/* ================================
   RENDER RESULTS
================================ */

function renderResults(patients, onSelect) {

  const container = document.getElementById("patientResults");

  if (!patients.length) {
    container.innerHTML = `
      <div class="empty-state">
        Пациент не найден
      </div>
    `;
    return;
  }

  container.innerHTML = patients.map(p => {

    const fio = [
      p.last_name,
      p.first_name,
      p.third_name
    ].filter(Boolean).join(" ");

    return `
      <div class="patient-card" data-id="${p.patient_id}">
        <div class="patient-name">${fio || "Без имени"}</div>
        <div class="patient-birth">
          ${p.birth_date || "Дата рождения не указана"}
        </div>
      </div>
    `;

  }).join("");

  const input = document.getElementById("patientSearchInput");
  if (input) input.blur();

  
container.querySelectorAll(".patient-card")
  .forEach(el => {

    el.addEventListener("click", () => {

      const id = el.dataset.id;

      const patient = patients.find(p =>
        String(p.patient_id) === String(id)
      );

      document.querySelector(".patient-overlay")?.remove();

      const slot = getSelectedSlotObject();

      openConfirmAppointment(patient, slot);

    });

  });


}
