const $ = (selector) => document.querySelector(selector);

const els = {
  zakatType: $("#zakatType"),
  zakatForm: $("#zakatForm"),
  formPenghasilan: $("#formPenghasilan"),
  formEmas: $("#formEmas"),
  hargaEmas: $("#hargaEmas"),
  gaji: $("#gaji"),
  penghasilanLain: $("#penghasilanLain"),
  totalEmas: $("#totalEmas"),
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
  els.gaji &&
  els.penghasilanLain &&
  els.totalEmas &&
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

  function formatCurrency(value) {
    return currencyFormatter.format(value);
  }

  function toast(message, duration = 1600) {
    els.toast.textContent = message;
    els.toast.classList.add("show");

    window.clearTimeout(toast._timer);
    toast._timer = window.setTimeout(() => {
      els.toast.classList.remove("show");
    }, duration);
  }

  function toggleForm(type) {
    const isPenghasilan = type === "penghasilan";

    els.formPenghasilan.classList.toggle("hidden", !isPenghasilan);
    els.formPenghasilan.classList.toggle("visible", isPenghasilan);

    els.formEmas.classList.toggle("hidden", isPenghasilan);
    els.formEmas.classList.toggle("visible", !isPenghasilan);
  }

  function calculateZakat(type, hargaEmas) {
    const nisab = hargaEmas * 85;

    let total = 0;
    if (type === "penghasilan") {
      const gaji = Number.parseFloat(els.gaji.value) || 0;
      const penghasilanLain = Number.parseFloat(els.penghasilanLain.value) || 0;
      total = gaji + penghasilanLain;
    } else {
      const totalEmas = Number.parseFloat(els.totalEmas.value) || 0;
      total = totalEmas * hargaEmas;
    }

    const isWajib = total >= nisab;
    const zakat = isWajib ? total * 0.025 : 0;

    return { total, nisab, isWajib, zakat };
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
    els.resultNisab.textContent = formatCurrency(result.nisab);
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

  function resetResults() {
    els.resultTotal.textContent = "Rp 0";
    els.resultNisab.textContent = "Rp 0";
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
    els.hargaEmas.value = "1100000";

    toggleForm(type);
    resetResults();
    toast("Form direset.");
  }

  function init() {
    els.hargaEmas.value = "1100000";
    toggleForm(els.zakatType.value);
    resetResults();

    els.zakatType.addEventListener("change", (event) => {
      toggleForm(event.target.value);
      resetResults();
    });

    els.zakatForm.addEventListener("submit", handleSubmit);
    els.resetBtn.addEventListener("click", handleReset);
  }

  init();
}
