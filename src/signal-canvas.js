// ============================================================
// AERIS — Signal Intelligence & Waveform Canvas
// Renders optical PPG waveforms (Red/IR), feature extraction markers,
// and the dramatic waveform-to-grid UI transformation.
// ============================================================

export class SignalCanvas {
  constructor(canvasEl) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.progress = 0;
    this.isVisible = false;
    this.animationId = null;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.time = 0;

    this.resize();
    this.bindEvents();
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
      resizeTimeout = setTimeout(() => this.resize(), 200);
    });
  }

  setVisible(visible) {
    this.isVisible = visible;
    if (visible && !this.animationId) this.animate();
  }

  setProgress(p) {
    this.progress = Math.max(0, Math.min(1, p));
  }

  // Generate synthetic PPG waveform value at normalized x position
  getPPGValue(xNorm, tOffset = 0) {
    const period = 0.35; // Beat cycle frequency
    const phase = (xNorm / period + tOffset) % 1.0;
    
    // Systolic peak + dicrotic notch model
    let y = 0;
    if (phase < 0.25) {
      // Primary systolic rise
      y = Math.sin((phase / 0.25) * Math.PI);
    } else if (phase < 0.45) {
      // Dicrotic notch valley
      const p2 = (phase - 0.25) / 0.2;
      y = 0.8 * Math.cos(p2 * Math.PI * 0.5) + 0.15 * Math.sin(p2 * Math.PI);
    } else if (phase < 0.65) {
      // Secondary diastolic wave
      const p3 = (phase - 0.45) / 0.2;
      y = 0.25 * Math.sin(p3 * Math.PI);
    } else {
      // Baseline relaxation
      y = 0.05 * Math.sin(((phase - 0.65) / 0.35) * Math.PI);
    }
    return Math.max(-0.2, y);
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const p = this.progress;
    this.time += 0.015;

    ctx.clearRect(0, 0, w, h);

    // Deep dark atmospheric background
    const bgGrad = ctx.createRadialGradient(w / 2, h / 2, w * 0.1, w / 2, h / 2, w * 0.7);
    bgGrad.addColorStop(0, 'rgba(18, 12, 10, 0.95)');
    bgGrad.addColorStop(1, 'rgba(5, 5, 5, 1.0)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Grid lines transformation phase (p > 0.6)
    const gridAlpha = p > 0.6 ? Math.min(1, (p - 0.6) / 0.3) : 0;
    if (gridAlpha > 0) {
      this.drawTransformingGrid(ctx, w, h, gridAlpha, p);
    }

    // Waveform phase (p <= 0.88)
    if (p <= 0.88) {
      const waveAlpha = p > 0.75 ? 1 - (p - 0.75) / 0.13 : 1;
      ctx.globalAlpha = waveAlpha;

      const centerY = h * 0.48;
      const amplitude = h * 0.18;
      const drawProgress = Math.min(1, p * 1.5); // Draws across width on scroll

      // Line 1: Primary Red PPG (660nm)
      this.drawWaveformLine(
        ctx, w, centerY, amplitude, drawProgress,
        '#D6B84C', 2.5, 0, 'rgba(214, 184, 76, 0.15)'
      );

      // Line 2: Infrared PPG (880nm)
      if (p > 0.2) {
        const irAlpha = Math.min(1, (p - 0.2) / 0.2);
        ctx.globalAlpha = waveAlpha * irAlpha;
        this.drawWaveformLine(
          ctx, w, centerY + 24, amplitude * 0.88, drawProgress,
          '#8B2D2D', 1.8, -0.04, 'rgba(139, 45, 45, 0.1)'
        );
      }

      // Line 3: Filtered Telemetry Stream
      if (p > 0.4) {
        const telemetryAlpha = Math.min(1, (p - 0.4) / 0.2);
        ctx.globalAlpha = waveAlpha * telemetryAlpha;
        this.drawWaveformLine(
          ctx, w, centerY - 24, amplitude * 0.6, drawProgress,
          '#4A9B6E', 1.2, 0.03, null
        );
      }

      // Feature extraction callouts / peak indicators
      if (p > 0.35 && drawProgress > 0.5) {
        this.drawFeatureMarkers(ctx, w, centerY, amplitude, p);
      }

      ctx.globalAlpha = 1.0;
    }
  }

  drawWaveformLine(ctx, w, centerY, amplitude, drawProgress, color, lineWidth, tShift, fillColor) {
    const step = 2;
    const maxDrawX = w * drawProgress;

    ctx.beginPath();
    let first = true;

    for (let x = 0; x <= maxDrawX; x += step) {
      const xNorm = x / w;
      const val = this.getPPGValue(xNorm, this.time * 0.05 + tShift);
      const y = centerY - val * amplitude;

      if (first) {
        ctx.moveTo(x, y);
        first = false;
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Fill area beneath curve
    if (fillColor && maxDrawX > 0) {
      ctx.lineTo(maxDrawX, centerY + amplitude * 0.5);
      ctx.lineTo(0, centerY + amplitude * 0.5);
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();
    }
  }

  drawFeatureMarkers(ctx, w, centerY, amplitude, p) {
    const markerProgress = Math.min(1, (p - 0.35) / 0.3);
    ctx.globalAlpha = markerProgress;

    // Find peak positions
    const peaks = [0.175, 0.525, 0.875];
    const labels = [
      { name: 'SpO₂ PEAK (660nm/880nm)', val: '97%', sub: 'Ratio of Absorbance' },
      { name: 'HRV INTERVAL (SDNN)', val: '45 ms', sub: 'Inter-Beat Variation' },
      { name: 'PERFUSION INDEX (PI)', val: '2.1%', sub: 'Pulsatile Amplitude Ratio' }
    ];

    peaks.forEach((xNorm, idx) => {
      const x = xNorm * w;
      if (x > w * p * 1.3) return; // Only show if drawn past

      const val = this.getPPGValue(xNorm, this.time * 0.05);
      const y = centerY - val * amplitude;

      // Glowing peak marker node
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#D6B84C';
      ctx.shadowColor = '#D6B84C';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Vertical dashed indicator line down to HUD
      ctx.beginPath();
      ctx.setLineDash([3, 3]);
      ctx.moveTo(x, y + 8);
      ctx.lineTo(x, centerY + amplitude + 40);
      ctx.strokeStyle = 'rgba(214, 184, 76, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);

      // Annotation label
      const item = labels[idx];
      if (item) {
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillStyle = '#D6B84C';
        ctx.textAlign = 'center';
        ctx.fillText(item.name, x, centerY + amplitude + 58);

        ctx.font = '600 16px "Inter", sans-serif';
        ctx.fillStyle = '#F2F1ED';
        ctx.fillText(item.val, x, centerY + amplitude + 78);

        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillStyle = '#8E8D87';
        ctx.fillText(item.sub, x, centerY + amplitude + 94);
      }
    });
  }

  drawTransformingGrid(ctx, w, h, gridAlpha, p) {
    const transformStage = Math.min(1, (p - 0.6) / 0.35);

    ctx.save();
    ctx.globalAlpha = gridAlpha;

    const cols = 6;
    const rows = 4;
    const cellW = w / cols;
    const cellH = h / rows;

    // Grid lines expanding out from center waveform
    ctx.strokeStyle = `rgba(214, 184, 76, ${0.12 * transformStage})`;
    ctx.lineWidth = 1;

    // Vertical lines
    for (let c = 0; c <= cols; c++) {
      const x = c * cellW;
      const lineLen = h * transformStage;
      const startY = (h - lineLen) / 2;

      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, startY + lineLen);
      ctx.stroke();
    }

    // Horizontal lines
    for (let r = 0; r <= rows; r++) {
      const y = r * cellH;
      const lineLen = w * transformStage;
      const startX = (w - lineLen) / 2;

      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(startX + lineLen, y);
      ctx.stroke();
    }

    // Intersecting HUD node points
    if (transformStage > 0.5) {
      const nodeAlpha = (transformStage - 0.5) * 2;
      ctx.fillStyle = `rgba(214, 184, 76, ${0.4 * nodeAlpha})`;

      for (let c = 1; c < cols; c++) {
        for (let r = 1; r < rows; r++) {
          ctx.beginPath();
          ctx.arc(c * cellW, r * cellH, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Wireframe panel boundaries emerging (preview of dashboard UI geometry)
    if (transformStage > 0.7) {
      const panelAlpha = (transformStage - 0.7) * 3.33;
      ctx.strokeStyle = `rgba(74, 155, 110, ${0.3 * panelAlpha})`;
      ctx.lineWidth = 1.5;

      const pX = w * 0.15;
      const pY = h * 0.2;
      const pW = w * 0.7;
      const pH = h * 0.6;

      ctx.strokeRect(pX, pY, pW, pH);

      // Corner tech tick marks
      const tick = 12;
      ctx.strokeStyle = '#D6B84C';

      // Top-Left
      ctx.beginPath();
      ctx.moveTo(pX, pY + tick); ctx.lineTo(pX, pY); ctx.lineTo(pX + tick, pY);
      ctx.stroke();

      // Top-Right
      ctx.beginPath();
      ctx.moveTo(pX + pW - tick, pY); ctx.lineTo(pX + pW, pY); ctx.lineTo(pX + pW, pY + tick);
      ctx.stroke();

      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(pX, pY + pH - tick); ctx.lineTo(pX, pY + pH); ctx.lineTo(pX + tick, pY + pH);
      ctx.stroke();

      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(pX + pW - tick, pY + pH); ctx.lineTo(pX + pW, pY + pH); ctx.lineTo(pX + pW, pY + pH - tick);
      ctx.stroke();
    }

    ctx.restore();
  }

  animate() {
    if (!this.isVisible) {
      this.animationId = null;
      return;
    }
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
