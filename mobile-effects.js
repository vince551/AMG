/* AMG mobile scroll interactions: lightweight, observer-driven and progressively enhanced. */
(() => {
  "use strict";
  const root = document.documentElement;
  const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const compact = () => window.matchMedia("(max-width: 680px)").matches || root.classList.contains("amg-compact-device");
  const header = document.querySelector(".navbar");
  const progress = document.createElement("div");
  progress.className = "amg-scroll-progress";
  progress.setAttribute("role", "progressbar");
  progress.setAttribute("aria-label", "Page reading progress");
  progress.setAttribute("aria-valuemin", "0");
  progress.setAttribute("aria-valuemax", "100");
  progress.setAttribute("aria-valuenow", "0");
  document.body.append(progress);

  let scrollQueued = false;
  let lastProgress = -1;
  const updateScrollEffects = () => {
    scrollQueued = false;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const ratio = Math.min(1, Math.max(0, window.scrollY / maxScroll));
    const percent = Math.round(ratio * 100);
    if (percent !== lastProgress) {
      progress.style.transform = `scaleX(${ratio})`;
      progress.setAttribute("aria-valuenow", String(percent));
      lastProgress = percent;
    }
    if (header) header.classList.toggle("amg-scrolled", window.scrollY > 28);
    if (!reducedMotion && compact()) {
      const gallery = document.querySelector("#heroSection .hero-gallery");
      if (gallery) {
        const hero = document.querySelector("#heroSection .hero");
        const rect = hero ? hero.getBoundingClientRect() : null;
        const offset = rect ? Math.max(-10, Math.min(10, -rect.top * 0.035)) : 0;
        gallery.style.setProperty("--amg-parallax-y", `${offset.toFixed(1)}px`);
      }
    }
  };
  const onScroll = () => {
    if (scrollQueued) return;
    scrollQueued = true;
    window.requestAnimationFrame(updateScrollEffects);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  updateScrollEffects();

  const countElements = [...document.querySelectorAll("[data-amg-count]")];
  const setCountTargets = () => {
    const levels = document.querySelectorAll("#heroSection .level-chips > *").length;
    const steps = document.querySelectorAll("#heroSection .journey-grid > article").length;
    const levelCounter = document.querySelector('[data-amg-count="levels"]');
    const stepCounter = document.querySelector('[data-amg-count="steps"]');
    if (levelCounter) levelCounter.dataset.countTarget = String(levels);
    if (stepCounter) stepCounter.dataset.countTarget = String(steps);
  };
  setCountTargets();

  const animateCount = (element) => {
    const target = Math.max(0, Number(element.dataset.countTarget || 0));
    if (!Number.isFinite(target)) return;
    const previous = Number(element.dataset.countedTarget);
    if (previous === target) return;
    element.dataset.countedTarget = String(target);
    if (reducedMotion || !("requestAnimationFrame" in window)) {
      element.textContent = target.toLocaleString();
      return;
    }
    const start = performance.now();
    const duration = 650;
    const frame = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      element.textContent = Math.round(target * eased).toLocaleString();
      if (t < 1) window.requestAnimationFrame(frame);
    };
    window.requestAnimationFrame(frame);
  };

  const revealSelector =
    "#heroSection .hero-copy, #heroSection .hero-gallery, #heroSection > .home-featured-section, " +
    "#heroSection > .home-intro, #heroSection .purpose-card, #heroSection .home-feature, " +
    "#heroSection .journey-grid > article, #heroSection .level-chips > *, #heroSection .values-grid > article, " +
    "#heroSection > .home-cta, #heroSection > .panel[aria-labelledby='announcementsTitle'], " +
    "#heroSection .featured-book-card, #heroSection .hero-gallery img, #heroSection .featured-book-cover img";

  if (reducedMotion || !("IntersectionObserver" in window)) {
    document.querySelectorAll(revealSelector).forEach(element => element.classList.add("amg-revealed"));
    countElements.forEach(animateCount);
    return;
  }

  root.classList.add("amg-scroll-effects-ready");
  const revealTargets = document.querySelectorAll(revealSelector);
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("amg-revealed");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -36px 0px" });
  revealTargets.forEach((element, index) => {
    element.style.setProperty("--amg-stagger", String(Math.min(index % 7, 6)));
    revealObserver.observe(element);
  });

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) animateCount(entry.target);
    });
  }, { threshold: 0.5 });
  countElements.forEach(element => counterObserver.observe(element));

  const featured = document.getElementById("homeFeaturedBooks");
  if (featured && "MutationObserver" in window) {
    const dataObserver = new MutationObserver(() => {
      const counter = document.querySelector('[data-amg-count="books"]');
      if (counter) { counterObserver.unobserve(counter); counterObserver.observe(counter); }
      featured.querySelectorAll(".featured-book-card, .featured-book-cover img").forEach((element, index) => {
        if (element.classList.contains("amg-observed")) return;
        element.classList.add("amg-observed");
        element.style.setProperty("--amg-stagger", String(Math.min(index, 6)));
        revealObserver.observe(element);
      });
    });
    dataObserver.observe(featured, { childList: true });
  }
})();
