/**
 * Aeris (HTAD-06) Database Seed Script
 *
 * Generates 28 realistic patient screening readings distributed over the last 24 hours.
 * Clears existing readings and populates data across four distinct patient profiles:
 * - PT-0042: Healthy profile (Low Risk / 0)
 * - PT-0043: Mild Hypoxia/Perfusion issues (Medium Risk / 1)
 * - PT-1089: Severe Anemia/Poor Perfusion (High Risk / 2)
 * - PT-2026: Fluctuating condition (swings between Risk 0 and 1)
 *
 * Also seeds patient_context for two of the four patients (PT-0042, PT-1089)
 * so the dashboard has a realistic mix to render: some readings with a
 * computed server_risk_level, some still "awaiting_patient_info".
 *
 * All timestamps are saved in ISO 8601 UTC format.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { predictAnemiaRisk } = require('./anemiaClassifier');

const DB_FILE = path.join(__dirname, 'aeris.db');

// Two of the four demo patients get seeded demographic context, so the
// seeded data demonstrates both the "computed" and "awaiting_patient_info"
// server_risk_status states without needing the (not-yet-built) dashboard.
const SEEDED_PATIENT_CONTEXT = {
  'PT-0042': { age: 28, gender: 0 }, // Female
  'PT-1089': { age: 55, gender: 1 }  // Male
};

const db = new sqlite3.Database(DB_FILE, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
    process.exit(1);
  }
  console.log('Database connected successfully.');
});

db.serialize(() => {
  // 1. Create schema if it doesn't exist (kept in sync with server.js —
  // see the schema-change note there re: risk_level -> device_risk_level)
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
      console.error('Schema creation failed:', err.message);
      process.exit(1);
    }
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS patient_context (
      patient_id TEXT PRIMARY KEY,
      age INTEGER NOT NULL,
      gender INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    )
  `, (err) => {
    if (err) {
      console.error('Schema creation failed (patient_context):', err.message);
      process.exit(1);
    }
  });

  // 2. Clear existing entries
  db.run('DELETE FROM readings', (err) => {
    if (err) {
      console.error('Truncation of readings table failed:', err.message);
      process.exit(1);
    }
    console.log('Cleared existing records from "readings" table.');

    db.run('DELETE FROM patient_context', (ctxErr) => {
      if (ctxErr) {
        console.error('Truncation of patient_context table failed:', ctxErr.message);
        process.exit(1);
      }
      console.log('Cleared existing records from "patient_context" table.');

      // 2b. Seed demographic context for two of the four demo patients
      const ctxStmt = db.prepare(`
        INSERT INTO patient_context (patient_id, age, gender, updated_at)
        VALUES (?, ?, ?, ?)
      `);
      const ctxNow = new Date().toISOString();
      for (const [patientId, ctx] of Object.entries(SEEDED_PATIENT_CONTEXT)) {
        ctxStmt.run(patientId, ctx.age, ctx.gender, ctxNow);
      }
      ctxStmt.finalize((ctxFinalizeErr) => {
        if (ctxFinalizeErr) {
          console.error('Finalizing patient_context seed failed:', ctxFinalizeErr.message);
          process.exit(1);
        }
        console.log(`Seeded patient_context for: ${Object.keys(SEEDED_PATIENT_CONTEXT).join(', ')}.`);
        seedReadings();
      });
    });
  });

  // 3. Prepare and insert mock readings
  function seedReadings() {
    const stmt = db.prepare(`
      INSERT INTO readings (patient_id, device_id, spo2, hrv, perfusion_index, red_raw, ir_raw, device_risk_level, server_risk_level, timestamp, received_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const totalRecords = 28;
    const now = Date.now();
    const intervalMs = 50 * 60 * 1000; // 50 minutes apart

    console.log(`Generating and inserting ${totalRecords} mock records...`);

    for (let i = 0; i < totalRecords; i++) {
      // Calculate UTC timestamp going backward in time
      const timeMs = now - (totalRecords - 1 - i) * intervalMs;
      const isoTimestamp = new Date(timeMs).toISOString();

      // Distribute readings across 4 mock patient personas
      const patientIndex = i % 4;
      let patientId, deviceId, spo2, hrv, perfusionIndex, deviceRiskLevel, redRaw, irRaw;

      if (patientIndex === 0) {
        // Patient PT-0042: Healthy Profile (Low Risk / 0)
        patientId = 'PT-0042';
        deviceId = 'aeris-001';
        spo2 = parseFloat((97.0 + Math.random() * 2.5).toFixed(1));          // 97.0% - 99.5%
        hrv = parseFloat((55.0 + Math.random() * 15.0).toFixed(1));          // 55.0 - 70.0 ms
        perfusionIndex = parseFloat((2.1 + Math.random() * 1.5).toFixed(2));  // 2.1 - 3.6
        redRaw = parseFloat((88000 + Math.random() * 4000).toFixed(1));       // ~88,000 - 92,000
        irRaw = parseFloat((86000 + Math.random() * 4000).toFixed(1));        // ~86,000 - 90,000
        deviceRiskLevel = 0;
      } else if (patientIndex === 1) {
        // Patient PT-0043: Mild Hypoxia / Perfusion Issues (Medium Risk / 1)
        patientId = 'PT-0043';
        deviceId = 'aeris-002';
        spo2 = parseFloat((93.0 + Math.random() * 2.0).toFixed(1));          // 93.0% - 95.0%
        hrv = parseFloat((40.0 + Math.random() * 10.0).toFixed(1));          // 40.0 - 50.0 ms
        perfusionIndex = parseFloat((1.0 + Math.random() * 0.4).toFixed(2));  // 1.0 - 1.4
        redRaw = parseFloat((88000 + Math.random() * 4000).toFixed(1));       // ~88,000 - 92,000
        irRaw = parseFloat((72000 + Math.random() * 4000).toFixed(1));        // ~72,000 - 76,000
        deviceRiskLevel = 1;
      } else if (patientIndex === 2) {
        // Patient PT-1089: Severe Anemia Risk / Poor Perfusion (High Risk / 2)
        patientId = 'PT-1089';
        deviceId = 'aeris-003';
        spo2 = parseFloat((88.0 + Math.random() * 4.0).toFixed(1));          // 88.0% - 92.0%
        hrv = parseFloat((30.0 + Math.random() * 10.0).toFixed(1));          // 30.0 - 40.0 ms
        perfusionIndex = parseFloat((0.4 + Math.random() * 0.3).toFixed(2));  // 0.4 - 0.7
        redRaw = parseFloat((85000 + Math.random() * 5000).toFixed(1));       // ~85,000 - 90,000
        irRaw = parseFloat((60000 + Math.random() * 5000).toFixed(1));        // ~60,000 - 65,000
        deviceRiskLevel = 2;
      } else {
        // Patient PT-2026: Fluctuating Status (Low/Medium Risk Swings)
        patientId = 'PT-2026';
        deviceId = 'aeris-001';
        const isHealthyReading = Math.random() > 0.5;
        if (isHealthyReading) {
          spo2 = parseFloat((96.0 + Math.random() * 2.0).toFixed(1));          // 96.0% - 98.0%
          perfusionIndex = parseFloat((1.6 + Math.random() * 0.8).toFixed(2));  // 1.6 - 2.4
          redRaw = parseFloat((85000 + Math.random() * 5000).toFixed(1));      // ~85,000 - 90,000
          irRaw = parseFloat((82000 + Math.random() * 6000).toFixed(1));       // ~82,000 - 88,000
          deviceRiskLevel = 0;
        } else {
          spo2 = parseFloat((93.5 + Math.random() * 1.5).toFixed(1));          // 93.5% - 95.0%
          perfusionIndex = parseFloat((1.1 + Math.random() * 0.3).toFixed(2));  // 1.1 - 1.4
          redRaw = parseFloat((88000 + Math.random() * 5000).toFixed(1));      // ~88,000 - 93,000
          irRaw = parseFloat((72000 + Math.random() * 6000).toFixed(1));       // ~72,000 - 78,000
          deviceRiskLevel = 1;
        }
        hrv = parseFloat((45.0 + Math.random() * 15.0).toFixed(1));          // 45.0 - 60.0 ms
      }

      // Server-side risk is only computed for patients with seeded context
      // (PT-0042, PT-1089) — everyone else stays "awaiting_patient_info",
      // matching how server.js behaves for real incoming readings.
      const ctx = SEEDED_PATIENT_CONTEXT[patientId];
      const serverRiskLevel = ctx ? predictAnemiaRisk(redRaw, irRaw, ctx.age, ctx.gender) : null;

      // Simulate a small transmission delay (received_at is slightly after the screening timestamp)
      const receivedMs = timeMs + 1500 + Math.random() * 3000;
      const isoReceivedAt = new Date(receivedMs).toISOString();

      stmt.run(patientId, deviceId, spo2, hrv, perfusionIndex, redRaw, irRaw, deviceRiskLevel, serverRiskLevel, isoTimestamp, isoReceivedAt);
    }

    // 4. Finalize transaction and report
    stmt.finalize((err) => {
      if (err) {
        console.error('Finalizing seed inserts failed:', err.message);
        process.exit(1);
      }
      console.log(`Successfully injected ${totalRecords} realistic records into 'readings'.`);

      // Print database row count confirmation
      db.get('SELECT COUNT(*) AS count FROM readings', (err, row) => {
        if (!err && row) {
          console.log(`Verification: readings count is now ${row.count}.`);
        }
        db.close(() => {
          console.log('Database connection closed safely. Seeding complete.');
        });
      });
    });
  }
});
