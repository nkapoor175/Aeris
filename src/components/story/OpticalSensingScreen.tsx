import React, { useEffect, useRef, useState } from "react";

export function OpticalSensingScreen() {
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
      id="optics"
      ref={containerRef}
      className={`product-screen optics-screen viewport-reveal ${isInView ? "is-in-view" : "is-out-view"}`}
    >
      <div className="screen-grid">
        {/* LEFT COLUMN - TEXT */}
        <div className="text-col">
          <span className="mono eyebrow-gold">02 / OPTICAL SENSING</span>
          <h2 className="section-title">
            Light in.<br />
            Signal out.
          </h2>
          <p className="section-body">
            AERIS uses dual-wavelength optical sensing at the fingertip.
          </p>

          <div className={`wavelength-badges ${isInView ? "is-active" : ""}`}>
            <div className="badge red-badge">
              <span className="dot red-dot" />
              <span className="mono">660 nm / RED</span>
            </div>
            <div className="badge nir-badge">
              <span className="dot gold-dot" />
              <span className="mono">880 nm / NIR</span>
            </div>
          </div>

          <p className="section-body-subtle">
            Light enters the tissue, interacts with blood and surrounding tissue, and the returning optical signal is captured by the sensor.
          </p>

          <div className="metadata-row">
            <span className="mono meta-tag">DUAL WAVELENGTH</span>
            <span className="mono meta-separator">/</span>
            <span className="mono meta-tag">FINGERTIP</span>
            <span className="mono meta-separator">/</span>
            <span className="mono meta-tag">NON-INVASIVE</span>
          </div>
        </div>

        {/* RIGHT COLUMN - REALISTIC FINGERTIP + OPTICAL DEVICE DIAGRAM */}
        <div className="visual-col">
          <div className={`optical-sensing-card-dark ${isInView ? "diagram-active" : "diagram-dim"}`}>
            <div className="diagram-image-wrapper">
              <img
                src="/assets/optical-diagram-dark.png"
                alt="Realistic fingertip placed inside AERIS optical sensing device clip"
                className="optical-finger-img"
              />

              {/* Animated Light Pulse Overlays - Illuminates when section is active */}
              <svg className="light-pulse-overlay-svg" viewBox="0 0 500 400">
                <path
                  d="M 235 110 Q 220 150 235 180 T 235 240 L 235 285"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="3.5"
                  strokeDasharray="8 4"
                  className={`light-pulse-anim ${isInView ? "is-illuminated" : ""}`}
                />

                <path
                  d="M 335 110 Q 320 150 335 180 T 335 240 L 335 285"
                  fill="none"
                  stroke="#c6a56a"
                  strokeWidth="3.5"
                  strokeDasharray="8 4"
                  className={`light-pulse-anim ${isInView ? "is-illuminated" : ""}`}
                />

                <circle
                  cx="285"
                  cy="290"
                  r="6"
                  fill="#c6a56a"
                  className={`photodetector-glow ${isInView ? "is-pulsing" : ""}`}
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
