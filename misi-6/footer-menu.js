(function () {
  const FOOTER_INNER_TEMPLATE = `
    <div class="site-footer__inner">
      <p class="site-footer__text" data-footer-copy></p>
    </div>
  `;

  const FOOTER_TEMPLATE = `
    <footer class="site-footer" role="contentinfo">
      ${FOOTER_INNER_TEMPLATE}
    </footer>
  `;

  function renderFooter(mount) {
    const isSemanticFooter = mount.tagName.toLowerCase() === "footer";

    if (isSemanticFooter) {
      mount.classList.add("site-footer");
      if (!mount.hasAttribute("role")) {
        mount.setAttribute("role", "contentinfo");
      }
      mount.innerHTML = FOOTER_INNER_TEMPLATE;
    } else {
      mount.innerHTML = FOOTER_TEMPLATE;
    }

    const text = mount.querySelector("[data-footer-copy]");
    if (!text) {
      return;
    }

    text.textContent = "\u00A9 2026 Ramadhan. All rights reserved.";
  }

  function init() {
    const mounts = document.querySelectorAll("[data-footer-menu]");
    mounts.forEach(renderFooter);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
