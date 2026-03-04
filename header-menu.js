(function () {
  const HEADER_TEMPLATE = `
    <nav class="unified-nav" aria-label="Menu utama">
      <div class="unified-nav__container">
        <div class="unified-nav__row">
          <a class="unified-nav__brand" href="doa.html">
            <img
              src="logo.png"
              alt="Logo Ramadhan"
              class="unified-nav__logo"
              width="44"
              height="44"
              loading="eager"
              decoding="async"
            />
            <span class="unified-nav__brand-text">Ramadhan</span>
          </a>

          <div class="unified-nav__desktop-menu">
            <a class="unified-nav__link" href="doa.html" data-page="doa">Doa</a>
            <a class="unified-nav__link" href="zikir.html" data-page="zikir">Hitung Zikir</a>
          </div>

          <button class="unified-nav__toggle" type="button" aria-expanded="false" aria-label="Buka menu" data-nav-toggle>
            <svg class="unified-nav__icon unified-nav__icon--menu" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 6H20M4 12H20M4 18H20" />
            </svg>
            <svg class="unified-nav__icon unified-nav__icon--close" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6L18 18M6 18L18 6" />
            </svg>
          </button>
        </div>

        <div class="unified-nav__mobile-menu" data-nav-mobile hidden>
          <a class="unified-nav__link" href="doa.html" data-page="doa">Doa</a>
          <a class="unified-nav__link" href="zikir.html" data-page="zikir">Hitung Zikir</a>
        </div>
      </div>
    </nav>
  `;

  function setActiveLink(root, currentPage) {
    const links = root.querySelectorAll(".unified-nav__link[data-page]");

    links.forEach((link) => {
      const isCurrent = link.dataset.page === currentPage;
      link.classList.toggle("is-active", isCurrent);

      if (isCurrent) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function bindMobileMenu(root) {
    const toggle = root.querySelector("[data-nav-toggle]");
    const mobileMenu = root.querySelector("[data-nav-mobile]");

    if (!toggle || !mobileMenu) {
      return;
    }

    function closeMenu() {
      toggle.setAttribute("aria-expanded", "false");
      mobileMenu.hidden = true;
    }

    toggle.addEventListener("click", () => {
      const isExpanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!isExpanded));
      mobileMenu.hidden = isExpanded;
    });

    mobileMenu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", closeMenu);
    });

    window.addEventListener("resize", () => {
      if (window.matchMedia("(min-width: 768px)").matches) {
        closeMenu();
      }
    });
  }

  function renderHeader(mount) {
    mount.innerHTML = HEADER_TEMPLATE;
    setActiveLink(mount, mount.dataset.currentPage || "");
    bindMobileMenu(mount);
  }

  function init() {
    const mounts = document.querySelectorAll("[data-header-menu]");
    mounts.forEach(renderHeader);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
