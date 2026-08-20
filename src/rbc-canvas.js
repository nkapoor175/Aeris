// ============================================================
// AERIS — 3D RBC Bloodstream Canvas
// Perspective-projected 3D camera simulation through biological bloodstream.
// Driven by scroll progress p (0.0 -> 1.0).
// Features: 3D perspective projection, z-sorting, biconcave cell geometry,
// depth-of-field blur layers, volumetric lighting, and continuous camera travel.
// ============================================================

export class RBCCanvas {
  constructor(canvasEl) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.cells = [];
    this.progress = 0;
    this.isVisible = false;
    this.animationId = null;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.isMobile = window.innerWidth < 768;

    // Rich erythrocyte volumetric color palette
    this.colors = [
      { r: 185, g: 32, b: 32, dim: '#4a0808' },  // Vivid oxygenated arterial red
      { r: 145, g: 24, b: 24, dim: '#380505' },  // Deep capillary red
      { r: 110, g: 18, b: 18, dim: '#280303' },  // Shadowed red
      { r: 165, g: 40, b: 30, dim: '#440a06' },  // Translucent amber-red highlight
      { r: 85, g: 12, b: 12, dim: '#1c0202' },   // Deep background red
    ];

    // Background color interpolation states
    this.bgFrom = { r: 5, g: 5, b: 5 };
    this.bgVessel = { r: 24, g: 4, b: 6 };
    this.bgCapillary = { r: 36, g: 8, b: 10 };

    this.resize();
    this.create3DCells();
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
    this.fov = Math.min(this.width, this.height) * 0.9;
  }

  create3DCells() {
    this.cells = [];
    const count = this.isMobile ? 48 : 110;
    const tunnelRadius = Math.min(this.width, this.height) * 0.8;

    for (let i = 0; i < count; i++) {
      const color = this.colors[Math.floor(Math.random() * this.colors.length)];
      
      // Cylindrical distribution around camera axis
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) * tunnelRadius * 0.95 + 40;
      
      this.cells.push({
        id: i,
        // 3D coordinates in camera space
        worldX: Math.cos(angle) * radius,
        worldY: Math.sin(angle) * radius,
        worldZ: Math.random() * 2400 - 400, // Z depth range from -400 to 2000px
        
        baseRadius: 36 + Math.random() * 34, // Base cell size (µm scaled)
        aspectRatio: 0.6 + Math.random() * 0.25, // Biconcave squish
        
        // 3D Rotations
        rotX: Math.random() * Math.PI * 2,
        rotY: Math.random() * Math.PI * 2,
        rotZ: Math.random() * Math.PI * 2,
        rotSpeedX: (Math.random() - 0.5) * 0.012,
        rotSpeedY: (Math.random() - 0.5) * 0.015,
        rotSpeedZ: (Math.random() - 0.5) * 0.008,
        
        // Drift velocities
        speedZ: 2.5 + Math.random() * 4.0,
        driftAngle: Math.random() * Math.PI * 2,
        wobbleFreq: 0.01 + Math.random() * 0.02,
        wobblePhase: Math.random() * Math.PI * 2,
        
        maxOpacity: 0.35 + Math.random() * 0.55,
        color,
      });
    }
  }

  bindEvents() {
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.isMobile = window.innerWidth < 768;
        this.resize();
        this.create3DCells();
      }, 200);
    });
  }

  setVisible(visible) {
    this.isVisible = visible;
    if (visible && !this.animationId) this.animate();
  }

  setProgress(p) {
    this.progress = Math.max(0, Math.min(1, p));
  }

  update() {
    if (this.reducedMotion) return;
    const p = this.progress;

    // Camera Z speed increases with scroll progress (feeling of entering & rushing through)
    const cameraSpeed = 1.0 + p * 6.5;
    
    // Convergence factor: cells align toward fingertip contact focal point when p > 0.55
    const converge = p > 0.55 && p < 0.85 ? Math.sin(((p - 0.55) / 0.3) * Math.PI) : 0;
    const disperse = p > 0.85 ? (p - 0.85) / 0.15 : 0;

    for (const cell of this.cells) {
      // 3D Rotation updates
      cell.rotX += cell.rotSpeedX;
      cell.rotY += cell.rotSpeedY;
      cell.rotZ += cell.rotSpeedZ;
      cell.wobblePhase += cell.wobbleFreq;

      // Z motion (camera flying forward through vessel)
      cell.worldZ -= cell.speedZ * cameraSpeed;

      // Recycle cells that fly past camera (Z < -300)
      if (cell.worldZ < -300) {
        cell.worldZ += 2400;
        const angle = Math.random() * Math.PI * 2;
        const tunnelRadius = Math.min(this.width, this.height) * 0.8;
        const radius = Math.sqrt(Math.random()) * tunnelRadius * 0.95 + 40;
        cell.worldX = Math.cos(angle) * radius;
        cell.worldY = Math.sin(angle) * radius;
      }

      // Convergence attraction toward center focal point (Transition to fingertip sensor)
      if (converge > 0) {
        const targetX = (cell.id % 5 - 2) * 20;
        const targetY = (cell.id % 3 - 1) * 20;
        cell.currentX = cell.worldX * (1 - converge) + targetX * converge;
        cell.currentY = cell.worldY * (1 - converge) + targetY * converge;
      } else if (disperse > 0) {
        cell.currentX = cell.worldX * (1 + disperse * 1.5);
        cell.currentY = cell.worldY * (1 + disperse * 1.5);
      } else {
        cell.currentX = cell.worldX + Math.sin(cell.wobblePhase) * 12;
        cell.currentY = cell.worldY + Math.cos(cell.wobblePhase) * 12;
      }
    }
  }

  drawCell3D(ctx, cell, centerX, centerY) {
    const fov = this.fov;
    const z = cell.worldZ;

    // Clip cells behind camera
    if (z <= 10) return;

    // Perspective Projection: x' = x * (fov / z), y' = y * (fov / z)
    const scale = fov / z;
    const projX = centerX + cell.currentX * scale;
    const projY = centerY + cell.currentY * scale;

    // Clip cells outside visible screen padding
    if (projX < -150 || projX > this.width + 150 || projY < -150 || projY > this.height + 150) return;

    const radius = cell.baseRadius * scale;
    if (radius < 1.5) return; // Too small to render

    // Depth-of-field opacity & blur factor based on distance z
    // Focal plane around z = 500
    const focusDist = Math.abs(z - 500);
    const dofBlur = Math.min(8, focusDist / 180);
    
    // Atmospheric fog fading with Z distance
    const fogFactor = Math.max(0, Math.min(1, 1 - (z - 200) / 1800));
    const opacity = cell.maxOpacity * fogFactor;

    if (opacity <= 0.01) return;

    ctx.save();
    ctx.translate(projX, projY);
    ctx.rotate(cell.rotZ);
    ctx.scale(1, cell.aspectRatio);

    ctx.globalAlpha = opacity;

    // Apply per-cell depth-of-field blur if supported
    if (dofBlur > 1.5 && ctx.filter !== undefined) {
      ctx.filter = `blur(${dofBlur.toFixed(1)}px)`;
    } else {
      ctx.filter = 'none';
    }

    // Volumetric 3D Biconcave Disk Shading (Radial Gradient)
    const highlightX = -radius * 0.25;
    const highlightY = -radius * 0.25;
    const grad = ctx.createRadialGradient(highlightX, highlightY, radius * 0.08, 0, 0, radius);
    
    grad.addColorStop(0, `rgb(${Math.min(255, cell.color.r + 75)}, ${Math.min(255, cell.color.g + 45)}, ${Math.min(255, cell.color.b + 45)})`);
    grad.addColorStop(0.55, `rgb(${cell.color.r}, ${cell.color.g}, ${cell.color.b})`);
    grad.addColorStop(0.85, `rgb(${Math.max(0, cell.color.r - 40)}, ${Math.max(0, cell.color.g - 15)}, ${Math.max(0, cell.color.b - 15)})`);
    grad.addColorStop(1, cell.color.dim);

    // Main cell body
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Central Biconcave Indentation (Dimple depression)
    const dimpleR = radius * 0.48;
    const dimpleGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, dimpleR);
    dimpleGrad.addColorStop(0, `rgba(${Math.min(255, cell.color.r + 90)}, ${Math.min(255, cell.color.g + 50)}, ${Math.min(255, cell.color.b + 50)}, 0.65)`);
    dimpleGrad.addColorStop(0.7, `rgba(${cell.color.r}, ${cell.color.g}, ${cell.color.b}, 0.15)`);
    dimpleGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.beginPath();
    ctx.arc(0, 0, dimpleR, 0, Math.PI * 2);
    ctx.fillStyle = dimpleGrad;
    ctx.fill();

    // Specular Rim Reflection Highlight
    ctx.beginPath();
    ctx.arc(-radius * 0.3, -radius * 0.3, radius * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 220, 220, 0.25)';
    ctx.fill();

    ctx.restore();
    ctx.filter = 'none';
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const p = this.progress;

    ctx.clearRect(0, 0, w, h);

    // Background vessel color transition: Dark black -> Deep Blood Burgundy -> Bright Capillary Red -> Black
    let bgR, bgG, bgB;
    if (p < 0.4) {
      const t = p / 0.4;
      bgR = Math.round(this.bgFrom.r + (this.bgVessel.r - this.bgFrom.r) * t);
      bgG = Math.round(this.bgFrom.g + (this.bgVessel.g - this.bgFrom.g) * t);
      bgB = Math.round(this.bgFrom.b + (this.bgVessel.b - this.bgFrom.b) * t);
    } else if (p < 0.75) {
      const t = (p - 0.4) / 0.35;
      bgR = Math.round(this.bgVessel.r + (this.bgCapillary.r - this.bgVessel.r) * t);
      bgG = Math.round(this.bgVessel.g + (this.bgCapillary.g - this.bgVessel.g) * t);
      bgB = Math.round(this.bgVessel.b + (this.bgCapillary.b - this.bgVessel.b) * t);
    } else {
      const t = (p - 0.75) / 0.25;
      bgR = Math.round(this.bgCapillary.r + (this.bgFrom.r - this.bgCapillary.r) * t);
      bgG = Math.round(this.bgCapillary.g + (this.bgFrom.g - this.bgCapillary.g) * t);
      bgB = Math.round(this.bgCapillary.b + (this.bgFrom.b - this.bgCapillary.b) * t);
    }

    // Radial lighting gradient (camera headlight in blood vessel)
    const vesselGrad = ctx.createRadialGradient(w / 2, h / 2, w * 0.05, w / 2, h / 2, w * 0.75);
    vesselGrad.addColorStop(0, `rgb(${Math.min(255, bgR + 28)}, ${Math.min(255, bgG + 10)}, ${Math.min(255, bgB + 12)})`);
    vesselGrad.addColorStop(0.75, `rgb(${bgR}, ${bgG}, ${bgB})`);
    vesselGrad.addColorStop(1, '#040303');

    ctx.fillStyle = vesselGrad;
    ctx.fillRect(0, 0, w, h);

    // Z-Sort cells for painter's algorithm (render furthest cells first, nearest last)
    this.cells.sort((a, b) => b.worldZ - a.worldZ);

    const centerX = w / 2;
    const centerY = h / 2;

    for (const cell of this.cells) {
      this.drawCell3D(ctx, cell, centerX, centerY);
    }

    // Atmospheric Vignette Edge Darkening
    const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.4, w / 2, h / 2, Math.max(w, h) * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(5,3,3,0.85)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  animate() {
    if (!this.isVisible) {
      this.animationId = null;
      return;
    }
    this.update();
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
