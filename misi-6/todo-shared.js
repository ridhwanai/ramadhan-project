(function () {
  const STORAGE_KEY = "ramadhan_todo_v1";
  const JAKARTA_TIMEZONE = "Asia/Jakarta";
  const PRAYER_KEYS = ["subuh", "dzuhur", "ashar", "maghrib", "isya"];

  const DZIKIR_SCHEMA_VERSION = 2;
  const DZIKIR_FIXED_ITEMS = [
    { id: "subhanallah", text: "Subhanallah" },
    { id: "alhamdulillah", text: "Alhamdulillah" },
    { id: "allahu_akbar", text: "Allahu Akbar" },
    { id: "la_ilaha_illallah", text: "La ilaha illallah" },
    { id: "astaghfirullah", text: "Astaghfirullah" },
  ];

  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function toNonNegativeNumber(value, fallback = 0) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return fallback;
    }
    return numeric;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getValidRamadanDay(value) {
    const day = Number.parseInt(value, 10);
    if (!Number.isInteger(day) || day < 1 || day > 30) {
      return null;
    }
    return day;
  }

  function normalizeDzikirText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function createEmptyState() {
    return {
      settings: {
        ramadanDayOverride: null,
        dzikirSchemaVersion: DZIKIR_SCHEMA_VERSION,
        dzikirCustomTemplates: [],
      },
      shalatByDate: {},
      quranByDate: {},
      puasa: {
        checkedDays: Array(30).fill(false),
      },
      dzikirByDate: {},
    };
  }

  function normalizeShalatEntry(rawEntry) {
    const entry = {};
    PRAYER_KEYS.forEach((key) => {
      entry[key] = Boolean(rawEntry?.[key]);
    });
    return entry;
  }

  function normalizeQuranEntry(rawEntry) {
    return {
      target: toNonNegativeNumber(rawEntry?.target, 0),
      read: toNonNegativeNumber(rawEntry?.read, 0),
      done: Boolean(rawEntry?.done),
    };
  }

  function normalizeDzikirTemplate(rawTemplate) {
    const id = typeof rawTemplate?.id === "string" ? rawTemplate.id.trim() : "";
    const text = normalizeDzikirText(rawTemplate?.text);

    if (!id || !text) {
      return null;
    }

    return {
      id,
      text,
    };
  }

  function normalizeDzikirTemplates(rawTemplates) {
    if (!Array.isArray(rawTemplates)) {
      return [];
    }

    const templates = [];
    const idSet = new Set();
    const textSet = new Set();

    rawTemplates.forEach((rawTemplate) => {
      const template = normalizeDzikirTemplate(rawTemplate);
      if (!template) {
        return;
      }

      const textKey = template.text.toLowerCase();
      if (idSet.has(template.id) || textSet.has(textKey)) {
        return;
      }

      idSet.add(template.id);
      textSet.add(textKey);
      templates.push(template);
    });

    return templates;
  }

  function normalizeDzikirEntry(rawEntry) {
    const rawIds = Array.isArray(rawEntry?.checkedItemIds) ? rawEntry.checkedItemIds : [];
    const checkedItemIds = [];
    const idSet = new Set();

    rawIds.forEach((rawId) => {
      if (typeof rawId !== "string") {
        return;
      }

      const itemId = rawId.trim();
      if (!itemId || idSet.has(itemId)) {
        return;
      }

      idSet.add(itemId);
      checkedItemIds.push(itemId);
    });

    return { checkedItemIds };
  }

  function normalizeCheckedDays(rawDays) {
    const days = Array(30).fill(false);
    if (!Array.isArray(rawDays)) {
      return days;
    }

    for (let i = 0; i < 30; i += 1) {
      days[i] = Boolean(rawDays[i]);
    }

    return days;
  }

  function normalizeState(rawState) {
    const empty = createEmptyState();
    if (!isPlainObject(rawState)) {
      return empty;
    }

    const normalized = createEmptyState();

    const overrideDay = getValidRamadanDay(rawState.settings?.ramadanDayOverride);
    normalized.settings.ramadanDayOverride = overrideDay;

    const rawSchemaVersion = Number.parseInt(rawState.settings?.dzikirSchemaVersion, 10);
    normalized.settings.dzikirSchemaVersion = Number.isInteger(rawSchemaVersion)
      ? rawSchemaVersion
      : 1;

    normalized.settings.dzikirCustomTemplates = normalizeDzikirTemplates(
      rawState.settings?.dzikirCustomTemplates
    );

    if (isPlainObject(rawState.shalatByDate)) {
      Object.entries(rawState.shalatByDate).forEach(([dateKey, entry]) => {
        normalized.shalatByDate[dateKey] = normalizeShalatEntry(entry);
      });
    }

    if (isPlainObject(rawState.quranByDate)) {
      Object.entries(rawState.quranByDate).forEach(([dateKey, entry]) => {
        normalized.quranByDate[dateKey] = normalizeQuranEntry(entry);
      });
    }

    normalized.puasa.checkedDays = normalizeCheckedDays(rawState.puasa?.checkedDays);

    if (isPlainObject(rawState.dzikirByDate)) {
      Object.entries(rawState.dzikirByDate).forEach(([dateKey, entry]) => {
        normalized.dzikirByDate[dateKey] = normalizeDzikirEntry(entry);
      });
    }

    return normalized;
  }

  function cloneState(state) {
    return JSON.parse(JSON.stringify(normalizeState(state)));
  }

  function getDzikirValidIdSet(customTemplates = []) {
    const validIds = new Set(DZIKIR_FIXED_ITEMS.map((item) => item.id));
    normalizeDzikirTemplates(customTemplates).forEach((template) => {
      validIds.add(template.id);
    });
    return validIds;
  }

  function sanitizeDzikirCheckedIds(checkedItemIds, dzikirItems) {
    const rawIds = Array.isArray(checkedItemIds) ? checkedItemIds : [];
    const validIds = new Set(
      Array.isArray(dzikirItems)
        ? dzikirItems.map((item) => item.id)
        : DZIKIR_FIXED_ITEMS.map((item) => item.id)
    );
    const filtered = [];
    const used = new Set();

    rawIds.forEach((rawId) => {
      if (typeof rawId !== "string") {
        return;
      }
      const id = rawId.trim();
      if (!id || used.has(id) || !validIds.has(id)) {
        return;
      }
      used.add(id);
      filtered.push(id);
    });

    return filtered;
  }

  function sanitizeDzikirDomain(normalizedState) {
    const state = normalizeState(normalizedState);
    let changed = false;

    const customTemplates = normalizeDzikirTemplates(state.settings.dzikirCustomTemplates);
    if (JSON.stringify(customTemplates) !== JSON.stringify(state.settings.dzikirCustomTemplates)) {
      state.settings.dzikirCustomTemplates = customTemplates;
      changed = true;
    }

    const validIdSet = getDzikirValidIdSet(state.settings.dzikirCustomTemplates);

    Object.entries(state.dzikirByDate).forEach(([dateKey, entry]) => {
      const cleanEntry = normalizeDzikirEntry(entry);
      const filtered = cleanEntry.checkedItemIds.filter((id) => validIdSet.has(id));
      if (filtered.length !== cleanEntry.checkedItemIds.length) {
        changed = true;
      }
      state.dzikirByDate[dateKey] = { checkedItemIds: filtered };
    });

    return { state, changed };
  }

  function migrateDzikirSchema(state) {
    const normalized = normalizeState(state);

    if (normalized.settings.dzikirSchemaVersion !== DZIKIR_SCHEMA_VERSION) {
      normalized.settings.dzikirSchemaVersion = DZIKIR_SCHEMA_VERSION;
      normalized.settings.dzikirCustomTemplates = [];
      normalized.dzikirByDate = {};
      return { state: normalizeState(normalized), changed: true };
    }

    const sanitized = sanitizeDzikirDomain(normalized);
    return {
      state: sanitized.state,
      changed: sanitized.changed,
    };
  }

  function loadState() {
    try {
      const rawText = window.localStorage.getItem(STORAGE_KEY);
      if (!rawText) {
        return createEmptyState();
      }

      const parsed = JSON.parse(rawText);
      const migration = migrateDzikirSchema(parsed);

      if (migration.changed) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migration.state));
      }

      return migration.state;
    } catch (error) {
      console.warn("Ramadhan Todo: failed to load localStorage state.", error);
      return createEmptyState();
    }
  }

  function saveState(state) {
    const migrated = migrateDzikirSchema(state).state;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    } catch (error) {
      console.warn("Ramadhan Todo: failed to save localStorage state.", error);
    }
    return migrated;
  }

  function emitStateChanged(state) {
    window.dispatchEvent(
      new CustomEvent("ramadhan:state-changed", {
        detail: {
          state: cloneState(state),
        },
      })
    );
  }

  function commitState(mutator) {
    const state = loadState();
    mutator(state);
    const saved = saveState(state);
    emitStateChanged(saved);
    return saved;
  }

  function getJakartaDateKey(date = new Date()) {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: JAKARTA_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const parts = formatter.formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    if (!year || !month || !day) {
      return "1970-01-01";
    }
    return `${year}-${month}-${day}`;
  }

  function getReadableJakartaDate(date = new Date()) {
    const formatter = new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: JAKARTA_TIMEZONE,
    });
    return formatter.format(date);
  }

  function getAutoRamadanDay(date = new Date()) {
    try {
      const formatter = new Intl.DateTimeFormat("en-US-u-ca-islamic", {
        month: "numeric",
        day: "numeric",
        timeZone: JAKARTA_TIMEZONE,
      });
      const parts = formatter.formatToParts(date);
      const month = Number.parseInt(
        parts.find((part) => part.type === "month")?.value || "",
        10
      );
      const day = Number.parseInt(
        parts.find((part) => part.type === "day")?.value || "",
        10
      );
      if (month === 9 && day >= 1 && day <= 30) {
        return day;
      }
      return null;
    } catch {
      return null;
    }
  }

  function getEffectiveRamadanDay(state, date = new Date()) {
    const normalized = normalizeState(state);
    const autoDay = getAutoRamadanDay(date);
    const overrideDay = getValidRamadanDay(normalized.settings.ramadanDayOverride);

    if (overrideDay !== null) {
      return {
        day: overrideDay,
        source: "override",
        autoDay,
      };
    }

    if (autoDay !== null) {
      return {
        day: autoDay,
        source: "auto",
        autoDay,
      };
    }

    return {
      day: 1,
      source: "fallback",
      autoDay,
    };
  }

  function getShalatEntry(state, dateKey = getJakartaDateKey()) {
    const normalized = normalizeState(state);
    return normalizeShalatEntry(normalized.shalatByDate[dateKey]);
  }

  function getQuranEntry(state, dateKey = getJakartaDateKey()) {
    const normalized = normalizeState(state);
    return normalizeQuranEntry(normalized.quranByDate[dateKey]);
  }

  function getDzikirCustomTemplates(state) {
    const migrated = migrateDzikirSchema(state).state;
    return normalizeDzikirTemplates(migrated.settings.dzikirCustomTemplates);
  }

  function getDzikirItems(state) {
    const fixedItems = DZIKIR_FIXED_ITEMS.map((item) => ({
      id: item.id,
      text: item.text,
      isFixed: true,
    }));
    const customItems = getDzikirCustomTemplates(state).map((item) => ({
      id: item.id,
      text: item.text,
      isFixed: false,
    }));
    return fixedItems.concat(customItems);
  }

  function getDzikirEntry(state, dateKey = getJakartaDateKey()) {
    const migrated = migrateDzikirSchema(state).state;
    const dzikirItems = getDzikirItems(migrated);
    const cleanEntry = normalizeDzikirEntry(migrated.dzikirByDate[dateKey]);
    return {
      checkedItemIds: sanitizeDzikirCheckedIds(cleanEntry.checkedItemIds, dzikirItems),
    };
  }

  function getPuasaCheckedDays(state) {
    const normalized = normalizeState(state);
    return normalizeCheckedDays(normalized.puasa.checkedDays);
  }

  function calculateShalatProgress(entry) {
    const cleanEntry = normalizeShalatEntry(entry);
    const completed = PRAYER_KEYS.reduce(
      (total, prayerKey) => total + (cleanEntry[prayerKey] ? 1 : 0),
      0
    );
    return (completed / PRAYER_KEYS.length) * 100;
  }

  function calculateQuranProgress(entry) {
    const cleanEntry = normalizeQuranEntry(entry);
    if (cleanEntry.done) {
      return 100;
    }
    if (cleanEntry.target <= 0) {
      return 0;
    }
    return clamp((cleanEntry.read / cleanEntry.target) * 100, 0, 100);
  }

  function calculatePuasaProgressFromDays(checkedDays) {
    const days = normalizeCheckedDays(checkedDays);
    const completed = days.filter(Boolean).length;
    return (completed / 30) * 100;
  }

  function calculatePuasaProgress(state) {
    return calculatePuasaProgressFromDays(getPuasaCheckedDays(state));
  }

  function calculateDzikirProgress(entry, dzikirItems = DZIKIR_FIXED_ITEMS) {
    const cleanEntry = normalizeDzikirEntry(entry);
    const totalItems =
      Array.isArray(dzikirItems) && dzikirItems.length > 0
        ? dzikirItems.length
        : DZIKIR_FIXED_ITEMS.length;

    if (totalItems <= 0) {
      return 0;
    }

    const checkedCount = sanitizeDzikirCheckedIds(cleanEntry.checkedItemIds, dzikirItems).length;
    return clamp((checkedCount / totalItems) * 100, 0, 100);
  }

  function calculateGlobalProgress(state, dateKey = getJakartaDateKey()) {
    const migrated = migrateDzikirSchema(state).state;
    const shalat = calculateShalatProgress(getShalatEntry(migrated, dateKey));
    const quran = calculateQuranProgress(getQuranEntry(migrated, dateKey));
    const puasa = calculatePuasaProgress(migrated);

    const dzikirItems = getDzikirItems(migrated);
    const dzikirEntry = getDzikirEntry(migrated, dateKey);
    const dzikir = calculateDzikirProgress(dzikirEntry, dzikirItems);

    const average = (shalat + quran + puasa + dzikir) / 4;

    return {
      average,
      parts: {
        shalat,
        quran,
        puasa,
        dzikir,
      },
    };
  }

  function getShalatStatus(progressValue) {
    const progress = clamp(progressValue, 0, 100);
    if (progress >= 100) {
      return "MasyaAllah lengkap!";
    }
    if (progress > 40) {
      return "Cukup baik";
    }
    return "Belum optimal";
  }

  function getQuranStatus(progressValue) {
    const progress = clamp(progressValue, 0, 100);
    if (progress >= 100) {
      return "Target tercapai";
    }
    if (progress >= 50) {
      return "Hampir selesai";
    }
    return "Masih bisa ditambah";
  }

  function getPuasaStatus(progressValue) {
    const progress = clamp(progressValue, 0, 100);
    if (progress >= 100) {
      return "MasyaAllah puasa penuh!";
    }
    if (progress >= 70) {
      return "Konsisten, lanjutkan";
    }
    if (progress > 0) {
      return "Semangat, teruskan";
    }
    return "Belum mulai";
  }

  function getDzikirStatus(progressValue) {
    return getShalatStatus(progressValue);
  }

  function getGlobalMotivation(progressValue) {
    const progress = clamp(progressValue, 0, 100);
    if (progress >= 100) {
      return "MasyaAllah konsisten!";
    }
    if (progress > 80) {
      return "Sangat baik, pertahankan";
    }
    if (progress > 40) {
      return "Cukup baik, lanjutkan";
    }
    return "Belum optimal, ayo ditingkatkan";
  }

  function formatPercent(progressValue) {
    return `${Math.round(clamp(progressValue, 0, 100))}%`;
  }

  function updateGlobalSummary(root = document, providedState = null) {
    const state = providedState ? migrateDzikirSchema(providedState).state : loadState();
    const todayKey = getJakartaDateKey();
    const summary = calculateGlobalProgress(state, todayKey);
    const progressText = formatPercent(summary.average);
    const motivationText = getGlobalMotivation(summary.average);

    root.querySelectorAll("[data-global-progress]").forEach((node) => {
      node.textContent = progressText;
    });

    root.querySelectorAll("[data-global-motivation]").forEach((node) => {
      node.textContent = motivationText;
    });

    root.querySelectorAll("[data-global-progress-bar]").forEach((node) => {
      node.style.width = progressText;
    });

    root.querySelectorAll("[data-today-date]").forEach((node) => {
      node.textContent = getReadableJakartaDate();
    });

    return summary;
  }

  function initTabs(currentTab) {
    document.querySelectorAll("[data-todo-tab]").forEach((link) => {
      const isActive = link.dataset.todoTab === currentTab;
      link.classList.toggle("is-active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function initPage({ currentTab }) {
    initTabs(currentTab);
    updateGlobalSummary(document, loadState());

    window.addEventListener("ramadhan:state-changed", (event) => {
      const eventState = event.detail?.state ?? loadState();
      updateGlobalSummary(document, eventState);
    });
  }

  function showToast(message, duration = 1600, kind = "normal") {
    const toastEl = document.getElementById("todoToast");
    if (!toastEl) {
      return;
    }

    toastEl.textContent = message;
    toastEl.classList.remove("is-success");
    if (kind === "success") {
      toastEl.classList.add("is-success");
    }
    toastEl.classList.add("show");

    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => {
      toastEl.classList.remove("show");
      window.setTimeout(() => toastEl.classList.remove("is-success"), 180);
    }, duration);
  }

  function createDzikirCustomTemplate(text) {
    const normalizedText = normalizeDzikirText(text);
    const id = `dzikir_custom_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 7)}`;

    return {
      id,
      text: normalizedText,
    };
  }

  function hasDuplicateDzikirTemplateText(templates, text, ignoredId = null) {
    const normalizedText = normalizeDzikirText(text).toLowerCase();
    if (!normalizedText) {
      return false;
    }

    return normalizeDzikirTemplates(templates).some((template) => {
      if (ignoredId && template.id === ignoredId) {
        return false;
      }
      return template.text.toLowerCase() === normalizedText;
    });
  }

  function purgeDzikirItemFromAllDays(state, itemId) {
    if (!isPlainObject(state) || typeof itemId !== "string" || !itemId.trim()) {
      return;
    }

    Object.entries(state.dzikirByDate || {}).forEach(([dateKey, entry]) => {
      const cleanEntry = normalizeDzikirEntry(entry);
      state.dzikirByDate[dateKey] = {
        checkedItemIds: cleanEntry.checkedItemIds.filter((id) => id !== itemId),
      };
    });
  }

  window.RamadhanTodo = {
    STORAGE_KEY,
    PRAYER_KEYS,
    DZIKIR_SCHEMA_VERSION,
    DZIKIR_FIXED_ITEMS,
    clamp,
    loadState,
    saveState,
    cloneState,
    commitState,
    normalizeDzikirText,
    createDzikirCustomTemplate,
    hasDuplicateDzikirTemplateText,
    sanitizeDzikirCheckedIds,
    purgeDzikirItemFromAllDays,
    getValidRamadanDay,
    getJakartaDateKey,
    getReadableJakartaDate,
    getAutoRamadanDay,
    getEffectiveRamadanDay,
    getShalatEntry,
    getQuranEntry,
    getPuasaCheckedDays,
    getDzikirEntry,
    getDzikirItems,
    getDzikirCustomTemplates,
    calculateShalatProgress,
    calculateQuranProgress,
    calculatePuasaProgress,
    calculatePuasaProgressFromDays,
    calculateDzikirProgress,
    calculateGlobalProgress,
    getShalatStatus,
    getQuranStatus,
    getPuasaStatus,
    getDzikirStatus,
    getGlobalMotivation,
    formatPercent,
    updateGlobalSummary,
    initPage,
    showToast,
  };
})();
