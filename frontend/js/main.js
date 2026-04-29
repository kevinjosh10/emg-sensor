import { db, dbRef, set, push, onValue, serverTimestamp, runTransaction } from "./firebase-service.js";

/* ─── CONSTANTS & STATE ─────────────────────────────────────────────── */
const DATA_POINTS   = 60;
const DEBOUNCE_MS   = 800;
const DBL_WINDOW_MS = 550;

const DIRS      = ['UP', 'RIGHT', 'DOWN', 'LEFT'];
const DIR_CHARS = { UP: '↑', RIGHT: '→', DOWN: '↓', LEFT: '←' };

let currentDir = 'UP';
let lastBlinkAt = 0;
let prevBlinkAt = 0;
let lastFistAt  = 0;
let totalEvents = 0;
const t0 = performance.now();

/* ─── DEMO MODE STATE ───────────────────────────────────────────────── */
let demoModeOn = true;
let lastFirebaseSignalTs = 0;
const MOCK_PAUSE_AFTER_FB_MS = 1500;

let eyeSpikeTicks  = 0;
let fistSpikeTicks = 0;

let eyeDrift  = 100;
let fistDrift = 90;

/* ─── CHART SETUP ───────────────────────────────────────────────────── */
const makeZeros = (n) => Array(n).fill(0);
const labels    = Array(DATA_POINTS).fill('');

const eyeData  = makeZeros(DATA_POINTS);
const fistData = makeZeros(DATA_POINTS);

function buildChart(canvasId, color, data, initThreshold) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          data,
          borderColor:     color,
          borderWidth:     1.5,
          backgroundColor: color + '12',
          pointRadius:     0,
          tension:         0.35,
          fill:            true,
        },
        {
          data:        Array(DATA_POINTS).fill(initThreshold),
          borderColor: 'rgba(255,255,255,0.13)',
          borderWidth: 1,
          borderDash:  [5, 4],
          pointRadius: 0,
          tension:     0,
          fill:        false,
        }
      ]
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      animation:           false,
      scales: {
        x: { display: false },
        y: {
          min: 0, max: 1200,
          grid:   { color: 'rgba(255,255,255,0.04)', drawTicks: false },
          ticks:  { color: '#4a4a62', font: { family: 'JetBrains Mono', size: 10 }, maxTicksLimit: 4, padding: 6 },
          border: { display: false },
        }
      },
      plugins: { legend: { display: false }, tooltip: { enabled: false } }
    }
  });
}

const eyeChart  = buildChart('eye-chart',  '#38b6ff', eyeData,  500);
const fistChart = buildChart('fist-chart', '#ff5c38', fistData, 600);

function setThresholdLine(chart, value) {
  chart.data.datasets[1].data = Array(DATA_POINTS).fill(value);
  chart.update('none');
}

/* ─── DOM REFS ──────────────────────────────────────────────────────── */
const el = (id) => document.getElementById(id);

const $eyeVal        = el('eye-val');
const $fistVal       = el('fist-val');
const $eyeSlider     = el('eyeSlider');
const $fistSlider    = el('fistSlider');
const $eyeThrDisp    = el('eye-thr-display');
const $fistThrDisp   = el('fist-thr-display');
const $latMs         = el('lat-ms');
const $dirLabel      = el('dir-label');
const $logBody       = el('log-body');
const $evTotal       = el('ev-total');
const $uptime        = el('uptime-display');
const $connPill      = el('conn-pill');
const $connDot       = el('conn-dot');
const $connLabel     = el('conn-label');
const $fbDot         = el('fb-dot');
const $fbLabel       = el('fb-label');
const $badgeBlink    = el('badge-blink');
const $badgeDbl      = el('badge-dbl');
const $badgeFist     = el('badge-fist');
const $btnEyeSpike   = el('btn-eye-spike');
const $btnFistSpike  = el('btn-fist-spike');
const $demoPill      = el('demo-pill');
const $demoPillLabel = el('demo-pill-label');
const $demoToggle    = el('demo-toggle');
const $demoTogLabel  = el('demo-toggle-label');
const $demoOffBanner = el('demo-off-banner');
const $eyeOverlay    = el('eye-overlay');
const $fistOverlay   = el('fist-overlay');

/* ─── DEMO MODE TOGGLE LOGIC ────────────────────────────────────────── */
function applyDemoMode(on) {
  demoModeOn = on;

  $demoToggle.classList.toggle('demo-off', !on);
  $demoTogLabel.textContent = on ? 'Demo Mode' : 'Demo Mode';
  $demoPill.classList.toggle('off', !on);
  $demoPillLabel.textContent = on ? 'Demo On' : 'Demo Off';
  $demoOffBanner.classList.toggle('show', !on);
  $btnEyeSpike.disabled  = !on;
  $btnFistSpike.disabled = !on;
  $eyeOverlay.classList.toggle('show', !on);
  $fistOverlay.classList.toggle('show', !on);

  prependRow(
    new Date().toTimeString().slice(0, 8),
    on
      ? `<span class="c-ok">Demo mode enabled</span> — <span class="c-dim">simulated signals active</span>`
      : `<span class="c-dir">Demo mode disabled</span> — <span class="c-dim">live Firebase only</span>`
  );
}

$demoToggle.addEventListener('click', () => {
  applyDemoMode(!demoModeOn);
});

/* ─── SHARED SAMPLE PROCESSOR ───────────────────────────────────────── */
function processSample(eyeV, fistV) {
  const tStart = performance.now();

  eyeData.shift();  eyeData.push(eyeV);
  fistData.shift(); fistData.push(fistV);
  eyeChart.update('none');
  fistChart.update('none');

  $eyeVal.textContent  = Math.round(eyeV);
  $fistVal.textContent = Math.round(fistV);
  $latMs.textContent   = Math.round(performance.now() - tStart);

  flashFb();
  runDetection(eyeV, fistV);
}

/* ─── FIREBASE LISTENERS ────────────────────────────────────────────── */
onValue(dbRef('.info/connected'), (snap) => {
  const online = snap.val() === true;
  $connPill.className    = 'conn-pill ' + (online ? 'online' : 'offline');
  $connLabel.textContent = online ? 'Connected' : 'Disconnected';
});

onValue(dbRef('signals'), (snap) => {
  const data = snap.val();
  if (!data) return;

  lastFirebaseSignalTs = performance.now();

  $eyeOverlay.classList.remove('show');
  $fistOverlay.classList.remove('show');
  setTimeout(() => {
    if (!demoModeOn) {
      $eyeOverlay.classList.add('show');
      $fistOverlay.classList.add('show');
    }
  }, 2000);

  const eyeV  = data.eye  ?? 0;
  const fistV = data.fist ?? 0;
  processSample(eyeV, fistV);
});

onValue(dbRef('thresholds'), (snap) => {
  const data = snap.val();
  if (!data) return;
  if (data.eye  != null) {
    $eyeSlider.value         = data.eye;
    $eyeThrDisp.textContent  = data.eye;
    setThresholdLine(eyeChart, data.eye);
  }
  if (data.fist != null) {
    $fistSlider.value        = data.fist;
    $fistThrDisp.textContent = data.fist;
    setThresholdLine(fistChart, data.fist);
  }
});

onValue(dbRef('direction'), (snap) => {
  const dir = snap.val();
  if (!dir || !DIR_CHARS[dir]) return;
  currentDir = dir;
  $dirLabel.textContent = dir;
  DIRS.forEach(d => el('darr-' + d).classList.remove('active'));
  el('darr-' + dir).classList.add('active');
});

onValue(dbRef('events'), () => {});

/* ─── SLIDER HANDLERS ───────────────────────────────────────────────── */
$eyeSlider.addEventListener('input', () => {
  const v = Number($eyeSlider.value);
  $eyeThrDisp.textContent = v;
  setThresholdLine(eyeChart, v);
  set(dbRef('thresholds/eye'), v);
});

$fistSlider.addEventListener('input', () => {
  const v = Number($fistSlider.value);
  $fistThrDisp.textContent = v;
  setThresholdLine(fistChart, v);
  set(dbRef('thresholds/fist'), v);
});

/* ─── SPIKE BUTTON HANDLERS ─────────────────────────────────────────── */
$btnEyeSpike.addEventListener('click', () => {
  eyeSpikeTicks = 6;
  $btnEyeSpike.classList.add('firing');
  setTimeout(() => $btnEyeSpike.classList.remove('firing'), 400);
});

$btnFistSpike.addEventListener('click', () => {
  fistSpikeTicks = 6;
  $btnFistSpike.classList.add('firing');
  setTimeout(() => $btnFistSpike.classList.remove('firing'), 400);
});

/* ─── DETECTION LOGIC ───────────────────────────────────────────────── */
function runDetection(eyeV, fistV) {
  const now     = performance.now();
  const eyeThr  = Number($eyeSlider.value);
  const fistThr = Number($fistSlider.value);

  if (eyeV > eyeThr && (now - lastBlinkAt) > DEBOUNCE_MS) {
    const isDouble = (now - prevBlinkAt) < DBL_WINDOW_MS;
    prevBlinkAt = lastBlinkAt;
    lastBlinkAt = now;

    if (isDouble) {
      pushEvent(
        `<span class="c-dbl">Double Blink</span>` +
        ` → <span class="c-dir">Click triggered</span>`
      );
      flash($badgeDbl);
    } else {
      pushEvent(
        `<span class="c-eye">Blink detected</span>` +
        ` → <span class="c-dir">Direction from Firebase</span>`
      );
      flash($badgeBlink);
    }
  }

  if (fistV > fistThr && (now - lastFistAt) > DEBOUNCE_MS) {
    lastFistAt = now;
    const arrow = DIR_CHARS[currentDir] ?? '?';
    pushEvent(
      `<span class="c-fist">Fist detected</span>` +
      ` → Cursor move <span class="c-dir">${arrow}</span>`
    );
    flash($badgeFist);
  }
}

/* ─── EVENT LOG ─────────────────────────────────────────────────────── */
function pushEvent(htmlMsg) {
  const ts = new Date().toTimeString().slice(0, 8);
  prependRow(ts, htmlMsg);
  push(dbRef('events'), { ts, html: htmlMsg, created: serverTimestamp() });
}

function prependRow(ts, html) {
  const row = document.createElement('div');
  row.className = 'log-row';
  row.innerHTML =
    `<span class="log-ts">[${ts}]</span>` +
    `<span class="log-txt">${html}</span>`;
  $logBody.insertBefore(row, $logBody.firstChild);
  $evTotal.textContent = ++totalEvents;
}

/* ─── THRESHOLD SEED ────────────────────────────────────────────────── */
runTransaction(dbRef('thresholds'), (current) => {
  if (current === null) return { eye: 500, fist: 600 };
  return current;
}).then(() => console.log("[SynapseLink] /thresholds seeded ✓")).catch(console.error);

/* ─── UTILITY HELPERS ───────────────────────────────────────────────── */
function flash(badge) {
  badge.classList.add('show');
  setTimeout(() => badge.classList.remove('show'), 750);
}

let fbTimer;
function flashFb() {
  $fbDot.classList.add('pulse');
  $fbLabel.textContent = 'Synced';
  clearTimeout(fbTimer);
  fbTimer = setTimeout(() => {
    $fbDot.classList.remove('pulse');
    $fbLabel.textContent = 'Firebase';
  }, 380);
}

setInterval(() => {
  const sec = Math.floor((performance.now() - t0) / 1000);
  const m   = Math.floor(sec / 60).toString().padStart(2, '0');
  const s   = (sec % 60).toString().padStart(2, '0');
  $uptime.textContent = `Uptime: ${m}:${s}`;
}, 1000);

/* ─── MOCK DATA HELPERS ─────────────────────────────────────────────── */
function driftStep(current, min, max, stepSize) {
  const next = current + (Math.random() - 0.5) * stepSize;
  return Math.max(min, Math.min(max, next));
}

function mockEyeSample() {
  eyeDrift = driftStep(eyeDrift, 60, 180, 18);

  if (eyeSpikeTicks > 0) {
    eyeSpikeTicks--;
    const phase = 6 - eyeSpikeTicks;
    const peakMult = phase <= 2 ? 0.6 + phase * 0.2 : phase <= 4 ? 1.0 : 0.85 - (phase - 4) * 0.2;
    return Math.round(550 + peakMult * (350 + Math.random() * 150));
  }

  if (Math.random() < 0.005) eyeSpikeTicks = 5;

  return Math.round(eyeDrift + (Math.random() - 0.5) * 40);
}

function mockFistSample() {
  fistDrift = driftStep(fistDrift, 55, 160, 16);

  if (fistSpikeTicks > 0) {
    fistSpikeTicks--;
    const phase = 6 - fistSpikeTicks;
    const peakMult = phase <= 2 ? 0.55 + phase * 0.22 : phase <= 4 ? 1.0 : 0.82 - (phase - 4) * 0.18;
    return Math.round(640 + peakMult * (300 + Math.random() * 160));
  }

  if (Math.random() < 0.004) fistSpikeTicks = 5;

  return Math.round(fistDrift + (Math.random() - 0.5) * 35);
}

/* ─── MOCK TICK (50 ms / ~20 Hz) ───────────────────────────────────── */
setInterval(() => {
  if (!demoModeOn) return;
  if (performance.now() - lastFirebaseSignalTs < MOCK_PAUSE_AFTER_FB_MS) return;
  processSample(mockEyeSample(), mockFistSample());
}, 50);

/* ─── SEED INITIAL DATA ─────────────────────────────────────────────── */
(function seedInitial() {
  for (let i = 0; i < DATA_POINTS; i++) {
    eyeData[i]  = Math.round(80 + Math.random() * 80);
    fistData[i] = Math.round(70 + Math.random() * 70);
  }
  eyeChart.update('none');
  fistChart.update('none');
  $eyeVal.textContent  = eyeData[DATA_POINTS - 1];
  $fistVal.textContent = fistData[DATA_POINTS - 1];
})();

/* ─── INITIAL STATE APPLY ───────────────────────────────────────────── */
prependRow(
  new Date().toTimeString().slice(0, 8),
  `<span class="c-ok">SynapseLink ready</span> — <span class="c-dim">Demo mode active</span>`
);
