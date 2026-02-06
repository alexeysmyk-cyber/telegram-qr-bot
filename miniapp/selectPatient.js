let searchTimeout = null;
let lastQuery = "";

export function openSelectPatient(onSelect) {

  const overlay = document.createElement("div");
  overlay.id = "patientOverlay";
  overlay.className = "patient-overlay";

  overlay.innerHTML = `...`;

  document.body.appendChild(overlay);

  document
    .getElementById("closePatient")
    .addEventListener("click", () => overlay.remove());

  const input = document.getElementById("patientSearchInput");

  input.addEventListener("input", (e) => {
    const value = e.target.value.trim();
    handleSearch(value, onSelect);
  });
}



function handleSearch(value, onSelect) {

  clearTimeout(searchTimeout);

  if (!value) {
    renderResults([]);
    return;
  }

  // если цифры → телефон
  if (/^[\d+\s()-]+$/.test(value)) {

    const normalized = normalizePhone(value);

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
function normalizePhone(phone) {

  let digits = phone.replace(/\D/g, "");

  if (digits.startsWith("7")) return digits;
  if (digits.startsWith("8")) return "7" + digits.slice(1);

  return digits;
}
async function searchPatients(params, onSelect) {

  const resultsContainer = document.getElementById("patientResults");

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

    const data = await response.json();

    if (!response.ok || data.error !== 0) {
      resultsContainer.innerHTML = "Ошибка поиска";
      return;
    }

    renderResults(data.data || [], onSelect);

  } catch {
    resultsContainer.innerHTML = "Ошибка соединения";
  }
}
function renderResults(patients, onSelect) {

  const container = document.getElementById("patientResults");

  if (!patients.length) {
    container.innerHTML = `
      <div class="empty-state">
        Пациент не найден<br/>
        <span class="link-text">Добавить нового</span>
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

  container.querySelectorAll(".patient-card")
    .forEach(el => {

      el.addEventListener("click", () => {

        const id = el.dataset.id;
        const patient = patients.find(p =>
          String(p.patient_id) === String(id)
        );

        document.getElementById("patientOverlay")?.remove();

        if (onSelect) onSelect(patient);
      });

    });
}
