require('dotenv').config();
const crypto = require('crypto');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// AES_KEY MUST be set in .env — no hardcoded fallback.
// The old default key (aeris_super_secure_key_32_bytes_) has been rotated and
// must no longer be used. Run `node -e "require('crypto').randomBytes(32).toString('hex')" | clip`
// to generate a new 64-char hex key and paste it into your .env as AES_KEY.
if (!process.env.AES_KEY) {
  console.error('ERROR: AES_KEY is not set in the environment. Cannot run tests without it.');
  console.error('Copy .env.example to .env and fill in a real 32-byte key before running.');
  process.exit(1);
}
const AES_KEY = process.env.AES_KEY;

// Encrypt helper using AES-256-CBC
function encrypt(payloadObj, keyString) {
  let keyBuffer;
  if (keyString.length === 64 && /^[0-9a-fA-F]+$/.test(keyString)) {
    keyBuffer = Buffer.from(keyString, 'hex');
  } else {
    keyBuffer = Buffer.from(keyString, 'utf8');
  }

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
  
  let encrypted = cipher.update(JSON.stringify(payloadObj), 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  return {
    encrypted_payload: encrypted,
    iv: iv.toString('base64')
  };
}

// Assert helper
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ ${message}`);
  }
}

// Main Test Sequence
async function runTests() {
  console.log('--- Starting Integration & Security Tests ---');

  // Clear existing databases and logs to ensure a clean slate
  const dbFile = path.join(__dirname, 'aeris.db');
  const logFile = path.join(__dirname, 'app.log');
  if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
  if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

  // 1. Spawn server
  console.log('Starting server...');
  const server = spawn('node', ['server.js'], { stdio: 'pipe' });

  // Pipe server output to console prefixed
  server.stdout.on('data', (data) => {
    console.log(`[Server] ${data.toString().trim()}`);
  });
  server.stderr.on('data', (data) => {
    console.error(`[Server Error] ${data.toString().trim()}`);
  });

  // Wait 3 seconds for server and database initialization (sqlite3 native module needs extra time)
  await new Promise(resolve => setTimeout(resolve, 3000));

  try {
    // --- TEST 1: Authorized Ingestion (Success) ---
    console.log('\nRunning Test 1: Ingesting valid data from authorized device...');
    const validData = {
      patient_id: 'PT-0042',
      spo2: 96.5,
      hrv: 42.0,
      perfusion_index: 1.8,
      risk_level: 1,
      timestamp: new Date().toISOString()
    };
    const { encrypted_payload, iv } = encrypt(validData, AES_KEY);

    const postPayload = {
      device_id: 'aeris-001',
      encrypted_payload,
      iv
    };

    const res1 = await fetch(`${BASE_URL}/api/reading`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postPayload)
    });
    
    assert(res1.status === 201, `Expected status 201, got ${res1.status}`);
    const body1 = await res1.json();
    assert(body1.message === 'Reading successfully processed and stored', 'Should return success message');
    assert(body1.id !== undefined, 'Should return the stored row ID');

    // --- TEST 2: Retrieve Stored Reading (Success) ---
    console.log('\nRunning Test 2: Retrieving readings via GET API...');
    const res2 = await fetch(`${BASE_URL}/api/readings?patient_id=PT-0042`);
    assert(res2.status === 200, `Expected status 200, got ${res2.status}`);
    const readings = await res2.json();
    assert(readings.length === 1, `Expected 1 record, got ${readings.length}`);
    assert(readings[0].patient_id === 'PT-0042', `Expected patient_id PT-0042, got ${readings[0].patient_id}`);
    assert(readings[0].device_id === 'aeris-001', `Expected device_id aeris-001, got ${readings[0].device_id}`);
    assert(readings[0].spo2 === 96.5, `Expected spo2 96.5, got ${readings[0].spo2}`);
    assert(readings[0].hrv === 42, `Expected hrv 42, got ${readings[0].hrv}`);
    assert(readings[0].perfusion_index === 1.8, `Expected perfusion_index 1.8, got ${readings[0].perfusion_index}`);
    assert(readings[0].risk_level === 1, `Expected risk_level 1, got ${readings[0].risk_level}`);
    assert(readings[0].received_at !== undefined, 'Should contain received_at timestamp');

    // --- TEST 3: Unauthorized Device (Failure) ---
    console.log('\nRunning Test 3: Rejecting request from unauthorized device...');
    const unauthorizedPayload = {
      device_id: 'aeris-rogue-999', // Not in ALLOWED_DEVICES
      encrypted_payload,
      iv
    };

    const res3 = await fetch(`${BASE_URL}/api/reading`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(unauthorizedPayload)
    });
    assert(res3.status === 401, `Expected status 401, got ${res3.status}`);
    const body3 = await res3.json();
    assert(body3.error === 'Device not authorized', 'Should return "Device not authorized" error');

    // --- TEST 4: Malformed Payload Field (Failure) ---
    console.log('\nRunning Test 4: Rejecting request with malformed/missing field (invalid risk_level)...');
    const invalidData = {
      patient_id: 'PT-0042',
      spo2: 96.5,
      hrv: 42.0,
      perfusion_index: 1.8,
      risk_level: 5, // Invalid: must be 0, 1, or 2
      timestamp: new Date().toISOString()
    };
    const encryptedInvalid = encrypt(invalidData, AES_KEY);

    const postPayloadInvalid = {
      device_id: 'aeris-001',
      encrypted_payload: encryptedInvalid.encrypted_payload,
      iv: encryptedInvalid.iv
    };

    const res4 = await fetch(`${BASE_URL}/api/reading`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postPayloadInvalid)
    });
    assert(res4.status === 400, `Expected status 400, got ${res4.status}`);
    const body4 = await res4.json();
    assert(body4.error.includes('risk_level'), `Expected error message to mention "risk_level", got: ${body4.error}`);

    // --- TEST 5: Decryption Failure with Wrong Key (Failure) ---
    console.log('\nRunning Test 5: Rejecting payload encrypted with wrong key...');
    const wrongKeyEncrypted = encrypt(validData, 'wrong_key_must_be_32_bytes_long_');
    const postPayloadWrongKey = {
      device_id: 'aeris-001',
      encrypted_payload: wrongKeyEncrypted.encrypted_payload,
      iv: wrongKeyEncrypted.iv
    };

    const res5 = await fetch(`${BASE_URL}/api/reading`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postPayloadWrongKey)
    });
    assert(res5.status === 400, `Expected status 400, got ${res5.status}`);
    const body5 = await res5.json();
    assert(body5.error.includes('Decryption or malformed payload error'), `Expected decryption failure error, got: ${body5.error}`);

    // --- TEST 6: Rate Limiting per Device ID (Failure) ---
    console.log('\nRunning Test 6: Verifying rate limit of 10 requests/minute per device...');
    const limitDevice = 'aeris-002'; // Use clean device to not interfere with aeris-001
    
    // Send 10 valid requests (which should succeed)
    console.log(`Sending 10 sequential valid requests for device: ${limitDevice}...`);
    for (let i = 1; i <= 10; i++) {
      const { encrypted_payload, iv } = encrypt(validData, AES_KEY);
      const res = await fetch(`${BASE_URL}/api/reading`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: limitDevice, encrypted_payload, iv })
      });
      assert(res.status === 201, `Request #${i} expected 201, got ${res.status}`);
    }

    // The 11th request should be rate-limited
    console.log('Sending the 11th request...');
    const { encrypted_payload: ep11, iv: iv11 } = encrypt(validData, AES_KEY);
    const res6 = await fetch(`${BASE_URL}/api/reading`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: limitDevice, encrypted_payload: ep11, iv: iv11 })
    });
    assert(res6.status === 429, `11th request expected status 429 (Too Many Requests), got ${res6.status}`);
    const body6 = await res6.json();
    assert(body6.error.includes('Rate limit exceeded'), `Expected rate limit error message, got: ${body6.error}`);

    // --- TEST 7: Log File Verification (Plaintext clinical data check) ---
    console.log('\nRunning Test 7: Confirming app.log does not leak plaintext patient data...');
    assert(fs.existsSync(logFile), 'Log file should be created');
    const logContent = fs.readFileSync(logFile, 'utf8');
    
    assert(!logContent.includes('PT-0042'), 'Log should NOT contain patient ID');
    assert(!logContent.includes('96.5') && !logContent.includes('96.0'), 'Log should NOT contain SpO2 value');
    assert(logContent.includes('aeris-001'), 'Log should contain metadata: device ID');
    assert(logContent.includes('SUCCESS') && logContent.includes('FAILURE'), 'Log should track successes and failures');
    console.log('app.log verified successfully! Here are the logs generated during testing:');
    console.log('------------------------------------------------------------');
    console.log(logContent.trim());
    console.log('------------------------------------------------------------');

    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! Pipeline is secure and fully functional.');

  } catch (err) {
    console.error('Test run failed with error:', err);
    process.exit(1);
  } finally {
    // 8. Clean shutdown of child server process
    console.log('\nShutting down test server...');
    server.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 500));
    process.exit(0);
  }
}

runTests();
