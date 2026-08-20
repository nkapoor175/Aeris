// ============================================================
// AERIS — Screening Console Functional Logic & Navigation Engine
// Manages 4 SPA views: Overview, Screenings, Patient, Device
// Every risk number, patient, and reading rendered here comes from
// the real backend (server.js / SQLite) via src/api-client.js —
// there is no mock or fabricated screening data in this file.
// ============================================================

import './dashboard-style.css';
import Chart from 'chart.js/auto';
import { fetchReadings, submitPatientContext, fetchPatientContext } from './api-client.js';
import { classificationFor, AWAITING_INFO } from './classification-map.js';

const POLL_INTERVAL_MS = 5000;

// ── APPLICATION STATE (all populated from the real API) ──
const state = {
  readings: [],       // full GET /api/readings result, newest first
  apiOnline: null,     // null = not yet checked
  selectedPatientId: null,
  // Client-side-only demo toggle for the Device view's offline-queue
  // panel. NOT backed by any real firmware/backend concept — see the
  // "UI simulation only" note in dashboard.html.
  simulatedOfflineMode: false,
};

let patientChartInstance = null;

// ── DATA LOADING ──
async function loadReadings() {
  try {
    const readings = await fetchReadings();
    state.readings = readings;
    state.apiOnline = true;
  } catch (err) {
    console.error('Failed to load readings from API:', err);
    state.apiOnline = false;
  }
}

function getDistinctPatientIds() {
  const ids = new Set(state.readings.map((r) => r.patient_id));
  return Array.from(ids).sort();
}

function getDistinctDeviceIds() {
  const ids = new Set(state.readings.map((r) => r.device_id));
  return Array.from(ids).sort();
}

function patientReadings(patientId) {
  return state.readings.filter((r) => r.patient_id === patientId);
}

function genderLabel(genderCode) {
  if (genderCode === 0) return 'Female';
  if (genderCode === 1) return 'Male';
  return 'Unknown';
}

// patient_id, device_id, and error messages are user/API-controlled strings
// with no server-side character restrictions (server.js only checks
// non-empty). They get interpolated into innerHTML templates throughout
// this file for layout flexibility (colored badges, mixed inline markup) —
// every such interpolation MUST go through this first, or a patient_id like
// "<img src=x onerror=...>" submitted via the (unauthenticated)
// POST /api/patient-context executes in every viewer's browser.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// The "authoritative" result for a reading: server_risk_level once
// computed, otherwise the on-device fast estimate. Never invents a
// value — callers must check `.isServerVerified` to render the
// distinction, not just the number.
function authoritativeResult(reading) {
  if (reading.server_risk_level !== null && reading.server_risk_level !== undefined) {
    return { code: reading.server_risk_level, isServerVerified: true };
  }
  return { code: reading.device_risk_level, isServerVerified: false };
}

// ── 1. SPA TAB NAVIGATION ──
function initTabNavigation() {
  const navLinks = document.querySelectorAll('#dash-nav .dash-nav__link');
  const views = document.querySelectorAll('.dash-view');

  function switchTab(viewId) {
    navLinks.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.view === viewId));
    views.forEach((v) => v.classList.toggle('is-active', v.id === `view-${viewId}`));

    if (viewId === 'patient') {
      renderPatientView();
    }
  }

  navLinks.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(btn.dataset.view);
    });
  });

  const btnGotoDevice = document.getElementById('btn-goto-device');
  if (btnGotoDevice) {
    btnGotoDevice.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('device');
    });
  }
}

// ── 2. HEADER: REAL API CONNECTIVITY STATUS ──
function renderApiStatusPill() {
  const pill = document.getElementById('dash-status-pill');
  if (!pill) return;

  if (state.apiOnline === false) {
    pill.innerHTML = `<span class="dash-dot dash-dot--warn"></span>BACKEND UNREACHABLE`;
    pill.title = `Could not reach the API. Is "node server.js" running?`;
  } else if (state.apiOnline === true) {
    pill.innerHTML = `<span class="dash-dot dash-dot--active"></span>ONLINE`;
    pill.title = '';
  } else {
    pill.innerHTML = `<span class="dash-dot"></span>CONNECTING…`;
  }
}

// ── 3. OVERVIEW VIEW RENDERERS ──
function renderOverviewStats() {
  const today = new Date().toDateString();
  const todaysReadings = state.readings.filter((r) => new Date(r.received_at).toDateString() === today);

  const healthy = todaysReadings.filter((r) => r.device_risk_level === 0).length;
  const mild = todaysReadings.filter((r) => r.device_risk_level === 1).length;
  const severe = todaysReadings.filter((r) => r.device_risk_level === 2).length;

  document.getElementById('m-total').textContent = todaysReadings.length;
  document.getElementById('m-healthy').textContent = healthy;
  document.getElementById('m-mild').textContent = mild;
  document.getElementById('m-severe').textContent = severe;
}

function renderActiveScreeningCard() {
  const latest = state.readings[0]; // API returns newest-first (ORDER BY received_at DESC)

  const badge = document.getElementById('active-risk-badge');
  const banner = document.getElementById('active-result-banner');
  const resLabel = document.getElementById('active-result-label');
  const resCode = document.getElementById('active-result-code');
  const actText = document.getElementById('active-action-text');
  const demoEl = document.getElementById('active-patient-demo');
  const sigEl = document.getElementById('active-signal-quality');
  const spo2El = document.getElementById('active-spo2');
  const hrvEl = document.getElementById('active-hrv');
  const piEl = document.getElementById('active-pi');
  const expEl = document.getElementById('active-explanation');
  const timeEl = document.getElementById('active-timestamp');

  if (!latest) {
    if (badge) badge.textContent = 'NO READINGS YET';
    if (resLabel) resLabel.textContent = '—';
    if (expEl) expEl.textContent = 'No readings have been received from any device yet.';
    renderOledMirror(null);
    return;
  }

  const { code, isServerVerified } = authoritativeResult(latest);
  const cMap = classificationFor(code);

  if (badge) {
    badge.textContent = isServerVerified
      ? `CODE ${code} // ${cMap.label} (SERVER-VERIFIED)`
      : `CODE ${code} // ${cMap.label} (ON-DEVICE ESTIMATE)`;
    badge.style.color = cMap.color;
    badge.style.backgroundColor = cMap.bgColor;
  }

  if (banner) banner.style.borderColor = cMap.color;
  if (resLabel) {
    resLabel.textContent = cMap.label;
    resLabel.style.color = cMap.color;
  }
  if (resCode) resCode.textContent = cMap.code === null ? '—' : cMap.code;
  if (actText) actText.textContent = cMap.action;

  if (demoEl) {
    const age = latest.patient_age !== null && latest.patient_age !== undefined ? `${latest.patient_age} yrs` : 'age unknown';
    const gender = genderLabel(latest.patient_gender);
    demoEl.textContent = `${latest.patient_id} · ${age} · ${gender}`;
  }

  // The backend does not transmit a signal-quality field (that's a
  // firmware-only quality-gating concept) — shown honestly as N/A
  // rather than fabricated.
  if (sigEl) {
    sigEl.textContent = '● N/A';
    sigEl.className = 'dash-signal-pill';
  }

  if (spo2El) spo2El.innerHTML = `${latest.spo2} <small>%</small>`;
  if (hrvEl) hrvEl.innerHTML = `${latest.hrv} <small>ms</small>`;
  if (piEl) piEl.innerHTML = `${latest.perfusion_index} <small>%</small>`;

  if (expEl) {
    expEl.textContent = isServerVerified
      ? `Server-side estimate using this reading's real Red/IR values plus the patient's registered age (${latest.patient_age}) and gender (${genderLabel(latest.patient_gender)}).`
      : `On-device fast estimate only — no patient-context registered for ${latest.patient_id} yet, so this uses on-device placeholder demographics. Submit patient context to unlock the full server-side estimate.`;
  }

  if (timeEl) timeEl.textContent = new Date(latest.received_at).toLocaleString();

  renderOledMirror(latest);
}

function renderOledMirror(reading) {
  const screen = document.getElementById('oled-screen');
  if (!screen) return;

  if (!reading) {
    screen.innerHTML = `
      <div class="oled-header">AERIS OLED v1.2 · SSD1306</div>
      <div class="oled-readings"><span>No readings yet</span></div>
    `;
    return;
  }

  const { code, isServerVerified } = authoritativeResult(reading);
  const cMap = classificationFor(code);

  screen.innerHTML = `
    <div class="oled-header">AERIS OLED v1.2 · SSD1306</div>
    <div style="margin: 6px 0;">
      <div class="oled-result__risk" style="color:${cMap.color}">RESULT: ${cMap.oledText} (Code ${cMap.code ?? '—'})</div>
      <div class="oled-readings">
        <span>${escapeHtml(reading.patient_id)}</span>
        <span>SpO₂ ${reading.spo2}%</span>
        <span>PI ${reading.perfusion_index}%</span>
      </div>
    </div>
    <div class="oled-footer">${isServerVerified ? cMap.action : 'On-device estimate — awaiting patient info'}</div>
  `;
}

function renderCompactDeviceStatus() {
  const el = document.getElementById('compact-device-status');
  if (!el) return;

  const deviceIds = getDistinctDeviceIds();
  const items = [
    { label: 'BACKEND API', val: state.apiOnline ? 'REACHABLE' : 'UNREACHABLE', active: !!state.apiOnline },
    { label: 'DEVICES SEEN', val: `${deviceIds.length} REPORTING`, active: deviceIds.length > 0 },
    { label: 'TOTAL READINGS', val: `${state.readings.length} STORED`, active: state.readings.length > 0 },
    { label: 'OFFLINE QUEUE (SIM)', val: state.simulatedOfflineMode ? 'SIMULATING' : '0 QUEUED', active: !state.simulatedOfflineMode },
  ];

  el.innerHTML = items.map((item) => `
    <div class="dash-compact-device-item">
      <span class="dash-device-dot ${item.active ? 'is-active' : 'is-warn'}"></span>
      <div>
        <div class="dash-compact-label">${item.label}</div>
        <div class="dash-compact-val">${item.val}</div>
      </div>
    </div>
  `).join('');

  const headerQueue = document.getElementById('header-queue-count');
  if (headerQueue) headerQueue.textContent = state.simulatedOfflineMode ? '1+' : '0';
}

function resultCellHtml(reading) {
  const device = classificationFor(reading.device_risk_level);
  const serverHasValue = reading.server_risk_level !== null && reading.server_risk_level !== undefined;
  const server = serverHasValue ? classificationFor(reading.server_risk_level) : AWAITING_INFO;

  return `
    <div class="dash-risk-tag" style="color:${device.color};background:${device.bgColor};margin-bottom:4px;">Device: ${device.label}</div>
    <div class="dash-risk-tag" style="color:${server.color};background:${server.bgColor};">Server: ${server.label}</div>
  `;
}

function renderRecentActivityTable() {
  const tbody = document.getElementById('overview-recent-body');
  if (!tbody) return;

  const recents = state.readings.slice(0, 7);
  tbody.innerHTML = recents.map((r) => `
    <tr class="clickable-row" data-id="${r.id}">
      <td><strong>#${r.id}</strong></td>
      <td>${escapeHtml(r.patient_id)}</td>
      <td>${r.patient_age ?? '—'} / ${genderLabel(r.patient_gender)}</td>
      <td>${resultCellHtml(r)}</td>
      <td><span class="dash-signal-pill">● N/A</span></td>
      <td>Complete</td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.clickable-row').forEach((row) => {
    row.addEventListener('click', () => openScreeningModal(Number(row.dataset.id)));
  });
}

// Handle Form Submission: registers patient context via the real API.
// Does NOT simulate a screening — a browser has no sensor to read.
function initScreeningForm() {
  const form = document.getElementById('screening-input-form');
  const genderBtns = document.querySelectorAll('.gender-btn');
  const genderInput = document.getElementById('input-gender');
  const patientIdInput = document.getElementById('input-patient-id');
  const ageInput = document.getElementById('input-age');
  const statusEl = document.getElementById('context-form-status');

  genderBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      genderBtns.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      if (genderInput) genderInput.value = btn.dataset.gender;
    });
  });

  // Pre-fill age/gender if this patient_id already has context saved
  // (GET /api/patient-context/:id) — matches the README's stated use case.
  if (patientIdInput) {
    patientIdInput.addEventListener('blur', async () => {
      const id = patientIdInput.value.trim();
      if (!id) return;
      try {
        const ctx = await fetchPatientContext(id);
        if (ctx) {
          ageInput.value = ctx.age;
          genderBtns.forEach((b) => b.classList.toggle('is-active', Number(b.dataset.gender) === ctx.gender));
          if (genderInput) genderInput.value = String(ctx.gender);
        }
      } catch (err) {
        console.error('Failed to pre-fill patient context:', err);
      }
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const patientId = patientIdInput.value.trim();
      const age = Number(ageInput.value);
      const gender = Number(genderInput.value);

      if (statusEl) statusEl.innerHTML = `<span>Saving…</span>`;

      try {
        await submitPatientContext(patientId, age, gender);
        if (statusEl) {
          statusEl.innerHTML = `<span style="color:#4A9B6E">Saved. Future readings for ${escapeHtml(patientId)} will include a server-side estimate — existing readings are not retroactively updated.</span>`;
        }
        await refreshAllData();
      } catch (err) {
        if (statusEl) statusEl.innerHTML = `<span style="color:#B93B3B">Failed to save: ${escapeHtml(err.message)}</span>`;
      }
    });
  }
}

// ── 4. DEDICATED SCREENINGS HISTORY VIEW ──
function renderFullScreeningsTable() {
  const tbody = document.getElementById('full-screenings-body');
  const countLabel = document.getElementById('screenings-count-label');
  if (!tbody) return;

  if (countLabel) countLabel.textContent = `Showing ${state.readings.length} records`;

  tbody.innerHTML = state.readings.map((r) => {
    const { code, isServerVerified } = authoritativeResult(r);
    const cMap = classificationFor(code);
    return `
      <tr class="clickable-row" data-id="${r.id}">
        <td><strong>#${r.id}</strong></td>
        <td>${escapeHtml(r.patient_id)}</td>
        <td>${r.patient_age ?? '—'}</td>
        <td>${genderLabel(r.patient_gender)}</td>
        <td>${new Date(r.received_at).toLocaleString()}</td>
        <td><strong style="color:${classificationFor(r.device_risk_level).color}">${r.device_risk_level}</strong></td>
        <td>${resultCellHtml(r)}</td>
        <td><span class="dash-signal-pill">● N/A</span></td>
        <td style="font-size:12px;color:var(--color-muted)">${isServerVerified ? cMap.action : 'Awaiting patient info'}</td>
        <td>Complete</td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.clickable-row').forEach((row) => {
    row.addEventListener('click', () => openScreeningModal(Number(row.dataset.id)));
  });
}

function initModal() {
  const backdrop = document.getElementById('screening-modal-backdrop');
  const closeBtn = document.getElementById('modal-close-btn');

  if (closeBtn) closeBtn.addEventListener('click', () => backdrop && backdrop.classList.remove('is-open'));
  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.classList.remove('is-open');
    });
  }
}

function openScreeningModal(readingId) {
  const r = state.readings.find((item) => item.id === readingId);
  if (!r) return;

  const backdrop = document.getElementById('screening-modal-backdrop');
  const titleEl = document.getElementById('modal-screening-id');
  const bodyEl = document.getElementById('modal-body');

  const device = classificationFor(r.device_risk_level);
  const serverHasValue = r.server_risk_level !== null && r.server_risk_level !== undefined;
  const server = serverHasValue ? classificationFor(r.server_risk_level) : AWAITING_INFO;
  const { code } = authoritativeResult(r);
  const headline = classificationFor(code);

  if (titleEl) titleEl.textContent = `#${r.id}`;

  if (bodyEl) {
    bodyEl.innerHTML = `
      <div class="dash-result-banner" style="border-color:${headline.color}">
        <span class="result-category" style="color:${headline.color}">${headline.label}</span>
        <div class="result-code-tag">${serverHasValue ? 'Server-verified' : 'On-device estimate'}</div>
      </div>
      <div class="dash-action-box" style="margin-top:12px;">
        <span class="action-label">ACTION INDICATOR:</span>
        <h4 class="action-text">${serverHasValue ? server.action : 'Awaiting patient info for a full estimate'}</h4>
      </div>
      <div class="dash-meta-list" style="margin-top:14px;padding:0;">
        <div class="dash-meta-row"><span>Patient ID</span><strong>${escapeHtml(r.patient_id)}</strong></div>
        <div class="dash-meta-row"><span>Age / Gender</span><strong>${r.patient_age ?? '—'} yrs / ${genderLabel(r.patient_gender)}</strong></div>
        <div class="dash-meta-row"><span>Device</span><strong>${escapeHtml(r.device_id)}</strong></div>
        <div class="dash-meta-row"><span>Device Result</span><strong style="color:${device.color}">${device.label} (Code ${device.code})</strong></div>
        <div class="dash-meta-row"><span>Server Result</span><strong style="color:${server.color}">${serverHasValue ? `${server.label} (Code ${server.code})` : server.label}</strong></div>
        <div class="dash-meta-row"><span>SpO₂</span><strong>${r.spo2}%</strong></div>
        <div class="dash-meta-row"><span>HRV</span><strong>${r.hrv} ms</strong></div>
        <div class="dash-meta-row"><span>Perfusion Index (PI)</span><strong>${r.perfusion_index}%</strong></div>
        <div class="dash-meta-row"><span>Raw Red / IR</span><strong>${r.red_raw} / ${r.ir_raw}</strong></div>
        <div class="dash-meta-row"><span>Screening Time</span><strong>${new Date(r.timestamp).toLocaleString()}</strong></div>
        <div class="dash-meta-row"><span>Received At</span><strong>${new Date(r.received_at).toLocaleString()}</strong></div>
      </div>
    `;
  }

  if (backdrop) backdrop.classList.add('is-open');
}

// ── 5. PATIENT-LEVEL VIEW & LONGITUDINAL TREND ──
function populatePatientSelect() {
  const select = document.getElementById('patient-select');
  if (!select) return;

  const patientIds = getDistinctPatientIds();
  const previousValue = select.value;

  if (patientIds.length === 0) {
    select.innerHTML = `<option value="">No patients yet — submit a reading first</option>`;
    return;
  }

  select.innerHTML = patientIds.map((id) => {
    const reading = patientReadings(id)[0];
    const age = reading?.patient_age ?? '—';
    const gender = genderLabel(reading?.patient_gender);
    const safeId = escapeHtml(id);
    return `<option value="${safeId}">Patient ${safeId} (${gender}, ${age} yrs)</option>`;
  }).join('');

  // Keep the previous selection if it's still valid, otherwise default to the first patient
  if (patientIds.includes(previousValue)) {
    select.value = previousValue;
  } else if (patientIds.includes(state.selectedPatientId)) {
    select.value = state.selectedPatientId;
  }
  state.selectedPatientId = select.value;
}

function renderPatientView() {
  const select = document.getElementById('patient-select');
  if (!select) return;

  populatePatientSelect();
  const patientId = select.value;
  state.selectedPatientId = patientId;

  const profileCard = document.getElementById('patient-profile-card');
  const tbody = document.getElementById('patient-history-body');

  if (!patientId) {
    if (profileCard) profileCard.innerHTML = `<div class="dash-panel__header"><span class="dash-panel__title">No patients yet</span></div>`;
    if (tbody) tbody.innerHTML = '';
    renderPatientTrendChart([]);
    return;
  }

  const history = patientReadings(patientId); // newest-first, as returned by the API
  const latest = history[0];
  const { code } = authoritativeResult(latest);
  const cMap = classificationFor(code);

  if (profileCard) {
    profileCard.innerHTML = `
      <div class="dash-panel__header">
        <span class="dash-panel__title">Patient ${escapeHtml(patientId)}</span>
        <span class="dash-badge" style="color:${cMap.color};background:${cMap.bgColor}">LATEST: ${cMap.label}</span>
      </div>
      <div class="dash-id-row">
        <div>
          <span class="dash-id-label">DEMOGRAPHICS</span>
          <div class="dash-id-val">${latest.patient_age ?? 'Not registered'} ${latest.patient_age !== null ? 'yrs' : ''} · ${genderLabel(latest.patient_gender)}</div>
        </div>
        <div style="text-align:right;">
          <span class="dash-id-label">TOTAL SCREENINGS</span>
          <div class="dash-id-val">${history.length} Recorded</div>
        </div>
      </div>
      <div class="dash-action-box" style="margin:14px 18px 0;">
        <span class="action-label">RECOMMENDED NEXT ACTION:</span>
        <h4 class="action-text">${cMap.action}</h4>
      </div>
      <div class="dash-meta-list" style="padding:14px 18px;">
        <div class="dash-meta-row"><span>Latest Screening</span><strong>${new Date(latest.received_at).toLocaleString()}</strong></div>
        <div class="dash-meta-row"><span>Device Result</span><strong>Code ${latest.device_risk_level}</strong></div>
        <div class="dash-meta-row"><span>Server Result</span><strong>${latest.server_risk_level ?? 'Awaiting patient info'}</strong></div>
      </div>
    `;
  }

  if (tbody) {
    tbody.innerHTML = history.map((h) => `
      <tr>
        <td>${new Date(h.received_at).toLocaleString()}</td>
        <td>${resultCellHtml(h)}</td>
        <td>${h.spo2}%</td>
        <td>${h.hrv} ms</td>
        <td>${h.perfusion_index}%</td>
        <td><span class="dash-signal-pill">● N/A</span></td>
      </tr>
    `).join('');
  }

  renderPatientTrendChart(history, patientId);
}

function renderPatientTrendChart(history, patientId) {
  const canvas = document.getElementById('patient-trend-chart');
  if (!canvas) return;

  const subLabel = document.getElementById('patient-chart-sub');
  if (subLabel) {
    subLabel.textContent = patientId
      ? `Longitudinal risk & optical telemetry trend for ${patientId}`
      : 'SpO₂ · Perfusion Index · HRV history over time';
  }

  if (patientChartInstance) {
    patientChartInstance.destroy();
    patientChartInstance = null;
  }
  if (!history || history.length === 0) return;

  // Chronological order (oldest -> newest) for a natural left-to-right trend
  const chronological = [...history].reverse();
  const labels = chronological.map((h) => new Date(h.received_at).toLocaleDateString());
  const spo2Data = chronological.map((h) => h.spo2);
  const piData = chronological.map((h) => h.perfusion_index);
  const deviceCodeData = chronological.map((h) => h.device_risk_level);
  const serverCodeData = chronological.map((h) => h.server_risk_level); // null gaps where not yet computed

  patientChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'SpO₂ %',
          data: spo2Data,
          borderColor: '#D6B84C',
          backgroundColor: 'rgba(214,184,76,0.08)',
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: '#D6B84C',
          tension: 0.3,
          fill: true,
          yAxisID: 'ySpO2',
        },
        {
          label: 'Perfusion Index (PI %)',
          data: piData,
          borderColor: '#4A9B6E',
          backgroundColor: 'rgba(74,155,110,0.05)',
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: '#4A9B6E',
          tension: 0.3,
          fill: true,
          yAxisID: 'yPI',
        },
        {
          label: 'Device Risk Code',
          data: deviceCodeData,
          borderColor: '#9E3838',
          borderWidth: 1.5,
          borderDash: [5, 5],
          pointRadius: 3,
          pointBackgroundColor: '#9E3838',
          tension: 0.1,
          yAxisID: 'yCode',
        },
        {
          label: 'Server Risk Code',
          data: serverCodeData,
          borderColor: '#6E7FD6',
          borderWidth: 1.5,
          pointRadius: 3,
          pointBackgroundColor: '#6E7FD6',
          spanGaps: false, // null points (no context yet) show as real gaps, not interpolated
          tension: 0.1,
          yAxisID: 'yCode',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          labels: { color: '#B0AFAA', font: { family: "'JetBrains Mono', monospace", size: 11 }, boxWidth: 12 },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#B0AFAA', font: { family: "'JetBrains Mono', monospace", size: 11 } },
        },
        ySpO2: {
          position: 'left',
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#D6B84C', font: { family: "'JetBrains Mono', monospace", size: 11 } },
          min: 85, max: 100,
        },
        yPI: {
          position: 'right',
          grid: { display: false },
          ticks: { color: '#4A9B6E', font: { family: "'JetBrains Mono', monospace", size: 11 } },
          min: 0, max: 5,
        },
        yCode: {
          display: false,
          min: -0.5, max: 2.5,
        },
      },
    },
  });
}

function initPatientViewControls() {
  const select = document.getElementById('patient-select');
  if (select) {
    select.addEventListener('change', () => {
      state.selectedPatientId = select.value;
      renderPatientView();
    });
  }
}

// ── 6. DEVICE & OFFLINE QUEUE DIAGNOSTICS ──
function renderFullDeviceStatus() {
  const el = document.getElementById('full-device-status-list');
  if (!el) return;

  const deviceIds = getDistinctDeviceIds();

  if (deviceIds.length === 0) {
    el.innerHTML = `<p style="padding:14px;color:var(--color-muted)">No devices have reported readings yet.</p>`;
    updateQueueUI();
    return;
  }

  const rows = deviceIds.map((deviceId) => {
    const readings = state.readings.filter((r) => r.device_id === deviceId);
    const lastSeen = readings.length ? new Date(readings[0].received_at).toLocaleString() : '—';
    return `
      <div class="dash-device-item" style="justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--color-border)">
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="dash-device-dot is-active"></span>
          <span>${escapeHtml(deviceId)}</span>
        </div>
        <strong style="font-family:var(--font-mono);font-size:12px;color:var(--color-accent)">${readings.length} readings · last seen ${lastSeen}</strong>
      </div>
    `;
  }).join('');

  el.innerHTML = `
    <p style="padding:0 0 10px;font-size:12px;color:var(--color-muted)">
      Derived from stored readings — no live telemetry channel (battery/WiFi signal/etc.) exists yet, only what each device has actually transmitted.
    </p>
    ${rows}
  `;

  updateQueueUI();
}

function updateQueueUI() {
  const countDisplay = document.getElementById('queue-count-display');
  const badge = document.getElementById('offline-queue-badge');
  const headerCount = document.getElementById('header-queue-count');
  const queuedCount = state.simulatedOfflineMode ? 1 : 0;

  if (countDisplay) {
    countDisplay.textContent = queuedCount === 0 ? '0 readings — fully synced' : `${queuedCount} reading (simulated) waiting to sync`;
  }
  if (badge) {
    badge.textContent = queuedCount === 0 ? 'FULLY SYNCED' : `${queuedCount} READINGS QUEUED (SIM)`;
  }
  if (headerCount) headerCount.textContent = queuedCount;
}

function initDeviceControls() {
  const btnToggleOffline = document.getElementById('btn-toggle-offline');
  const btnSyncQueue = document.getElementById('btn-sync-queue');

  if (btnToggleOffline) {
    btnToggleOffline.addEventListener('click', () => {
      state.simulatedOfflineMode = !state.simulatedOfflineMode;
      btnToggleOffline.textContent = state.simulatedOfflineMode ? 'Switch to Online Mode' : 'Simulate Offline Mode';
      btnToggleOffline.style.borderColor = state.simulatedOfflineMode ? '#D6B84C' : 'var(--color-border)';
      updateQueueUI();
      renderCompactDeviceStatus();
    });
  }

  if (btnSyncQueue) {
    btnSyncQueue.addEventListener('click', () => {
      state.simulatedOfflineMode = false;
      updateQueueUI();
      renderCompactDeviceStatus();
    });
  }
}

// ── RENDER + REFRESH ──
function renderAll() {
  renderApiStatusPill();
  renderOverviewStats();
  renderActiveScreeningCard();
  renderCompactDeviceStatus();
  renderRecentActivityTable();
  renderFullScreeningsTable();
  renderFullDeviceStatus();

  const patientViewActive = document.getElementById('view-patient')?.classList.contains('is-active');
  if (patientViewActive) renderPatientView();
  else populatePatientSelect();
}

async function refreshAllData() {
  await loadReadings();
  renderAll();
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  initTabNavigation();
  initScreeningForm();
  initModal();
  initPatientViewControls();
  initDeviceControls();

  refreshAllData();
  setInterval(refreshAllData, POLL_INTERVAL_MS);
});
