(function () {
  const app = window.RamadhanTodo;
  if (!app) {
    console.warn("To-Do Shalat: shared module belum dimuat.");
    return;
  }

  app.initPage({ currentTab: "shalat" });

  const checkboxes = Array.from(document.querySelectorAll("[data-prayer]"));
  const progressTextEl = document.getElementById("shalatProgressText");
  const progressBarEl = document.getElementById("shalatProgressBar");
  const statusEl = document.getElementById("shalatStatus");
  const saveBtn = document.getElementById("shalatSaveBtn");

  const hasRequiredDom =
    checkboxes.length === app.PRAYER_KEYS.length &&
    progressTextEl &&
    progressBarEl &&
    statusEl &&
    saveBtn;

  if (!hasRequiredDom) {
    console.warn("To-Do Shalat: elemen DOM wajib tidak lengkap.");
    return;
  }

  const todayKey = app.getJakartaDateKey();
  let state = app.loadState();
  let draftEntry = app.getShalatEntry(state, todayKey);

  function syncChecklistVisualState() {
    checkboxes.forEach((checkbox) => {
      const row = checkbox.closest(".todo-checklist__item");
      if (!row) {
        return;
      }
      const isChecked = Boolean(checkbox.checked);
      row.classList.toggle("is-checked", isChecked);

      const icon = row.querySelector(".todo-check-icon__glyph");
      if (icon) {
        icon.classList.toggle("fa-check", !isChecked);
        icon.classList.toggle("fa-check-double", isChecked);
      }
    });
  }

  function readEntryFromUi() {
    const nextEntry = {};
    app.PRAYER_KEYS.forEach((prayerKey) => {
      nextEntry[prayerKey] = false;
    });

    checkboxes.forEach((checkbox) => {
      const prayerKey = checkbox.dataset.prayer;
      if (!prayerKey) {
        return;
      }
      nextEntry[prayerKey] = Boolean(checkbox.checked);
    });

    return nextEntry;
  }

  function syncUiWithEntry() {
    checkboxes.forEach((checkbox) => {
      const prayerKey = checkbox.dataset.prayer;
      checkbox.checked = Boolean(draftEntry[prayerKey]);
    });
    syncChecklistVisualState();
  }

  function render() {
    syncChecklistVisualState();

    const progress = app.calculateShalatProgress(draftEntry);
    const progressText = app.formatPercent(progress);

    progressTextEl.textContent = progressText;
    progressBarEl.style.width = progressText;
    statusEl.textContent = app.getShalatStatus(progress);

    const previewState = app.cloneState(state);
    previewState.shalatByDate[todayKey] = { ...draftEntry };
    app.updateGlobalSummary(document, previewState);
  }

  checkboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      draftEntry = readEntryFromUi();
      render();
    });
  });

  saveBtn.addEventListener("click", () => {
    draftEntry = readEntryFromUi();
    state = app.commitState((nextState) => {
      nextState.shalatByDate[todayKey] = { ...draftEntry };
    });

    app.showToast("Checklist shalat berhasil disimpan.", 1650, "success");
    render();
  });

  window.addEventListener("ramadhan:state-changed", (event) => {
    state = app.cloneState(event.detail?.state ?? app.loadState());
  });

  syncUiWithEntry();
  render();
})();
