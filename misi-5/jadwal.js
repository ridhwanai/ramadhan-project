(function () {
  const API_CITY_LIST = "https://api.myquran.com/v2/sholat/kota/semua";
  const API_SCHEDULE_BASE = "https://api.myquran.com/v2/sholat/jadwal";
  const JAKARTA_TZ = "Asia/Jakarta";
  const STORAGE_CITY_KEY = "ramadhan_misi5_selected_city";
  const FALLBACK_CITIES = [
    { id: "1301", lokasi: "KOTA JAKARTA" },
    { id: "1219", lokasi: "KOTA BANDUNG" },
    { id: "1638", lokasi: "KOTA SURABAYA" },
  ];

  const citySearch = document.getElementById("citySearch");
  const citySelect = document.getElementById("citySelect");
  const controlsForm = document.getElementById("controlsForm");
  const refreshBtn = document.getElementById("refreshBtn");
  const statusMessage = document.getElementById("statusMessage");
  const monthLabel = document.getElementById("monthLabel");
  const heroCity = document.getElementById("heroCity");
  const todayLabel = document.getElementById("todayLabel");
  const locationLabel = document.getElementById("locationLabel");
  const scheduleBody = document.getElementById("scheduleBody");

  if (
    !citySearch ||
    !citySelect ||
    !controlsForm ||
    !refreshBtn ||
    !statusMessage ||
    !monthLabel ||
    !heroCity ||
    !todayLabel ||
    !locationLabel ||
    !scheduleBody
  ) {
    console.warn("Misi 5: elemen penting tidak lengkap.");
    return;
  }

  const state = {
    cities: [],
    filteredCities: [],
    selectedCityId: "1301",
  };

  let scheduleAbortController = null;

  function getJakartaDateParts(date = new Date()) {
    const datePartsFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: JAKARTA_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const verboseFormatter = new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: JAKARTA_TZ,
    });

    const parts = datePartsFormatter.formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value || "1970";
    const month = parts.find((part) => part.type === "month")?.value || "01";
    const day = parts.find((part) => part.type === "day")?.value || "01";

    return {
      year,
      month,
      day,
      dateKey: `${year}-${month}-${day}`,
      todayLabel: verboseFormatter.format(date),
    };
  }

  function renderMonthLabel(year, month) {
    const dateValue = new Date(`${year}-${month}-01T00:00:00+07:00`);
    const formatter = new Intl.DateTimeFormat("id-ID", {
      month: "long",
      year: "numeric",
      timeZone: JAKARTA_TZ,
    });
    monthLabel.textContent = formatter.format(dateValue);
  }

  function setStatus(kind, text) {
    statusMessage.classList.remove(
      "hidden",
      "imsak-status--loading",
      "imsak-status--error",
      "imsak-status--success"
    );

    if (kind === "error") {
      statusMessage.classList.add("imsak-status--error");
    } else if (kind === "success") {
      statusMessage.classList.add("imsak-status--success");
    } else {
      statusMessage.classList.add("imsak-status--loading");
    }

    statusMessage.textContent = text;
  }

  function hideStatus() {
    statusMessage.classList.add("hidden");
  }

  function renderEmptyRow(text) {
    scheduleBody.innerHTML = "";

    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 7;
    cell.className = "imsak-table-empty";
    cell.textContent = text;
    row.appendChild(cell);
    scheduleBody.appendChild(row);
  }

  function appendCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = String(value || "-");
    row.appendChild(cell);
  }

  function getTanggalLabel(item) {
    const tanggal = typeof item?.tanggal === "string" ? item.tanggal.trim() : "";
    if (tanggal) {
      return tanggal;
    }

    const date = typeof item?.date === "string" ? item.date.trim() : "";
    return date || "-";
  }

  function renderScheduleRows(rows, todayKey) {
    scheduleBody.innerHTML = "";
    if (!Array.isArray(rows) || rows.length === 0) {
      renderEmptyRow("Data jadwal tidak tersedia untuk kota ini.");
      return;
    }

    const fragment = document.createDocumentFragment();
    rows.forEach((item) => {
      const row = document.createElement("tr");
      if (String(item?.date || "").trim() === todayKey) {
        row.classList.add("is-today");
      }

      appendCell(row, getTanggalLabel(item));
      appendCell(row, item?.imsak);
      appendCell(row, item?.subuh);
      appendCell(row, item?.dzuhur);
      appendCell(row, item?.ashar);
      appendCell(row, item?.maghrib);
      appendCell(row, item?.isya);

      fragment.appendChild(row);
    });

    scheduleBody.appendChild(fragment);
  }

  function normalizeCityItem(rawItem) {
    const id = String(rawItem?.id || "").trim();
    const lokasi = String(rawItem?.lokasi || "").trim();
    if (!id || !lokasi) {
      return null;
    }
    return { id, lokasi };
  }

  function normalizeSearchText(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/\./g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function readSavedCityId() {
    try {
      return String(window.localStorage.getItem(STORAGE_CITY_KEY) || "").trim();
    } catch {
      return "";
    }
  }

  function saveCityId(cityId) {
    try {
      window.localStorage.setItem(STORAGE_CITY_KEY, String(cityId));
    } catch {
      // Ignore storage failures on private mode / quota issues.
    }
  }

  function findCityById(cities, cityId) {
    return cities.find((city) => city.id === cityId) || null;
  }

  function renderCityOptions(cities, preferredId = "") {
    citySelect.innerHTML = "";

    if (!Array.isArray(cities) || cities.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Kota tidak ditemukan.";
      citySelect.appendChild(option);
      citySelect.disabled = true;
      refreshBtn.disabled = true;
      return;
    }

    cities.forEach((city) => {
      const option = document.createElement("option");
      option.value = city.id;
      option.textContent = city.lokasi;
      citySelect.appendChild(option);
    });

    const selectedId = findCityById(cities, preferredId) ? preferredId : cities[0].id;
    citySelect.value = selectedId;
    state.selectedCityId = selectedId;
    citySelect.disabled = false;
    refreshBtn.disabled = false;
  }

  function updateHeroCityLabel(cityId, fallbackText = "-") {
    const city = findCityById(state.cities, cityId);
    heroCity.textContent = city ? city.lokasi : fallbackText;
  }

  function applyCityFilter() {
    const query = normalizeSearchText(citySearch.value);
    const previousSelectedId = state.selectedCityId;

    if (!query) {
      state.filteredCities = state.cities.slice();
      renderCityOptions(state.filteredCities, state.selectedCityId);
      hideStatus();
      return;
    }

    state.filteredCities = state.cities.filter((city) =>
      normalizeSearchText(city.lokasi).includes(query)
    );

    renderCityOptions(state.filteredCities, state.selectedCityId);

    if (state.filteredCities.length === 0) {
      setStatus("error", "Kota tidak ditemukan. Coba kata kunci lain.");
      return;
    }

    if (state.selectedCityId && state.selectedCityId !== previousSelectedId) {
      loadSchedule(state.selectedCityId, true);
      return;
    }

    setStatus("success", `Ditemukan ${state.filteredCities.length} kota.`);
  }

  async function fetchCityList() {
    const response = await fetch(API_CITY_LIST);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    if (!payload?.status || !Array.isArray(payload.data)) {
      throw new Error("Payload daftar kota tidak valid.");
    }

    const normalized = payload.data
      .map(normalizeCityItem)
      .filter(Boolean)
      .sort((a, b) => a.lokasi.localeCompare(b.lokasi, "id-ID"));

    if (normalized.length === 0) {
      throw new Error("Daftar kota kosong.");
    }

    return normalized;
  }

  async function loadSchedule(cityId, showLoading = true) {
    const cleanCityId = String(cityId || "").trim();
    if (!cleanCityId) {
      renderEmptyRow("Pilih kota untuk menampilkan jadwal.");
      return;
    }

    if (scheduleAbortController) {
      scheduleAbortController.abort();
    }
    scheduleAbortController = new AbortController();

    const now = getJakartaDateParts();
    renderMonthLabel(now.year, now.month);
    todayLabel.textContent = now.todayLabel;
    state.selectedCityId = cleanCityId;
    saveCityId(cleanCityId);
    updateHeroCityLabel(cleanCityId, "Kota belum dipilih");

    if (showLoading) {
      setStatus("loading", "Memuat data jadwal...");
      renderEmptyRow("Memuat data jadwal imsakiyah...");
    }

    const endpoint = `${API_SCHEDULE_BASE}/${encodeURIComponent(cleanCityId)}/${now.year}/${now.month}`;

    try {
      const response = await fetch(endpoint, { signal: scheduleAbortController.signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      const jadwal = payload?.data?.jadwal;
      if (!payload?.status || !Array.isArray(jadwal)) {
        throw new Error("Payload jadwal tidak valid.");
      }

      const lokasi = String(payload?.data?.lokasi || "Lokasi tidak diketahui");
      const daerah = String(payload?.data?.daerah || "").trim();
      const fullLocation = daerah ? `${lokasi}, ${daerah}` : lokasi;

      locationLabel.textContent = `${fullLocation} | Hari ini: ${now.todayLabel}`;
      heroCity.textContent = lokasi;
      renderScheduleRows(jadwal, now.dateKey);
      setStatus("success", `Berhasil memuat ${jadwal.length} jadwal untuk ${lokasi}.`);
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }

      renderEmptyRow("Gagal memuat data. Silakan coba lagi.");
      locationLabel.textContent = "Data belum tersedia.";
      heroCity.textContent = "-";
      setStatus("error", "Gagal memuat data jadwal dari API.");
      console.error("Misi 5: gagal fetch jadwal.", error);
    }
  }

  async function init() {
    const now = getJakartaDateParts();
    renderMonthLabel(now.year, now.month);
    todayLabel.textContent = now.todayLabel;
    let useFallbackCities = false;

    citySelect.disabled = true;
    refreshBtn.disabled = true;
    setStatus("loading", "Memuat daftar kota...");

    try {
      state.cities = await fetchCityList();
    } catch (error) {
      console.error("Misi 5: gagal memuat daftar kota.", error);
      state.cities = FALLBACK_CITIES.slice();
      useFallbackCities = true;
      setStatus("error", "Gagal memuat daftar kota penuh. Menggunakan daftar kota dasar.");
    }

    const savedId = readSavedCityId();
    const preferredId = [savedId, state.selectedCityId, "1301", FALLBACK_CITIES[0].id].find((cityId) =>
      state.cities.some((city) => city.id === cityId)
    );

    state.selectedCityId = preferredId || state.cities[0]?.id || "";
    state.filteredCities = state.cities.slice();
    renderCityOptions(state.filteredCities, state.selectedCityId);

    if (!useFallbackCities) {
      hideStatus();
    }

    await loadSchedule(state.selectedCityId, false);
  }

  citySearch.addEventListener("input", () => {
    applyCityFilter();
  });

  controlsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (citySelect.value) {
      loadSchedule(citySelect.value, true);
    }
  });

  citySelect.addEventListener("change", () => {
    loadSchedule(citySelect.value, true);
  });

  refreshBtn.addEventListener("click", () => {
    loadSchedule(citySelect.value, true);
  });

  init();
})();
