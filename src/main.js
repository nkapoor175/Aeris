// ============================================================
// AERIS — Scientific Product Film Scroll Choreography
// Connects single-runway GSAP ScrollTrigger to MasterCanvas
// and manages overlay stage triggers with smooth camera inertia.
// ============================================================

import './style.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MasterCanvas } from './master-canvas.js';

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function isInRange(p, start, end) {
  return p >= start && p < end;
}

// ── MINIMAL NAVIGATION CONTROLLER ──
function initNavigation() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  let lastY = 0;
  let ticking = false;

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y > 150 && y > lastY + 5) nav.classList.add('is-hidden');
        else if (y < lastY - 5 || y < 50) nav.classList.remove('is-hidden');
        lastY = y;
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

// ── FILM EXPERIENCE CHOREOGRAPHY ──
function initFilmExperience() {
  const canvasEl = document.getElementById('film-canvas');
  const filmContainer = document.getElementById('film-container');
  if (!canvasEl || !filmContainer) return;

  const masterCanvas = new MasterCanvas(canvasEl);

  const stages = {
    hero:           document.getElementById('stage-hero'),
    biology:        document.getElementById('stage-biology'),
    optical:        document.getElementById('stage-optical'),
    signal:         document.getElementById('stage-signal'),
    classification: document.getElementById('stage-classification'),
  };

  ScrollTrigger.create({
    trigger: '#film-container',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 0.2,
    onUpdate: (self) => {
      const p = self.progress;
      masterCanvas.setProgress(p);

      // Scene 1: Hero (P: 0.00 -> 0.18)
      if (stages.hero) {
        stages.hero.classList.toggle('is-active', isInRange(p, 0.00, 0.18));
      }

      // Scene 2 & 3: Biology / RBC Flow (P: 0.22 -> 0.40)
      if (stages.biology) {
        stages.biology.classList.toggle('is-active', isInRange(p, 0.22, 0.40));
      }

      // Scene 4: Optical Measurement (P: 0.44 -> 0.62)
      if (stages.optical) {
        stages.optical.classList.toggle('is-active', isInRange(p, 0.44, 0.62));
      }

      // Scene 5: Waveform Signal Metrics (P: 0.66 -> 0.82)
      if (stages.signal) {
        stages.signal.classList.toggle('is-active', isInRange(p, 0.66, 0.82));
      }

      // Scene 6: Classification & AERIS Product Console CTA (P: 0.84 -> 1.00)
      if (stages.classification) {
        stages.classification.classList.toggle('is-active', p >= 0.84);
      }
    },
  });
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initFilmExperience();
  ScrollTrigger.refresh();
});
