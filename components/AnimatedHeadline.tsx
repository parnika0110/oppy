"use client";

import { useEffect, useRef, useState } from "react";

/**
 * AnimatedHeadline — The Problem section headline with a subtle
 * entrance animation for the "OPPYortunity" brand treatment.
 *
 * Uses IntersectionObserver to trigger once when the section scrolls into view.
 * Respects prefers-reduced-motion.
 */
export default function AnimatedHeadline() {
  const ref = useRef<HTMLHeadingElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <h2 ref={ref} className="lp-section-headline">
      You shouldn&apos;t need
      <br />
      17 tabs to find one
      <br />
      <span className="lp-headline-accent">
        good{" "}
        <span className={`oppytunity ${visible ? "oppytunity--visible" : ""}`}>
          <span className="oppytunity-oppy">OPPY</span>ortunity.
        </span>
      </span>
    </h2>
  );
}
