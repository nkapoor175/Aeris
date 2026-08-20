import React, { useEffect, useRef, useState } from "react";

export function FinalCtaScreen() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { threshold: 0.25, rootMargin: "-10% 0px -10% 0px" }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="cta"
      ref={containerRef}
      className={`product-screen cta-screen viewport-reveal ${isInView ? "is-in-view" : "is-out-view"}`}
    >
      <div className="cta-screen-content">
        <span className="mono eyebrow-gold">AERIS / SCREENING SYSTEM</span>
        <h2 className={`section-title cta-title ${isInView ? "is-crisp" : "is-soft"}`}>See AERIS in action.</h2>
        <p className="cta-supporting-text">
          Explore how a single fingertip measurement becomes an AI-assisted screening result.
        </p>

        <a className="cta-button-gold" href="/dashboard">
          <span>EXPLORE THE SCREENING</span>
          <span className="arrow">→</span>
        </a>
      </div>

      <footer className={`site-footer ${isInView ? "footer-revealed" : "footer-dim"}`}>
        <a className="brand" href="#top">
          <img src="/assets/aeris-mark.svg" alt="" />
          <span>AERIS</span>
        </a>
        <span className="mono">OPTICAL SCREENING / 2026</span>
        <a href="/dashboard" className="mono footer-link">
          EXPLORE THE SCREENING →
        </a>
      </footer>
    </section>
  );
}
