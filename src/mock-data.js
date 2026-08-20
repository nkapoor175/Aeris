// ============================================================
// AERIS — Centralized Data Layer & Backend Integration Interface
// Structured for direct readiness with ESP32 & ML risk model
// ============================================================

export const CLASSIFICATION_MAP = {
  0: {
    code: 0,
    label: 'HEALTHY',
    color: '#4A9B6E',
    bgColor: 'rgba(74, 155, 110, 0.15)',
    action: 'No immediate referral indicated',
    oledText: 'HEALTHY',
  },
  1: {
    code: 1,
    label: 'MILD / MODERATE',
    color: '#D6B84C',
    bgColor: 'rgba(214, 184, 76, 0.15)',
    action: '→ Refer for confirmatory blood test',
    oledText: 'MILD/MOD ANEMIA',
  },
  2: {
    code: 2,
    label: 'SEVERE',
    color: '#B93B3B',
    bgColor: 'rgba(185, 59, 59, 0.15)',
    action: '→ Priority referral / confirmatory testing',
    oledText: 'SEVERE ANEMIA',
  },
};

// Demographic-aware ML risk predictor mockup matching backend signature:
// predictAnemiaRisk(redValue, irValue, age, genderMale)
export function predictAnemiaRisk(redValue, irValue, age, genderMale) {
  const ratio = (redValue && irValue) ? redValue / irValue : 1.2;
  
  if (ratio > 1.45 || (age > 60 && ratio > 1.3)) {
    return 2; // SEVERE
  } else if (ratio > 1.15 || (genderMale === 0 && age < 35 && ratio > 1.1)) {
    return 1; // MILD / MODERATE
  }
  return 0; // HEALTHY
}

// Patient Profiles for Patient-Level View
export const patientsDatabase = [
  {
    id: 'PT-0042',
    name: 'Patient PT-0042',
    age: 32,
    genderMale: 0,
    genderText: 'Female',
    screeningsCount: 7,
    latestResultCode: 1,
    signalQuality: 'GOOD',
    latestTimestamp: '2026-08-20T14:23:00',
    history: [
      { timestamp: '2026-08-01 10:15', code: 1, spo2: 95, hrv: 40, pi: 1.6, signal: 'GOOD' },
      { timestamp: '2026-08-04 11:30', code: 1, spo2: 94, hrv: 38, pi: 1.4, signal: 'GOOD' },
      { timestamp: '2026-08-07 09:45', code: 1, spo2: 96, hrv: 42, pi: 1.8, signal: 'GOOD' },
      { timestamp: '2026-08-10 14:10', code: 2, spo2: 93, hrv: 35, pi: 1.2, signal: 'FAIR' },
      { timestamp: '2026-08-13 16:05', code: 1, spo2: 95, hrv: 41, pi: 1.7, signal: 'GOOD' },
      { timestamp: '2026-08-16 10:20', code: 1, spo2: 96, hrv: 44, pi: 1.9, signal: 'GOOD' },
      { timestamp: '2026-08-20 14:23', code: 1, spo2: 96, hrv: 42, pi: 1.8, signal: 'GOOD' },
    ]
  },
  {
    id: 'PT-0089',
    name: 'Patient PT-0089',
    age: 48,
    genderMale: 1,
    genderText: 'Male',
    screeningsCount: 4,
    latestResultCode: 0,
    signalQuality: 'GOOD',
    latestTimestamp: '2026-08-20T13:54:00',
    history: [
      { timestamp: '2026-07-15 09:00', code: 0, spo2: 98, hrv: 55, pi: 3.1, signal: 'GOOD' },
      { timestamp: '2026-07-28 11:20', code: 0, spo2: 97, hrv: 52, pi: 2.9, signal: 'GOOD' },
      { timestamp: '2026-08-10 15:45', code: 0, spo2: 98, hrv: 58, pi: 3.2, signal: 'GOOD' },
      { timestamp: '2026-08-20 13:54', code: 0, spo2: 98, hrv: 56, pi: 3.0, signal: 'GOOD' },
    ]
  },
  {
    id: 'PT-0104',
    name: 'Patient PT-0104',
    age: 64,
    genderMale: 0,
    genderText: 'Female',
    screeningsCount: 5,
    latestResultCode: 2,
    signalQuality: 'FAIR',
    latestTimestamp: '2026-08-20T12:40:00',
    history: [
      { timestamp: '2026-07-02 14:00', code: 1, spo2: 94, hrv: 34, pi: 1.4, signal: 'GOOD' },
      { timestamp: '2026-07-18 10:30', code: 1, spo2: 93, hrv: 32, pi: 1.3, signal: 'FAIR' },
      { timestamp: '2026-08-01 11:15', code: 2, spo2: 91, hrv: 29, pi: 0.9, signal: 'GOOD' },
      { timestamp: '2026-08-12 16:20', code: 2, spo2: 90, hrv: 26, pi: 0.8, signal: 'FAIR' },
      { timestamp: '2026-08-20 12:40', code: 2, spo2: 91, hrv: 28, pi: 0.9, signal: 'FAIR' },
    ]
  },
  {
    id: 'PT-0036',
    name: 'Patient PT-0036',
    age: 26,
    genderMale: 1,
    genderText: 'Male',
    screeningsCount: 3,
    latestResultCode: 0,
    signalQuality: 'GOOD',
    latestTimestamp: '2026-08-20T11:15:00',
    history: [
      { timestamp: '2026-06-10 09:30', code: 0, spo2: 99, hrv: 62, pi: 3.6, signal: 'GOOD' },
      { timestamp: '2026-07-12 14:15', code: 0, spo2: 98, hrv: 60, pi: 3.4, signal: 'GOOD' },
      { timestamp: '2026-08-20 11:15', code: 0, spo2: 99, hrv: 61, pi: 3.5, signal: 'GOOD' },
    ]
  }
];

// Active Live Screening State
export let activeScreening = {
  screeningId: 'SCR-2026-0842',
  patientId: 'PT-0042',
  age: 32,
  genderMale: 0,
  genderText: 'Female',
  spo2: 96,
  hrv: 42,
  pi: 1.8,
  signalQuality: 'GOOD',
  classificationCode: 1, // 0: HEALTHY, 1: MILD/MODERATE, 2: SEVERE
  timestamp: '2026-08-20T14:23:00',
  explanation: 'Classification generated from optical sensor input and patient demographic inputs.',
  status: 'Complete',
};

// Summary Statistics for Overview
export const overviewStats = {
  totalScreenedToday: 127,
  healthyCount: 84,
  mildModerateCount: 31,
  severeCount: 12,
  activeSession: true,
};

// Realistic, Varied Screening Activity Logs
export const screeningsHistory = [
  { id: 'SCR-2026-0842', patientId: 'PT-0042', age: 32, gender: 'Female', time: '14:23', code: 1, signalQuality: 'GOOD', status: 'Complete', spo2: 96, hrv: 42, pi: 1.8 },
  { id: 'SCR-2026-0841', patientId: 'PT-0089', age: 48, gender: 'Male', time: '13:54', code: 0, signalQuality: 'GOOD', status: 'Complete', spo2: 98, hrv: 56, pi: 3.0 },
  { id: 'SCR-2026-0840', patientId: 'PT-0104', age: 64, gender: 'Female', time: '12:40', code: 2, signalQuality: 'FAIR', status: 'Complete', spo2: 91, hrv: 28, pi: 0.9 },
  { id: 'SCR-2026-0839', patientId: 'PT-0036', age: 26, gender: 'Male', time: '11:15', code: 0, signalQuality: 'GOOD', status: 'Complete', spo2: 99, hrv: 61, pi: 3.5 },
  { id: 'SCR-2026-0838', patientId: 'PT-0012', age: 29, gender: 'Female', time: '10:48', code: 1, signalQuality: 'GOOD', status: 'Complete', spo2: 95, hrv: 39, pi: 1.6 },
  { id: 'SCR-2026-0837', patientId: 'PT-0055', age: 53, gender: 'Female', time: '10:20', code: 2, signalQuality: 'FAIR', status: 'Complete', spo2: 90, hrv: 24, pi: 0.7 },
  { id: 'SCR-2026-0836', patientId: 'PT-0071', age: 41, gender: 'Male', time: '09:55', code: 0, signalQuality: 'GOOD', status: 'Complete', spo2: 98, hrv: 54, pi: 2.8 },
  { id: 'SCR-2026-0835', patientId: 'PT-0023', age: 37, gender: 'Female', time: '09:12', code: 1, signalQuality: 'GOOD', status: 'Complete', spo2: 94, hrv: 37, pi: 1.5 },
];

// Device Diagnostics & Hardware State
export const deviceSystemStatus = {
  isOnline: true,
  max30102Sensor: 'ACTIVE / CALIBRATED',
  esp32Connection: 'CONNECTED (UART/USB)',
  firmwareVersion: '1.2.4',
  batteryLevel: 88,
  batteryStatus: 'Charging (USB-C)',
  dataTransmission: 'Active / TLS Encrypted',
  securityEncryption: 'AES-128 / WPA3',
  offlineQueueCount: 3,
  isOfflineMode: false,
  lastSyncTimestamp: new Date().toISOString(),
};

// Execute a New Screening with Custom Age & Gender
export function executeNewScreening(patientId, age, genderMale) {
  const code = predictAnemiaRisk(1.22, 1.0, age, genderMale);
  const signalQualities = ['GOOD', 'GOOD', 'GOOD', 'FAIR'];
  const signalQuality = signalQualities[Math.floor(Math.random() * signalQualities.length)];

  const newScreening = {
    screeningId: `SCR-${Date.now().toString().slice(-6)}`,
    patientId: patientId || `PT-${Math.floor(1000 + Math.random() * 9000)}`,
    age: Number(age) || 30,
    genderMale: Number(genderMale),
    genderText: Number(genderMale) === 1 ? 'Male' : 'Female',
    spo2: Math.floor(92 + Math.random() * 7),
    hrv: Math.floor(35 + Math.random() * 25),
    pi: parseFloat((1.2 + Math.random() * 2.1).toFixed(1)),
    signalQuality,
    classificationCode: code,
    timestamp: new Date().toISOString(),
    explanation: 'Classification generated from optical sensor absorbance input and demographic features.',
    status: deviceSystemStatus.isOfflineMode ? 'Queued (Offline)' : 'Complete',
  };

  // Update active screening
  activeScreening = newScreening;

  // Add to screenings history
  screeningsHistory.unshift({
    id: newScreening.screeningId,
    patientId: newScreening.patientId,
    age: newScreening.age,
    gender: newScreening.genderText,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    code: newScreening.classificationCode,
    signalQuality: newScreening.signalQuality,
    status: newScreening.status,
    spo2: newScreening.spo2,
    hrv: newScreening.hrv,
    pi: newScreening.pi,
  });

  // Update summary stats
  overviewStats.totalScreenedToday += 1;
  if (code === 0) overviewStats.healthyCount += 1;
  else if (code === 1) overviewStats.mildModerateCount += 1;
  else if (code === 2) overviewStats.severeCount += 1;

  if (deviceSystemStatus.isOfflineMode) {
    deviceSystemStatus.offlineQueueCount += 1;
  }

  return newScreening;
}
