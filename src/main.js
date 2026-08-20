// ============================================================
// AERIS — Unified Master Storytelling & Scroll Choreography
// Binds a single continuous GSAP ScrollTrigger to MasterCanvas
// and manages 5 narrative overlay stages.
//
// Section 01: The Problem       (P: 0.00 -> 0.14)
// Section 02: Bloodstream       (P: 0.22 -> 0.38)
// Section 03: Measurement       (P: 0.48 -> 0.62)
// Section 04: Signal to Insight (P: 0.66 -> 0.82)
// Section 05: Accessibility     (P: 0.86 -> 1.00)
// ============================================================

import './style.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MasterCanvas } from './master-canvas.js';

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── NAVIGATION ──
function initNavigation() {
  const nav = document.getElementById('nav');
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');
  const overlay = document.getElementById('nav-overlay');
  let lastY = 0;

  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (y > 120 && y > lastY) nav.classList.add('is-hidden');
    else nav.classList.remove('is-hidden');
    lastY = y;
  }, { passive: true });

  if (toggle) {
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('is-open');
      overlay.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    overlay.addEventListener('click', () => {
      links.classList.remove('is-open');
      overlay.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
    links.querySelectorAll('.nav__link').forEach((link) => {
      link.addEventListener('click', (e) => {
        const targetP = link.dataset.navTarget;
        if (targetP !== undefined) {
          e.preventDefault();
          const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
          const scrollToY = Number(targetP) * maxScroll;
          window.scrollTo({ top: scrollToY, behavior: reducedMotion ? 'auto' : 'smooth' });
        }
        links.classList.remove('is-open');
        overlay.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }
}

// ── MASTER EXPERIENCE CHOREOGRAPHY ──
function initMasterExperience() {
  const canvasEl = document.getElementById('master-canvas');
  const masterContainer = document.getElementById('master-experience');
  if (!canvasEl || !masterContainer) return;

  const masterCanvas = new MasterCanvas(canvasEl);

  // Five narrative stages matching new HTML
  const stages = {
    problem:       document.getElementById('stage-problem'),
    bloodstream:   document.getElementById('stage-bloodstream'),
    measurement:   document.getElementById('stage-measurement'),
    insight:       document.getElementById('stage-insight'),
    accessibility: document.getElementById('stage-accessibility'),
  };

  // Pipeline nodes for staggered reveal in Section 04
  const pipeNodes = gsap.utils.toArray('.pipe-node');
  // Measurement steps for staggered reveal in Section 03
  const measSteps = gsap.utils.toArray('.meas-step');

  ScrollTrigger.create({
    trigger: '#master-experience',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 0.3,
    onUpdate: (self) => {
      const p = self.progress;
      masterCanvas.setProgress(p);

      // ── Section 01: The Problem (P: 0.00 -> 0.14) ──
      if (stages.problem) {
        stages.problem.classList.toggle('is-active', p >= 0.00 && p < 0.14);
      }

      // ── Section 02: Bloodstream (P: 0.22 -> 0.38) ──
      if (stages.bloodstream) {
        stages.bloodstream.classList.toggle('is-active', p >= 0.22 && p < 0.38);
      }

      // ── Section 03: Measurement (P: 0.48 -> 0.62) ──
      if (stages.measurement) {
        const isMeasActive = p >= 0.48 && p < 0.62;
        stages.measurement.classList.toggle('is-active', isMeasActive);

        if (isMeasActive) {
          const measT = (p - 0.48) / 0.14; // 0 to 1
          measSteps.forEach((step, i) => {
            const threshold = (i + 1) * 0.22; // stagger at 0.22, 0.44, 0.66, 0.88
            step.classList.toggle('is-active', measT > threshold);
          });
        }
      }

      // ── Section 04: Signal to Insight (P: 0.66 -> 0.82) ──
      if (stages.insight) {
        const isInsightActive = p >= 0.66 && p < 0.82;
        stages.insight.classList.toggle('is-active', isInsightActive);

        if (isInsightActive) {
          const insightT = (p - 0.66) / 0.16; // 0 to 1
          pipeNodes.forEach((node, i) => {
            const threshold = (i + 1) * 0.2; // stagger at 0.2, 0.4, 0.6, 0.8
            node.classList.toggle('is-active', insightT > threshold);
          });
        }
      }

      // ── Section 05: Accessibility (P: 0.86 -> 1.00) ──
      if (stages.accessibility) {
        stages.accessibility.classList.toggle('is-active', p >= 0.86);
      }
    },
  });
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initMasterExperience();
  ScrollTrigger.refresh();
});
