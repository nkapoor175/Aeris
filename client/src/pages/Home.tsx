import { useEffect, useRef, useState } from "react";
import { BiologyScreen } from "../components/story/BiologyScreen";
import { OpticalSensingScreen } from "../components/story/OpticalSensingScreen";
import { SignalProcessingScreen } from "../components/story/SignalProcessingScreen";
import { MethodScreen } from "../components/story/MethodScreen";
import { FinalCtaScreen } from "../components/story/FinalCtaScreen";

const ASSETS = {
  heroGray: "/assets/hero-gray.png",
  heroColor: "/assets/hero-color.png",
  mark: "/assets/aeris-mark.svg",
};

function Mono({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`mono ${className}`}>{children}</span>;
}

function Hero() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState({ x: 72, y: 55, active: false });
  const [scrollScale, setScrollScale] = useState(1);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      if (scrollY < window.innerHeight * 1.2) {
        // imperceptible slow scale on scroll
        setScrollScale(1 + scrollY * 0.00012);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const onMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setCursor({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
      active: true,
    });
  };

  return (
    <section
      id="top"
      className="hero"
      ref={heroRef}
      onPointerMove={onMove}
      onPointerLeave={() => setCursor((v) => ({ ...v, active: false }))}
    >
      <div
        className="hero-image"
        style={{
          transform: `scale(${cursor.active ? 1.012 : scrollScale}) translate(${
            cursor.active ? (cursor.x - window.innerWidth / 2) * -0.0015 : 0
          }px, ${cursor.active ? (cursor.y - window.innerHeight / 2) * -0.0015 : 0}px)`,
        }}
      >
        <img src={ASSETS.heroGray} alt="Clinician using a non-invasive optical fingertip sensor" className="hero-photo" />
        <img
          src={ASSETS.heroColor}
          alt=""
          aria-hidden="true"
          className={`hero-photo hero-photo-color ${cursor.active ? "is-revealed" : ""}`}
          style={
            {
              "--mx": `${cursor.x}px`,
              "--my": `${cursor.y}px`,
            } as React.CSSProperties
          }
        />
        <div className="hero-vignette" />
      </div>

      <header className="site-header">
        <a className="brand" href="#top" aria-label="AERIS home">
          <img src={ASSETS.mark} alt="" /> <span>AERIS</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#biology">THE STORY</a>
          <a href="#method">METHOD</a>
          <a href="/dashboard">
            CONSOLE <span className="arrow">↗</span>
          </a>
        </nav>
        <Mono>OPTICAL / 01</Mono>
      </header>

      <div className="hero-copy">
        <Mono className="eyebrow">NON-INVASIVE OPTICAL SCREENING</Mono>
        <h1>AERIS</h1>
        <p>
          For early anemia risk detection.
          <br />A signal, before a symptom.
        </p>
      </div>

      <div className="hero-meta left">
        <Mono>CLINICAL WORLD</Mono>
        <span className="rule" />
        <Mono>01 / 05</Mono>
      </div>

      <div className="hero-meta right">
        <Mono>SCROLL TO EXPLORE ↓</Mono>
        <span className="scroll-line" />
      </div>

      <div
        className="cursor-note"
        style={{ opacity: cursor.active ? 1 : 0, left: cursor.x + 16, top: cursor.y + 16 }}
      >
        <span className="cursor-dot" /> COLOR FIELD
      </div>
    </section>
  );
}

export default function Home() {
  const [activeSection, setActiveSection] = useState("01");

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const h = window.innerHeight;
      if (scrollY < h * 0.7) setActiveSection("01");
      else if (scrollY < h * 1.7) setActiveSection("01 BIOLOGY");
      else if (scrollY < h * 2.7) setActiveSection("02 OPTICS");
      else if (scrollY < h * 3.7) setActiveSection("03 SIGNAL");
      else if (scrollY < h * 4.7) setActiveSection("04 METHOD");
      else setActiveSection("05 CONSOLE");
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <main>
      {/* Fixed Viewport Monochromatic Grain Overlay */}
      <div className="fixed-viewport-grain" />

      {/* Screen 01: Hero */}
      <Hero />

      {/* Screen 02: Biology */}
      <BiologyScreen />

      {/* Screen 03: Optical Sensing */}
      <OpticalSensingScreen />

      {/* Screen 04: Signal Processing & Result */}
      <SignalProcessingScreen />

      {/* Screen 05: The AERIS Method */}
      <MethodScreen />

      {/* Screen 06: Final CTA */}
      <FinalCtaScreen />

      {/* Clean Right Chapter Rail */}
      <aside className="clean-chapter-rail" aria-label="Chapter progress">
        {[
          { id: "01 BIOLOGY", href: "#biology", label: "01 BIOLOGY" },
          { id: "02 OPTICS", href: "#optics", label: "02 OPTICS" },
          { id: "03 SIGNAL", href: "#signal", label: "03 SIGNAL" },
          { id: "04 METHOD", href: "#method", label: "04 METHOD" },
          { id: "05 CONSOLE", href: "#cta", label: "05 CONSOLE" },
        ].map((item) => (
          <a
            key={item.id}
            href={item.href}
            className={`mono chapter-rail-link ${activeSection === item.id ? "is-active" : ""}`}
          >
            {item.label}
          </a>
        ))}
      </aside>
    </main>
  );
}
