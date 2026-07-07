import type { ScanResult } from '../../lib/types';
import { getToken } from '../../lib/auth';

const $ = (id: string) => document.getElementById(id)!;

let ringAnimFrame = 0;
function animateRing(el: SVGCircleElement, from: number, to: number, duration: number) {
  cancelAnimationFrame(ringAnimFrame);
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
    el.style.strokeDashoffset = String(from + (to - from) * ease);
    if (t < 1) ringAnimFrame = requestAnimationFrame(step);
  };
  ringAnimFrame = requestAnimationFrame(step);
}

const STEPS = [
  'Detecting garment type...',
  'Checking your wardrobe...',
  'Calculating outfit combos...',
  'Generating verdict...',
];

function showError(msg: string) {
  $('state-error').classList.remove('hidden');
  $('state-loading').classList.add('hidden');
  $('state-result').classList.add('hidden');
  ($('error-msg') as HTMLElement).textContent = msg;
}

function renderProgress(step: number, startedAt: number) {
  const rows = document.querySelectorAll('.step-row');
  const elapsed = Date.now() - startedAt;

  rows.forEach((row, i) => {
    const circle = row.querySelector('.step-circle')!;
    const label = row.querySelector('.step-label')!;
    circle.className = 'step-circle';
    label.className = 'step-label';

    if (i < step) {
      circle.classList.add('done');
      circle.textContent = '✓';
      label.classList.add('done');
    } else if (i === step) {
      circle.classList.add('active');
      circle.textContent = String(i + 1);
      label.classList.add('active');
    } else {
      circle.textContent = String(i + 1);
      label.classList.add('future');
    }
  });

  // Stuck warning
  if (elapsed > 30000) {
    $('stuck-warning').classList.remove('hidden');
  } else {
    $('stuck-warning').classList.add('hidden');
  }
}

function renderResult(r: ScanResult) {
  $('state-loading').classList.add('hidden');
  $('state-result').classList.remove('hidden');

  // --- Score ring (dynamic color, JS animation) ---
  const scoreColor = r.score >= 70 ? '#22c55e' : r.score >= 40 ? '#f97316' : '#ef4444';
  const circumference = 326.7;
  const offset = circumference - (r.score / 100) * circumference;
  const circle = $('sc-circle') as unknown as SVGCircleElement;
  circle.style.stroke = scoreColor;
  circle.style.strokeDashoffset = String(circumference);
  animateRing(circle, circumference, offset, 800);
  ($('sc-text') as HTMLSpanElement).textContent = String(r.score);
  const vt = $('sc-verdict') as HTMLSpanElement;
  vt.textContent = r.verdict === 'worth_it' ? 'WORTH IT' : r.verdict === 'consider' ? 'CONSIDER' : 'SKIP';
  vt.style.color = scoreColor;

  ($('sc-one-liner') as HTMLElement).textContent = r.one_liner;
  ($('sc-reasoning') as HTMLElement).textContent = r.reasoning;

  // Rate limit notice
  if (r.rate_limited) {
    $('rate-limit-notice').classList.remove('hidden');
  } else {
    $('rate-limit-notice').classList.add('hidden');
  }

  // --- Breakdown bars (colorful) ---
  const barColors: Record<string, string> = {
    gap_fill: '#22c55e',
    color_fit: '#3b82f6',
    outfit_potential: '#a855f7',
    similarity_risk: '#ef4444',
    versatility: '#14b8a6',
  };
  const bars = [
    { key: 'gap_fill', label: 'Gap Fill', value: r.breakdown.gap_fill },
    { key: 'color_fit', label: 'Color Fit', value: r.breakdown.color_fit },
    { key: 'similarity_risk', label: 'Similarity Risk', value: r.breakdown.similarity_risk },
    { key: 'outfit_potential', label: 'Outfit Pot.', value: r.breakdown.outfit_potential },
    { key: 'versatility', label: 'Versatility', value: r.breakdown.versatility },
  ];
  ($('breakdown-bars') as HTMLElement).innerHTML = bars.map((b) => `
    <div class="bar-row">
      <span class="bar-label">${b.label}</span>
      <div class="bar-track">
        <div class="bar-fill" style="width:${b.value}%;background:${barColors[b.key] || '#000'}"></div>
      </div>
      <span class="bar-value">${b.value}</span>
    </div>`).join('');

  // --- Similar items (thumbs + name) ---
  if (r.similar_items?.length > 0) {
    $('similar-section').classList.remove('hidden');
    ($('similar-list') as HTMLElement).innerHTML = r.similar_items
      .map((s) => `<div class="thumb-item">
        <div class="thumb">${s.image_url ? `<img src="${s.image_url}" alt="${s.name}" />` : s.name[0]}</div>
        <span class="thumb-label">${s.name}</span>
      </div>`)
      .join('');
  }

  // --- Ghost items (orange card, image thumbs) ---
  if (r.ghost_items?.length > 0) {
    $('ghost-section').classList.remove('hidden');
    ($('ghost-list') as HTMLElement).innerHTML = `
      <div class="ghost-warning">
        <span class="ghost-warning-icon">⚠️</span>
        <p class="ghost-warning-text">You already own similar items you rarely wear</p>
      </div>
      <div class="ghost-scroll">
        ${r.ghost_items.map(g => `
          <div class="ghost-item-card">
            <div class="ghost-thumb-wrap">
              ${g.image_url
                ? `<img src="${g.image_url}" alt="${g.name}" class="ghost-thumb-img" />`
                : `<div class="ghost-thumb-placeholder">👕</div>`
              }
            </div>
            <span class="gi-name">${g.name}</span>
            <span class="gi-wear">worn ${g.wear_count}x</span>
          </div>
        `).join('')}
      </div>`;
  }

  // --- Multiplier + Pairings (visual cards, 2-col grid) ---
  if (r.suggested_pairings?.length > 0) {
    $('pairings-section').classList.remove('hidden');

    if (r.outfit_multiplier > 0) {
      ($('multiplier-info') as HTMLElement).innerHTML = `
        <div class="multiplier-heading">
          <span class="multiplier-icon">✦</span>
          <div>
            <p class="multiplier-count">Unlocks <strong>${r.outfit_multiplier} new looks</strong></p>
            <p class="multiplier-sub">New outfit combinations with your existing wardrobe</p>
          </div>
        </div>`;
    }

    ($('pairings-list') as HTMLElement).innerHTML = r.suggested_pairings
      .map((p) => `<div class="pairing-card">
        <div class="pairing-thumb">
          ${p.image_url
            ? `<img src="${p.image_url}" alt="${p.name}" />`
            : p.color
              ? `<span class="pairing-color-dot" style="background:${p.color}"></span>`
              : `<span class="pairing-color-dot" style="background:#e3e2e2"></span>`
          }
        </div>
        <div class="pairing-info">
          <p class="pairing-name">${p.name}</p>
          <p class="pairing-type">${p.type}</p>
        </div>
      </div>`)
      .join('');
  }

  // --- CPW with comparison bar + verdict ---
  if (r.cost_per_wear) {
    $('cpw-section').classList.remove('hidden');
    const cpw = r.cost_per_wear;
    const maxCpw = Math.max(cpw.projected_cpw, cpw.wardrobe_average_cpw, 1);
    const projPct = (cpw.projected_cpw / maxCpw) * 100;
    const avgPct = (cpw.wardrobe_average_cpw / maxCpw) * 100;

    let vColor: string, vIcon: string, vLabel: string;
    if (cpw.verdict === 'below_average') {
      vColor = '#22c55e'; vIcon = '✓'; vLabel = 'Better than average';
    } else if (cpw.verdict === 'similar') {
      vColor = '#f97316'; vIcon = '!'; vLabel = 'Similar to average';
    } else if (cpw.verdict === 'above_average') {
      vColor = '#ef4444'; vIcon = '⚠'; vLabel = 'Higher than average';
    } else {
      vColor = '#9ca3af'; vIcon = '?'; vLabel = 'Unknown';
    }

    ($('cpw-content') as HTMLElement).innerHTML = `
      <div class="cpw-grid">
        <div class="metric"><div class="val">$${cpw.projected_cpw}</div><div class="lbl">Proj. CPW</div></div>
        <div class="metric"><div class="val">$${cpw.wardrobe_average_cpw}</div><div class="lbl">Wardrobe Avg</div></div>
        <div class="metric"><div class="val">${cpw.projected_wears}</div><div class="lbl">Est. Wears</div></div>
        <div class="metric"><div class="val">$${cpw.estimated_price}</div><div class="lbl">Price</div></div>
      </div>
      <div class="cpw-bar-wrap">
        <div class="cpw-bar-container">
          <div class="cpw-bar-track"></div>
          <div class="cpw-bar-avg" style="right:${100 - avgPct}%"></div>
          <div class="cpw-bar-fill" style="width:${projPct}%;background:${vColor}"></div>
          <div class="cpw-bar-dot" style="left:${projPct}%;background:${vColor}"></div>
        </div>
        <div class="cpw-verdict" style="color:${vColor}">
          <span>${vIcon}</span>
          <span>${vLabel}</span>
        </div>
      </div>`;
  }

  // --- Budget with over-budget warning text ---
  if (r.budget_context) {
    $('budget-section').classList.remove('hidden');
    const b = r.budget_context;
    const flagColor = b.flag === 'over_budget' ? '#dc2626' : '#16a34a';

    let warningHtml = '';
    if (b.flag === 'over_budget' && b.wardrobe_average > 0) {
      const ratio = Math.round(b.item_price / b.wardrobe_average * 10) / 10;
      warningHtml = `<div class="budget-warning">This is ${ratio}× your average item price.</div>`;
    }

    ($('budget-content') as HTMLElement).innerHTML = `
      <div class="budget-grid">
        <div class="metric"><div class="val" style="color:${flagColor}">$${b.item_price}</div><div class="lbl">Item Price</div></div>
        <div class="metric"><div class="val">$${b.wardrobe_average}</div><div class="lbl">Your Avg</div></div>
        <div class="metric"><div class="val">$${b.wardrobe_median}</div><div class="lbl">Median</div></div>
        <div class="metric"><div class="val">$${b.wardrobe_max}</div><div class="lbl">Max</div></div>
      </div>
      ${warningHtml}`;
  }
}

$('retry-btn').addEventListener('click', () => {
  $('state-error').classList.add('hidden');
  $('state-loading').classList.remove('hidden');
  init();
});

function showReady() {
  $('state-loading').classList.add('hidden');
  $('state-error').classList.add('hidden');
  $('state-result').classList.add('hidden');
  $('state-ready').classList.remove('hidden');
}

$('scan-another-btn').addEventListener('click', async () => {
  await chrome.storage.session.remove(['lastResult', 'lastError', 'progressStep', 'startedAt']);
  await chrome.storage.session.set({ scanningStatus: 'ready' });
  showReady();
});

async function init() {
  // Poll for state changes
  const poll = async () => {
    const data = await chrome.storage.session.get(['scanningStatus', 'lastResult', 'lastError', 'progressStep', 'startedAt']);
    if (data.scanningStatus === 'scanning') {
      $('state-loading').classList.remove('hidden');
      $('state-error').classList.add('hidden');
      $('state-result').classList.add('hidden');

      const step = Number(data.progressStep ?? 0);
      const startedAt = Number(data.startedAt ?? Date.now());
      const elapsed = Date.now() - startedAt;

      // Show progress steps
      $('progress-steps').classList.remove('hidden');
      renderProgress(step, startedAt);

      // Update message
      const stepIdx = Math.min(step, STEPS.length - 1);
      ($('loading-msg') as HTMLElement).textContent = STEPS[stepIdx];

      // Timeout after 90s
      if (elapsed > 90000) {
        showError('Scan timed out. Please try again.');
        return;
      }

      setTimeout(poll, 500);
    } else if (data.lastResult) {
      renderResult(data.lastResult as ScanResult);
    } else if (data.lastError) {
      showError(data.lastError as string);
    } else {
      const token = await getToken();
      if (!token) {
        showError('Not connected. Open the popup to enter your API token.');
      } else {
        showReady();
      }
    }
  };
  poll();
}

init();
