// ============================================================
// AERIS — Dashboard API Client
// Thin fetch wrapper around the real backend (server.js). No mock
// data lives here or is imported from here — every function talks
// to the actual Express/SQLite API documented in the README.
// ============================================================

// The Vite dev server (5173) and the Express API (server.js, default
// 3001) are two different processes/ports in dev. server.js enables
// CORS (*) specifically so this works without a proxy. In production,
// server.js serves the built dashboard itself via express.static, so
// this constant should match whatever PORT server.js is actually
// listening on (see .env / .env.example).
const API_BASE_URL = 'http://localhost:3001';

async function parseJsonOrThrow(res) {
  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new Error(`Server returned a non-JSON response (status ${res.status})`);
  }
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

// GET /api/readings?patient_id=<optional>
export async function fetchReadings(patientId) {
  const url = patientId
    ? `${API_BASE_URL}/api/readings?patient_id=${encodeURIComponent(patientId)}`
    : `${API_BASE_URL}/api/readings`;
  const res = await fetch(url);
  return parseJsonOrThrow(res);
}

// POST /api/patient-context { patient_id, age, gender }
export async function submitPatientContext(patientId, age, gender) {
  const res = await fetch(`${API_BASE_URL}/api/patient-context`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patient_id: patientId, age, gender }),
  });
  return parseJsonOrThrow(res);
}

// GET /api/patient-context/:patient_id — returns null on 404 (no context yet)
// rather than throwing, since "no context yet" is an expected, common case.
export async function fetchPatientContext(patientId) {
  const res = await fetch(`${API_BASE_URL}/api/patient-context/${encodeURIComponent(patientId)}`);
  if (res.status === 404) return null;
  return parseJsonOrThrow(res);
}
