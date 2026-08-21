import React, { useEffect, useRef, useState } from "react";

export function MethodScreen() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isInView, setIsInView] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

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

  const principles = [
    {
      id: "01",
      title: "NON-INVASIVE",
      expandText: "No needle.",
      detailText: "Captures physiological signals through fingertip optical reflection without skin puncture or discomfort.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c6a56a" strokeWidth="1.5">
          <path d="M2 12 C6 6, 10 6, 12 12 C14 18, 18 18, 22 12" />
        </svg>
      ),
    },
    {
      id: "02",
      title: "ONE FINGER",
      expandText: "A simple optical measurement.",
      detailText: "Single fingertip probe contact acquires dual-wavelength optical return signals instantly.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c6a56a" strokeWidth="1.5">
          <rect x="8" y="4" width="8" height="16" rx="4" />
          <line x1="12" y1="8" x2="12" y2="12" />
        </svg>
      ),
    },
    {
      id: "03",
      title: "15–30 SECONDS",
      expandText: "Rapid preliminary screening.",
      detailText: "Delivers conceptual screening risk assessment within seconds for rapid clinical workflow.",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c6a56a" strokeWidth="1.5">
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 15 15" />
        </svg>
      ),
    },
  ];

  return (
    <section
      id="method"
      ref={containerRef}
      className={`product-screen method-screen viewport-reveal ${isInView ? "is-in-view" : "is-out-view"}`}
    >
      <div className="method-screen-content">
        <header className="method-header">
          <span className="mono eyebrow-gold">04 / THE AERIS METHOD</span>
          <h2 className="section-title headline-large">
            Screening<br />
            should<br />
            <em className="gold-text">be simple.</em>
          </h2>
        </header>

        {/* Large Readable Interactive Principles */}
        <div className="interactive-principles-list">
          {principles.map((item, idx) => {
            const isExpanded = activeIndex === idx;
            return (
              <div
                key={item.id}
                className={`principle-card ${isExpanded ? "is-expanded" : "is-quiet"}`}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => setActiveIndex(idx)}
              >
                <div className="principle-header">
                  <span className="mono item-num">{item.id}</span>
                  <strong className="item-title">{item.title}</strong>
                  <span className={`item-icon ${isExpanded ? "icon-active" : ""}`}>{item.icon}</span>
                </div>

                <div className={`principle-expanded-content ${isExpanded ? "content-open" : "content-closed"}`}>
                  <span className="mono expand-headline">{item.expandText}</span>
                  <p className="expand-paragraph">{item.detailText}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
