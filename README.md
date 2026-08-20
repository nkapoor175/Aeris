# Aeris Secure Backend Data-Receiving Pipeline (HTAD-06)

This repository contains the backend ingestion pipeline and matching ESP32 firmware reference code for the **Aeris (HTAD-06)** fingertip-based anemia/malnutrition screening device.

The ESP32 device captures clinical metrics (SpO2, HRV, Perfusion Index, raw Red/IR), evaluates a fast on-device risk level, encrypts the dataset using **AES-256-CBC**, and POSTs it to this server. The server authenticates the device, decrypts the payload, runs schema validation, archives the reading in SQLite, and — once a patient's real age/gender have been entered via the dashboard — re-runs the full ML classifier server-side for a more accurate estimate. See [Two-Tier Risk Model](#-two-tier-risk-model) below.

---

## Technical Features

- **Device Authentication**: Rejects requests from devices not present in the environment allowlist (`ALLOWED_DEVICES`).
- **Cryptographic Security**: On-device AES-256-CBC encryption using ESP32 hardware entropy (`esp_random()`) and built-in `mbedtls` library. On-server Node.js `crypto` decryption.
- **In-Memory Rate Limiting**: Mitigates DDoS/API abuse by capping requests at 10 requests/minute per individual `device_id`.
- **Two-Tier Risk Classification**: A fast on-device estimate (rule-based or ML with placeholder demographics) is always stored, and a full server-side ML estimate using the patient's real age/gender is computed and stored alongside it once that context exists. See below.
- **Database Storage**: Lightweight, zero-config SQLite backend storing all validated readings plus per-patient demographic context.
- **CORS Enabled**: Cross-Origin Resource Sharing (CORS) is enabled (`*`) for local development, allowing the dashboard frontend to call the API from other ports (e.g., React/Vue/Svelte on 5173 or 3000) without origin-block issues.
- **Simple Polling Compatibility**: The `GET /api/readings` endpoint retrieves readings sorted chronologically by `received_at` DESC, making it ideal for simple client-side polling every few seconds to create a "live" feel.
- **Privacy Compliance**: All console and file logs (`app.log`) omit patient identities and clinical parameter values in plaintext. Only request metadata (timestamps, IP, endpoints, status codes, device ID) are logged.

---

## 🩺 Two-Tier Risk Model

Aeris classifies anemia/malnutrition risk in two stages:

1. **On-device (fast, first-pass) estimate** — `device_risk_level`. Computed on the ESP32 itself, either by the rule-based Perfusion Index thresholding or the on-device ML model (`HardwareTest/AnemiaClassifier.h/.cpp`). The on-device ML model needs age/gender as inputs, but the hardware has no input mechanism for them yet, so it currently runs with **placeholder demographics (age=30, female)** — see `HardwareTest.ino`. This estimate is always present and is what drives the device's own LEDs/buzzer in real time.
2. **Server-side (full) estimate** — `server_risk_level`. Computed by this backend using [`anemiaClassifier.js`](anemiaClassifier.js), a faithful Node.js port of the same decision tree (`AnemiaDecisionTree.h`), but fed the reading's **actual raw Red/IR values combined with the patient's real age/gender** (submitted once via `POST /api/patient-context`, see below) instead of the on-device placeholders.

Until a patient's age/gender have been submitted, `server_risk_level` is `null` and `server_risk_status` reads `"awaiting_patient_info"` — the API deliberately does **not** fall back to placeholder-based demographics for this field, since that would silently present a low-confidence estimate as a real one. Once context exists, `server_risk_status` reads `"computed"`.

**Important**: `server_risk_level` is computed once, at the moment a reading is ingested, using whatever patient-context exists *at that time*. If context is submitted *after* a reading has already been stored, that older reading's `server_risk_level` stays `null` — it is not retroactively recomputed. Only readings that arrive after context exists get a computed value.

---

## 📂 Project Structure

```
├── .env                  # Configuration variables (Port, Key, Device Allowlist)
├── .env.example          # Environment variables template
├── server.js             # Express application, SQLite schema, and static-serves dist/ if built
├── anemiaClassifier.js   # Node.js port of the on-device ML decision tree (server-side risk)
├── seed.js               # Database seeding script for frontend prototyping
├── test_pipeline.js      # Self-contained integration & security test suite
├── app.log               # Generated request log (metadata only)
├── aeris.db              # SQLite Database file
├── index.html, dashboard.html   # Vite entry points — landing/story page & the screening console
├── vite.config.js
├── src/
│   ├── main.js, style.css, master-canvas.js           # index.html's scroll-driven story page
│   ├── dashboard-main.js, dashboard-style.css          # dashboard.html's logic — real API data only
│   ├── api-client.js          # fetch wrapper around the backend (readings, patient-context)
│   └── classification-map.js  # risk-code -> label/color/action presentation map
├── public/                # Static assets (favicon, images) served as-is by Vite
├── HardwareTest/
│   ├── AnemiaClassifier.h/.cpp   # Original C++ ML classifier (source of truth for anemiaClassifier.js)
│   └── AnemiaDecisionTree.h      # Generated decision tree used by AnemiaClassifier.cpp
└── esp32_client/
    └── esp32_client.ino  # ESP32 Arduino/C++ firmware reference code
```

---

## 🚀 Setup & Execution

### 1. Installation

Install Node.js (v18+ recommended, v24.13.0 verified) and run:

```bash
# Install Express, SQLite3 driver, and dotenv
npm install
```

### 2. Environment Configuration

Create a `.env` file in the root directory (based on `.env.example`):

```env
PORT=3001

# AES_KEY must be exactly 32 bytes (256-bit).
# Generate a fresh key with:
#   node -e "require('crypto').randomBytes(32).toString('hex')" | clip
# Then paste the 64-char hex output here.
AES_KEY=<paste-your-64-char-hex-key-here>

# Comma-separated list of allowed device IDs
ALLOWED_DEVICES=aeris-001,aeris-002,aeris-003
```

### 3. Database Seeding

To feed your dashboard frontend with realistic mock data across multiple patients, run the seed script:

```bash
node seed.js
```

This clears the database and inserts **28 records** covering a 24-hour window, presenting four clinical profiles (ranging from healthy to severe anemia risk/poor perfusion) so the frontend team can showcase graphs, charts, and telemetry right away.

### 4. Running the Server

Start the backend:

```bash
node server.js
```

The server will bind to **`http://localhost:3001`**.

### 5. Running the Dashboard

The dashboard (`index.html` landing/story page + `dashboard.html` screening console) is a separate Vite app in the same repo. It talks to the backend over HTTP (see `src/api-client.js`), so **the server from step 4 needs to be running** for the dashboard to show anything real.

**Local development** (hot-reload, served by Vite on its own port):

```bash
npm run dev
```

Opens on `http://localhost:5173`. The dashboard's API calls are hardcoded to `http://localhost:3001` in `src/api-client.js` — if you change `PORT` in `.env`, update that constant too. CORS is already enabled server-side (`*`) so cross-port calls from 5173 → 3001 work without extra config.

**Production-style build** (dashboard and API served from one origin/port — no CORS needed):

```bash
npm run build   # outputs to dist/
node server.js  # server.js serves dist/ automatically via express.static if it exists
```

Then visit `http://localhost:3001/dashboard.html` directly — same server, same port, as the API.

**Views in the console** (`dashboard.html`): Overview (live stats + latest reading + patient-context form), Screenings (full audit log), Patient (per-patient history + trend chart), Device (which physical devices have reported, offline-queue UI demo). All four render from real `GET /api/readings` data, polling every 5s — none of it is mock/fabricated data.

---

## 🧪 Testing the Pipeline

### Option A: Run the Automated Test Suite (Recommended)

To run the complete automated test suite (which validates ingestion on port 3001, database retrieval, unauthorized devices, malformed schema fields, encryption mismatches, rate-limiting, and privacy logs):

```bash
node test_pipeline.js
```

### Option B: Manual Testing via Curl (Pre-encrypted Payload)

The payload below is encrypted with a **documentation-only** key (`aeris_EXAMPLE_ONLY_not_real_key!`)
that exists solely for verifying the server mechanics. To use it, set `AES_KEY` in your `.env` to
that same documentation key, start the server, then run the curl command:

> ⚠️ The documentation key is intentionally published here for testing. Use your own randomly
> generated key for any real deployment.

```bash
# First: set AES_KEY=aeris_EXAMPLE_ONLY_not_real_key! in your .env, then start the server.
curl -X POST http://localhost:3001/api/reading \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "aeris-001",
    "encrypted_payload": "2LTDp3/4XPndDCAPbFulDtZiTWutIuoHs0tg81wQYwdTo6ulXzm30F8NlrwGdx92fLM+PP1KKKvukIh4ZNVTMP60hwRs+wjE8jvn5/5mAi0Onyv/VVX18mrJryVrFTuAgU1ANUr4n0bFCf466lvIasyPM2baOmCbuQFEsdcxr1c75m1cbtWaxlCb5CUXmZBTBXQjYyJIxfqhTN5hQaAyiQ==",
    "iv": "3RL1kNnZSbD2EUfBKVkyfA=="
  }'
```

This decrypts to `{ patient_id: "PT-0042", spo2: 96, hrv: 42, perfusion_index: 1.8, risk_level: 1, red_raw: 90000, ir_raw: 70000, timestamp: "2026-08-20T14:23:00Z" }`.

#### Expected Server Response (`201 Created`), no patient-context yet:
```json
{
  "message": "Reading successfully processed and stored",
  "id": 1,
  "device_risk_level": 1,
  "server_risk_level": null,
  "server_risk_status": "awaiting_patient_info"
}
```

#### Fetch Stored Readings (Ideal for Polling):
Retrieve all readings (or filter by patient ID). Each reading includes both risk tiers and the patient's stored demographics (if any):

```bash
curl "http://localhost:3001/api/readings?patient_id=PT-0042"
```

---

## 📡 API Reference

### `POST /api/reading`
Called by the ESP32 device. Requires `device_id` to be in `ALLOWED_DEVICES` and enforces the 10 req/min rate limit. Body: `{ device_id, encrypted_payload, iv }`, where `encrypted_payload` decrypts to:

| Field              | Type   | Notes                                                      |
|--------------------|--------|--------------------------------------------------------------|
| `patient_id`       | string | non-empty                                                   |
| `spo2`             | number | 0–100                                                        |
| `hrv`              | number | ≥ 0                                                           |
| `perfusion_index`  | number | ≥ 0                                                           |
| `risk_level`       | number | 0, 1, or 2 — the on-device estimate, stored as `device_risk_level` |
| `red_raw`          | number | ≥ 0 — raw Red optical value from MAX30102                   |
| `ir_raw`           | number | ≥ 0 — raw IR optical value from MAX30102                    |
| `timestamp`        | string | ISO 8601                                                     |

Returns `201` with `{ message, id, device_risk_level, server_risk_level, server_risk_status }`. `server_risk_level`/`server_risk_status` reflect whether patient-context existed for this `patient_id` *at the moment this reading arrived* (see [Two-Tier Risk Model](#-two-tier-risk-model)).

### `GET /api/readings?patient_id=<optional>`
Returns stored readings (newest first), each including `device_risk_level`, `server_risk_level`, `server_risk_status`, and `patient_age`/`patient_gender` (from `patient_context`, `null` if never submitted).

### `POST /api/patient-context`
Not device-authenticated — intended for the (not-yet-built) dashboard. Body: `{ patient_id, age, gender }` where `age` is an integer 1–120 and `gender` is `0` (female) or `1` (male). Upserts by `patient_id` — call it once, or again later to update. Returns `200` with the saved record.

```bash
curl -X POST http://localhost:3001/api/patient-context \
  -H "Content-Type: application/json" \
  -d '{"patient_id": "PT-0042", "age": 34, "gender": 0}'
```

### `GET /api/patient-context/:patient_id`
Fetches stored demographics for a patient — useful for a dashboard to pre-fill a form. Returns `200` with `{ patient_id, age, gender, updated_at }`, or `404` if no context has been submitted for that patient yet.

```bash
curl http://localhost:3001/api/patient-context/PT-0042
```

### Full walkthrough: patient-context → reading → `server_risk_level`

Submitting context *before* a reading arrives is what makes `server_risk_level` get computed for that reading (see the retroactivity note in [Two-Tier Risk Model](#-two-tier-risk-model)):

```bash
# 1. Submit patient context FIRST
curl -X POST http://localhost:3001/api/patient-context \
  -H "Content-Type: application/json" \
  -d '{"patient_id": "PT-0042", "age": 34, "gender": 0}'

# 2. THEN submit the reading (same pre-encrypted payload as above)
curl -X POST http://localhost:3001/api/reading \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "aeris-001",
    "encrypted_payload": "2LTDp3/4XPndDCAPbFulDtZiTWutIuoHs0tg81wQYwdTo6ulXzm30F8NlrwGdx92fLM+PP1KKKvukIh4ZNVTMP60hwRs+wjE8jvn5/5mAi0Onyv/VVX18mrJryVrFTuAgU1ANUr4n0bFCf466lvIasyPM2baOmCbuQFEsdcxr1c75m1cbtWaxlCb5CUXmZBTBXQjYyJIxfqhTN5hQaAyiQ==",
    "iv": "3RL1kNnZSbD2EUfBKVkyfA=="
  }'
# -> { "message": "...", "id": 1, "device_risk_level": 1, "server_risk_level": 1, "server_risk_status": "computed" }

# 3. Fetch it back — server_risk_level and patient_age/patient_gender are now populated
curl "http://localhost:3001/api/readings?patient_id=PT-0042"
```

---

## 🔐 Cryptography Guide (For Teammates)

Symmetric encryption keeps patients' medical telemetry secure during transport. Here is a step-by-step breakdown of how the device encrypts and the server decrypts:

```
[On-Device ESP32]                                 [Network Transmit]                            [On-Server Node.js]
1. Patient JSON    ---> (Pad to 16B)                                                             5. Authenticate Device ID
2. Generate Random IV (16 bytes)                                                                 6. Decode Base64 IV & Ciphertext
3. AES-256-CBC Encrypt (Key + IV)                 JSON POST:                                     7. Decrypt (Key + IV) -> Plaintext
4. Base64 Encode IV & Ciphertext   -------------> { device_id, encrypted_payload, iv } ---------> 8. Parse JSON & Validate Schema
                                                                                                 9. Save to Database
```

### 1. Initialization Vector (IV)
- **What is it?** A 16-byte random salt used as the starting point of the CBC chain.
- **Why?** It ensures that if the same patient reading is sent twice, the resulting ciphertext is completely different, preventing eavesdroppers from identifying patterns.
- **Device Implementation**: Generated using ESP32's hardware random number generator (`esp_random()`).

### 2. Block Padding (PKCS#7)
- **What is it?** AES operates on fixed blocks of 16 bytes. If our JSON string is 125 bytes, it is not a multiple of 16.
- **Why?** CBC requires padding to fill the final block.
- **Device Implementation**: The trailing bytes are padded with a value equal to the number of padding bytes required. (e.g., if 3 bytes are missing, we append `0x03, 0x03, 0x03`).

### 3. Cipher Block Chaining (CBC)
- **What is it?** An encryption mode where each 16-byte block of plaintext is XORed with the previous ciphertext block before being encrypted.
- **Why?** It makes each block dependent on all previous blocks, adding diffusion.
- **Key Size**: We use **AES-256** which requires a 32-byte (256-bit) shared secret key.

### 4. Base64 Encoding
- **What is it?** Translates raw binary bytes (containing unprintable characters) into safe, printable ASCII characters.
- **Why?** Raw binary ciphertext cannot be easily sent in a standard JSON HTTP POST payload. Base64-encoding allows safe transmission.
