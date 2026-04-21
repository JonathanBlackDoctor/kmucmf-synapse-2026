// Neural background — simpler static structure, rich signal variety.
// Static layers: long axons + decor arcs + dendrite tufts + boutons + a few ganglia.
// Active signals: varied speed, direction, size, intensity, cycle, fade, branching.
// Respects .render-mode (hidden) and prefers-reduced-motion (handled in CSS).

(function () {
  const VB_W = 1920, VB_H = 1200;

  // ── Deterministic PRNG so the wallpaper is stable across reloads ──
  let _rs = 0x4E753B21;
  function rng() { _rs = (Math.imul(_rs, 1664525) + 1013904223) >>> 0; return _rs / 4294967296; }
  function rr(a, b) { return a + rng() * (b - a); }
  function pick(arr) { return arr[Math.floor(rng() * arr.length)]; }

  // ── Main axons (long sinuous, roughly horizontal/diagonal) ──
  // Simpler hand-curated set like the earlier preferred version, +2 extras for mild complexity.
  const AXON_PATHS = [
    'M -120 180 C 340 80, 780 320, 1180 180 S 1780 110, 2060 260',
    'M -80 420 C 280 560, 700 320, 1080 460 S 1720 540, 2040 380',
    'M -100 760 C 320 620, 720 860, 1100 720 S 1760 820, 2040 700',
    'M -60 1020 C 300 940, 720 1100, 1120 960 S 1780 1040, 2060 900',
    'M -100 300 C 260 380, 620 240, 980 340 S 1540 280, 2020 340',
    'M -80 900 C 320 820, 700 980, 1080 880 S 1660 960, 2040 860',
    // Two extra long trunks for slightly more complexity
    'M 120 -80 C 300 320, 80 700, 260 1040 S 420 1240, 380 1280',
    'M 1620 -60 C 1480 360, 1700 700, 1540 1040 S 1460 1240, 1500 1280',
  ];

  // ── Decorative secondary paths (no signal) ──
  const DECOR_PATHS = [
    'M 80 120 Q 320 220, 560 140 T 1040 180',
    'M 600 60 C 780 200, 900 80, 1100 180',
    'M 1280 80 Q 1520 160, 1700 60',
    'M 40 560 Q 220 640, 380 540',
    'M 1420 540 Q 1580 620, 1760 560',
    'M 260 1100 Q 440 1000, 620 1080',
    'M 1100 1100 Q 1280 1000, 1460 1080',
    'M 840 720 Q 980 800, 1120 720',
    // A couple of small loops to enrich the mid-field
    'M 740 380 C 800 300, 900 300, 960 380 S 900 480, 820 440',
    'M 1280 860 C 1340 780, 1440 780, 1500 860 S 1440 960, 1360 920',
  ];

  // ── Dendrite tufts (small branching bursts at strategic points) ──
  const DENDRITE_TUFTS = [
    [260, 220], [520, 460], [900, 280], [1340, 520],
    [180, 820], [780, 900], [1080, 1020], [1520, 820],
    [620, 180], [1460, 280], [340, 980], [1620, 1020],
  ];
  function makeTuft(cx, cy) {
    const n = 5 + Math.floor(rng() * 4);
    let d = '';
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2;
      const L = 14 + rng() * 28;
      const x2 = cx + Math.cos(a) * L;
      const y2 = cy + Math.sin(a) * L;
      d += `M ${cx} ${cy} L ${x2.toFixed(1)} ${y2.toFixed(1)} `;
      if (rng() < 0.55) {
        const a2 = a + (rng() < 0.5 ? 0.42 : -0.42);
        const L2 = 5 + rng() * 13;
        const x3 = x2 + Math.cos(a2) * L2;
        const y3 = y2 + Math.sin(a2) * L2;
        d += `M ${x2.toFixed(1)} ${y2.toFixed(1)} L ${x3.toFixed(1)} ${y3.toFixed(1)} `;
      }
    }
    return d.trim();
  }
  const DENDRITE_PATHS = DENDRITE_TUFTS.map(([x, y]) => makeTuft(x, y));

  // ── Ganglia (small cell-body clusters for mild complexity) ──
  const GANGLIA = [];
  const GANGLIA_SEEDS = [[360, 360], [1220, 420], [680, 720], [1560, 740]];
  GANGLIA_SEEDS.forEach(([cx, cy]) => {
    const cells = [];
    const n = 5 + Math.floor(rng() * 4);
    const haloR = 26 + rng() * 16;
    for (let j = 0; j < n; j++) {
      const angle = (j / n) * Math.PI * 2 + rng() * 0.8;
      const r = 10 + rng() * (haloR * 0.6);
      cells.push({
        dx: Math.cos(angle) * r,
        dy: Math.sin(angle) * r,
        r: (2.6 + rng() * 2.2).toFixed(2),
        op: (0.48 + rng() * 0.32).toFixed(2),
      });
    }
    GANGLIA.push({ cx, cy, haloR: haloR.toFixed(1), cells });
  });

  // ── Boutons (synaptic terminal point-lights) ──
  const BOUTON_POSITIONS = [
    [160, 200, 2.8, 0.55], [380, 340, 2.2, 0.48], [640, 260, 3.0, 0.6],
    [920, 420, 2.4, 0.45], [1180, 340, 2.6, 0.5], [1460, 280, 2.0, 0.4],
    [1720, 220, 3.2, 0.58], [220, 540, 2.2, 0.42], [520, 620, 2.6, 0.5],
    [820, 560, 3.0, 0.55], [1100, 680, 2.4, 0.46], [1400, 580, 2.8, 0.52],
    [1680, 640, 2.2, 0.44], [180, 880, 2.6, 0.5], [480, 820, 2.4, 0.46],
    [780, 920, 3.0, 0.58], [1080, 860, 2.2, 0.42], [1360, 940, 2.6, 0.5],
    [1620, 880, 2.8, 0.54], [320, 1080, 2.4, 0.46], [980, 1060, 2.8, 0.52],
    [1260, 1080, 2.2, 0.42], [1540, 1040, 2.6, 0.5],
  ];

  // ── Signals ── much more variety + more visible
  // Each signal is a photon traveling one axon. Parameters vary:
  //   speed tier (fast / medium / slow), direction (forward / reverse),
  //   cycle length (idle gap between pulses), size, intensity, mid-extinction.
  // Every axon gets 2-3 signals at different offsets → many overlapping bursts.

  // Mobile sees fewer signals (perf). Threshold matches the CSS @media (max-width: 768px).
  const isMobile = (typeof window !== 'undefined') && window.matchMedia && window.matchMedia('(max-width: 768px)').matches;

  const SIGNALS = [];
  AXON_PATHS.forEach((_, axIdx) => {
    let bursts = 2 + (rng() < 0.55 ? 1 : 0);   // 2 or 3 signals per axon
    if (isMobile) bursts = Math.max(1, Math.ceil(bursts / 2)); // halve on mobile
    for (let b = 0; b < bursts; b++) {
      const speedTier = rng();
      const travel = speedTier < 0.30 ? rr(1.2, 2.0)     // fast
                   : speedTier < 0.75 ? rr(2.4, 3.8)     // medium
                   :                    rr(4.5, 6.5);    // slow
      const idle = rr(1.8, 4.5);                          // shorter idle → more frequent
      const total = travel + idle;
      const aStart = idle / total;
      const aStartPlus = Math.min(aStart + 0.006, 0.985);
      const beginOff = rng() * total;
      const reverse = rng() < 0.32;
      const fadeMid = rng() < 0.22;
      const midFrac = aStart + (1 - aStart) * rr(0.40, 0.70);
      const intensity = rr(0.80, 1.0);                   // brighter baseline
      const size = rr(2.6, 5.0);                         // larger dots
      SIGNALS.push({
        axIdx, dur: total.toFixed(2), begin: (-beginOff).toFixed(2),
        aStart: aStart.toFixed(3),
        aStartPlus: aStartPlus.toFixed(3),
        reverse, fadeMid,
        midFrac: midFrac.toFixed(3),
        midFracPlus: Math.min(midFrac + 0.008, 0.99).toFixed(3),
        intensity: intensity.toFixed(2),
        size: size.toFixed(2),
      });
    }
  });

  // ── Build SVG markup ──
  const axonSVG = AXON_PATHS.map((d, i) => {
    const op = (0.14 + rng() * 0.08).toFixed(2);
    const sw = (0.85 + rng() * 0.55).toFixed(2);
    const myelin = rng() < 0.45;
    const dash = myelin ? ` stroke-dasharray="${pick(['14 4', '18 3', '22 5', '11 3'])}"` : '';
    const haloOp = (parseFloat(op) * 0.55).toFixed(3);
    const haloW = (parseFloat(sw) * 2.6).toFixed(2);
    return [
      `<path d="${d}" stroke="#7FB2E8" stroke-width="${haloW}" opacity="${haloOp}" fill="none" filter="url(#nbBlurHalo)"/>`,
      `<path id="nb-ax-${i}" d="${d}" stroke="#7FB2E8" stroke-width="${sw}" opacity="${op}" fill="none"${dash}/>`,
    ].join('');
  }).join('');

  const decorSVG = DECOR_PATHS.map(d => {
    const op = (0.09 + rng() * 0.07).toFixed(2);
    const sw = (0.45 + rng() * 0.35).toFixed(2);
    return `<path d="${d}" stroke="#A5C4F0" stroke-width="${sw}" opacity="${op}" fill="none"/>`;
  }).join('');

  const dendriteSVG = DENDRITE_PATHS.map(d =>
    `<path d="${d}" opacity="${(0.15 + rng() * 0.08).toFixed(2)}"/>`
  ).join('');

  const gangliaSVG = GANGLIA.map(g => {
    const haloBig = (parseFloat(g.haloR) * 1.45).toFixed(1);
    return [
      `<circle cx="${g.cx}" cy="${g.cy}" r="${haloBig}" fill="url(#nbGangHalo)" opacity="0.22"/>`,
      `<circle cx="${g.cx}" cy="${g.cy}" r="${g.haloR}" fill="url(#nbGangHalo)" opacity="0.42"/>`,
      g.cells.map(c => `<circle cx="${(g.cx + c.dx).toFixed(1)}" cy="${(g.cy + c.dy).toFixed(1)}" r="${c.r}" fill="url(#nbGangCell)" opacity="${c.op}"/>`).join(''),
      `<circle cx="${g.cx}" cy="${g.cy}" r="4" fill="#EAF2FF" opacity="0.55" filter="url(#nbDot)"/>`,
    ].join('');
  }).join('');

  const boutonSVG = BOUTON_POSITIONS.map(([x, y, r, o]) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#nbBouton)" opacity="${o.toFixed(2)}"/>`
  ).join('');

  // SMIL signals — every circle rides its axon path via animateMotion referencing
  // the axon's own `<path id="nb-ax-N">`. Opacity is a 5- or 6-stop animate.
  // SMIL is isolated from CSS transforms (so poster scale changes don't flicker)
  // and works on iOS Safari 14+ / all desktops / Android Chrome.
  const signalSVG = SIGNALS.map(s => {
    const kP = s.reverse ? '1;1;0' : '0;0;1';
    const kT = `0;${s.aStart};1`;
    const opV = s.fadeMid
      ? `0;0;${s.intensity};${s.intensity};0;0`
      : `0;0;${s.intensity};${s.intensity};0`;
    const opT = s.fadeMid
      ? `0;${s.aStart};${s.aStartPlus};${s.midFrac};${s.midFracPlus};1`
      : `0;${s.aStart};${s.aStartPlus};0.985;1`;
    return `<circle class="nb-sig" r="${s.size}" fill="#EAF2FF" filter="url(#nbDot)" opacity="0">
      <animateMotion dur="${s.dur}s" repeatCount="indefinite" begin="${s.begin}s"
                     keyPoints="${kP}" keyTimes="${kT}" rotate="auto">
        <mpath xlink:href="#nb-ax-${s.axIdx}" href="#nb-ax-${s.axIdx}"/>
      </animateMotion>
      <animate attributeName="opacity" dur="${s.dur}s" repeatCount="indefinite" begin="${s.begin}s"
               values="${opV}" keyTimes="${opT}"/>
    </circle>`;
  }).join('');

  const html = `
<svg id="neural-bg" class="neural-bg" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs>
    <filter id="nbBlurHalo" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
    <filter id="nbDot" x="-400%" y="-400%" width="900%" height="900%">
      <feGaussianBlur stdDeviation="2.8" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <radialGradient id="nbBouton" cx="50%" cy="50%" r="50%">
      <stop offset="0%"  stop-color="#EAF2FF" stop-opacity="0.95"/>
      <stop offset="40%" stop-color="#A5C4F0" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#7FB2E8" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="nbGangHalo" cx="50%" cy="50%" r="50%">
      <stop offset="0%"  stop-color="#A5C4F0" stop-opacity="0.45"/>
      <stop offset="60%" stop-color="#7FB2E8" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#7FB2E8" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="nbGangCell" cx="50%" cy="50%" r="50%">
      <stop offset="0%"  stop-color="#EAF2FF" stop-opacity="0.85"/>
      <stop offset="55%" stop-color="#A5C4F0" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#87B0E8" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <g class="nb-axons" stroke-linecap="round" fill="none">
    ${axonSVG}
  </g>

  <g class="nb-decor" stroke-linecap="round" fill="none">
    ${decorSVG}
  </g>

  <g class="nb-dendrites" stroke="#7FB2E8" fill="none" stroke-width="0.5" stroke-linecap="round">
    ${dendriteSVG}
  </g>

  <g class="nb-ganglia">
    ${gangliaSVG}
  </g>

  <g class="nb-boutons">
    ${boutonSVG}
  </g>

  <g class="nb-signals">
    ${signalSVG}
  </g>
</svg>`;

  function inject() {
    if (document.getElementById('neural-bg')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    const parentSel = window.__NEURAL_BG_PARENT;
    const parent = (parentSel && document.querySelector(parentSel)) || document.body;
    const svg = wrap.firstElementChild;
    parent.insertBefore(svg, parent.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
