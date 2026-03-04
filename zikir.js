const $ = (q) => document.querySelector(q);
const $$ = (q) => Array.from(document.querySelectorAll(q));

const els = {
  num: $("#num"),
  label: $("#label"),
  prog: $("#prog"),
  targetText: $("#targetText"),
  progressText: $("#progressText"),
  todayCount: $("#todayCount"),
  totalCount: $("#totalCount"),
  preset: $("#preset"),
  customText: $("#customText"),
  chips: $$(".chip"),
  tap: $("#tap"),
  wrap: $("#counterWrap"),
  minus: $("#minus"),
  reset: $("#reset"),
  toast: $("#toast"),
  haptic: $("#haptic"),
  sound: $("#sound"),
};

const hasRequiredDom =
  els.num &&
  els.label &&
  els.prog &&
  els.targetText &&
  els.progressText &&
  els.todayCount &&
  els.totalCount &&
  els.preset &&
  els.customText &&
  els.chips.length > 0 &&
  els.tap &&
  els.wrap &&
  els.minus &&
  els.reset &&
  els.toast &&
  els.haptic &&
  els.sound;

if (!hasRequiredDom) {
  console.warn("Zikir page: required DOM nodes not found.");
} else {
  const PARTICLE_COLORS = ["#c9a84c", "#e8cc7a", "#f5e9c8", "#3da876"];
  const todayKey = () => new Date().toISOString().slice(0, 10);

  const state = {
    dhikr: "Subhanallah",
    target: 33,
    count: 0,
    total: 0,
    byDay: {},
    haptic: true,
    sound: false,
  };

  let audioCtx = null;

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function clickSound() {
    if (!state.sound) {
      return;
    }

    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = "sine";
      osc.frequency.value = 520;
      gain.gain.value = 0.0001;

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();

      gain.gain.exponentialRampToValueAtTime(0.06, audioCtx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.08);
      osc.stop(audioCtx.currentTime + 0.09);
    } catch {
      // ignore audio errors
    }
  }

  function toast(message, duration = 1400, kind = "normal") {
    els.toast.textContent = message;
    els.toast.classList.remove("complete");

    if (kind === "complete") {
      els.toast.classList.add("complete");
    }

    els.toast.classList.add("show");

    window.clearTimeout(toast._timer);
    toast._timer = window.setTimeout(() => {
      els.toast.classList.remove("show");
      window.setTimeout(() => els.toast.classList.remove("complete"), 220);
    }, duration);
  }

  function vibrate(ms = 18) {
    if (!state.haptic) {
      return;
    }

    if (navigator.vibrate) {
      navigator.vibrate(ms);
    }
  }

  function setDhikr(value) {
    state.dhikr = value;

    if (value === "custom") {
      els.customText.style.display = "block";
      els.customText.focus();
    } else {
      els.customText.style.display = "none";
    }

    render();
  }

  function currentDhikrLabel() {
    if (state.dhikr === "custom") {
      const text = (els.customText.value || "").trim();
      return text.length ? text : "Zikir custom";
    }

    return state.dhikr;
  }

  function setTarget(target) {
    state.target = target;

    els.chips.forEach((chip) => {
      chip.classList.toggle("active", Number(chip.dataset.target) === target);
    });

    render();
  }

  function progress() {
    if (state.target === 0) {
      return 0;
    }

    return clamp(state.count / state.target, 0, 1);
  }

  function setRing(p) {
    const radius = 138;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - p);

    els.prog.style.strokeDasharray = String(circumference);
    els.prog.style.strokeDashoffset = String(offset);
  }

  function confettiPulse() {
    els.wrap.animate(
      [
        { transform: "scale(1)", filter: "brightness(1)" },
        { transform: "scale(1.015)", filter: "brightness(1.08)" },
        { transform: "scale(1)", filter: "brightness(1)" },
      ],
      { duration: 520, easing: "cubic-bezier(.16,1,.3,1)" }
    );
  }

  function spawnCompletionParticles() {
    const rect = els.wrap.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const particleCount = 24;

    for (let i = 0; i < particleCount; i += 1) {
      const particle = document.createElement("div");
      const angle = (i / particleCount) * 360 + Math.random() * 18;
      const distance = 90 + Math.random() * 90;
      const rad = (angle * Math.PI) / 180;

      particle.className = "particle";
      particle.style.left = `${cx}px`;
      particle.style.top = `${cy}px`;
      particle.style.setProperty("--tx", `${Math.cos(rad) * distance}px`);
      particle.style.setProperty("--ty", `${Math.sin(rad) * distance}px`);
      particle.style.setProperty("--dur", `${0.55 + Math.random() * 0.4}s`);

      const color = PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)];
      particle.style.background = color;
      particle.style.boxShadow = `0 0 5px ${color}`;

      document.body.appendChild(particle);
      particle.addEventListener("animationend", () => particle.remove());
    }
  }

  function addRipple(x, y) {
    const ripple = document.createElement("div");
    ripple.className = "ripple";
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;

    els.tap.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
  }

  function bumpNumber() {
    els.num.animate(
      [
        { transform: "translateY(0) scale(1)" },
        { transform: "translateY(-2px) scale(1.04)" },
        { transform: "translateY(0) scale(1)" },
      ],
      { duration: 240, easing: "cubic-bezier(.2,.8,.2,1)" }
    );
  }

  function inc() {
    state.count += 1;
    state.total += 1;

    const key = todayKey();
    state.byDay[key] = (state.byDay[key] || 0) + 1;

    bumpNumber();
    vibrate(16);
    clickSound();

    if (state.target !== 0 && state.count === state.target) {
      const label = currentDhikrLabel();
      toast(`TARGET TERCAPAI - ${state.target}x ${label}`, 3600, "complete");
      confettiPulse();
      spawnCompletionParticles();
      vibrate(28);
    } else {
      toast("+1");
    }

    render();
  }

  function dec() {
    if (state.count <= 0) {
      return;
    }

    state.count -= 1;
    toast("Undo");
    vibrate(10);
    clickSound();
    render();
  }

  function reset() {
    state.count = 0;
    toast("Reset");
    vibrate(20);
    render();
  }

  function render() {
    const label = currentDhikrLabel();
    const targetText = state.target === 0 ? "inf" : String(state.target);

    els.num.textContent = String(state.count);
    els.targetText.textContent = targetText;

    const p = progress();
    setRing(p);

    els.progressText.textContent = state.target === 0 ? "-" : `${Math.round(p * 100)}%`;
    els.label.textContent = `${label} - target ${targetText}`;

    const key = todayKey();
    els.todayCount.textContent = String(state.byDay[key] || 0);
    els.totalCount.textContent = String(state.total || 0);
  }

  els.preset.addEventListener("change", (event) => setDhikr(event.target.value));
  els.customText.addEventListener("input", render);

  els.chips.forEach((chip) => {
    chip.addEventListener("click", () => setTarget(Number(chip.dataset.target)));
  });

  els.tap.addEventListener("click", (event) => {
    const rect = els.tap.getBoundingClientRect();
    addRipple(event.clientX - rect.left, event.clientY - rect.top);
    inc();
  });

  els.tap.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      addRipple(els.tap.clientWidth / 2, els.tap.clientHeight / 2);
      inc();
    }
  });

  els.minus.addEventListener("click", dec);
  els.reset.addEventListener("click", reset);

  els.haptic.addEventListener("click", () => {
    state.haptic = !state.haptic;
    els.haptic.classList.toggle("on", state.haptic);
    toast(state.haptic ? "Haptic ON" : "Haptic OFF");
  });

  els.sound.addEventListener("click", () => {
    state.sound = !state.sound;
    els.sound.classList.toggle("on", state.sound);
    toast(state.sound ? "Sound ON" : "Sound OFF");
  });

  window.addEventListener("keydown", (event) => {
    if (
      event.target instanceof Element &&
      event.target.closest('input, textarea, select, button, a, [role="button"], [contenteditable="true"]')
    ) {
      return;
    }

    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      addRipple(els.tap.clientWidth / 2, els.tap.clientHeight / 2);
      inc();
    }

    if (event.key === "Backspace") {
      event.preventDefault();
      dec();
    }

    if (event.key.toLowerCase() === "r") {
      event.preventDefault();
      reset();
    }
  });

  function init() {
    els.preset.value = state.dhikr;
    els.haptic.classList.toggle("on", state.haptic);
    els.sound.classList.toggle("on", state.sound);
    render();
  }

  init();
}
