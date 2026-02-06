let searchTimeout = null;
let lastQuery = "";

export function openSelectPatient(onSelect) {

  if (document.getElementById("patientOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "patientOverlay";
  overlay.className = "visit-overlay patient-overlay";

  overlay.innerHTML = `
    <div class="visit-container patient-container">

      <div class="create-header">
        <div class="create-title">Выбор пациента</div>
        <div class="create-close" id="closePatientBtn">←</div>
      </div>

      <div class="card">
        <input 
          type="text"
          id="patientSearchInput"
          placeholder="Фамилия или телефон"
          class="patient-search-input"
        />
      </div>

      <div class="patient-results" id="patientResults"></div>

      <div class="fixed-bottom">
        <button class="secondary-btn" id="newPatientBtn">
          Новый пациент
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById("closePatientBtn")
    .addEventListener("click", () => overlay.remove());

  document.getElementById("newPatientBtn")
    .addEventListener("click", () => {
      alert("Тут будет создание нового пациента");
    });

  const input = document.getElementById("patientSearchInput");

  input.addEventListener("input", (e) => {
    const value = e.target.value.trim();

    handleSearch(value, onSelect);
  });
}
