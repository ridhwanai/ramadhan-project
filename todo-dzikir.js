(function () {
  const app = window.RamadhanTodo;
  if (!app) {
    console.warn("To-Do Dzikir: shared module belum dimuat.");
    return;
  }

  app.initPage({ currentTab: "dzikir" });

  const checklistEl = document.getElementById("dzikirChecklist");
  const openModalBtn = document.getElementById("dzikirOpenModalBtn");
  const modalEl = document.getElementById("dzikirModal");
  const modalInputsEl = document.getElementById("dzikirModalInputs");
  const modalSaveBtn = document.getElementById("dzikirModalSaveBtn");
  const modalCloseBtn = document.getElementById("dzikirModalCloseBtn");
  const progressTextEl = document.getElementById("dzikirProgressText");
  const progressBarEl = document.getElementById("dzikirProgressBar");
  const statusEl = document.getElementById("dzikirStatus");
  const saveBtn = document.getElementById("dzikirSaveBtn");

  const hasRequiredDom =
    checklistEl &&
    openModalBtn &&
    modalEl &&
    modalInputsEl &&
    modalSaveBtn &&
    modalCloseBtn &&
    progressTextEl &&
    progressBarEl &&
    statusEl &&
    saveBtn;

  if (!hasRequiredDom) {
    console.warn("To-Do Dzikir: elemen DOM wajib tidak lengkap.");
    return;
  }

  const todayKey = app.getJakartaDateKey();
  const fixedItems = app.DZIKIR_FIXED_ITEMS.map((item) => ({
    id: item.id,
    text: item.text,
    isFixed: true,
  }));

  let state = app.loadState();
  let draftTemplates = app.getDzikirCustomTemplates(state);
  let draftEntry = app.getDzikirEntry(state, todayKey);
  let pendingCustomTexts = [""];
  let isModalOpen = false;

  function getAllItems() {
    const customItems = draftTemplates.map((template) => ({
      id: template.id,
      text: template.text,
      isFixed: false,
    }));
    return fixedItems.concat(customItems);
  }

  function isChecked(itemId) {
    return draftEntry.checkedItemIds.includes(itemId);
  }

  function setChecked(itemId, checked) {
    const idSet = new Set(draftEntry.checkedItemIds);
    if (checked) {
      idSet.add(itemId);
    } else {
      idSet.delete(itemId);
    }
    draftEntry.checkedItemIds = app.sanitizeDzikirCheckedIds(Array.from(idSet), getAllItems());
  }

  function removeCustomItem(itemId) {
    draftTemplates = draftTemplates.filter((template) => template.id !== itemId);
    draftEntry.checkedItemIds = draftEntry.checkedItemIds.filter((checkedId) => checkedId !== itemId);
  }

  function validateCustomText(text, ignoredId = null) {
    const normalizedText = app.normalizeDzikirText(text);
    if (!normalizedText) {
      return { ok: false, message: "Teks dzikir custom tidak boleh kosong." };
    }

    const fixedDuplicate = fixedItems.some(
      (item) => item.text.toLowerCase() === normalizedText.toLowerCase()
    );
    if (fixedDuplicate) {
      return { ok: false, message: "Item dzikir sudah ada di daftar tetap." };
    }

    const customDuplicate = app.hasDuplicateDzikirTemplateText(
      draftTemplates,
      normalizedText,
      ignoredId
    );
    if (customDuplicate) {
      return { ok: false, message: "Item dzikir custom duplikat." };
    }

    return { ok: true, text: normalizedText };
  }

  function ensurePendingTrailingInput() {
    if (pendingCustomTexts.length === 0) {
      pendingCustomTexts = [""];
      return;
    }

    const lastText = app.normalizeDzikirText(pendingCustomTexts[pendingCustomTexts.length - 1]);
    if (lastText.length > 0) {
      pendingCustomTexts.push("");
    }

    while (pendingCustomTexts.length > 1) {
      const last = app.normalizeDzikirText(pendingCustomTexts[pendingCustomTexts.length - 1]);
      const beforeLast = app.normalizeDzikirText(
        pendingCustomTexts[pendingCustomTexts.length - 2]
      );
      if (!last && !beforeLast) {
        pendingCustomTexts.pop();
      } else {
        break;
      }
    }
  }

  function buildModalInput(index, value) {
    const row = document.createElement("div");
    row.className = "todo-modal__row";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "todo-input";
    input.dataset.customDraftIndex = String(index);
    input.placeholder = `Dzikir custom #${index + 1}`;
    input.value = value;

    row.appendChild(input);
    return row;
  }

  function renderModalInputs() {
    modalInputsEl.innerHTML = "";
    pendingCustomTexts.forEach((value, index) => {
      modalInputsEl.appendChild(buildModalInput(index, value));
    });
  }

  function resetModalDraft() {
    pendingCustomTexts = [""];
    ensurePendingTrailingInput();
    renderModalInputs();
  }

  function openModal() {
    isModalOpen = true;
    resetModalDraft();
    modalEl.hidden = false;
    document.body.classList.add("todo-modal-open");

    const firstInput = modalInputsEl.querySelector("input");
    if (firstInput instanceof HTMLInputElement) {
      firstInput.focus();
    }
  }

  function closeModal() {
    isModalOpen = false;
    modalEl.hidden = true;
    document.body.classList.remove("todo-modal-open");
    resetModalDraft();
    openModalBtn.focus();
  }

  function appendPendingCustomItems() {
    const normalizedInputs = pendingCustomTexts
      .map((rawText) => app.normalizeDzikirText(rawText))
      .filter(Boolean);

    if (normalizedInputs.length === 0) {
      return { added: 0, skipped: 0 };
    }

    const seenText = new Set();
    let added = 0;
    let skipped = 0;

    normalizedInputs.forEach((text) => {
      const key = text.toLowerCase();
      if (seenText.has(key)) {
        skipped += 1;
        return;
      }
      seenText.add(key);

      const validation = validateCustomText(text);
      if (!validation.ok) {
        skipped += 1;
        return;
      }

      const template = app.createDzikirCustomTemplate(validation.text);
      draftTemplates = draftTemplates.concat(template);
      added += 1;
    });

    return { added, skipped };
  }

  function updateCustomItemText(itemId, nextTextRaw) {
    const validation = validateCustomText(nextTextRaw, itemId);
    if (!validation.ok) {
      app.showToast(validation.message);
      render();
      return;
    }

    draftTemplates = draftTemplates.map((template) => {
      if (template.id !== itemId) {
        return template;
      }
      return {
        ...template,
        text: validation.text,
      };
    });

    render();
  }

  function buildChecklistItem(item) {
    const row = document.createElement("div");
    row.className = "todo-checklist__item";
    row.classList.toggle("is-checked", isChecked(item.id));
    row.dataset.itemRow = "true";
    row.dataset.itemId = item.id;
    if (!item.isFixed) {
      row.classList.add("todo-checklist__item--custom");
    }

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "todo-checkbox-native";
    checkbox.checked = isChecked(item.id);
    checkbox.dataset.itemCheckbox = "true";
    checkbox.dataset.itemId = item.id;
    checkbox.id = `dzikir_item_${item.id}`;
    row.appendChild(checkbox);

    const iconLabel = document.createElement("label");
    iconLabel.className = "todo-check-icon";
    iconLabel.setAttribute("for", checkbox.id);
    iconLabel.setAttribute("aria-label", `Toggle item dzikir ${item.text}`);
    const iconClass = isChecked(item.id) ? "fa-check-double" : "fa-check";
    iconLabel.innerHTML = `<i class="fa-solid ${iconClass} todo-check-icon__glyph" aria-hidden="true"></i>`;
    row.appendChild(iconLabel);

    if (item.isFixed) {
      const label = document.createElement("label");
      label.className = "todo-checklist__text";
      label.setAttribute("for", checkbox.id);
      label.textContent = item.text;
      row.appendChild(label);
      return row;
    }

    const textInput = document.createElement("input");
    textInput.type = "text";
    textInput.className = "todo-input todo-input--inline";
    textInput.value = item.text;
    textInput.dataset.customTextInput = "true";
    textInput.dataset.itemId = item.id;
    textInput.setAttribute("aria-label", `Teks dzikir custom ${item.text}`);
    row.appendChild(textInput);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "todo-btn todo-btn--danger todo-btn--mini";
    deleteBtn.dataset.customDeleteBtn = "true";
    deleteBtn.dataset.itemId = item.id;
    deleteBtn.textContent = "Hapus";
    row.appendChild(deleteBtn);

    return row;
  }

  function renderChecklist() {
    checklistEl.innerHTML = "";
    const items = getAllItems();
    items.forEach((item) => {
      checklistEl.appendChild(buildChecklistItem(item));
    });
  }

  function renderProgress() {
    const items = getAllItems();
    draftEntry.checkedItemIds = app.sanitizeDzikirCheckedIds(draftEntry.checkedItemIds, items);

    const checkedCount = draftEntry.checkedItemIds.length;
    const totalCount = items.length;
    const progress = app.calculateDzikirProgress(draftEntry, items);
    const progressPercent = app.formatPercent(progress);

    progressTextEl.textContent = `${progressPercent} (${checkedCount}/${totalCount})`;
    progressBarEl.style.width = progressPercent;
    statusEl.textContent = app.getDzikirStatus(progress);

    const previewState = app.cloneState(state);
    previewState.settings.dzikirSchemaVersion = app.DZIKIR_SCHEMA_VERSION;
    previewState.settings.dzikirCustomTemplates = draftTemplates.map((template) => ({
      id: template.id,
      text: template.text,
    }));
    previewState.dzikirByDate[todayKey] = {
      checkedItemIds: draftEntry.checkedItemIds.slice(),
    };

    app.updateGlobalSummary(document, previewState);
  }

  function render() {
    renderChecklist();
    renderProgress();
  }

  openModalBtn.addEventListener("click", openModal);
  modalCloseBtn.addEventListener("click", closeModal);

  modalEl.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    if (target.matches("[data-dzikir-modal-close]")) {
      closeModal();
    }
  });

  modalInputsEl.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    if (!target.matches("[data-custom-draft-index]")) {
      return;
    }

    const index = Number.parseInt(target.dataset.customDraftIndex || "", 10);
    if (!Number.isInteger(index) || index < 0 || index >= pendingCustomTexts.length) {
      return;
    }

    pendingCustomTexts[index] = target.value;

    const isLast = index === pendingCustomTexts.length - 1;
    if (isLast && app.normalizeDzikirText(target.value)) {
      pendingCustomTexts.push("");
      modalInputsEl.appendChild(buildModalInput(pendingCustomTexts.length - 1, ""));
      return;
    }

    const oldLength = pendingCustomTexts.length;
    ensurePendingTrailingInput();
    if (oldLength !== pendingCustomTexts.length) {
      renderModalInputs();
    }
  });

  modalSaveBtn.addEventListener("click", () => {
    const result = appendPendingCustomItems();

    if (result.added === 0 && result.skipped === 0) {
      app.showToast("Isi minimal satu dzikir sebelum menyimpan.");
      return;
    }

    closeModal();
    render();

    if (result.added > 0 && result.skipped > 0) {
      app.showToast(`${result.added} dzikir ditambah, ${result.skipped} input dilewati.`);
      return;
    }

    if (result.added > 0) {
      app.showToast(`${result.added} dzikir custom masuk ke checklist.`, 1700, "success");
      return;
    }

    app.showToast("Input custom duplikat/invalid, tidak ada yang ditambahkan.");
  });

  checklistEl.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.matches("[data-item-checkbox]")) {
      const itemId = target.dataset.itemId;
      if (!itemId) {
        return;
      }
      setChecked(itemId, target.checked);
      render();
      return;
    }

    if (target.matches("[data-custom-text-input]")) {
      const itemId = target.dataset.itemId;
      if (!itemId) {
        return;
      }
      updateCustomItemText(itemId, target.value);
    }
  });

  checklistEl.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (!target.matches("[data-custom-delete-btn]")) {
      const row = target.closest("[data-item-row]");
      if (!row) {
        return;
      }

      if (
        target.closest("label") ||
        target.matches("[data-item-checkbox]") ||
        target.matches("[data-custom-text-input]") ||
        target.closest("[data-custom-text-input]") ||
        target.closest("button")
      ) {
        return;
      }

      const rowItemId = row.dataset.itemId;
      if (!rowItemId) {
        return;
      }

      setChecked(rowItemId, !isChecked(rowItemId));
      render();
      return;
    }

    const itemId = target.dataset.itemId;
    if (!itemId) {
      return;
    }

    removeCustomItem(itemId);
    render();
    app.showToast("Item dzikir custom dihapus.");
  });

  saveBtn.addEventListener("click", () => {
    const allItems = getAllItems();
    const validIds = new Set(allItems.map((item) => item.id));
    draftEntry.checkedItemIds = draftEntry.checkedItemIds.filter((id) => validIds.has(id));

    state = app.commitState((nextState) => {
      nextState.settings.dzikirSchemaVersion = app.DZIKIR_SCHEMA_VERSION;
      nextState.settings.dzikirCustomTemplates = draftTemplates.map((template) => ({
        id: template.id,
        text: template.text,
      }));

      const keepIds = new Set(
        fixedItems.map((item) => item.id).concat(draftTemplates.map((template) => template.id))
      );

      Object.entries(nextState.dzikirByDate).forEach(([dateKey, entry]) => {
        const checkedItemIds = app
          .sanitizeDzikirCheckedIds(entry?.checkedItemIds || [], getAllItems())
          .filter((id) => keepIds.has(id));
        nextState.dzikirByDate[dateKey] = { checkedItemIds };
      });

      nextState.dzikirByDate[todayKey] = {
        checkedItemIds: draftEntry.checkedItemIds.slice(),
      };
    });

    draftTemplates = app.getDzikirCustomTemplates(state);
    draftEntry = app.getDzikirEntry(state, todayKey);
    render();
    app.showToast("Checklist dzikir berhasil disimpan.", 1650, "success");
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isModalOpen) {
      closeModal();
    }
  });

  window.addEventListener("ramadhan:state-changed", (event) => {
    state = app.cloneState(event.detail?.state ?? app.loadState());
  });

  render();
})();
