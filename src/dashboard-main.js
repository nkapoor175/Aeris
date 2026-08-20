// ============================================================
// AERIS — Screening Console Functional Logic & Navigation Engine
// Manages 4 SPA views: Overview, Screenings, Patient, Device
// Handles demographic-aware ML risk predictions, offline queue,
// patient-level longitudinal trends, and physical OLED mirror.
// ============================================================

import './dashboard-style.css';
import Chart from 'chart.js/auto';
import {
  CLASSIFICATION_MAP,
  patientsDatabase,
  activeScreening,
  overviewStats,
  screeningsHistory,
  deviceSystemStatus,
  executeNewScreening,
} from './mock-data.js';

let patientChartInstance = null;

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

  // Handle jump buttons e.g. "Full System Page ->"
  const btnGotoDevice = document.getElementById('btn-goto-device');
  if (btnGotoDevice) {
    btnGotoDevice.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('device');
    });
  }
}

// ── 2. OVERVIEW VIEW RENDERERS ──
function renderOverviewStats() {
  document.getElementById('m-total').textContent = overviewStats.totalScreenedToday;
  document.getElementById('m-healthy').textContent = overviewStats.healthyCount;
  document.getElementById('m-mild').textContent = overviewStats.mildModerateCount;
  document.getElementById('m-severe').textContent = overviewStats.severeCount;
}

function renderActiveScreeningCard() {
  const s = activeScreening;
  const cMap = CLASSIFICATION_MAP[s.classificationCode] || CLASSIFICATION_MAP[0];

  // Badge
  const badge = document.getElementById('active-risk-badge');
  if (badge) {
    badge.textContent = `CODE ${s.classificationCode} // ${cMap.label}`;
    badge.style.color = cMap.color;
    badge.style.backgroundColor = cMap.bgColor;
  }

  // Banner
  const banner = document.getElementById('active-result-banner');
  if (banner) banner.style.borderColor = cMap.color;

  const resLabel = document.getElementById('active-result-label');
  if (resLabel) {
    resLabel.textContent = cMap.label;
    resLabel.style.color = cMap.color;
  }

  const resCode = document.getElementById('active-result-code');
  if (resCode) resCode.textContent = s.classificationCode;

  // Next Action
  const actText = document.getElementById('active-action-text');
  if (actText) actText.textContent = cMap.action;

  // Patient & Signal Quality
  const demoEl = document.getElementById('active-patient-demo');
  if (demoEl) demoEl.textContent = `${s.patientId} · ${s.age} yrs · ${s.genderText}`;

  const sigEl = document.getElementById('active-signal-quality');
  if (sigEl) {
    sigEl.textContent = `● ${s.signalQuality}`;
    sigEl.className = `dash-signal-pill dash-signal-pill--${s.signalQuality.toLowerCase()}`;
  }

  // Metrics
  const spo2El = document.getElementById('active-spo2');
  if (spo2El) spo2El.innerHTML = `${s.spo2} <small>%</small>`;

  const hrvEl = document.getElementById('active-hrv');
  if (hrvEl) hrvEl.innerHTML = `${s.hrv} <small>ms</small>`;

  const piEl = document.getElementById('active-pi');
  if (piEl) piEl.innerHTML = `${s.pi} <small>%</small>`;

  // Explanation & Timestamp
  const expEl = document.getElementById('active-explanation');
  if (expEl) expEl.textContent = s.explanation;

  const timeEl = document.getElementById('active-timestamp');
  if (timeEl) timeEl.textContent = new Date(s.timestamp).toLocaleString();

  // OLED Mirror
  renderOledMirror();
}

function renderOledMirror() {
  const screen = document.getElementById('oled-screen');
  if (!screen) return;
  const s = activeScreening;
  const cMap = CLASSIFICATION_MAP[s.classificationCode] || CLASSIFICATION_MAP[0];

  screen.innerHTML = `
    <div class="oled-header">AERIS OLED v1.2 · SSD1306</div>
    <div style="margin: 6px 0;">
      <div class="oled-result__risk" style="color:${cMap.color}">RESULT: ${cMap.oledText} (Code ${s.classificationCode})</div>
      <div class="oled-readings">
        <span>DEMO: ${s.age}y ${s.genderText.slice(0, 1)}</span>
        <span>SpO₂ ${s.spo2}%</span>
        <span>PI ${s.pi}%</span>
      </div>
    </div>
    <div class="oled-footer">${cMap.action}</div>
  `;
}

function renderCompactDeviceStatus() {
  const el = document.getElementById('compact-device-status');
  if (!el) return;

  const items = [
    { label: 'DEVICE HARDWARE', val: deviceSystemStatus.isOnline ? 'ONLINE' : 'OFFLINE', active: deviceSystemStatus.isOnline },
    { label: 'MAX30102 SENSOR', val: deviceSystemStatus.max30102Sensor, active: true },
    { label: 'ESP32 CORE', val: deviceSystemStatus.esp32Connection, active: true },
    { label: 'OFFLINE QUEUE', val: `${deviceSystemStatus.offlineQueueCount} QUEUED`, active: deviceSystemStatus.offlineQueueCount === 0 },
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

  // Update header pills
  const headerQueue = document.getElementById('header-queue-count');
  if (headerQueue) headerQueue.textContent = deviceSystemStatus.offlineQueueCount;

  const statusPill = document.getElementById('dash-status-pill');
  if (statusPill) {
    if (deviceSystemStatus.isOfflineMode) {
      statusPill.innerHTML = `<span class="dash-dot dash-dot--warn"></span>OFFLINE — QUEUING DATA`;
    } else {
      statusPill.innerHTML = `<span class="dash-dot dash-dot--active"></span>ONLINE`;
    }
  }
}

function renderRecentActivityTable() {
  const tbody = document.getElementById('overview-recent-body');
  if (!tbody) return;

  const recents = screeningsHistory.slice(0, 7);
  tbody.innerHTML = recents.map((s) => {
    const cMap = CLASSIFICATION_MAP[s.code] || CLASSIFICATION_MAP[0];
    return `
      <tr class="clickable-row" data-id="${s.id}">
        <td><strong>${s.id}</strong></td>
        <td>${s.patientId}</td>
        <td>${s.age} / ${s.gender}</td>
        <td><span class="dash-risk-tag" style="color:${cMap.color};background:${cMap.bgColor}">${cMap.label}</span></td>
        <td><span class="dash-signal-pill dash-signal-pill--${s.signalQuality.toLowerCase()}">● ${s.signalQuality}</span></td>
        <td>${s.status}</td>
      </tr>
    `;
  }).join('');

  // Make overview table rows clickable to open modal!
  tbody.querySelectorAll('.clickable-row').forEach((row) => {
    row.addEventListener('click', () => {
      openScreeningModal(row.dataset.id);
    });
  });
}

// Handle Form Submission for New Screening
function initScreeningForm() {
  const form = document.getElementById('screening-input-form');
  const genderBtns = document.querySelectorAll('.gender-btn');
  const genderInput = document.getElementById('input-gender');

  genderBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      genderBtns.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      if (genderInput) genderInput.value = btn.dataset.gender;
    });
  });

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const patientIdInput = document.getElementById('input-patient-id');
      const ageInput = document.getElementById('input-age');

      const patientId = patientIdInput ? patientIdInput.value.trim() : 'PT-0042';
      const age = ageInput ? ageInput.value : 32;
      const genderMale = genderInput ? genderInput.value : 0;

      executeNewScreening(patientId, age, genderMale);

      // Re-render UI
      renderOverviewStats();
      renderActiveScreeningCard();
      renderRecentActivityTable();
      renderFullScreeningsTable();
      renderCompactDeviceStatus();
    });
  }
}

// ── 3. DEDICATED SCREENINGS HISTORY VIEW ──
function renderFullScreeningsTable() {
  const tbody = document.getElementById('full-screenings-body');
  const countLabel = document.getElementById('screenings-count-label');
  if (!tbody) return;

  if (countLabel) countLabel.textContent = `Showing ${screeningsHistory.length} records`;

  tbody.innerHTML = screeningsHistory.map((s) => {
    const cMap = CLASSIFICATION_MAP[s.code] || CLASSIFICATION_MAP[0];
    return `
      <tr class="clickable-row" data-id="${s.id}">
        <td><strong>${s.id}</strong></td>
        <td>${s.patientId}</td>
        <td>${s.age}</td>
        <td>${s.gender}</td>
        <td>${s.time}</td>
        <td><strong style="color:${cMap.color}">${s.code}</strong></td>
        <td><span class="dash-risk-tag" style="color:${cMap.color};background:${cMap.bgColor}">${cMap.label}</span></td>
        <td><span class="dash-signal-pill dash-signal-pill--${s.signalQuality.toLowerCase()}">● ${s.signalQuality}</span></td>
        <td style="font-size:12px;color:var(--color-muted)">${cMap.action}</td>
        <td>${s.status}</td>
      </tr>
    `;
  }).join('');

  // Row click event to open modal
  tbody.querySelectorAll('.clickable-row').forEach((row) => {
    row.addEventListener('click', () => {
      openScreeningModal(row.dataset.id);
    });
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

function openScreeningModal(screeningId) {
  const s = screeningsHistory.find((item) => item.id === screeningId);
  if (!s) return;

  const backdrop = document.getElementById('screening-modal-backdrop');
  const titleEl = document.getElementById('modal-screening-id');
  const bodyEl = document.getElementById('modal-body');
  const cMap = CLASSIFICATION_MAP[s.code] || CLASSIFICATION_MAP[0];

  if (titleEl) titleEl.textContent = s.id;

  if (bodyEl) {
    bodyEl.innerHTML = `
      <div class="dash-result-banner" style="border-color:${cMap.color}">
        <span class="result-category" style="color:${cMap.color}">${cMap.label}</span>
        <div class="result-code-tag">Model Code: <strong>${s.code}</strong></div>
      </div>
      <div class="dash-action-box" style="margin-top:12px;">
        <span class="action-label">ACTION INDICATOR:</span>
        <h4 class="action-text">${cMap.action}</h4>
      </div>
      <div class="dash-meta-list" style="margin-top:14px;padding:0;">
        <div class="dash-meta-row"><span>Patient ID</span><strong>${s.patientId}</strong></div>
        <div class="dash-meta-row"><span>Age / Gender</span><strong>${s.age} yrs / ${s.gender}</strong></div>
        <div class="dash-meta-row"><span>Signal Quality</span><strong>● ${s.signalQuality}</strong></div>
        <div class="dash-meta-row"><span>SpO₂</span><strong>${s.spo2}%</strong></div>
        <div class="dash-meta-row"><span>HRV</span><strong>${s.hrv} ms</strong></div>
        <div class="dash-meta-row"><span>Perfusion Index (PI)</span><strong>${s.pi}%</strong></div>
        <div class="dash-meta-row"><span>Status</span><strong>${s.status}</strong></div>
      </div>
    `;
  }

  if (backdrop) backdrop.classList.add('is-open');
}

// ── 4. PATIENT-LEVEL VIEW & LONGITUDINAL TREND ──
function renderPatientView() {
  const select = document.getElementById('patient-select');
  if (!select) return;

  const patientId = select.value;
  const patient = patientsDatabase.find((p) => p.id === patientId) || patientsDatabase[0];
  const cMap = CLASSIFICATION_MAP[patient.latestResultCode] || CLASSIFICATION_MAP[0];

  // Render Profile Card
  const profileCard = document.getElementById('patient-profile-card');
  if (profileCard) {
    profileCard.innerHTML = `
      <div class="dash-panel__header">
        <span class="dash-panel__title">${patient.name}</span>
        <span class="dash-badge" style="color:${cMap.color};background:${cMap.bgColor}">LATEST: ${cMap.label}</span>
      </div>
      <div class="dash-id-row">
        <div>
          <span class="dash-id-label">DEMOGRAPHICS</span>
          <div class="dash-id-val">${patient.age} yrs · ${patient.genderText}</div>
        </div>
        <div style="text-align:right;">
          <span class="dash-id-label">TOTAL SCREENINGS</span>
          <div class="dash-id-val">${patient.screeningsCount} Recorded</div>
        </div>
      </div>
      <div class="dash-action-box" style="margin:14px 18px 0;">
        <span class="action-label">RECOMMENDED NEXT ACTION:</span>
        <h4 class="action-text">${cMap.action}</h4>
      </div>
      <div class="dash-meta-list" style="padding:14px 18px;">
        <div class="dash-meta-row"><span>Latest Screening</span><strong>${new Date(patient.latestTimestamp).toLocaleString()}</strong></div>
        <div class="dash-meta-row"><span>Signal Quality</span><strong>● ${patient.signalQuality}</strong></div>
        <div class="dash-meta-row"><span>Classification Output</span><strong>Model Code ${patient.latestResultCode}</strong></div>
      </div>
    `;
  }

  // Render Patient Table
  const tbody = document.getElementById('patient-history-body');
  if (tbody) {
    tbody.innerHTML = patient.history.map((h) => {
      const codeMap = CLASSIFICATION_MAP[h.code] || CLASSIFICATION_MAP[0];
      return `
        <tr>
          <td>${h.timestamp}</td>
          <td><span class="dash-risk-tag" style="color:${codeMap.color};background:${codeMap.bgColor}">${codeMap.label}</span></td>
          <td>${h.spo2}%</td>
          <td>${h.hrv} ms</td>
          <td>${h.pi}%</td>
          <td><span class="dash-signal-pill dash-signal-pill--${h.signal.toLowerCase()}">● ${h.signal}</span></td>
        </tr>
      `;
    }).join('');
  }

  // Render Patient Longitudinal Chart
  renderPatientTrendChart(patient);
}

function renderPatientTrendChart(patient) {
  const canvas = document.getElementById('patient-trend-chart');
  if (!canvas) return;

  const subLabel = document.getElementById('patient-chart-sub');
  if (subLabel) subLabel.textContent = `Longitudinal risk & optical telemetry trend for ${patient.id}`;

  if (patientChartInstance) {
    patientChartInstance.destroy();
  }

  const labels = patient.history.map((h) => h.timestamp.split(' ')[0]);
  const spo2Data = patient.history.map((h) => h.spo2);
  const piData = patient.history.map((h) => h.pi);
  const codeData = patient.history.map((h) => h.code);

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
          label: 'Risk Code (0:H, 1:M, 2:S)',
          data: codeData,
          borderColor: '#9E3838',
          borderWidth: 1.5,
          borderDash: [5, 5],
          pointRadius: 3,
          pointBackgroundColor: '#9E3838',
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
      renderPatientView();
    });
  }
}

// ── 5. DEVICE & OFFLINE QUEUE DIAGNOSTICS ──
function renderFullDeviceStatus() {
  const el = document.getElementById('full-device-status-list');
  if (!el) return;

  const items = [
    { label: 'MAX30102 Dual Optical Sensor Array', status: deviceSystemStatus.max30102Sensor, active: true },
    { label: 'ESP32 Microcontroller Serial Interface', status: deviceSystemStatus.esp32Connection, active: true },
    { label: `Firmware Operating System`, status: `v${deviceSystemStatus.firmwareVersion}`, active: true },
    { label: 'Battery System & Power Supply', status: `${deviceSystemStatus.batteryLevel}% · ${deviceSystemStatus.batteryStatus}`, active: true },
    { label: 'Data Security & Storage Encryption', status: deviceSystemStatus.securityEncryption, active: true },
    { label: 'Network Telemetry Transport', status: deviceSystemStatus.dataTransmission, active: true },
  ];

  el.innerHTML = items.map((item) => `
    <div class="dash-device-item" style="justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--color-border)">
      <div style="display:flex;align-items:center;gap:10px;">
        <span class="dash-device-dot ${item.active ? 'is-active' : ''}"></span>
        <span>${item.label}</span>
      </div>
      <strong style="font-family:var(--font-mono);font-size:12px;color:var(--color-accent)">${item.status}</strong>
    </div>
  `).join('');

  updateQueueUI();
}

function updateQueueUI() {
  const countDisplay = document.getElementById('queue-count-display');
  const badge = document.getElementById('offline-queue-badge');
  const headerCount = document.getElementById('header-queue-count');

  if (countDisplay) {
    if (deviceSystemStatus.offlineQueueCount === 0) {
      countDisplay.textContent = '0 readings — fully synced';
    } else {
      countDisplay.textContent = `${deviceSystemStatus.offlineQueueCount} readings waiting to sync`;
    }
  }
  if (badge) {
    badge.textContent = deviceSystemStatus.offlineQueueCount === 0 ? 'FULLY SYNCED' : `${deviceSystemStatus.offlineQueueCount} READINGS QUEUED`;
    badge.className = deviceSystemStatus.offlineQueueCount === 0 ? 'dash-badge risk-low' : 'dash-badge';
  }
  if (headerCount) {
    headerCount.textContent = deviceSystemStatus.offlineQueueCount;
  }
}

function initDeviceControls() {
  const btnToggleOffline = document.getElementById('btn-toggle-offline');
  const btnSyncQueue = document.getElementById('btn-sync-queue');

  if (btnToggleOffline) {
    btnToggleOffline.addEventListener('click', () => {
      deviceSystemStatus.isOfflineMode = !deviceSystemStatus.isOfflineMode;
      btnToggleOffline.textContent = deviceSystemStatus.isOfflineMode ? 'Switch to Online Mode' : 'Simulate Offline Mode';
      btnToggleOffline.style.borderColor = deviceSystemStatus.isOfflineMode ? '#D6B84C' : 'var(--color-border)';
      renderCompactDeviceStatus();
    });
  }

  if (btnSyncQueue) {
    btnSyncQueue.addEventListener('click', () => {
      if (deviceSystemStatus.offlineQueueCount > 0) {
        deviceSystemStatus.offlineQueueCount = 0;
        updateQueueUI();
        renderCompactDeviceStatus();
        renderFullScreeningsTable();
      }
    });
  }
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  initTabNavigation();
  initScreeningForm();
  initModal();
  initPatientViewControls();
  initDeviceControls();

  renderOverviewStats();
  renderActiveScreeningCard();
  renderCompactDeviceStatus();
  renderRecentActivityTable();
  renderFullScreeningsTable();
  renderFullDeviceStatus();
});
