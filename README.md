# Aeris Secure Backend Data-Receiving Pipeline (HTAD-06)

This repository contains the backend ingestion pipeline and matching ESP32 firmware reference code for the **Aeris (HTAD-06)** fingertip-based anemia/malnutrition screening device.

The ESP32 device captures clinical metrics (SpO2, HRV, Perfusion Index), evaluates a risk level, encrypts the dataset on-device using **AES-256-CBC**, and POSTs it to this server. The server authenticates the device, decrypts the payload, runs schema validation, and archives the reading in SQLite.

---

## Technical Features

- **Device Authentication**: Rejects requests from devices not present in the environment allowlist (`ALLOWED_DEVICES`).
- **Cryptographic Security**: On-device AES-256-CBC encryption using ESP32 hardware entropy (`esp_random()`) and built-in `mbedtls` library. On-server Node.js `crypto` decryption.
- **In-Memory Rate Limiting**: Mitigates DDoS/API abuse by capping requests at 10 requests/minute per individual `device_id`.
- **Database Storage**: Lightweight, zero-config SQLite backend storing all validated readings.
- **CORS Enabled**: Cross-Origin Resource Sharing (CORS) is enabled (`*`) for local development, allowing the dashboard frontend to call the API from other ports (e.g., React/Vue/Svelte on 5173 or 3000) without origin-block issues.
- **Simple Polling Compatibility**: The `GET /api/readings` endpoint retrieves readings sorted chronologically by `received_at` DESC, making it ideal for simple client-side polling every few seconds to create a "live" feel.
- **Privacy Compliance**: All console and file logs (`app.log`) omit patient identities and clinical parameter values in plaintext. Only request metadata (timestamps, IP, endpoints, status codes, device ID) are logged.

---

## 📂 Project Structure

```
├── .env                  # Configuration variables (Port, Key, Device Allowlist)
├── .env.example          # Environment variables template
├── server.js             # Express application & SQLite schema config
├── seed.js               # Database seeding script for frontend prototyping
├── test_pipeline.js      # Self-contained integration & security test suite
├── app.log               # Generated request log (metadata only)
├── aeris.db              # SQLite Database file
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
    "encrypted_payload": "2LTDp3/4XPndDCAPbFulDtZiTWutIuoHs0tg81wQYwdTo6ulXzm30F8NlrwGdx92fLM+PP1KKKvukIh4ZNVTMP60hwRs+wjE8jvn5/5mAi3thxEqNhOSJBPZbCrxwjjyNI6RhOHex3WSgWFO2etbi/00gdwytw6aCzkXveMJlvQ=",
    "iv": "3RL1kNnZSbD2EUfBKVkyfA=="
  }'
```

#### Expected Server Response (`201 Created`):
```json
{
  "message": "Reading successfully processed and stored",
  "id": 1
}
```

#### Fetch Stored Readings (Ideal for Polling):
Retrieve all readings (or filter by patient ID):

```bash
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
