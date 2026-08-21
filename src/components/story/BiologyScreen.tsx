import React, { useEffect, useRef, useState } from "react";

export function BiologyScreen() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isInView, setIsInView] = useState(false);
  const dnaAngleRef = useRef(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { threshold: 0.2, rootMargin: "-10% 0px -10% 0px" }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    // 6 RBCs — positioned as proportions, clustered around the DNA column
    const rbcDefs = [
      { px: 0.30, py: 0.13, z: 0.38, scale: 0.78, baseRot: 0.4, blur: 2.5 },
      { px: 0.58, py: 0.27, z: 0.92, scale: 1.08, baseRot: 1.1, blur: 0 },
      { px: 0.24, py: 0.47, z: 0.25, scale: 0.62, baseRot: 2.1, blur: 3.5 },
      { px: 0.61, py: 0.63, z: 0.84, scale: 0.90, baseRot: 0.7, blur: 0.5 },
      { px: 0.36, py: 0.77, z: 0.96, scale: 1.02, baseRot: 1.6, blur: 0 },
      { px: 0.50, py: 0.91, z: 0.35, scale: 0.68, baseRot: 2.5, blur: 2.5 },
    ];

    const render = () => {
      const parent = canvas.parentElement;
      const dpr = window.devicePixelRatio || 1;
      const w = parent?.clientWidth || 450;
      const h = parent?.clientHeight || 700;

      // Resize buffer only when needed for performance
      const targetW = Math.round(w * dpr);
      const targetH = Math.round(h * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // --- Subtle atmospheric dark-red gradient ---
      const glowStr = isInView ? 0.22 : 0.09;
      const atmo = ctx.createRadialGradient(w * 0.44, h * 0.5, 18, w * 0.44, h * 0.5, w * 0.55);
      atmo.addColorStop(0, `rgba(80, 12, 14, ${glowStr})`);
      atmo.addColorStop(0.55, `rgba(36, 6, 8, ${glowStr * 0.35})`);
      atmo.addColorStop(1, "rgba(3,3,3,0)");
      ctx.fillStyle = atmo;
      ctx.fillRect(0, 0, w, h);

      // --- DNA Double Helix (3D depth-sorted) ---
      dnaAngleRef.current += 0.003;
      const angle = dnaAngleRef.current;

      const cx = w * 0.44;
      const helixR = Math.min(w * 0.135, 55);
      const crop = 95; // pixels beyond canvas edges
      const startY = -crop;
      const endY = h + crop;
      const totalLen = endY - startY;
      const steps = 360;
      const turns = 3.2;
      const rungEvery = Math.floor(steps / 26);

      ctx.lineCap = "round";

      // Z-depth → color
      const strandCol = (z: number) => {
        const n = (z + 1) / 2; // 0–1
        const r = 38 + n * 120;
        const g = 7 + n * 24;
        const b = 7 + n * 20;
        const a = 0.40 + n * 0.60;
        return `rgba(${r | 0},${g | 0},${b | 0},${a.toFixed(2)})`;
      };
      // Z-depth → stroke width
      const strandW = (z: number) => 2.0 + ((z + 1) / 2) * 3.2;

      for (let i = 0; i < steps; i++) {
        const t0 = i / steps;
        const t1 = (i + 1) / steps;
        const y0 = startY + t0 * totalLen;
        const y1 = startY + t1 * totalLen;
        if (y1 < -12 || y0 > h + 12) continue; // skip offscreen

        const p0 = angle + t0 * turns * Math.PI * 2;
        const p1 = angle + t1 * turns * Math.PI * 2;

        // Strand A
        const ax0 = cx + Math.sin(p0) * helixR;
        const az0 = Math.cos(p0);
        const ax1 = cx + Math.sin(p1) * helixR;
        // Strand B (π offset)
        const bx0 = cx - Math.sin(p0) * helixR;
        const bz0 = -az0;
        const bx1 = cx - Math.sin(p1) * helixR;

        const aFront = az0 >= bz0;

        // 1. Back strand segment
        const [bkX0, bkX1, bkZ] = aFront ? [bx0, bx1, bz0] : [ax0, ax1, az0];
        ctx.beginPath();
        ctx.moveTo(bkX0, y0);
        ctx.lineTo(bkX1, y1);
        ctx.strokeStyle = strandCol(bkZ);
        ctx.lineWidth = strandW(bkZ);
        ctx.stroke();

        // 2. Base pair rung at intervals
        if (i % rungEvery === 0 && i > 0) {
          const aAlpha = 0.20 + ((az0 + 1) / 2) * 0.50;
          const bAlpha = 0.20 + ((bz0 + 1) / 2) * 0.50;
          const minA = Math.min(aAlpha, bAlpha);

          // Cylindrical gradient along the rung
          const rg = ctx.createLinearGradient(ax0, y0, bx0, y0);
          rg.addColorStop(0, `rgba(128,24,22,${aAlpha.toFixed(2)})`);
          rg.addColorStop(0.30, `rgba(68,13,11,${(minA * 0.55).toFixed(2)})`);
          rg.addColorStop(0.50, `rgba(45,9,7,${(minA * 0.35).toFixed(2)})`);
          rg.addColorStop(0.70, `rgba(68,13,11,${(minA * 0.55).toFixed(2)})`);
          rg.addColorStop(1, `rgba(128,24,22,${bAlpha.toFixed(2)})`);
          ctx.beginPath();
          ctx.moveTo(ax0, y0);
          ctx.lineTo(bx0, y0);
          ctx.strokeStyle = rg;
          ctx.lineWidth = 1.8;
          ctx.stroke();

          // Small junction spheres where rungs meet strands
          for (const pt of [{ x: ax0, z: az0 }, { x: bx0, z: bz0 }]) {
            const nA = 0.28 + ((pt.z + 1) / 2) * 0.62;
            const nR = 1.8 + ((pt.z + 1) / 2) * 2.0;
            const ng = ctx.createRadialGradient(pt.x - nR * 0.3, y0 - nR * 0.3, 0.5, pt.x, y0, nR);
            ng.addColorStop(0, `rgba(185,48,42,${nA.toFixed(2)})`);
            ng.addColorStop(1, `rgba(50,10,8,${(nA * 0.35).toFixed(2)})`);
            ctx.beginPath();
            ctx.arc(pt.x, y0, nR, 0, Math.PI * 2);
            ctx.fillStyle = ng;
            ctx.fill();
          }
        }

        // 3. Front strand segment
        const [frX0, frX1, frZ] = aFront ? [ax0, ax1, az0] : [bx0, bx1, bz0];
        ctx.beginPath();
        ctx.moveTo(frX0, y0);
        ctx.lineTo(frX1, y1);
        ctx.strokeStyle = strandCol(frZ);
        ctx.lineWidth = strandW(frZ);
        ctx.stroke();

        // 4. Specular highlight on front-facing portions
        if (frZ > 0.25) {
          ctx.beginPath();
          ctx.moveTo(frX0 - 0.6, y0);
          ctx.lineTo(frX1 - 0.6, y1);
          ctx.strokeStyle = `rgba(205,62,55,${((frZ - 0.25) * 0.32).toFixed(2)})`;
          ctx.lineWidth = strandW(frZ) * 0.22;
          ctx.stroke();
        }
      }

      // --- Edge fades (smooth crop at top/bottom) ---
      const fadeH = 55;
      const topFade = ctx.createLinearGradient(0, 0, 0, fadeH);
      topFade.addColorStop(0, "rgba(3,3,3,1)");
      topFade.addColorStop(1, "rgba(3,3,3,0)");
      ctx.fillStyle = topFade;
      ctx.fillRect(0, 0, w, fadeH);

      const botFade = ctx.createLinearGradient(0, h - fadeH, 0, h);
      botFade.addColorStop(0, "rgba(3,3,3,0)");
      botFade.addColorStop(1, "rgba(3,3,3,1)");
      ctx.fillStyle = botFade;
      ctx.fillRect(0, h - fadeH, w, fadeH);

      // --- Red Blood Cells (depth-sorted, back to front) ---
      const time = Date.now() * 0.0001;
      const sortedRBCs = [...rbcDefs].sort((a, b) => a.z - b.z);

      for (const rbc of sortedRBCs) {
        // Extremely subtle drift — suspended in medium
        const dx = Math.sin(time * 0.32 + rbc.baseRot * 2.5) * 3;
        const dy = Math.cos(time * 0.26 + rbc.baseRot * 3.1) * 2.5;
        const x = rbc.px * w + dx;
        const y = rbc.py * h + dy;
        const rot = rbc.baseRot + time * 0.07;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);

        const s = rbc.scale * (0.68 + rbc.z * 0.38);
        ctx.scale(s, s);

        if (rbc.blur > 0) {
          ctx.filter = `blur(${rbc.blur}px)`;
        }

        const rx = 28, ry = 16;
        const al = 0.45 + rbc.z * 0.55;

        // Toroidal rim-lit biconcave disc
        const rim = ctx.createRadialGradient(0, 0, rx * 0.10, 0, 0, rx * 1.08);
        rim.addColorStop(0, `rgba(18,3,3,${al.toFixed(2)})`);       // concave center
        rim.addColorStop(0.22, `rgba(42,7,7,${al.toFixed(2)})`);     // inner shadow
        rim.addColorStop(0.48, `rgba(100,18,16,${al.toFixed(2)})`);  // bright inner rim
        rim.addColorStop(0.68, `rgba(125,25,22,${al.toFixed(2)})`);  // brightest rim
        rim.addColorStop(0.85, `rgba(62,12,10,${(al * 0.72).toFixed(2)})`);  // falloff
        rim.addColorStop(1, `rgba(22,4,3,${(al * 0.35).toFixed(2)})`);       // edge

        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fillStyle = rim;
        ctx.fill();

        // Subtle specular catch — upper-left
        const spec = ctx.createRadialGradient(-rx * 0.30, -ry * 0.32, 1, -rx * 0.12, -ry * 0.15, rx * 0.40);
        spec.addColorStop(0, `rgba(190,70,62,${(al * 0.20).toFixed(2)})`);
        spec.addColorStop(1, "rgba(190,70,62,0)");
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fillStyle = spec;
        ctx.fill();

        ctx.filter = "none";
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [isInView]);

  return (
    <section
      id="biology"
      ref={containerRef}
      className={`product-screen biology-screen viewport-reveal ${isInView ? "is-in-view" : "is-out-view"}`}
    >
      <div className="screen-grid">
        {/* LEFT COLUMN — 3D DNA HELIX & RBCs */}
        <div className="visual-col biology-transparent-col">
          <canvas ref={canvasRef} className="biology-floating-canvas" />
        </div>

        {/* RIGHT COLUMN — TEXT (unchanged) */}
        <div className="text-col">
          <span className="mono eyebrow-gold">01 / BIOLOGY</span>
          <h2 className="section-title">THE SIGNAL STARTS IN BLOOD.</h2>
          <p className="section-body">
            Red blood cells interact with light as it passes through tissue. Their optical response provides the biological basis for extracting physiological information non-invasively.
          </p>

          <div className="metadata-row">
            <span className="mono meta-tag">ERYTHROCYTES</span>
            <span className="mono meta-separator">/</span>
            <span className="mono meta-tag">LIGHT ABSORPTION</span>
            <span className="mono meta-separator">/</span>
            <span className="mono meta-tag">BLOOD VOLUME</span>
          </div>
        </div>
      </div>
    </section>
  );
}
