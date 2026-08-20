require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { predictAnemiaRisk } = require('./anemiaClassifier');

const app = express();
app.use(express.json());

// Enable CORS for local development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const PORT = process.env.PORT || 3000;
const LOG_FILE = path.join(__dirname, 'app.log');
const DB_FILE = path.join(__dirname, 'aeris.db');

// --- Pre-shared Encryption Key & Allowlist Validation ---
let AES_KEY_BUFFER;
try {
  const rawKey = process.env.AES_KEY;
  if (!rawKey) {
    console.error('ERROR: AES_KEY is not defined in the environment.');
    process.exit(1);
  }
  // Allow 64-character hex or 32-character ASCII keys
  if (rawKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawKey)) {
    AES_KEY_BUFFER = Buffer.from(rawKey, 'hex');
  } else {
    AES_KEY_BUFFER = Buffer.from(rawKey, 'utf8');
  }
  if (AES_KEY_BUFFER.length !== 32) {
    throw new Error(`Resolved key length is ${AES_KEY_BUFFER.length} bytes, but AES-256 requires exactly 32 bytes.`);
  }
} catch (error) {
  console.error(`ERROR: Failed to load encryption key: ${error.message}`);
  process.exit(1);
}

// Parse allowlist of devices
const allowedDevices = new Set(
  process.env.ALLOWED_DEVICES
    ? process.env.ALLOWED_DEVICES.split(',').map(id => id.trim().toLowerCase())
    : []
);

// --- SQLite Database Setup ---
const db = new sqlite3.Database(DB_FILE, (err) => {
  if (err) {
    console.error('ERROR: Failed to open SQLite database:', err.message);
    process.exit(1);
  }
  console.log('Connected to the SQLite database.');
});

db.serialize(() => {
  // NOTE: this is a schema change from the previous "risk_level" column
  // (now "device_risk_level", plus new red_raw/ir_raw/server_risk_level
  // columns). aeris.db is gitignored and never shipped with real data, so
  // this ships as a fresh CREATE TABLE rather than a migration. If you
  // have a local aeris.db from before this change, delete it (or re-run
  // seed.js) — CREATE TABLE IF NOT EXISTS will NOT retrofit the new
  // columns onto an existing old-schema table.
  db.run(`
    CREATE TABLE IF NOT EXISTS readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      spo2 REAL NOT NULL,
      hrv REAL NOT NULL,
      perfusion_index REAL NOT NULL,
      red_raw REAL NOT NULL,
      ir_raw REAL NOT NULL,
      device_risk_level INTEGER NOT NULL,
      server_risk_level INTEGER,
      timestamp TEXT NOT NULL,
      received_at TEXT NOT NULL
    )
  `, (err) => {
    if (err) {
      console.error('ERROR: Failed to create readings table:', err.message);
      process.exit(1);
    }
  });

  // Patient demographic context (age/gender), entered once via the
  // dashboard and reused for every future reading from that patient_id.
  // gender follows the same 0=Female/1=Male convention as
  // HardwareTest/AnemiaClassifier.h's GENDER_FEMALE/GENDER_MALE constants.
  db.run(`
    CREATE TABLE IF NOT EXISTS patient_context (
      patient_id TEXT PRIMARY KEY,
      age INTEGER NOT NULL,
      gender INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    )
  `, (err) => {
    if (err) {
      console.error('ERROR: Failed to create patient_context table:', err.message);
      process.exit(1);
    }
  });
});

// --- Middleware: Request Logger ---
// Do NOT log decrypted clinical patient data. Only log metadata.
function requestLogger(req, res, next) {
  const originalSend = res.send;
  res.send = function (body) {
    const statusCode = res.statusCode;
    const logTime = new Date().toISOString();
    const deviceId = req.body && req.body.device_id ? String(req.body.device_id) : 'UNKNOWN_DEVICE';
    const clientIp = req.ip || req.connection.remoteAddress;
    const method = req.method;
    const url = req.path;
    
    let outcome = statusCode >= 200 && statusCode < 300 ? 'SUCCESS' : 'FAILURE';
    let detail = '';

    // Log validation/decryption error details if status code is client error
    if (statusCode === 400 || statusCode === 401 || statusCode === 429) {
      try {
        const parsedBody = JSON.parse(body);
        detail = ` - Error: ${parsedBody.error || parsedBody.message || body}`;
      } catch (e) {
        detail = ` - Error: ${body}`;
      }
    }

    const logMessage = `${logTime} | IP: ${clientIp} | Method: ${method} | URL: ${url} | Device: ${deviceId} | Status: ${statusCode} [${outcome}]${detail}\n`;
    
    // Append to file
    fs.appendFile(LOG_FILE, logMessage, 'utf8', (err) => {
      if (err) console.error('Failed to write to log file:', err);
    });

    return originalSend.apply(res, arguments);
  };
  next();
}

app.use(requestLogger);

// --- Middleware: Custom In-Memory Rate Limiting per Device ID ---
// Limits each device_id to 10 requests per minute
const rateLimits = new Map(); // device_id -> Array of timestamps

function deviceRateLimiter(req, res, next) {
  const { device_id } = req.body;
  
  // Skip rate limiting if no device_id is provided; the allowlist check will catch it shortly
  if (!device_id) {
    return next();
  }

  const normalizedDeviceId = String(device_id).trim().toLowerCase();
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const limit = 10;

  if (!rateLimits.has(normalizedDeviceId)) {
    rateLimits.set(normalizedDeviceId, []);
  }

  const timestamps = rateLimits.get(normalizedDeviceId);
  // Filter out timestamps outside the active window
  const activeTimestamps = timestamps.filter(t => now - t < windowMs);
  
  if (activeTimestamps.length >= limit) {
    return res.status(429).json({
      error: 'Rate limit exceeded. Maximum 10 requests per minute per device.'
    });
  }

  activeTimestamps.push(now);
  rateLimits.set(normalizedDeviceId, activeTimestamps);
  next();
}

// --- Middleware: Device Authentication (Allowlist validation) ---
function deviceAuthenticator(req, res, next) {
  const { device_id } = req.body;
  if (!device_id) {
    return res.status(400).json({ error: 'Missing device_id' });
  }

  const normalizedDeviceId = String(device_id).trim().toLowerCase();
  if (!allowedDevices.has(normalizedDeviceId)) {
    return res.status(401).json({ error: 'Device not authorized' });
  }
  next();
}

// --- Decryption Helper ---
function decryptPayload(encryptedBase64, ivBase64) {
  const iv = Buffer.from(ivBase64, 'base64');
  if (iv.length !== 16) {
    throw new Error('IV must be exactly 16 bytes (128 bits)');
  }
  
  const decipher = crypto.createDecipheriv('aes-256-cbc', AES_KEY_BUFFER, iv);
  let decrypted = decipher.update(encryptedBase64, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

// --- Endpoint: POST /api/reading ---
// SECURITY NOTE: deviceAuthenticator MUST run before deviceRateLimiter.
// If the order were reversed, an attacker could exhaust the rate-limit bucket for a
// real device ID (e.g. aeris-001) using 10 unauthenticated requests, locking out the
// legitimate ESP32 hardware for a minute — a trivial unauthenticated DoS.
app.post('/api/reading', deviceAuthenticator, deviceRateLimiter, (req, res) => {
  const { device_id, encrypted_payload, iv } = req.body;

  // 1. Check outer JSON fields
  if (!encrypted_payload || !iv) {
    return res.status(400).json({ error: 'Missing encrypted_payload or iv' });
  }

  try {
    // 2. Decrypt payload
    const decrypted = decryptPayload(encrypted_payload, iv);

    // 3. Validate decrypted payload fields
    // NOTE: the field is still named "risk_level" on the wire (unchanged
    // firmware payload key), but it's stored/returned as device_risk_level
    // to distinguish it from the new server-computed server_risk_level.
    const { patient_id, spo2, hrv, perfusion_index, risk_level, timestamp, red_raw, ir_raw } = decrypted;

    if (typeof patient_id !== 'string' || patient_id.trim() === '') {
      return res.status(400).json({ error: 'Invalid or missing patient_id in payload' });
    }
    if (typeof spo2 !== 'number' || isNaN(spo2) || spo2 < 0 || spo2 > 100) {
      return res.status(400).json({ error: 'Invalid or missing spo2 in payload' });
    }
    if (typeof hrv !== 'number' || isNaN(hrv) || hrv < 0) {
      return res.status(400).json({ error: 'Invalid or missing hrv in payload' });
    }
    if (typeof perfusion_index !== 'number' || isNaN(perfusion_index) || perfusion_index < 0) {
      return res.status(400).json({ error: 'Invalid or missing perfusion_index in payload' });
    }
    if (typeof risk_level !== 'number' || ![0, 1, 2].includes(risk_level)) {
      return res.status(400).json({ error: 'Invalid or missing risk_level in payload (must be 0, 1, or 2)' });
    }
    if (typeof red_raw !== 'number' || isNaN(red_raw) || red_raw < 0) {
      return res.status(400).json({ error: 'Invalid or missing red_raw in payload' });
    }
    if (typeof ir_raw !== 'number' || isNaN(ir_raw) || ir_raw < 0) {
      return res.status(400).json({ error: 'Invalid or missing ir_raw in payload' });
    }
    if (typeof timestamp !== 'string' || isNaN(Date.parse(timestamp))) {
      return res.status(400).json({ error: 'Invalid or missing timestamp in payload' });
    }

    // 4. Look up patient demographic context (age/gender). If it exists,
    // re-run the full ML classifier server-side using the *real* age/gender
    // instead of the on-device placeholder (age=30/female). If it doesn't
    // exist yet, server_risk_level stays null — we do NOT silently fall
    // back to placeholder demographics for a clinical estimate.
    db.get(
      'SELECT age, gender FROM patient_context WHERE patient_id = ?',
      [patient_id],
      (ctxErr, contextRow) => {
        if (ctxErr) {
          console.error('Patient context lookup error:', ctxErr.message);
          return res.status(500).json({ error: 'Failed to look up patient context' });
        }

        let serverRiskLevel = null;
        if (contextRow) {
          serverRiskLevel = predictAnemiaRisk(red_raw, ir_raw, contextRow.age, contextRow.gender);
        }

        // 5. Save to Database (both device_risk_level and server_risk_level)
        const received_at = new Date().toISOString();
        const query = `
          INSERT INTO readings (patient_id, device_id, spo2, hrv, perfusion_index, red_raw, ir_raw, device_risk_level, server_risk_level, timestamp, received_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
          patient_id,
          device_id,
          spo2,
          hrv,
          perfusion_index,
          red_raw,
          ir_raw,
          risk_level,
          serverRiskLevel,
          timestamp,
          received_at
        ];

        db.run(query, params, function (err) {
          if (err) {
            console.error('Database insertion error:', err.message);
            return res.status(500).json({ error: 'Failed to save record to database' });
          }
          res.status(201).json({
            message: 'Reading successfully processed and stored',
            id: this.lastID,
            device_risk_level: risk_level,
            server_risk_level: serverRiskLevel,
            server_risk_status: serverRiskLevel === null ? 'awaiting_patient_info' : 'computed'
          });
        });
      }
    );

  } catch (error) {
    // Return detailed decryption error
    return res.status(400).json({ error: `Decryption or malformed payload error: ${error.message}` });
  }
});

// --- Endpoint: GET /api/readings ---
// Returns device_risk_level (on-device fast estimate) and server_risk_level
// (full server-side estimate, present once patient-context exists) per
// reading, plus the patient's stored age/gender if available.
app.get('/api/readings', (req, res) => {
  const { patient_id } = req.query;

  let query = `
    SELECT
      r.id, r.patient_id, r.device_id, r.spo2, r.hrv, r.perfusion_index,
      r.red_raw, r.ir_raw, r.device_risk_level, r.server_risk_level,
      r.timestamp, r.received_at,
      pc.age AS patient_age, pc.gender AS patient_gender
    FROM readings r
    LEFT JOIN patient_context pc ON pc.patient_id = r.patient_id
  `;
  const params = [];

  if (patient_id) {
    query += ' WHERE r.patient_id = ?';
    params.push(patient_id);
  }

  query += ' ORDER BY r.received_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Database query error:', err.message);
      return res.status(500).json({ error: 'Failed to retrieve data from database' });
    }
    const enriched = rows.map((row) => ({
      ...row,
      server_risk_status: row.server_risk_level === null ? 'awaiting_patient_info' : 'computed'
    }));
    res.json(enriched);
  });
});

// --- Endpoint: POST /api/patient-context ---
// Stores/updates a patient's age & gender, entered once via the dashboard
// and reused for every future reading from that patient_id (upsert on
// patient_id). NOTE: unlike /api/reading, this endpoint has no device
// authentication — it's meant to be called by the (not-yet-built) dashboard
// directly, not the ESP32. In this hackathon build it's an open endpoint;
// flagging that it would need real auth (e.g. a dashboard login/session)
// before this went anywhere near real patient data.
app.post('/api/patient-context', (req, res) => {
  const { patient_id, age, gender } = req.body;

  if (typeof patient_id !== 'string' || patient_id.trim() === '') {
    return res.status(400).json({ error: 'Invalid or missing patient_id' });
  }
  if (typeof age !== 'number' || !Number.isInteger(age) || age <= 0 || age > 120) {
    return res.status(400).json({ error: 'Invalid or missing age (must be an integer between 1 and 120)' });
  }
  if (gender !== 0 && gender !== 1) {
    return res.status(400).json({ error: 'Invalid or missing gender (must be 0 = female or 1 = male)' });
  }

  const updated_at = new Date().toISOString();
  const query = `
    INSERT INTO patient_context (patient_id, age, gender, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(patient_id) DO UPDATE SET age = excluded.age, gender = excluded.gender, updated_at = excluded.updated_at
  `;

  db.run(query, [patient_id, age, gender, updated_at], function (err) {
    if (err) {
      console.error('Patient context upsert error:', err.message);
      return res.status(500).json({ error: 'Failed to save patient context' });
    }
    res.status(200).json({
      message: 'Patient context saved',
      patient_id,
      age,
      gender,
      updated_at
    });
  });
});

// --- Endpoint: GET /api/patient-context/:patient_id ---
// Fetches stored demographic info for a patient (e.g. to pre-fill a
// dashboard form if context was already entered).
app.get('/api/patient-context/:patient_id', (req, res) => {
  const { patient_id } = req.params;

  db.get(
    'SELECT patient_id, age, gender, updated_at FROM patient_context WHERE patient_id = ?',
    [patient_id],
    (err, row) => {
      if (err) {
        console.error('Patient context query error:', err.message);
        return res.status(500).json({ error: 'Failed to retrieve patient context' });
      }
      if (!row) {
        return res.status(404).json({ error: `No patient context found for patient_id: ${patient_id}` });
      }
      res.json(row);
    }
  );
});

// --- Server Startup & Cleanup ---
const server = app.listen(PORT, () => {
  console.log(`Aeris backend listening on port ${PORT}`);
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function shutdown() {
  console.log('Shutting down server...');
  server.close(() => {
    db.close((err) => {
      if (err) {
        console.error('Error closing SQLite DB:', err.message);
      } else {
        console.log('Closed SQLite DB connection.');
      }
      process.exit(0);
    });
  });
}
