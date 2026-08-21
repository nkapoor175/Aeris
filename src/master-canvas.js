// ============================================================
// AERIS — Scientific Product Film Master Canvas Engine
// Renders the single continuous camera journey:
// Scene 1: Hero Desaturated Photograph + Parallax
// Scene 2: Camera pushes INTO image → transitions into biological lumen
// Scene 3: Realistic 3D Human Red Blood Cells (Biconcave disc, central dimple)
// Scene 4: Restrained Dual-Wavelength Optical Interaction (660nm & 880nm)
// Scene 5: RBC Motion transforms into clean PPG Waveform Signals
// Scene 6: Signal resolves into AI Classification Codes & AERIS Console CTA
// ============================================================

export class MasterCanvas {
  constructor(canvasEl) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.targetProgress = 0;
    this.currentProgress = 0;
    this.animationId = null;
    this.dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    this.time = 0;

    this.reducedMotion = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
    this.isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;

    // Mouse tracking for hero parallax
    this.mouse = { x: 0, y: 0, normX: 0, normY: 0 };

    // Hero image loading
    this.heroImg = new Image();
    this.heroImgLoaded = false;
    this.heroImg.src = '/images/blood-draw.png';
    this.heroImg.onload = () => { this.heroImgLoaded = true; };

    // Initialize 3D Realistic Human RBC Cells
    this.cells = [];
    this.createRealisticRBCs();

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

    this.fov = Math.min(this.width, this.height) * 0.85;
  }

  // Create high-quality, biologically realistic human erythrocytes
  createRealisticRBCs() {
    this.cells = [];
    const count = this.isMobile ? 18 : 32; // Smaller count of HIGH QUALITY cells
    const tunnelRadius = Math.min(this.width || 1000, this.height || 700) * 0.75;

    // Biological erythrocyte color tones (ONLY real reds & shadowed burgundy, NO yellow!)
    const rbcPalette = [
      { r: 180, g: 30, b: 30, dim: '#3a0505', rim: 'rgba(255, 190, 190, 0.35)' }, // Oxygenated red
      { r: 145, g: 22, b: 22, dim: '#2c0404', rim: 'rgba(230, 160, 160, 0.25)' }, // Deoxygenated venous red
      { r: 120, g: 16, b: 16, dim: '#200303', rim: 'rgba(200, 140, 140, 0.20)' }, // Deep shadowed red
    ];

    for (let i = 0; i < count; i++) {
      const color = rbcPalette[i % rbcPalette.length];
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) * tunnelRadius * 0.9 + 30;

      this.cells.push({
        id: i,
        // 3D coordinates in camera space
        worldX: Math.cos(angle) * radius,
        worldY: Math.sin(angle) * radius,
        worldZ: Math.random() * 2200 - 300,
        currentX: 0,
        currentY: 0,
        currentZ: 0,

        baseRadius: 36 + Math.random() * 28,
        aspectRatio: 0.52 + Math.random() * 0.25, // Biconcave squish

        // 3D Rotations
        rotZ: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.01,
        speedZ: 2.5 + Math.random() * 3.5,
        wobbleFreq: 0.008 + Math.random() * 0.015,
        wobblePhase: Math.random() * Math.PI * 2,

        // Morph target mapping
        waveTargetX: (i / count),
        opacity: 0.4 + Math.random() * 0.5,
        color,
      });
    }
  }

  bindEvents() {
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => this.resize(), 200);
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.normX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.normY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    }, { passive: true });
  }

  setProgress(p) {
    this.targetProgress = Math.max(0, Math.min(1, p));
  }

  smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // PPG Waveform math
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

  // Physics update loop
  updateRBCs(p) {
    if (this.reducedMotion) return;
    const cameraSpeed = 1.0 + Math.pow(Math.min(1, p * 2.5), 1.5) * 5.5;
    const morphToWave = p >= 0.54 ? Math.min(1, (p - 0.54) / 0.18) : 0;

    const w = this.width;
    const h = this.height;

    for (const cell of this.cells) {
      cell.rotZ += cell.rotSpeed;
      cell.wobblePhase += cell.wobbleFreq;

      // Z camera motion
      cell.worldZ -= cell.speedZ * cameraSpeed;
      if (cell.worldZ < -300) {
        cell.worldZ += 2200;
        const angle = Math.random() * Math.PI * 2;
        const tunnelRadius = Math.min(w, h) * 0.75;
        const radius = Math.sqrt(Math.random()) * tunnelRadius * 0.9 + 30;
        cell.worldX = Math.cos(angle) * radius;
        cell.worldY = Math.sin(angle) * radius;
      }

      let tx = cell.worldX + Math.sin(cell.wobblePhase) * 12;
      let ty = cell.worldY + Math.cos(cell.wobblePhase) * 12;
      let tz = cell.worldZ;

      // Transform cell positions into Waveform vertices as progress enters signal phase
      if (morphToWave > 0) {
        const xNorm = cell.waveTargetX;
        const val = this.getPPGValue(xNorm, this.time * 0.04);
        const targetScreenX = (xNorm - 0.5) * w * 0.85;
        const targetScreenY = -val * (h * 0.14);

        tx = this.lerp(tx, targetScreenX, morphToWave);
        ty = this.lerp(ty, targetScreenY, morphToWave);
        tz = this.lerp(tz, 450, morphToWave);
      }

      cell.currentX = tx;
      cell.currentY = ty;
      cell.currentZ = tz;
    }
  }

  // Animation Loop
  animate() {
    this.time += 0.016;

    // Smooth inertia interpolation
    const lerpSpeed = this.reducedMotion ? 1.0 : 0.085;
    this.currentProgress += (this.targetProgress - this.currentProgress) * lerpSpeed;
    const p = this.currentProgress;

    this.updateRBCs(p);
    this.render(p);

    this.animationId = requestAnimationFrame(() => this.animate());
  }

  render(p) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    // ── 1. BACKGROUND COLOR INTERPOLATION ──
    // Deep black -> Dark microvascular red background -> Black -> Subtle gold ambient
    let bgR = 5, bgG = 5, bgB = 5;

    const bloodT = this.smoothstep(0.15, 0.26, p) * (1 - this.smoothstep(0.48, 0.56, p));
    bgR = Math.round(5 + bloodT * 26);
    bgG = Math.round(5 + bloodT * 3);
    bgB = Math.round(5 + bloodT * 4);

    const bgGrad = ctx.createRadialGradient(w / 2, h / 2, w * 0.05, w / 2, h / 2, w * 0.85);
    bgGrad.addColorStop(0, `rgb(${bgR + 12}, ${bgG + 6}, ${bgB + 4})`);
    bgGrad.addColorStop(1, `rgb(${bgR}, ${bgG}, ${bgB})`);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // ── 2. SCENE 1 & 2: HERO PHOTOGRAPH & CAMERA ZOOM INTO IMAGE (P: 0.00 -> 0.28) ──
    const heroAlpha = 1 - this.smoothstep(0.16, 0.26, p);
    if (heroAlpha > 0.001 && this.heroImgLoaded) {
      this.drawHeroPhotograph(ctx, w, h, p, heroAlpha);
    }

    // ── 3. SCENE 3: REALISTIC HUMAN RED BLOOD CELLS (P: 0.20 -> 0.65) ──
    const rbcAlpha = this.smoothstep(0.20, 0.28, p) * (1 - this.smoothstep(0.58, 0.65, p));
    if (rbcAlpha > 0.001) {
      this.drawRealisticRBCs(ctx, w, h, p, rbcAlpha);
    }

    // ── 4. SCENE 4: RESTRAINED DUAL-WAVELENGTH OPTICAL LIGHT BEAM (P: 0.44 -> 0.62) ──
    const beamAlpha = this.smoothstep(0.44, 0.50, p) * (1 - this.smoothstep(0.58, 0.62, p));
    if (beamAlpha > 0.001) {
      this.drawOpticalBeam(ctx, w, h, p, beamAlpha);
    }

    // ── 5. SCENE 5: WAVEFORM SIGNAL TRACES (P: 0.58 -> 0.84) ──
    const waveAlpha = this.smoothstep(0.58, 0.64, p) * (1 - this.smoothstep(0.80, 0.84, p));
    if (waveAlpha > 0.001) {
      this.drawWaveformSignals(ctx, w, h, p, waveAlpha);
    }

    // ── 6. ATMOSPHERIC VIGNETTE & CRISP SCANLINE ──
    const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.38, w / 2, h / 2, Math.max(w, h) * 0.82);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(3,2,2,0.92)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  // Renders Scene 1 & 2: Hero Photograph & Camera Push INTO Tissue Depth
  drawHeroPhotograph(ctx, w, h, p, alpha) {
    const normP = Math.min(1, p / 0.22);
    // Camera zoom push-in
    const scale = 1.0 + Math.pow(normP, 1.6) * 0.45;
    const blurAmount = normP * 18;
    const brightness = Math.max(12, 85 - normP * 72);

    ctx.save();
    ctx.globalAlpha = alpha;

    if (blurAmount > 0.8 && ctx.filter !== undefined) {
      ctx.filter = `grayscale(100%) contrast(140%) brightness(${brightness}%) blur(${blurAmount.toFixed(1)}px)`;
    } else {
      ctx.filter = `grayscale(100%) contrast(140%) brightness(${brightness}%)`;
    }

    // Subtle pointer parallax displacement
    const px = this.mouse.normX * 16;
    const py = this.mouse.normY * 16;

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

    const imgX = (w - drawW) / 2 + px;
    const imgY = (h - drawH) / 2 + py;

    ctx.drawImage(this.heroImg, imgX, imgY, drawW, drawH);

    // Microvascular tissue desaturation tint as camera moves under the skin
    if (normP > 0.2) {
      const tissueTint = (normP - 0.2) / 0.8;
      ctx.fillStyle = `rgba(75, 10, 10, ${tissueTint * 0.85})`;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.restore();
    ctx.filter = 'none';
  }

  // Renders Scene 3: Biologically Realistic Human Erythrocytes (3D Biconcave Discs)
  drawRealisticRBCs(ctx, w, h, p, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;

    // Z-Sort for painter's depth algorithm
    this.cells.sort((a, b) => b.currentZ - a.currentZ);

    const centerX = w / 2;
    const centerY = h / 2;
    const fov = this.fov || 800;
    const morphFactor = p >= 0.54 ? Math.min(1, (p - 0.54) / 0.18) : 0;

    for (const cell of this.cells) {
      const z = cell.currentZ;
      if (z <= 10) continue;

      const scale = fov / z;
      const projX = centerX + cell.currentX * (morphFactor > 0.5 ? 1 : scale);
      const projY = centerY + cell.currentY * (morphFactor > 0.5 ? 1 : scale);

      if (projX < -150 || projX > w + 150 || projY < -150 || projY > h + 150) continue;

      const radius = cell.baseRadius * scale;
      if (radius < 1.2) continue;

      // Depth of field blur & atmospheric fog
      const focusDist = Math.abs(z - 450);
      const dofBlur = Math.min(7, focusDist / 190) * (1 - morphFactor);
      const fogFactor = Math.max(0, Math.min(1, 1 - (z - 200) / 1800));
      const opacity = cell.opacity * fogFactor;

      if (opacity <= 0.01) continue;

      ctx.save();
      ctx.translate(projX, projY);
      ctx.rotate(cell.rotZ);
      ctx.scale(1, cell.aspectRatio);
      ctx.globalAlpha = opacity;

      if (dofBlur > 1.4 && ctx.filter !== undefined) {
        ctx.filter = `blur(${dofBlur.toFixed(1)}px)`;
      }

      // Volumetric Biconcave Disc Gradient (REALISTIC BIOLOGICAL RED ONLY!)
      const hlX = -radius * 0.25;
      const hlY = -radius * 0.25;
      const grad = ctx.createRadialGradient(hlX, hlY, radius * 0.08, 0, 0, radius);
      grad.addColorStop(0, `rgb(${Math.min(255, cell.color.r + 75)}, ${Math.min(255, cell.color.g + 45)}, ${Math.min(255, cell.color.b + 45)})`);
      grad.addColorStop(0.55, `rgb(${cell.color.r}, ${cell.color.g}, ${cell.color.b})`);
      grad.addColorStop(0.85, `rgb(${Math.max(0, cell.color.r - 40)}, ${Math.max(0, cell.color.g - 18)}, ${Math.max(0, cell.color.b - 18)})`);
      grad.addColorStop(1, cell.color.dim);

      // Outer Erythrocyte Disc
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Central Biconcave Indentation (Dimple Depression)
      const dimpleR = radius * 0.48;
      const dimpleGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, dimpleR);
      dimpleGrad.addColorStop(0, `rgba(${Math.min(255, cell.color.r + 85)}, ${Math.min(255, cell.color.g + 45)}, ${Math.min(255, cell.color.b + 45)}, 0.6)`);
      dimpleGrad.addColorStop(0.7, `rgba(${cell.color.r}, ${cell.color.g}, ${cell.color.b}, 0.15)`);
      dimpleGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(0, 0, dimpleR, 0, Math.PI * 2);
      ctx.fillStyle = dimpleGrad;
      ctx.fill();

      // Specular Rim Reflection Highlight
      ctx.beginPath();
      ctx.arc(-radius * 0.28, -radius * 0.28, radius * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = cell.color.rim;
      ctx.fill();

      ctx.restore();
      ctx.filter = 'none';
    }

    ctx.restore();
  }

  // Renders Scene 4: Restrained Dual-Wavelength Optical Laser Beam Interaction
  drawOpticalBeam(ctx, w, h, p, alpha) {
    const centerY = h * 0.5;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Restrained 660nm Red Laser Beam Line
    ctx.beginPath();
    ctx.moveTo(0, centerY - 15);
    ctx.lineTo(w, centerY - 15);
    ctx.strokeStyle = 'rgba(185, 32, 32, 0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Restrained 880nm IR Laser Beam Line (Warm Gold)
    ctx.beginPath();
    ctx.moveTo(0, centerY + 15);
    ctx.lineTo(w, centerY + 15);
    ctx.strokeStyle = 'rgba(200, 168, 70, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Subtle Focal Beam Glow Pass
    const beamGlow = ctx.createLinearGradient(0, centerY - 30, 0, centerY + 30);
    beamGlow.addColorStop(0, 'rgba(185, 32, 32, 0)');
    beamGlow.addColorStop(0.5, 'rgba(200, 168, 70, 0.08)');
    beamGlow.addColorStop(1, 'rgba(185, 32, 32, 0)');
    ctx.fillStyle = beamGlow;
    ctx.fillRect(0, centerY - 35, w, 70);

    ctx.restore();
  }

  // Renders Scene 5: Clean PPG Waveform Signal Traces
  drawWaveformSignals(ctx, w, h, p, alpha) {
    const waveT = (p - 0.58) / 0.24; // 0 to 1
    const drawProgress = Math.min(1, waveT * 1.35);
    const centerY = h * 0.5;
    const amplitude = h * 0.14;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Primary 660nm Waveform Trace (Warm AERIS Gold)
    this.drawPPGLine(ctx, w, centerY, amplitude, drawProgress, '#C8A846', 2.2, 0, 'rgba(200, 168, 70, 0.06)');

    // Secondary 880nm IR Waveform Trace (Subtle Red)
    if (waveT > 0.15) {
      this.drawPPGLine(ctx, w, centerY + 20, amplitude * 0.8, drawProgress, '#8B1E1E', 1.6, -0.04, 'rgba(139, 30, 30, 0.05)');
    }

    ctx.restore();
  }

  drawPPGLine(ctx, w, centerY, amplitude, drawProgress, color, lineWidth, tShift, fillColor) {
    const maxDrawX = w * drawProgress;
    if (maxDrawX <= 0) return;

    ctx.beginPath();
    let first = true;
    const step = 2;

    for (let x = 0; x <= maxDrawX; x += step) {
      const xNorm = x / w;
      const val = this.getPPGValue(xNorm, this.time * 0.04 + tShift);
      const y = centerY - val * amplitude;
      if (first) { ctx.moveTo(x, y); first = false; }
      else { ctx.lineTo(x, y); }
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (fillColor && maxDrawX > 0) {
      ctx.lineTo(maxDrawX, centerY + amplitude * 0.45);
      ctx.lineTo(0, centerY + amplitude * 0.45);
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();
    }
  }

  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
}
