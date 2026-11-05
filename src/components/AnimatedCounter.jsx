import { useEffect, useRef, useState } from "react";

/** Counts up once the value is on screen, and again whenever the target changes. */
export function AnimatedCounter({ value, label }) {
  const target = Math.max(0, Number(value) || 0);
  const ref = useRef(null);
  const [display, setDisplay] = useState(target);
  const seenRef = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const animate = () => {
      if (reduced || !("requestAnimationFrame" in window)) {
        setDisplay(target);
        return;
      }
      const start = performance.now();
      const duration = 650;
      const frame = (now) => {
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplay(Math.round(target * eased));
        if (progress < 1) window.requestAnimationFrame(frame);
      };
      window.requestAnimationFrame(frame);
    };

    if (!("IntersectionObserver" in window)) {
      animate();
      return undefined;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        if (seenRef.current) {
          setDisplay(target);
          return;
        }
        seenRef.current = true;
        animate();
      });
    }, { threshold: 0.5 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [target]);

  return (
    <div className="amg-counter">
      <strong ref={ref}>{display.toLocaleString()}</strong>
      <span>{label}</span>
    </div>
  );
}
