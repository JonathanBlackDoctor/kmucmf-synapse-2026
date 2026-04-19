// C-NAPSE Card rendering — v3.2
// vanilla DOM/SVG for fidelity + html2canvas compatibility

(function () {
  const { imgUrl, VERSES, SENIORS, JUNIORS } = window.__CNAPSE;

  // SVG viewBox reference (cards visually render close to this size via CSS max-width 460px)
  const W = 500, H = 750;

  // ── Deterministic hash for per-curve variance (FNV-1a 32-bit) ──
  function hashSeed(key) {
    let h = 0x811c9dc5;
    const s = String(key);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  }
  // Pseudo-random in [0,1) from key+salt
  function sr(key, salt) {
    const h = hashSeed(String(key) + ':' + salt);
    return (h % 100000) / 100000;
  }
  // Ranged variant
  function srRange(key, salt, lo, hi) {
    return lo + sr(key, salt) * (hi - lo);
  }

  // ── Synapse curve: cubic bezier + 3 layers + particles + endpoint star ──
  // opts: { complexity: 'normal' | 'high' }
  function synapseCurve(x1, y1, x2, y2, key, opts) {
    opts = opts || {};
    const isHigh = opts.complexity === 'high';

    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);

    // Hash-based variance
    const archScale = isHigh
      ? srRange(key, 'archH', 0.55, 0.95)
      : srRange(key, 'arch',  0.35, 0.70);
    const archHeight = Math.max(dist * archScale * 0.5, 50);

    // Mostly arch "up" (away from mid), but allow bias variation
    const archSign = sr(key, 'sign') < 0.15 ? 1 : -1;  // 15% arch down
    const cp1xFrac = srRange(key, 'cp1x', 0.10, 0.42);
    const cp2xFrac = srRange(key, 'cp2x', 0.55, 0.87);
    // S-curve flip — second control flips across the axis
    const sFlip = sr(key, 'sflip') < (isHigh ? 0.55 : 0.40) ? -1 : 1;
    // Perpendicular-ish offset (up/down across line)
    // Use dy's sign to consistently mean "above"
    const perpScale = archSign * archHeight;
    const cp1Off = perpScale;
    const cp2Off = perpScale * sFlip * srRange(key, 'cp2a', 0.55, 1.0);

    const cx1 = x1 + dx * cp1xFrac;
    const cy1 = y1 + dy * cp1xFrac + cp1Off;
    const cx2 = x1 + dx * cp2xFrac;
    const cy2 = y1 + dy * cp2xFrac + cp2Off;

    const d = `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${cx2.toFixed(1)} ${cy2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;

    // Cubic bezier parametric
    const bz = (u) => {
      const m = 1 - u;
      const px = m*m*m*x1 + 3*m*m*u*cx1 + 3*m*u*u*cx2 + u*u*u*x2;
      const py = m*m*m*y1 + 3*m*m*u*cy1 + 3*m*u*u*cy2 + u*u*u*y2;
      return [px, py];
    };

    // Particles — 9-11 for high complexity, 6-8 otherwise
    const nParticles = isHigh
      ? 9 + Math.floor(sr(key, 'npts') * 3)
      : 6 + Math.floor(sr(key, 'npts') * 3);
    const pts = [];
    for (let i = 0; i < nParticles; i++) {
      const baseT = (i + 1) / (nParticles + 1);
      const jitter = (sr(key, 't' + i) - 0.5) * 0.08;
      const t = Math.max(0.05, Math.min(0.95, baseT + jitter));
      const rRoll = sr(key, 'r' + i);
      const r = rRoll < 0.15 ? 0.9 + sr(key, 'rs' + i) * 0.5
              : rRoll < 0.55 ? 1.3 + sr(key, 'rs' + i) * 0.8
              : rRoll < 0.85 ? 2.0 + sr(key, 'rs' + i) * 1.2
              :                2.8 + sr(key, 'rs' + i) * 1.4;
      const palette = ["#A5C4F0", "#C5D6F0", "#7FB2E8", "#EAF2FF", "#B7D0F0"];
      const c = palette[Math.floor(sr(key, 'c' + i) * palette.length)];
      const o = 0.7 + sr(key, 'o' + i) * 0.3;
      pts.push({ t, r, c, o });
    }
    const particleSVG = pts.map((p, i) => {
      const [px, py] = bz(p.t);
      return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${p.r.toFixed(2)}" fill="${p.c}" opacity="${p.o.toFixed(2)}" filter="url(#dot-${key})"/>`;
    }).join('');

    // Optional secondary thin dashed inner ribbon for high complexity
    const innerRibbon = isHigh
      ? `<path d="${d}" stroke="#EAF2FF" stroke-width="0.6" fill="none" stroke-dasharray="0.8 4" opacity="0.55" stroke-linecap="round"/>`
      : '';

    const mainWidth = isHigh ? 1.8 : 1.6;
    const haloWidth = isHigh ? 7 : 6;
    const midWidth  = isHigh ? 3.4 : 3;

    // ── Intermittent action-potential ──
    // Cycle = 4.0–7.0s total per synapse; ~76% idle, ~22% active travel, 2% fade.
    // Random phase offset (negative begin) so 200+ pulses don't align.
    const cycleDur    = 4.0 + sr(key, 'cycle') * 3.0;
    const phaseOffset = sr(key, 'phase') * cycleDur;
    const pathId      = `synPath-${key}`;
    const cdStr       = cycleDur.toFixed(2);
    const beginStr    = (-phaseOffset).toFixed(2);
    const AS = 0.76;               // active start fraction (idle→travel)
    const AP = (AS + 0.01).toFixed(3);   // fade-in plateau
    const AE = 0.98;               // fade-out end

    const shimmerLayer = `
      <path class="syn-shimmer" d="${d}" stroke="#EAF2FF" stroke-width="1.1"
            stroke-dasharray="8 72" stroke-linecap="round" fill="none"
            filter="url(#dot-${key})" opacity="0"
            style="--syn-dur:${cdStr}s; --syn-delay:${beginStr}s"/>`;
    const pulseLayer = `
      <circle class="syn-pulse" r="3.2" fill="#EAF2FF" filter="url(#dot-${key})" opacity="0">
        <animateMotion dur="${cdStr}s" repeatCount="indefinite" begin="${beginStr}s"
                       keyPoints="0;0;1" keyTimes="0;${AS};1" rotate="auto">
          <mpath href="#${pathId}"/>
        </animateMotion>
        <animate attributeName="opacity" dur="${cdStr}s" repeatCount="indefinite" begin="${beginStr}s"
                 values="0;0;0.95;0.95;0" keyTimes="0;${AS};${AP};${AE};1"/>
      </circle>
      <circle class="syn-pulse-core" r="1.3" fill="#FFFFFF" opacity="0">
        <animateMotion dur="${cdStr}s" repeatCount="indefinite" begin="${beginStr}s"
                       keyPoints="0;0;1" keyTimes="0;${AS};1">
          <mpath href="#${pathId}"/>
        </animateMotion>
        <animate attributeName="opacity" dur="${cdStr}s" repeatCount="indefinite" begin="${beginStr}s"
                 values="0;0;1;1;0" keyTimes="0;${AS};${AP};${AE};1"/>
      </circle>`;

    return `
      <!-- Hidden path: animateMotion reference target (no stroke, no fill) -->
      <path id="${pathId}" d="${d}" fill="none" stroke="none"/>
      <!-- Layer 1: outer halo (blurred) -->
      <path d="${d}" stroke="#7FB2E8" stroke-width="${haloWidth}" fill="none" opacity="0.13" filter="url(#blurA-${key})" stroke-linecap="round"/>
      <!-- Layer 2: mid glow -->
      <path d="${d}" stroke="#A5C4F0" stroke-width="${midWidth}" fill="none" opacity="0.40" filter="url(#blurB-${key})" stroke-linecap="round"/>
      <!-- Layer 3: main solid with gradient -->
      <path d="${d}" stroke="url(#synGrad-${key})" stroke-width="${mainWidth}" fill="none" opacity="0.92" stroke-linecap="round"/>
      <!-- Layer 4: inner dashed -->
      <path d="${d}" stroke="#EAF2FF" stroke-width="0.8" fill="none" stroke-dasharray="1 6" opacity="0.72" stroke-linecap="round"/>
      ${innerRibbon}
      ${particleSVG}
      <!-- Action-potential shimmer (above static layers, below endpoint star) -->
      ${shimmerLayer}
      <!-- Action-potential traveling pulse (bright, rides the same bezier) -->
      ${pulseLayer}
      <!-- Endpoint: 3-layer glow star -->
      <circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="9" fill="#7FB2E8" opacity="0.18" filter="url(#blurA-${key})"/>
      <circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="6" fill="#87B0E8" opacity="0.45" filter="url(#blurB-${key})"/>
      <circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="4" fill="#EAF2FF" opacity="0.98" filter="url(#dot-${key})"/>
      <circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="1.6" fill="#FFFFFF" opacity="1"/>
    `;
  }

  // SVG defs per synapse curve key — gradient uses userSpaceOnUse aligned to path
  function synapseDefs(key, x1, y1, x2, y2) {
    return `
      <linearGradient id="synGrad-${key}" gradientUnits="userSpaceOnUse"
          x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}">
        <stop offset="0%"  stop-color="#7FB2E8" stop-opacity="0.55"/>
        <stop offset="60%" stop-color="#A5C4F0" stop-opacity="0.85"/>
        <stop offset="100%" stop-color="#EAF2FF" stop-opacity="0.98"/>
      </linearGradient>
      <filter id="blurA-${key}" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="5"/>
      </filter>
      <filter id="blurB-${key}" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="1.5"/>
      </filter>
      <filter id="dot-${key}" x="-200%" y="-200%" width="500%" height="500%">
        <feGaussianBlur stdDeviation="1.2"/>
        <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    `;
  }

  // ── Dendrite tip targets (percentage of card — where synapse curves land on bg neuron) ──
  const DENDRITE_TIP = {
    "01_rod.png":               [0.42, 0.30],
    "02_cone.png":              [0.42, 0.30],
    "06_retinal_ganglion.png":  [0.38, 0.38],
    "08_mitral.png":            [0.40, 0.28],
    "09_tufted.png":            [0.40, 0.30],
    "10_olfactory_granule.png": [0.40, 0.32],
    "13_merkel.png":            [0.40, 0.38],
    "14_pacinian.png":          [0.38, 0.36],
    "15_meissner.png":          [0.38, 0.36],
    "16_ruffini.png":           [0.38, 0.36],
    "17_muscle_spindle.png":    [0.38, 0.34],
    "18_golgi_tendon.png":      [0.38, 0.34],
    "19_free_nerve.png":        [0.38, 0.15],
    "30_pyramidal.png":         [0.40, 0.30],
    "31_betz.png":              [0.40, 0.30],
    "32_von_economo.png":       [0.42, 0.32],
    "33_chandelier.png":        [0.40, 0.32],
    "34_cortical_basket.png":   [0.42, 0.36],
    "35_double_bouquet.png":    [0.40, 0.32],
    "36_martinotti.png":        [0.36, 0.40],
    "37_cajal_retzius.png":     [0.42, 0.22],
    "39_neurogliaform.png":     [0.40, 0.38],
    "40_dentate_granule.png":  [0.42, 0.38],
    "41_ca1_pyramidal.png":    [0.40, 0.32],
    "42_ca3_pyramidal.png":    [0.40, 0.32],
    "43_mossy_cell.png":       [0.40, 0.36],
    "45_medium_spiny.png":     [0.42, 0.38],
    "46_cholinergic.png":      [0.42, 0.38],
    "47_dopaminergic.png":     [0.42, 0.36],
    "48_locus_coeruleus.png":  [0.42, 0.34],
    "49_raphe.png":            [0.42, 0.34],
    "50_thalamic_relay.png":   [0.42, 0.38],
    "51_thalamic_reticular.png":[0.42, 0.38],
    "52_magnocellular.png":    [0.42, 0.30],
    "53_alpha_motor.png":      [0.40, 0.38],
    "54_gamma_motor.png":      [0.40, 0.38],
    "55_renshaw.png":          [0.42, 0.38],
    "20_drg.png":              [0.42, 0.38],
    "57_sympathetic.png":      [0.42, 0.40],
    "58_parasympathetic.png":  [0.42, 0.40],
    // seniors
    "04_horizontal.png":       [0.40, 0.36],
    "07_olfactory_receptor.png":[0.42, 0.34],
    "27_golgi_cell.png":       [0.42, 0.38],
    "23_climbing_fiber.png":   [0.40, 0.30],
    "38_cortical_stellate.png":[0.42, 0.38],
    "21_purkinje.png":         [0.42, 0.30],
    "25_cerebellar_basket.png":[0.42, 0.32],
    "26_cerebellar_stellate.png":[0.42, 0.38],
    "44_olm.png":              [0.42, 0.48],
    "29_unipolar_brush.png":   [0.42, 0.38],
    "28_lugaro.png":           [0.42, 0.38],
    "24_mossy_fiber.png":      [0.40, 0.28],
    "22_cerebellar_granule.png":[0.42, 0.38],
    "05_amacrine.png":         [0.42, 0.32],
    "56_mauthner.png":         [0.42, 0.34],
    "11_inner_hair.png":       [0.42, 0.42],
    "60_dogiel_ii.png":        [0.42, 0.38],
  };
  const tipFor = (img) => DENDRITE_TIP[img] || [0.40, 0.36];

  // Per-image spread override for senior curve endpoints (x/y spread for multi-junior fan-out)
  const SPREAD_OVERRIDE = {
    "23_climbing_fiber.png": { x: 6,  y: 10 }, // climbing fiber converges — tight
  };
  const DEFAULT_SPREAD = { x: 14, y: 22 };
  const spreadFor = (img) => SPREAD_OVERRIDE[img] || DEFAULT_SPREAD;

  // Per-image background position override — crop + optional custom mask
  // { top: %, height: %, maskImage?: css-gradient } applied as inline style on .card-bg img
  const BG_OFFSET = {
    "19_free_nerve.png": {
      top: -23, height: 131,
      // Aggressive top-corner fade + extended fadeout zone to mask remaining skin line
      maskImage: "radial-gradient(ellipse 82% 95% at 50% 68%, #000 38%, transparent 100%)"
    },
  };
  function bgStyleFor(image) {
    const off = BG_OFFSET[image];
    if (!off) return '';
    let style = `top: ${off.top}%; height: ${off.height}%;`;
    if (off.maskImage) {
      style += ` -webkit-mask-image: ${off.maskImage}; mask-image: ${off.maskImage};`;
    }
    return ` style="${style}"`;
  }

  // ── Corners: L-brackets (CSS spans) + 4 corner text/icon blocks ──
  function corners(groupLabel, neuronName, starKey) {
    const sid = `starglow-${starKey}`;
    return `
      <span class="l-bracket l-bracket-tl"></span>
      <span class="l-bracket l-bracket-tr"></span>
      <span class="l-bracket l-bracket-bl"></span>
      <span class="l-bracket l-bracket-br"></span>
      <div class="corner corner-tl">C-NAPSE · 2026 · 계명 CMF</div>
      <div class="corner corner-tr">${neuronName}</div>
      <div class="corner corner-bl">${groupLabel}</div>
      <div class="corner corner-br">
        <svg viewBox="0 0 28 28" width="22" height="22" aria-hidden="true">
          <defs>
            <filter id="${sid}" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.2"/>
            </filter>
          </defs>
          <path d="M14 2 L15.4 12.6 L26 14 L15.4 15.4 L14 26 L12.6 15.4 L2 14 L12.6 12.6 Z"
                fill="#87B0E8" filter="url(#${sid})"/>
        </svg>
      </div>
    `;
  }

  // ── Verse block ──
  function verseBlock(groupKey) {
    const v = VERSES[groupKey];
    return `
      <div class="verse">
        <div class="verse-body">&ldquo; ${v.text} &rdquo;</div>
        <div class="verse-ref">— ${v.ref_en} · ${v.ref_ko}</div>
      </div>
    `;
  }

  // ── Junior card ──
  function juniorCard(j, idx) {
    const senior = SENIORS.find(s => s.group === j.group);
    const somaYpct = j.soma_y;
    const [tipXr, tipYr] = tipFor(j.image);
    const tipX = tipXr * W;
    const tipY = tipYr * H;

    // Mini mentor position (CSS): top: 8.5%, left: 4.8%, 70×105
    const miniLeftPct = 0.048;
    const miniTopPct  = 0.085;
    const miniWpct    = 70 / 460;
    const miniHpct    = 105 / 690;

    const miniLeft = miniLeftPct * W;
    const miniTop  = miniTopPct * H;
    const miniW    = miniWpct * W;
    const miniH    = miniHpct * H;
    const startX = miniLeft + miniW * 0.5;
    const startY = miniTop + miniH * 0.95;

    const key = `j${idx}`;

    return `
      <article class="card" data-idx="${idx}" data-kind="junior">
        <div class="card-bg-wrap">
          <img class="card-bg"${bgStyleFor(j.image)} src="${imgUrl(j.image)}" loading="lazy" crossorigin="anonymous" alt=""/>
          <div class="card-bg-veil"></div>
        </div>

        ${corners(j.group, j.neuron_name, key)}

        <!-- MENTOR section -->
        <div class="mentor">
          <div class="mentor-neuron-wrap">
            <img class="mentor-neuron-img" src="${imgUrl(senior.image)}" loading="lazy" crossorigin="anonymous" alt=""/>
          </div>
          <div class="mentor-info">
            <div class="mentor-label">MENTOR</div>
            <div class="mentor-name">${senior.name} · ${senior.info}</div>
            <div class="mentor-neuron-name">${senior.neuron_name}</div>
          </div>
        </div>

        <!-- Synapse curve -->
        <svg class="synapse" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
          <defs>${synapseDefs(key, startX, startY, tipX, tipY)}</defs>
          ${synapseCurve(startX, startY, tipX, tipY, key, { complexity: 'high' })}
        </svg>

        <!-- Name over soma -->
        <div class="subject-name" style="top:${(somaYpct * 100).toFixed(2)}%">
          <span class="deco">—</span>
          <span class="name-text">${j.name}</span>
          <span class="deco">—</span>
        </div>

        ${verseBlock(j.group)}

        <button class="dl-btn" title="JPG 다운로드">⬇</button>
      </article>
    `;
  }

  // ── Senior card ──
  // Direction REVERSED: synapse originates at bg neuron dendrite tip → ends at mini (receiving).
  // Biological analogy: senior→junior signal flow (senior background as source).
  function seniorCard(s, idx) {
    const somaYpct = s.soma_y;
    const juniors = s.juniors_idx.map(i => JUNIORS[i]);
    const n = juniors.length;

    // GUIDING stack — v3.2 70×105 fixed
    const contLeftPct = 0.048;
    const contTopPct  = 0.08;
    const rowGap      = n >= 4 ? 8 : 12;
    const miniW       = 70;
    const miniH       = 105;
    const rowH        = miniH;
    const stackHeight = n * rowH + (n - 1) * rowGap;
    const denseClass  = n >= 4 ? ' dense' : '';

    // Build rows
    const rows = juniors.map((j) => `
      <div class="guide-row">
        <div class="guide-mini-wrap">
          <img class="guide-mini-img" src="${imgUrl(j.image)}" loading="lazy" crossorigin="anonymous" alt=""/>
        </div>
        <div class="guide-info">
          <div class="guide-name">${j.name}</div>
          <div class="guide-neuron">${j.neuron_name}</div>
        </div>
      </div>
    `).join('');

    // Endpoint base on mini neurons (bg tip is SOURCE, mini is SINK)
    const [tipXr, tipYr] = tipFor(s.image);
    const tipBaseX = tipXr * W;
    const tipBaseY = tipYr * H;
    const spread = spreadFor(s.image);

    const labelHeightPx = 22;
    const stackTopPx = contTopPct * H + labelHeightPx;

    const highComplexity = n === 1;

    const curves = juniors.map((j, i) => {
      const rowTopPx = stackTopPx + i * (rowH + rowGap);
      const miniBottomY = rowTopPx + rowH * 0.95;
      const miniCenterX = contLeftPct * W + miniW * 0.5;
      // Spread dendrite tips on bg neuron (source side)
      const spreadIdx = i - (n - 1) / 2;
      const srcX = tipBaseX + spreadIdx * spread.x + (i % 2 === 0 ? -6 : 6);
      const srcY = tipBaseY + spreadIdx * spread.y;
      // REVERSED: start = bg dendrite tip, end = mini bottom-center (endpoint star at mini)
      const curveKey = `s${idx}-${i}`;
      return {
        key: curveKey,
        svg: synapseCurve(srcX, srcY, miniCenterX, miniBottomY, curveKey, highComplexity ? { complexity: 'high' } : {}),
        srcX, srcY, miniCenterX, miniBottomY,
      };
    });

    const defs = curves.map(c => synapseDefs(c.key, c.srcX, c.srcY, c.miniCenterX, c.miniBottomY)).join('');
    const curveSVG = curves.map(c => c.svg).join('');

    // Dynamic soma_y: if GUIDING stack overlaps name band, push name below stack
    const guidingBottomPct = contTopPct + (labelHeightPx + stackHeight) / H;
    // If senior has noClamp flag, respect soma_y as authored; otherwise auto-push below GUIDING
    const finalSomaYPct = s.noClamp
      ? somaYpct
      : Math.max(somaYpct, guidingBottomPct + 0.08);

    const key = `s${idx}`;

    return `
      <article class="card card-senior" data-idx="s${idx}" data-kind="senior">
        <div class="card-bg-wrap">
          <img class="card-bg"${bgStyleFor(s.image)} src="${imgUrl(s.image)}" loading="lazy" crossorigin="anonymous" alt=""/>
          <div class="card-bg-veil"></div>
        </div>

        ${corners(s.group, s.neuron_name, key)}

        <div class="guiding-stack" style="top:${(contTopPct * 100).toFixed(2)}%; left:${(contLeftPct * 100).toFixed(2)}%;">
          <div class="guiding-label">GUIDING</div>
          <div class="guiding-rows${denseClass}">${rows}</div>
        </div>

        <svg class="synapse" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
          <defs>${defs}</defs>
          ${curveSVG}
        </svg>

        <div class="subject-name" style="top:${(finalSomaYPct * 100).toFixed(2)}%">
          <span class="deco">—</span>
          <span class="name-text">${s.name}</span>
          <span class="deco">—</span>
        </div>

        ${verseBlock(s.group)}

        <button class="dl-btn" title="JPG 다운로드">⬇</button>
      </article>
    `;
  }

  window.__CNAPSE_CARD = { juniorCard, seniorCard, W, H };
})();
