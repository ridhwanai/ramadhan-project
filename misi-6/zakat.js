const $ = (selector) => document.querySelector(selector);

const GOLD_PRICE_PROXY_URL =
  "https://api.codetabs.com/v1/proxy/?quest=https://r.jina.ai/http://www.logammulia.com/id/harga-emas-hari-ini";
const GOLD_SOURCE_NAME = "Logam Mulia (Antam)";
const GOLD_CACHE_KEY = "zakatGoldPriceCacheV1";

const els = {
  zakatType: $("#zakatType"),
  zakatForm: $("#zakatForm"),
  formPenghasilan: $("#formPenghasilan"),
  formEmas: $("#formEmas"),
  hargaEmas: $("#hargaEmas"),
  refreshGoldPriceBtn: $("#refreshGoldPriceBtn"),
  goldPriceSource: $("#goldPriceSource"),
  gaji: $("#gaji"),
  penghasilanLain: $("#penghasilanLain"),
  totalEmas: $("#totalEmas"),
  resultTotalLabel: $("#resultTotalLabel"),
  resultNisabYearLabel: $("#resultNisabYearLabel"),
  resultNisabBulananRow: $("#resultNisabBulananRow"),
  resultNisabBulanan: $("#resultNisabBulanan"),
  resultTotal: $("#resultTotal"),
  resultNisab: $("#resultNisab"),
  resultStatus: $("#resultStatus"),
  resultZakat: $("#resultZakat"),
  resetBtn: $("#resetBtn"),
  toast: $("#toast"),
};

const hasRequiredDom =
  els.zakatType &&
  els.zakatForm &&
  els.formPenghasilan &&
  els.formEmas &&
  els.hargaEmas &&
  els.refreshGoldPriceBtn &&
  els.goldPriceSource &&
  els.gaji &&
  els.penghasilanLain &&
  els.totalEmas &&
  els.resultTotalLabel &&
  els.resultNisabYearLabel &&
  els.resultNisabBulananRow &&
  els.resultNisabBulanan &&
  els.resultTotal &&
  els.resultNisab &&
  els.resultStatus &&
  els.resultZakat &&
  els.resetBtn &&
  els.toast;

if (!hasRequiredDom) {
  console.warn("Zakat page: required DOM nodes not found.");
} else {
  const currencyFormatter = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const dateFormatter = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });

  function formatCurrency(value) {
    return currencyFormatter.format(value);
  }

  function formatDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return dateFormatter.format(date);
  }

  function toast(message, duration = 1700) {
    els.toast.textContent = message;
    els.toast.classList.add("show");

    window.clearTimeout(toast._timer);
    toast._timer = window.setTimeout(() => {
      els.toast.classList.remove("show");
    }, duration);
  }

  function setGoldSourceText(text) {
    els.goldPriceSource.textContent = text;
  }

  function setGoldSourceInfo(sourceName, dateText, { cached = false } = {}) {
    const datePart = dateText ? ` - ${dateText}` : "";
    const cachePart = cached ? " (cache)" : "";
    setGoldSourceText(`Sumber: ${sourceName}${cachePart}${datePart}`);
  }

  function setManualGoldSource() {
    setGoldSourceText("Sumber: Manual input");
  }

  function updateResultLabels(type) {
    const isPenghasilan = type === "penghasilan";
    els.resultTotalLabel.textContent = isPenghasilan ? "Total Penghasilan/Bulan" : "Total Nilai Emas";
    els.resultNisabYearLabel.textContent = "Nisab/Tahun";
    els.resultNisabBulananRow.style.display = isPenghasilan ? "flex" : "none";
  }

  function toggleForm(type) {
    const isPenghasilan = type === "penghasilan";

    els.formPenghasilan.classList.toggle("hidden", !isPenghasilan);
    els.formPenghasilan.classList.toggle("visible", isPenghasilan);

    els.formEmas.classList.toggle("hidden", isPenghasilan);
    els.formEmas.classList.toggle("visible", !isPenghasilan);

    updateResultLabels(type);
  }

  function parseGoldPriceMarkdown(markdown) {
    const primarySection = markdown.split("| Emas Batangan Gift Series |")[0];
    const oneGramMatch = primarySection.match(/\|\s*1\s*gr\s*\|\s*([0-9.,]+)\s*\|/i);
    const dateMatch = markdown.match(/Harga Emas Hari Ini,\s*([^\n\r]+)/i);

    if (!oneGramMatch) {
      throw new Error("Data harga 1 gr tidak ditemukan.");
    }

    const price = Number.parseInt(oneGramMatch[1].replace(/[^\d]/g, ""), 10);
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error("Data harga emas tidak valid.");
    }

    return {
      price,
      priceDate: dateMatch ? dateMatch[1].trim() : formatDate(new Date()),
    };
  }

  function readGoldCache() {
    try {
      const raw = window.localStorage.getItem(GOLD_CACHE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);
      if (!parsed || !Number.isFinite(parsed.price) || parsed.price <= 0) {
        return null;
      }

      return parsed;
    } catch (error) {
      return null;
    }
  }

  function writeGoldCache(payload) {
    try {
      window.localStorage.setItem(GOLD_CACHE_KEY, JSON.stringify(payload));
    } catch (error) {
      // Ignore cache write errors.
    }
  }

  function applyGoldPrice(payload, { cached = false } = {}) {
    els.hargaEmas.value = String(Math.round(payload.price));
    setGoldSourceInfo(payload.source || GOLD_SOURCE_NAME, payload.priceDate || formatDate(payload.fetchedAt), { cached });
  }

  async function fetchLatestGoldPrice() {
    const response = await fetch(GOLD_PRICE_PROXY_URL, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Fetch gagal (${response.status}).`);
    }

    const markdown = await response.text();
    const parsed = parseGoldPriceMarkdown(markdown);

    return {
      price: parsed.price,
      priceDate: parsed.priceDate,
      source: GOLD_SOURCE_NAME,
      fetchedAt: new Date().toISOString(),
    };
  }

  async function hydrateGoldPriceOnLoad() {
    setGoldSourceText("Sumber: Memuat harga emas harian...");

    try {
      const latest = await fetchLatestGoldPrice();
      applyGoldPrice(latest);
      writeGoldCache(latest);
      toast("Harga emas harian berhasil diperbarui.");
      return;
    } catch (error) {
      const cache = readGoldCache();
      if (cache) {
        applyGoldPrice(cache, { cached: true });
        toast("Gagal ambil harga terbaru. Menggunakan cache terakhir.");
        return;
      }
    }

    setManualGoldSource();
    toast("Harga emas otomatis belum tersedia. Silakan isi manual.");
  }

  async function refreshGoldPrice() {
    if (refreshGoldPrice._pending) {
      return;
    }

    const oldText = els.refreshGoldPriceBtn.textContent;
    refreshGoldPrice._pending = true;
    els.refreshGoldPriceBtn.disabled = true;
    els.refreshGoldPriceBtn.textContent = "Memuat...";

    try {
      const latest = await fetchLatestGoldPrice();
      applyGoldPrice(latest);
      writeGoldCache(latest);
      toast("Harga emas berhasil di-refresh.");
    } catch (error) {
      const cache = readGoldCache();
      if (cache) {
        applyGoldPrice(cache, { cached: true });
        toast("Refresh gagal. Menggunakan cache terakhir.");
      } else {
        setManualGoldSource();
        toast("Refresh harga gagal. Isi manual.");
      }
    } finally {
      els.refreshGoldPriceBtn.disabled = false;
      els.refreshGoldPriceBtn.textContent = oldText;
      refreshGoldPrice._pending = false;
    }
  }

  function calculateZakat(type, hargaEmas) {
    const nisabTahunan = hargaEmas * 85;

    if (type === "penghasilan") {
      const gaji = Number.parseFloat(els.gaji.value) || 0;
      const penghasilanLain = Number.parseFloat(els.penghasilanLain.value) || 0;
      const totalBulanan = gaji + penghasilanLain;
      const nisabBulanan = nisabTahunan / 12;
      const isWajib = totalBulanan >= nisabBulanan;
      const zakat = isWajib ? totalBulanan * 0.025 : 0;

      return {
        type,
        total: totalBulanan,
        nisabTahunan,
        nisabBulanan,
        isWajib,
        zakat,
      };
    }

    const totalEmasGram = Number.parseFloat(els.totalEmas.value) || 0;
    const nilaiEmas = totalEmasGram * hargaEmas;
    const isWajib = nilaiEmas >= nisabTahunan;
    const zakat = isWajib ? nilaiEmas * 0.025 : 0;

    return {
      type,
      total: nilaiEmas,
      nisabTahunan,
      nisabBulanan: null,
      isWajib,
      zakat,
    };
  }

  function updateStatus(isWajib) {
    els.resultStatus.classList.remove("status-idle", "status-wajib", "status-belum");

    if (isWajib) {
      els.resultStatus.classList.add("status-wajib");
      els.resultStatus.textContent = "Wajib Zakat";
    } else {
      els.resultStatus.classList.add("status-belum");
      els.resultStatus.textContent = "Belum Wajib";
    }
  }

  function displayResults(result) {
    els.resultTotal.textContent = formatCurrency(result.total);
    els.resultNisab.textContent = formatCurrency(result.nisabTahunan);
    els.resultNisabBulanan.textContent =
      result.type === "penghasilan" ? formatCurrency(result.nisabBulanan) : "-";
    els.resultZakat.textContent = formatCurrency(result.zakat);
    updateStatus(result.isWajib);
  }

  function validate(type) {
    const hargaEmas = Number.parseFloat(els.hargaEmas.value);

    if (!hargaEmas || hargaEmas <= 0) {
      toast("Harga emas belum valid.");
      els.hargaEmas.focus();
      return false;
    }

    if (type === "penghasilan") {
      const gaji = Number.parseFloat(els.gaji.value) || 0;
      const penghasilanLain = Number.parseFloat(els.penghasilanLain.value) || 0;

      if (gaji === 0 && penghasilanLain === 0) {
        toast("Isi gaji atau penghasilan lain.");
        els.gaji.focus();
        return false;
      }
    } else {
      const totalEmas = Number.parseFloat(els.totalEmas.value) || 0;

      if (totalEmas === 0) {
        toast("Masukkan total emas yang dimiliki.");
        els.totalEmas.focus();
        return false;
      }
    }

    return true;
  }

  function resetResults(type = els.zakatType.value) {
    updateResultLabels(type);
    els.resultTotal.textContent = "Rp 0";
    els.resultNisab.textContent = "Rp 0";
    els.resultNisabBulanan.textContent = type === "penghasilan" ? "Rp 0" : "-";
    els.resultZakat.textContent = "Rp 0";
    els.resultStatus.classList.remove("status-wajib", "status-belum");
    els.resultStatus.classList.add("status-idle");
    els.resultStatus.textContent = "-";
  }

  function handleSubmit(event) {
    event.preventDefault();

    const type = els.zakatType.value;
    if (!validate(type)) {
      return;
    }

    const hargaEmas = Number.parseFloat(els.hargaEmas.value);
    const result = calculateZakat(type, hargaEmas);

    displayResults(result);
    toast("Perhitungan selesai.");
  }

  function handleReset() {
    const type = els.zakatType.value;

    els.gaji.value = "";
    els.penghasilanLain.value = "";
    els.totalEmas.value = "";

    toggleForm(type);
    resetResults(type);

    if (!(Number.parseFloat(els.hargaEmas.value) > 0)) {
      setManualGoldSource();
    }

    toast("Form direset.");
  }

  function init() {
    toggleForm(els.zakatType.value);
    resetResults(els.zakatType.value);

    els.zakatType.addEventListener("change", (event) => {
      toggleForm(event.target.value);
      resetResults(event.target.value);
    });

    els.hargaEmas.addEventListener("input", () => {
      if (Number.parseFloat(els.hargaEmas.value) > 0) {
        setManualGoldSource();
      }
    });

    els.zakatForm.addEventListener("submit", handleSubmit);
    els.resetBtn.addEventListener("click", handleReset);
    els.refreshGoldPriceBtn.addEventListener("click", refreshGoldPrice);

    hydrateGoldPriceOnLoad();
  }

  init();
}
