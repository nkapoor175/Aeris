import React, { useEffect, useRef, useState } from "react";

export function SignalProcessingScreen() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isInView, setIsInView] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
        if (entry.isIntersecting) {
          setActiveStep(0);
          let current = 0;
          timer = setInterval(() => {
            current += 1;
            if (current <= 4) {
              setActiveStep(current);
            } else {
              clearInterval(timer);
            }
          }, 300);
        } else {
          setActiveStep(0);
        }
      },
      { threshold: 0.25, rootMargin: "-10% 0px -10% 0px" }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      if (timer) clearInterval(timer);
    };
  }, []);

  const pipelineSteps = [
    { id: "01", title: "OPTICAL SIGNAL", caption: "Raw red/NIR pulses" },
    { id: "02", title: "FILTERING", caption: "Noise reduction sweep" },
    { id: "03", title: "FEATURE EXTRACTION", caption: "Systolic & notch points" },
    { id: "04", title: "AERIS MODEL", caption: "Analytical ML model" },
    { id: "05", title: "SCREENING RESULT", caption: "Resolved risk estimation" },
  ];

  return (
    <section
      id="signal"
      ref={containerRef}
      className={`product-screen signal-screen viewport-reveal ${isInView ? "is-in-view" : "is-out-view"}`}
    >
      <div className="signal-screen-content">
        <header className="signal-header">
          <span className="mono eyebrow-gold">03 / SIGNAL PROCESSING & CLASSIFICATION</span>
          <h2 className="section-title center-title">From optical signal to screening output.</h2>
        </header>

        {/* Sequential 5-Stage Pipeline */}
        <div className="horizontal-pipeline">
          {pipelineSteps.map((step, idx) => (
            <React.Fragment key={step.id}>
              <div
                className={`pipeline-node ${activeStep >= idx ? "is-active" : ""} ${
                  activeStep === idx ? "is-current-active" : ""
                }`}
                onClick={() => setActiveStep(idx)}
              >
                <span className="mono node-step">{step.id}</span>
                <strong className="mono node-title">{step.title}</strong>
                <span className="mono node-caption">{step.caption}</span>
              </div>
              {idx < pipelineSteps.length - 1 && (
                <span className={`pipeline-arrow-icon ${activeStep > idx ? "is-active" : ""}`}>→</span>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Display Box with Waveform & Result Climax */}
        <div className={`pipeline-display-card ${activeStep >= 4 ? "is-complete" : ""}`}>
          <div className="waveform-trace-box">
            <span className="mono box-label">LIVE PHOTOPLETHYSMOGRAM (PPG) TRACE</span>
            <svg viewBox="0 0 800 120" className="ppg-waveform-svg" preserveAspectRatio="none">
              <path
                d="M 0 60 Q 20 20 40 60 T 80 60 T 120 20 T 160 60 T 200 60"
                fill="none"
                stroke="#dc2626"
                strokeWidth="1.5"
                opacity="0.45"
              />
              <path
                d="M 200 60 C 220 15, 230 15, 240 60 C 245 75, 250 50, 260 60 C 280 60, 290 60, 300 60 C 320 15, 330 15, 340 60 C 345 75, 350 50, 360 60 C 380 60, 390 60, 400 60 C 420 15, 430 15, 440 60 C 445 75, 450 50, 460 60 C 480 60, 490 60, 500 60 L 800 60"
                fill="none"
                stroke="#c6a56a"
                strokeWidth="2.2"
                className={`ppg-draw-path step-${activeStep}`}
              />
              <circle cx="225" cy="22" r="4" fill="#dc2626" className={`peak-dot ${activeStep >= 2 ? "show" : ""}`} />
              <circle cx="248" cy="54" r="3" fill="#c6a56a" className={`peak-dot ${activeStep >= 2 ? "show" : ""}`} />
              <circle cx="325" cy="22" r="4" fill="#dc2626" className={`peak-dot ${activeStep >= 2 ? "show" : ""}`} />
              <circle cx="348" cy="54" r="3" fill="#c6a56a" className={`peak-dot ${activeStep >= 2 ? "show" : ""}`} />
              <circle cx="425" cy="22" r="4" fill="#dc2626" className={`peak-dot ${activeStep >= 2 ? "show" : ""}`} />
              <circle cx="448" cy="54" r="3" fill="#c6a56a" className={`peak-dot ${activeStep >= 2 ? "show" : ""}`} />
            </svg>
          </div>

          {/* Screening Result Visual Climax Card */}
          <div className={`clinical-result-climax-card ${activeStep >= 4 ? "is-revealed" : "is-dim"}`}>
            <div className="result-climax-header">
              <span className="mono result-eyebrow">SCREENING RESULT</span>
              <div className="result-hero-badge">
                <strong className="result-hero-status">LOW RISK</strong>
              </div>
              <span className="mono result-caption-sub">CONCEPTUAL SCREENING OUTPUT</span>
            </div>

            <div className={`result-metrics-grid ${activeStep >= 4 ? "is-visible" : ""}`}>
              <div className="metric-box">
                <strong className="metric-big-num">94.8%</strong>
                <span className="mono metric-label">MODEL CONFIDENCE</span>
              </div>
              <div className="metric-box">
                <strong className="metric-big-num">18.2 s</strong>
                <span className="mono metric-label">SCREENING TIME</span>
              </div>
              <div className="metric-box">
                <strong className="metric-big-num">ONE FINGER</strong>
                <span className="mono metric-label">MEASUREMENT</span>
              </div>
            </div>
          </div>
        </div>

        <div className="disclaimer-footer">
          <span className="mono">CONCEPTUAL SCREENING SYSTEM — NOT A DIAGNOSTIC RECORD</span>
        </div>
      </div>
    </section>
  );
}
