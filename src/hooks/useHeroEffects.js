import { useEffect } from "react";

const REVEAL_SELECTOR = [
  "#heroSection .hero-copy",
  "#heroSection .hero-gallery",
  "#heroSection > .home-featured-section",
  "#heroSection > .home-intro",
  "#heroSection .purpose-card",
  "#heroSection .home-feature",
  "#heroSection .journey-grid > article",
  "#heroSection .level-chips > *",
  "#heroSection .values-grid > article",
  "#heroSection > .home-cta",
  "#heroSection > .panel[aria-labelledby='announcementsTitle']",
  "#heroSection .featured-book-card",
  "#heroSection .hero-gallery img",
  "#heroSection .featured-book-cover img"
].join(", ");

const prefersReducedMotion = () => Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

/**
 * Progressive scroll reveals for the home page. Elements are observed rather
 * than wrapped, so the markup keeps every selector the stylesheet targets.
 */
export function useRevealTargets(dependencyKey) {
  useEffect(() => {
    const targets = document.querySelectorAll(REVEAL_SELECTOR);
    if (!targets.length) return undefined;

    if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
      targets.forEach(element => element.classList.add("amg-revealed"));
      return undefined;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("amg-revealed");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -36px 0px" });

    targets.forEach((element, index) => {
      if (element.classList.contains("amg-revealed")) return;
      element.style.setProperty("--amg-stagger", String(Math.min(index % 7, 6)));
      observer.observe(element);
    });

    return () => observer.disconnect();
  }, [dependencyKey]);
}

/** Subtle hero-gallery parallax, limited to narrow viewports and small offsets. */
export function useHeroParallax(galleryRef) {
  useEffect(() => {
    const gallery = galleryRef.current;
    if (!gallery) return undefined;

    let queued = false;
    const update = () => {
      queued = false;
      const compact = window.matchMedia("(max-width: 680px)").matches
        || document.documentElement.classList.contains("amg-compact-device");
      if (prefersReducedMotion() || !compact) return;
      const hero = document.querySelector("#heroSection .hero");
      const rect = hero ? hero.getBoundingClientRect() : null;
      const offset = rect ? Math.max(-10, Math.min(10, -rect.top * 0.035)) : 0;
      gallery.style.setProperty("--amg-parallax-y", `${offset.toFixed(1)}px`);
    };
    const onScroll = () => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [galleryRef]);
}
