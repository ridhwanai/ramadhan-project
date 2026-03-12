(function () {
  const app = window.RamadhanTodo;
  if (!app) {
    console.warn("To-Do Puasa: shared module belum dimuat.");
    return;
  }

  app.initPage({ currentTab: "puasa" });

  const activeDayEl = document.getElementById("puasaActiveDay");
  const sourceEl = document.getElementById("puasaSource");
  const overrideInput = document.getElementById("ramadanDayOverride");
  const clearOverrideBtn = document.getElementById("clearOverrideBtn");
  const gregorianYearEl = document.getElementById("puasaGregorianYear");
  const hijriYearEl = document.getElementById("puasaHijriYear");
  const calendarEl = document.getElementById("puasaCalendar");
  const progressTextEl = document.getElementById("puasaProgressText");
  const progressBarEl = document.getElementById("puasaProgressBar");
  const statusEl = document.getElementById("puasaStatus");
  const saveBtn = document.getElementById("puasaSaveBtn");

  const hasRequiredDom =
    activeDayEl &&
    sourceEl &&
    overrideInput &&
    clearOverrideBtn &&
    gregorianYearEl &&
    hijriYearEl &&
    calendarEl &&
    progressTextEl &&
    progressBarEl &&
    statusEl &&
    saveBtn;

  if (!hasRequiredDom) {
    console.warn("To-Do Puasa: elemen DOM wajib tidak lengkap.");
    return;
  }

  const gregorianDateFormatter = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Jakarta",
  });

  const gregorianYearFormatter = new Intl.DateTimeFormat("id-ID", {
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });

  const hijriPartsFormatter = new Intl.DateTimeFormat("en-US-u-ca-islamic", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });

  let cachedHijriYear = null;
  let cachedRamadanMap = null;

  let state = app.loadState();
  let checkedDays = app.getPuasaCheckedDays(state);
  let overrideDay = app.getValidRamadanDay(state.settings?.ramadanDayOverride);

  function createPreviewState() {
    const previewState = app.cloneState(state);
    previewState.settings.ramadanDayOverride = overrideDay;
    previewState.puasa.checkedDays = checkedDays.slice();
    return previewState;
  }

  function getSourceMessage(dayInfo) {
    if (dayInfo.source === "override") {
      const autoText = dayInfo.autoDay === null ? "-" : String(dayInfo.autoDay);
      return `Override manual aktif. Auto hari ini: ${autoText}.`;
    }

    if (dayInfo.source === "auto") {
      return "Otomatis dari tanggal hari ini.";
    }

    return "Auto tidak valid. Fallback ke hari 1.";
  }

  function getHijriParts(date) {
    const parts = hijriPartsFormatter.formatToParts(date);
    const day = Number.parseInt(parts.find((part) => part.type === "day")?.value || "", 10);
    const month = Number.parseInt(parts.find((part) => part.type === "month")?.value || "", 10);
    const year = Number.parseInt(parts.find((part) => part.type === "year")?.value || "", 10);

    if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
      return null;
    }

    return { day, month, year };
  }

  function resolveTargetHijriYear() {
    const todayHijri = getHijriParts(new Date());
    if (!todayHijri) {
      return null;
    }

    if (todayHijri.month > 9) {
      return todayHijri.year + 1;
    }

    return todayHijri.year;
  }

  function buildRamadanDateMap(targetHijriYear) {
    const dateMap = new Map();
    if (!targetHijriYear) {
      return dateMap;
    }

    const start = new Date();
    start.setUTCDate(start.getUTCDate() - 550);

    for (let i = 0; i < 1200 && dateMap.size < 30; i += 1) {
      const candidate = new Date(start.getTime() + i * 86400000);
      const hijri = getHijriParts(candidate);
      if (!hijri) {
        continue;
      }

      const isTargetRamadanDay =
        hijri.year === targetHijriYear &&
        hijri.month === 9 &&
        hijri.day >= 1 &&
        hijri.day <= 30;

      if (!isTargetRamadanDay || dateMap.has(hijri.day)) {
        continue;
      }

      dateMap.set(hijri.day, candidate);
    }

    return dateMap;
  }

  function getRamadanDateMap(targetHijriYear) {
    if (!targetHijriYear) {
      return new Map();
    }

    if (cachedHijriYear === targetHijriYear && cachedRamadanMap) {
      return cachedRamadanMap;
    }

    cachedHijriYear = targetHijriYear;
    cachedRamadanMap = buildRamadanDateMap(targetHijriYear);
    return cachedRamadanMap;
  }

  function getCalendarYearInfo() {
    const targetHijriYear = resolveTargetHijriYear();
    const dateMap = getRamadanDateMap(targetHijriYear);

    const gregorianYearSet = new Set();
    dateMap.forEach((date) => {
      gregorianYearSet.add(gregorianYearFormatter.format(date));
    });

    const gregorianYearText =
      gregorianYearSet.size > 0
        ? Array.from(gregorianYearSet).join("/")
        : gregorianYearFormatter.format(new Date());

    return {
      hijriYearText: targetHijriYear ? `${targetHijriYear} H` : "-",
      gregorianYearText,
      dateMap,
    };
  }

  function formatGregorianDate(date) {
    if (!(date instanceof Date)) {
      return "--/--";
    }
    return gregorianDateFormatter.format(date);
  }

  function renderCalendar(activeDay, dateMap) {
    calendarEl.innerHTML = "";

    for (let day = 1; day <= 30; day += 1) {
      const isDone = Boolean(checkedDays[day - 1]);
      const isActiveDay = day === activeDay;
      const gregorianDateText = formatGregorianDate(dateMap.get(day));

      const button = document.createElement("button");
      button.type = "button";
      button.className = "todo-day";
      button.classList.toggle("is-done", isDone);
      button.classList.toggle("is-active", isActiveDay);
      button.classList.toggle("is-locked", !isActiveDay);
      button.disabled = !isActiveDay;
      button.setAttribute(
        "aria-label",
        `Hari ${day} (${gregorianDateText}) ${isDone ? "sudah puasa" : "belum puasa"}`
      );

      button.innerHTML = `
        <span class="todo-day__greg">${gregorianDateText}</span>
        <span class="todo-day__ramadan">${day}</span>
        ${
          isDone
            ? '<span class="todo-day__check" aria-hidden="true"><i class="fa-solid fa-check-double"></i></span>'
            : ""
        }
      `;

      if (isActiveDay) {
        button.addEventListener("click", () => {
          checkedDays[day - 1] = !checkedDays[day - 1];
          render();
        });
      }

      calendarEl.appendChild(button);
    }
  }

  function render() {
    const previewState = createPreviewState();
    const dayInfo = app.getEffectiveRamadanDay(previewState);
    const yearInfo = getCalendarYearInfo();

    activeDayEl.textContent = `Hari ${dayInfo.day}`;
    sourceEl.textContent = getSourceMessage(dayInfo);
    gregorianYearEl.textContent = yearInfo.gregorianYearText;
    hijriYearEl.textContent = yearInfo.hijriYearText;
    overrideInput.value = overrideDay === null ? "" : String(overrideDay);
    renderCalendar(dayInfo.day, yearInfo.dateMap);

    const progress = app.calculatePuasaProgressFromDays(checkedDays);
    const completedDays = checkedDays.filter(Boolean).length;
    const progressText = `${app.formatPercent(progress)} (${completedDays}/30)`;
    progressTextEl.textContent = progressText;
    progressBarEl.style.width = app.formatPercent(progress);
    statusEl.textContent = app.getPuasaStatus(progress);

    app.updateGlobalSummary(document, previewState);
  }

  overrideInput.addEventListener("input", () => {
    const value = overrideInput.value.trim();
    if (!value) {
      overrideDay = null;
      render();
      return;
    }

    const parsedDay = app.getValidRamadanDay(value);
    if (parsedDay !== null) {
      overrideDay = parsedDay;
      render();
    }
  });

  overrideInput.addEventListener("blur", () => {
    const value = overrideInput.value.trim();
    if (!value) {
      return;
    }
    if (app.getValidRamadanDay(value) === null) {
      app.showToast("Hari override harus antara 1 sampai 30.");
      overrideInput.value = overrideDay === null ? "" : String(overrideDay);
    }
  });

  clearOverrideBtn.addEventListener("click", () => {
    overrideDay = null;
    render();
    app.showToast("Mode otomatis diaktifkan kembali.");
  });

  saveBtn.addEventListener("click", () => {
    state = app.commitState((nextState) => {
      nextState.settings.ramadanDayOverride = overrideDay;
      nextState.puasa.checkedDays = checkedDays.slice();
    });

    app.showToast("Progress puasa berhasil disimpan.", 1650, "success");
    render();
  });

  window.addEventListener("ramadhan:state-changed", (event) => {
    state = app.cloneState(event.detail?.state ?? app.loadState());
  });

  render();
})();
