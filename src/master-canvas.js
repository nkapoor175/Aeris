// ============================================================
// AERIS — Master Cinematic Editorial Render Engine
// Single unified Canvas engine managing the 5 narrative sections:
//   Section 01: The Problem (Clinical Photo Camera Push-In -> Dissolve)
//   Section 02: Enter the Bloodstream (Realistic Fluid RBC Flow across Viewport)
//   Section 03: Non-Invasive Measurement (Optical Sensing Light Pulse at Fingertip)
//   Section 04: Signal to Insight (Conceptual Pipeline: Optical -> Features -> Risk)
//   Section 05: Accessibility / Final Transformation to Screening Console
// ============================================================

export class MasterCanvas {
  constructor(canvasEl) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.progress = 0;
    this.animationId = null;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.time = 0;

    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.isMobile = window.innerWidth < 768;

    // Load High-Resolution Biomedical Assets
    this.heroImg = new Image();
    this.heroImgLoaded = false;
    this.heroImg.src = '/images/blood-draw.png';
    this.heroImg.onload = () => { this.heroImgLoaded = true; };

    this.rbcImg = new Image();
    this.rbcImgLoaded = false;
    this.rbcImg.src = '/images/rbc-figure.png';
    this.rbcImg.onload = () => { this.rbcImgLoaded = true; };

    this.resize();
    this.bindEvents();
    this.animate();
  }

  resize() {
    if (!this.canvas.parentElement) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);
  }

  bindEvents() {
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.isMobile = window.innerWidth < 768;
        this.resize();
      }, 200);
    });
  }

  setProgress(p) {
    this.progress = Math.max(0, Math.min(1, p));
  }

  // Representative PPG Waveform Function for Section 04
  getPPGValue(xNorm, tOffset = 0) {
    const period = 0.32;
    const phase = (xNorm / period + tOffset) % 1.0;

    let y = 0;
    if (phase < 0.25) {
      y = Math.sin((phase / 0.25) * Math.PI);
    } else if (phase < 0.45) {
      const p2 = (phase - 0.25) / 0.2;
      y = 0.78 * Math.cos(p2 * Math.PI * 0.5) + 0.18 * Math.sin(p2 * Math.PI);
    } else if (phase < 0.65) {
      const p3 = (phase - 0.45) / 0.2;
      y = 0.28 * Math.sin(p3 * Math.PI);
    } else {
      y = 0.06 * Math.sin(((phase - 0.65) / 0.35) * Math.PI);
    }
    return Math.max(-0.2, y);
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const p = this.progress;
    this.time += 0.016;

    ctx.clearRect(0, 0, w, h);

    // Deep dark background color interpolation
    let bgR = 5, bgG = 5, bgB = 5;
    if (p > 0.15 && p < 0.45) {
      // Deep biological lumen lighting for Bloodstream (Section 02)
      const bloodT = Math.sin(((p - 0.15) / 0.30) * Math.PI);
      bgR = Math.round(5 + bloodT * 32);
      bgG = Math.round(5 + bloodT * 4);
      bgB = Math.round(5 + bloodT * 6);
    } else if (p > 0.60 && p < 0.85) {
      // Subtle gold hue for Signal to Insight (Section 04)
      const sigT = Math.sin(((p - 0.60) / 0.25) * Math.PI);
      bgR = Math.round(5 + sigT * 18);
      bgG = Math.round(5 + sigT * 12);
      bgB = Math.round(5 + sigT * 4);
    }

    const bgGrad = ctx.createRadialGradient(w / 2, h / 2, w * 0.05, w / 2, h / 2, w * 0.85);
    bgGrad.addColorStop(0, `rgb(${Math.min(255, bgR + 18)}, ${Math.min(255, bgG + 10)}, ${Math.min(255, bgB + 8)})`);
    bgGrad.addColorStop(1, `rgb(${bgR}, ${bgG}, ${bgB})`);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // ============================================================
    // SECTION 01 — THE PROBLEM: Hero Clinical Photo Push-In (P: 0.00 -> 0.18)
    // ============================================================
    if (p < 0.18 && this.heroImgLoaded) {
      this.drawHeroClinicalPhoto(ctx, w, h, p);
    }

    // ============================================================
    // SECTION 02 — ENTER THE BLOODSTREAM: Realistic Fluid RBC Flow (P: 0.15 -> 0.48)
    // ============================================================
    if (p > 0.15 && p < 0.48 && this.rbcImgLoaded) {
      this.drawFluidRBCStream(ctx, w, h, p);
    }

    // ============================================================
    // SECTION 03 — NON-INVASIVE MEASUREMENT: Optical Sensing Light Pulse (P: 0.45 -> 0.65)
    // ============================================================
    if (p > 0.45 && p < 0.65) {
      this.drawOpticalMeasurementPulse(ctx, w, h, p);
    }

    // ============================================================
    // SECTION 04 — SIGNAL TO INSIGHT: Conceptual Pipeline (P: 0.62 -> 0.84)
    // ============================================================
    if (p > 0.62 && p < 0.84) {
      this.drawSignalToInsightPipeline(ctx, w, h, p);
    }

    // ============================================================
    // SECTION 05 — ACCESSIBILITY: Interface Wireframe Matrix (P: 0.82 -> 1.00)
    // ============================================================
    if (p > 0.82) {
      this.drawAccessibilityMatrix(ctx, w, h, p);
    }

    // Atmospheric Vignette Edge Darkening
    const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.38, w / 2, h / 2, Math.max(w, h) * 0.82);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(3,2,2,0.85)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  // SECTION 01: HERO CLINICAL PHOTO PUSH-IN
  drawHeroClinicalPhoto(ctx, w, h, p) {
    const normP = p / 0.18; // 0 to 1
    
    // Scale: 1.0 -> 1.25
    const scale = 1.0 + Math.pow(normP, 1.8) * 0.25;
    // Opacity reaches 0.0 at P = 0.18
    const opacity = Math.max(0, 1.0 - Math.pow(normP, 2.0));
    const blurAmount = normP * 14;

    if (opacity <= 0.001) return;

    ctx.save();
    ctx.globalAlpha = opacity;

    if (blurAmount > 1.2 && ctx.filter !== undefined) {
      ctx.filter = `grayscale(100%) contrast(140%) brightness(${80 - normP * 65}%) blur(${blurAmount.toFixed(1)}px)`;
    } else {
      ctx.filter = 'grayscale(100%) contrast(140%)';
    }

    const imgAspect = this.heroImg.width / this.heroImg.height;
    const screenAspect = w / h;
    let drawW, drawH;

    if (screenAspect > imgAspect) {
      drawW = w * scale;
      drawH = (w / imgAspect) * scale;
    } else {
      drawH = h * scale;
      drawW = (h * imgAspect) * scale;
    }

    const imgX = (w - drawW) / 2;
    const imgY = (h - drawH) / 2;

    ctx.drawImage(this.heroImg, imgX, imgY, drawW, drawH);

    // Deep red tissue desaturation overlay as camera enters skin
    if (normP > 0.25) {
      const redTint = (normP - 0.25) / 0.75;
      ctx.fillStyle = `rgba(110, 18, 18, ${redTint * 0.85})`;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.restore();
    ctx.filter = 'none';
  }

  // SECTION 02: REALISTIC FLUID RBC STREAM ACROSS VIEWPORT
  drawFluidRBCStream(ctx, w, h, p) {
    // RBC Fade In: starts at P = 0.15 (after photo dissolves), fully visible by P = 0.20
    const rbcAlphaIn = p < 0.20 ? (p - 0.15) / 0.05 : 1.0;
    // RBC Settle & Dissolve into darkness toward P = 0.42 -> 0.48
    const rbcAlphaOut = p > 0.42 ? 1.0 - (p - 0.42) / 0.06 : 1.0;
    const rbcAlpha = Math.max(0, Math.min(1, rbcAlphaIn * rbcAlphaOut));

    if (rbcAlpha <= 0.001) return;

    const streamProgress = (p - 0.15) / 0.30; // 0 to 1

    ctx.save();
    ctx.globalAlpha = rbcAlpha;

    const imgAspect = this.rbcImg.width / this.rbcImg.height;

    // Multi-plane camera pan & fluid organic curved trajectory across viewport
    // Layer 1: Background Deep Vessel Layer (Soft blur, subtle motion)
    ctx.save();
    ctx.globalAlpha = rbcAlpha * 0.40;
    if (ctx.filter !== undefined) ctx.filter = 'blur(5px) brightness(60%)';

    const scale1 = 1.35 + streamProgress * 0.25;
    const drawW1 = w * scale1;
    const drawH1 = (w / imgAspect) * scale1;
    // Flow enters from left, moves along curved trajectory to right
    const x1 = (w - drawW1) / 2 - (streamProgress - 0.5) * (w * 0.30);
    const y1 = (h - drawH1) / 2 + Math.sin(streamProgress * Math.PI) * 45;

    ctx.drawImage(this.rbcImg, x1, y1, drawW1, drawH1);
    ctx.restore();

    // Layer 2: Main Focal Stream Layer (Sharp realistic biological RBCs)
    ctx.save();
    ctx.globalAlpha = rbcAlpha * 0.90;
    if (ctx.filter !== undefined) ctx.filter = 'contrast(130%) brightness(95%)';

    const scale2 = 1.2 + streamProgress * 0.30;
    const drawW2 = w * scale2;
    const drawH2 = (w / imgAspect) * scale2;
    const x2 = (w - drawW2) / 2 - (streamProgress - 0.5) * (w * 0.45);
    const y2 = (h - drawH2) / 2 + Math.cos(streamProgress * Math.PI * 1.1) * 35;

    ctx.drawImage(this.rbcImg, x2, y2, drawW2, drawH2);
    ctx.restore();

    // Layer 3: Foreground Near Plane Layer (Near cells passing close to camera)
    ctx.save();
    ctx.globalAlpha = rbcAlpha * 0.35;
    if (ctx.filter !== undefined) ctx.filter = 'blur(8px) brightness(110%)';

    const scale3 = 1.6 + streamProgress * 0.45;
    const drawW3 = w * scale3;
    const drawH3 = (w / imgAspect) * scale3;
    const x3 = (w - drawW3) / 2 - (streamProgress - 0.3) * (w * 0.55);
    const y3 = (h - drawH3) / 2 - (streamProgress - 0.2) * (h * 0.20);

    ctx.drawImage(this.rbcImg, x3, y3, drawW3, drawH3);
    ctx.restore();

    ctx.restore();
    ctx.filter = 'none';
  }

  // SECTION 03: NON-INVASIVE MEASUREMENT OPTICAL LIGHT PULSE
  drawOpticalMeasurementPulse(ctx, w, h, p) {
    const pulseT = (p - 0.45) / 0.20; // 0 to 1
    const centerX = w / 2;
    const centerY = h / 2;

    const sparkAlpha = Math.sin(Math.min(1, pulseT) * Math.PI);

    if (sparkAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = sparkAlpha * 0.85;

      const radius = Math.sin(pulseT * Math.PI) * (w * 0.35) + 30;
      const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.25, '#D6B84C');
      grad.addColorStop(0.6, 'rgba(214, 184, 76, 0.25)');
      grad.addColorStop(1, 'rgba(214, 184, 76, 0)');

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Dual optical wavelength pulse rings (660nm Red / 880nm IR)
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 0.85, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(214, 184, 76, ${0.5 * (1 - pulseT)})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 0.65, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(139, 45, 45, ${0.4 * (1 - pulseT)})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore();
    }
  }

  // SECTION 04: SIGNAL TO INSIGHT CONCEPTUAL PIPELINE
  drawSignalToInsightPipeline(ctx, w, h, p) {
    const pipeT = (p - 0.62) / 0.22; // 0 to 1
    const pipeAlpha = Math.min(1, pipeT * 2.5) * (p > 0.80 ? 1 - (p - 0.80) / 0.04 : 1);
    const centerY = h * 0.52;
    const amplitude = h * 0.14;
    const drawX = w * Math.min(1, pipeT * 1.3);

    ctx.save();
    ctx.globalAlpha = pipeAlpha;

    // Subtle optical signal waveform trace
    ctx.beginPath();
    let first = true;
    for (let x = 0; x <= drawX; x += 3) {
      const xNorm = x / w;
      const val = this.getPPGValue(xNorm, this.time * 0.04);
      const y = centerY - val * amplitude;
      if (first) { ctx.moveTo(x, y); first = false; } else { ctx.lineTo(x, y); }
    }
    ctx.strokeStyle = 'rgba(214, 184, 76, 0.75)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#D6B84C';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Secondary infrared absorption signal trace
    if (pipeT > 0.3) {
      const irT = (pipeT - 0.3) / 0.7;
      const irDrawX = w * Math.min(1, irT * 1.3);

      ctx.beginPath();
      first = true;
      for (let x = 0; x <= irDrawX; x += 3) {
        const xNorm = x / w;
        const val = this.getPPGValue(xNorm, this.time * 0.04 - 0.05);
        const y = centerY + 24 - val * (amplitude * 0.8);
        if (first) { ctx.moveTo(x, y); first = false; } else { ctx.lineTo(x, y); }
      }
      ctx.strokeStyle = 'rgba(139, 45, 45, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();
  }

  // SECTION 05: ACCESSIBILITY MATRIX TRANSFORMATION
  drawAccessibilityMatrix(ctx, w, h, p) {
    const gridT = (p - 0.82) / 0.18; // 0 to 1
    const gridAlpha = Math.min(1, gridT * 2.5);

    ctx.save();
    ctx.globalAlpha = gridAlpha;

    const cols = 8;
    const rows = 5;
    const cellW = w / cols;
    const cellH = h / rows;

    ctx.strokeStyle = `rgba(214, 184, 76, ${0.12 * gridT})`;
    ctx.lineWidth = 1;

    for (let c = 0; c <= cols; c++) {
      const x = c * cellW;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      const y = r * cellH;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Outer wireframe panel frame
    if (gridT > 0.4) {
      const panelAlpha = (gridT - 0.4) * 1.66;
      ctx.strokeStyle = `rgba(74, 155, 110, ${0.35 * panelAlpha})`;
      ctx.lineWidth = 1.5;

      const pX = w * 0.15;
      const pY = h * 0.18;
      const pW = w * 0.7;
      const pH = h * 0.64;

      ctx.strokeRect(pX, pY, pW, pH);

      const tick = 14;
      ctx.strokeStyle = '#D6B84C';
      ctx.beginPath(); ctx.moveTo(pX, pY + tick); ctx.lineTo(pX, pY); ctx.lineTo(pX + tick, pY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pX + pW - tick, pY); ctx.lineTo(pX + pW, pY); ctx.lineTo(pX + pW, pY + tick); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pX, pY + pH - tick); ctx.lineTo(pX, pY + pH); ctx.lineTo(pX + tick, pY + pH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pX + pW - tick, pY + pH); ctx.lineTo(pX + pW, pY + pH); ctx.lineTo(pX + pW, pY + pH - tick); ctx.stroke();
    }

    ctx.restore();
  }

  animate() {
    this.render();
    this.animationId = requestAnimationFrame(() => this.animate());
  }

  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
}
