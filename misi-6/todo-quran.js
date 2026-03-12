(function () {
  const app = window.RamadhanTodo;
  if (!app) {
    console.warn("To-Do Quran: shared module belum dimuat.");
    return;
  }

  app.initPage({ currentTab: "quran" });

  const targetInput = document.getElementById("quranTarget");
  const readInput = document.getElementById("quranRead");
  const doneInput = document.getElementById("quranDone");
  const doneRow = doneInput ? doneInput.closest(".todo-check-inline") : null;
  const progressTextEl = document.getElementById("quranProgressText");
  const progressBarEl = document.getElementById("quranProgressBar");
  const statusEl = document.getElementById("quranStatus");
  const saveBtn = document.getElementById("quranSaveBtn");

  const hasRequiredDom =
    targetInput &&
    readInput &&
    doneInput &&
    progressTextEl &&
    progressBarEl &&
    statusEl &&
    saveBtn;

  if (!hasRequiredDom) {
    console.warn("To-Do Quran: elemen DOM wajib tidak lengkap.");
    return;
  }

  const todayKey = app.getJakartaDateKey();
  let state = app.loadState();
  let draftEntry = app.getQuranEntry(state, todayKey);

  function syncDoneRowState() {
    if (!doneRow) {
      return;
    }
    const isChecked = Boolean(doneInput.checked);
    doneRow.classList.toggle("is-checked", isChecked);

    const icon = doneRow.querySelector(".todo-check-icon__glyph");
    if (icon) {
      icon.classList.toggle("fa-check", !isChecked);
      icon.classList.toggle("fa-check-double", isChecked);
    }
  }

  function toInputNumber(value, fallback = 0) {
    const numeric = Number.parseInt(value, 10);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return fallback;
    }
    return numeric;
  }

  function readEntryFromUi() {
    return {
      target: toInputNumber(targetInput.value, 0),
      read: toInputNumber(readInput.value, 0),
      done: Boolean(doneInput.checked),
    };
  }

  function syncUiWithEntry() {
    targetInput.value = draftEntry.target > 0 ? String(draftEntry.target) : "";
    readInput.value = draftEntry.read > 0 ? String(draftEntry.read) : "";
    doneInput.checked = Boolean(draftEntry.done);
    syncDoneRowState();
  }

  function render() {
    syncDoneRowState();

    const progress = app.calculateQuranProgress(draftEntry);
    const progressText = app.formatPercent(progress);

    progressTextEl.textContent = progressText;
    progressBarEl.style.width = progressText;
    statusEl.textContent = app.getQuranStatus(progress);

    const previewState = app.cloneState(state);
    previewState.quranByDate[todayKey] = { ...draftEntry };
    app.updateGlobalSummary(document, previewState);
  }

  function handleInputChange() {
    draftEntry = readEntryFromUi();
    render();
  }

  targetInput.addEventListener("input", handleInputChange);
  readInput.addEventListener("input", handleInputChange);
  doneInput.addEventListener("change", handleInputChange);

  saveBtn.addEventListener("click", () => {
    draftEntry = readEntryFromUi();
    state = app.commitState((nextState) => {
      nextState.quranByDate[todayKey] = { ...draftEntry };
    });

    app.showToast("Progress baca Qur'an berhasil disimpan.", 1650, "success");
    render();
  });

  window.addEventListener("ramadhan:state-changed", (event) => {
    state = app.cloneState(event.detail?.state ?? app.loadState());
  });

  syncUiWithEntry();
  render();
})();
