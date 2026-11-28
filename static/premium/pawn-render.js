/* PROJECT ELO 4000 - der Bauer. Ein Drehkoerper (Staunton-Profil), pro Pixel physikalisch schattiert: Fresnel-Reflexion von Studio-Softboxen auf schwarzem Obsidian,
   satiniertes Platin am Kragen, feine Smaragdfuge am Sockel, Spiegelung im polierten Boden. Kein 3D-Modell und keine Bilddatei noetig; das Licht folgt dem Zeiger.
   Rein statisch gezeichnet (Canvas 2D), nichts wird geladen. */
(function () {
  "use strict";
  const PROFILE = [[21.5, 0], [21.5, 2.8], [20.6, 3.9], [18.6, 4.8], [16.6, 5.8], [14.4, 7.2], [12.8, 9.4], [11.6, 13], [10.4, 19], [9.3, 30], [8.6, 42], [8.3, 52], [8.6, 56.5], [10.8, 57.7], [12.8, 59.2], [12.8, 61], [10.4, 62.7], [8.4, 64.2], [8.1, 66], [8.6, 69.5], [9.4, 74.6], [12.3, 78.4], [14.2, 85.5], [12.3, 92.6], [9.1, 96.4], [4.9, 99], [0, 100]];
  const RING = [58.2, 61.8], SEAM = [4.9, 5.7];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const box = (v, a, b, k) => sst(a - k, a + k, v) * (1 - sst(b - k, b + k, v));

  function catmull(pts, sub) {
    const out = [], n = pts.length;
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
      for (let k = 0; k < sub; k++) { const t = k / sub, t2 = t * t, t3 = t2 * t, f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3); out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]); }
    }
    out.push(pts[n - 1]); return out;
  }
  const N = 1000, LUT = new Float32Array(N + 1);                                          // Radius je Hoehe 0..100 in Schritten von 0,1
  (function () { const d = catmull(PROFILE, 10); let j = 0; for (let i = 0; i <= N; i++) { const h = i / 10; while (j < d.length - 2 && d[j + 1][1] < h) j++; const a = d[j], b = d[j + 1], t = b[1] === a[1] ? 0 : clamp((h - a[1]) / (b[1] - a[1]), 0, 1); LUT[i] = a[0] + (b[0] - a[0]) * t; } LUT[N] = 0; })();
  const rAt = (h) => LUT[clamp(Math.round(h * 10), 0, N)];

  /* Studio: Umgebungsleuchte als Funktion von Azimut/Elevation. k = Unschaerfe (Platin spiegelt weicher als Obsidian) */
  function env(az, el, k, L, out) {
    let r = 0.010, g = 0.016, b = 0.034;
    const haze = 0.05 * sst(-0.7, 0.1, el) * (1 - sst(0.1, 0.9, el)); r += haze * 0.35; g += haze * 0.55; b += haze * 1.0;
    const key = box(az, -1.08 + L * 0.55, -0.62 + L * 0.55, 0.10 * k) * box(el, -0.30, 1.05, 0.16 * k) * 6.0;         // grosse Softbox links
    const strip = box(az, 0.74 + L * 0.3, 0.88 + L * 0.3, 0.045 * k) * box(el, -0.35, 0.95, 0.14 * k) * 3.4;          // schmale Streifenleuchte rechts
    const top = box(el, 1.0, 1.5, 0.14 * k) * box(az, -1.5, 1.5, 0.5 * k) * 1.1;                                         // Deckenpanel
    const a = Math.abs(az), rim = box(a, 2.62, 3.5, 0.12 * k) * box(el, -0.8, 1.0, 0.3 * k) * 1.5;                      // Gegenlicht fuer die Konturkante
    const floor = (1 - sst(-0.9, -0.25, el)) * 0.035;
    r += key * 0.96 + strip * 0.80 + top * 0.92 + rim * 0.85 + floor * 0.3; g += key * 0.98 + strip * 0.90 + top * 0.96 + rim * 0.92 + floor * 0.5; b += key * 1.0 + strip * 1.0 + top * 1.0 + rim * 1.0 + floor * 0.9;
    out[0] = r; out[1] = g; out[2] = b;
  }

  function render(canvas, o) {
    o = o || {}; const L = o.light || 0, W = canvas.width, H = canvas.height, ctx = canvas.getContext("2d"); if (!ctx || !W || !H) return;
    const img = ctx.createImageData(W, H), px = img.data, cx = W / 2, sc = H * 0.80 / 100, yb = H * 0.86, e = [0, 0, 0], e2 = [0, 0, 0];
    for (let y = 0; y < H; y++) {
      const refl = y > yb, h = (refl ? y - yb : yb - y) / sc; if (h < -0.6 / sc || h > 100 + 0.8 / sc) continue;
      const dv = 0.34 / sc, r = rAt(h) * sc, rm = rAt(h - dv) * sc, rp = rAt(h + dv) * sc, rmax = Math.max(r, rm, rp); if (rmax < 0.3) continue;    // Kantenglaettung auch senkrecht: drei Teilproben je Zeile
      const s = (rAt(h + 0.35) - rAt(h - 0.35)) / 0.7; let nr = 1 / Math.sqrt(1 + s * s), nh = -s * nr;
      const ringD = Math.min(h - RING[0], RING[1] - h), inRing = ringD > -0.05;
      if (inRing && ringD < 0.6) { const bv = 1 - ringD / 0.6, dir = (h - RING[0] < RING[1] - h) ? -1 : 1; nh += dir * 0.9 * bv * bv; const l2 = Math.hypot(nr, nh); nr /= l2; nh /= l2; }
      const fade = refl ? 0.30 * Math.pow(1 - (y - yb) / (H - yb), 1.7) : 1, seam = h > SEAM[0] && h < SEAM[1] ? 1 : 0;
      const x0 = Math.max(0, Math.floor(cx - rmax - 1)), x1 = Math.min(W - 1, Math.ceil(cx + rmax + 1)), rowNoise = 0.97 + 0.03 * Math.sin(y * 1.9) * Math.sin(y * 0.37);
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx, ad = Math.abs(dx), cov = (clamp(r - ad + 0.5, 0, 1) + clamp(rm - ad + 0.5, 0, 1) + clamp(rp - ad + 0.5, 0, 1)) / 3; if (cov <= 0) continue;
        const sT = clamp(dx / Math.max(r, 0.5), -1, 1), cT = Math.sqrt(1 - sT * sT), nx = nr * sT, ny = refl ? -nh : nh, nz = nr * cT;
        const rx = 2 * nz * nx, ry = 2 * nz * ny, rz = 2 * nz * nz - 1, az = Math.atan2(rx, rz), el = Math.asin(clamp(ry, -1, 1));
        let cr, cg, cb;
        if (inRing) {                                                                    // satiniertes Platin: Metall, weiche Reflexion, feine Buerstung
          env(az, el, 3.2, L, e); const m = 0.50 * rowNoise;
          cr = e[0] * 0.55 * m * 0.84 + 0.03 * nz; cg = e[1] * 0.55 * m * 0.86 + 0.03 * nz; cb = e[2] * 0.55 * m * 0.90 + 0.034 * nz;
        } else {                                                                         // Obsidian: tiefschwarz, Spiegelung nach Fresnel, innere Tiefe durch zweite, gedaempfte Spiegelung
          env(az, el, 1, L, e); const F = 0.04 + 0.96 * Math.pow(1 - nz, 5);
          env(-az * 0.55, el * 0.6 - 0.2, 4, L, e2);
          cr = 0.005 + e[0] * F + e2[0] * 0.020 * (1 - F); cg = 0.007 + e[1] * F + e2[1] * 0.020 * (1 - F); cb = 0.012 + e[2] * F + e2[2] * 0.026 * (1 - F);
          cr += 0.003 * (0.5 + 0.5 * ny); cg += 0.004 * (0.5 + 0.5 * ny); cb += 0.007 * (0.5 + 0.5 * ny);
          if (seam) { const sg = 0.55 * (0.4 + 0.6 * nz); cr += 0.03 * sg; cg += 0.20 * sg; cb += 0.13 * sg; }      // die einzige Smaragd-Spur: eine feine Fuge im Sockel
        }
        const dth = (((x * 7 + y * 13) & 15) - 7.5) / 2550;                           // Dither gegen Streifenbildung in den dunklen Verlaeufen
        const i = (y * W + x) * 4, ge = 1 / 2.2;
        px[i] = 255 * Math.pow(Math.max(0, 1 - Math.exp(-1.25 * cr)) + dth, ge); px[i + 1] = 255 * Math.pow(Math.max(0, 1 - Math.exp(-1.25 * cg)) + dth, ge); px[i + 2] = 255 * Math.pow(Math.max(0, 1 - Math.exp(-1.25 * cb)) + dth, ge); px[i + 3] = 255 * cov * fade;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  window.PawnRender = { render };
})();
