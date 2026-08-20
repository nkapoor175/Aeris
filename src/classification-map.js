// ============================================================
// AERIS — Risk Classification Presentation Map
// Maps the backend's 0/1/2 risk codes (device_risk_level /
// server_risk_level, both from HardwareTest/AnemiaClassifier + its
// anemiaClassifier.js port) to display label/color/action text.
// Purely presentational — the risk codes themselves always come
// from the real API, never computed here.
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

// Used for server_risk_level when it's null (server_risk_status:
// "awaiting_patient_info") — not a risk level, so it's a distinct
// neutral state rather than shoehorned into 0/1/2.
export const AWAITING_INFO = {
  code: null,
  label: 'AWAITING PATIENT INFO',
  color: '#8A8A85',
  bgColor: 'rgba(138, 138, 133, 0.15)',
  action: 'Submit patient age/gender to compute the full server-side estimate',
  oledText: 'AWAITING INFO',
};

export function classificationFor(code) {
  if (code === null || code === undefined) return AWAITING_INFO;
  return CLASSIFICATION_MAP[code] || CLASSIFICATION_MAP[0];
}
