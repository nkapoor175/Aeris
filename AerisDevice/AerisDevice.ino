/*
  ============================================================
  AERIS (HTAD-06) — Unified Device Firmware
  Sensor -> Quality Gating -> ML Classification (w/ fallback) ->
  OLED + LEDs + Buzzer -> AES-256-CBC Encrypt -> HTTPS POST
  ============================================================
  This is the actual end-to-end firmware for the physical device —
  it combines what HardwareTest/HardwareTest.ino (sensor+OLED+LED,
  no transmission) and esp32_client/esp32_client.ino (encryption+
  POST, but with simulated sensor data) each did separately. Neither
  of those files alone runs the full pipeline; this one does.

  esp32_client.ino is intentionally left as-is alongside this file —
  it's still useful on its own for testing the backend without a
  physical MAX30102/OLED/ESP32 attached.

  Wiring (matches the team's confirmed working breadboard layout):
    Sensor  -> 3V3/GND rows, D21 (SDA), D22 (SCL)
    OLED    -> same rows, same SDA/SCL columns
    Red LED    -> D18
    Yellow LED -> D19
    Green LED  -> D23
    Buzzer     -> D5
  ============================================================
*/

#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include "mbedtls/aes.h"
#include "mbedtls/base64.h"
#include "MAX30105.h"
#include "spo2_algorithm.h"
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "AnemiaClassifier.h"   // ML risk classifier (predictAnemiaRisk)

// --- Wi-Fi Settings ---
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// --- Backend API Settings ---
const char* server_url = "http://YOUR_SERVER_IP:3001/api/reading";

// --- Shared Pre-Shared Key (32 bytes / 256 bits) ---
// SECURITY: Replace this placeholder with the ACTUAL key from your team's
// .env file. DO NOT commit the real key to version control. Must be exactly
// 32 ASCII characters (256 bits) and match AES_KEY on the server.
const char* aes_key = "REPLACE_WITH_YOUR_32_CHAR_SECRET";

// --- Allowed Device ID ---
// MUST be registered in the backend server's ALLOWED_DEVICES env list.
const char* device_id = "aeris-001";

#define SDA_PIN 21
#define SCL_PIN 22
#define RED_LED    18
#define YELLOW_LED 19
#define GREEN_LED  23
#define BUZZER_PIN 5

#define SCREEN_W 128
#define SCREEN_H 64
#define OLED_RESET -1
#define OLED_ADDR 0x3C
Adafruit_SSD1306 display(SCREEN_W, SCREEN_H, &Wire, OLED_RESET);

MAX30105 sensor;

#define IR_FINGER_THRESHOLD   50000
#define IR_SATURATION_LIMIT   200000
#define MIN_AC_AMPLITUDE      500
#define SPO2_MIN_VALID         70
#define SPO2_MAX_VALID        100
#define PI_MIN_VALID          0.1
#define PI_MAX_VALID           25.0

#define PI_LOW_RISK_MIN     3.0
#define PI_MEDIUM_RISK_MIN  1.4

#define BUFFER_SIZE 100

uint32_t irBuffer[BUFFER_SIZE];
uint32_t redBuffer[BUFFER_SIZE];

int32_t spo2Value;
int8_t spo2Valid;
int32_t heartRateValue;
int8_t heartRateValid;

int currentRiskLevel = -1;

// Only send one reading per finger "session" (placed -> held -> removed),
// rather than re-transmitting every ~1s loop iteration while the finger
// stays down. Reset the moment no finger is detected. Without this, a
// finger held in place for a demo would spam the backend and trip the
// server's 10 req/min rate limiter within seconds.
bool readingSentForCurrentSession = false;

// ------------------------------------------------------------------
// TODO (Person 1 / whoever owns patient intake): patientId/patientAge/
// patientGender are placeholders. This sketch has no input mechanism
// for any of them yet (no keypad/serial/BLE UI). The backend's
// server-side risk estimate (server_risk_level) is designed to correct
// for this — once a health worker submits the patient's real age/
// gender via the dashboard (POST /api/patient-context), the server
// recomputes the full risk estimate using the SAME model, so the
// on-device placeholder here only affects the immediate on-device
// LED/OLED result, not the record a clinician would actually trust.
// ------------------------------------------------------------------
const char* patientId = "PT-0042";
int patientAge = 30;
int patientGender = GENDER_FEMALE; // 0 = Female, 1 = Male (see AnemiaClassifier.h)

// ------------------------------------------------------------------
// NOTE: this field is named "hrv" throughout the firmware, backend
// schema, and dashboard, but what's actually computed below is
// instantaneous HEART RATE (bpm) via the maxim library, not true
// heart-rate-variability (which needs beat-to-beat interval variance
// analysis — a materially different, harder DSP problem that was
// never implemented). This mislabeling predates this file — flagging
// it here rather than silently perpetuating it without comment.
// ------------------------------------------------------------------

float calculatePerfusionIndex(uint32_t *irData, int length, float *acOut, float *dcOut) {
  uint32_t maxVal = irData[0];
  uint32_t minVal = irData[0];
  uint64_t sum = 0;

  for (int i = 0; i < length; i++) {
    if (irData[i] > maxVal) maxVal = irData[i];
    if (irData[i] < minVal) minVal = irData[i];
    sum += irData[i];
  }

  float acComponent = (float)(maxVal - minVal);
  float dcComponent = (float)(sum / length);

  *acOut = acComponent;
  *dcOut = dcComponent;

  if (dcComponent == 0) return 0;
  return (acComponent / dcComponent) * 100.0;
}

// Rule-based fallback classifier. Kept as a safety net — used if the ML
// model returns an out-of-range value instead of 0/1/2. See the sanity
// check in loop().
int classifyRiskFallback(float pi, int32_t spo2) {
  if (pi >= PI_LOW_RISK_MIN) return 0;
  else if (pi >= PI_MEDIUM_RISK_MIN) return 1;
  else return 2;
}

void clearAllLEDs() {
  digitalWrite(RED_LED, LOW);
  digitalWrite(YELLOW_LED, LOW);
  digitalWrite(GREEN_LED, LOW);
}

void setRiskLED(int riskLevel) {
  clearAllLEDs();
  if (riskLevel == 0) digitalWrite(GREEN_LED, HIGH);
  else if (riskLevel == 1) digitalWrite(YELLOW_LED, HIGH);
  else if (riskLevel == 2) digitalWrite(RED_LED, HIGH);
}

void alertHighRisk() {
  for (int i = 0; i < 3; i++) {
    tone(BUZZER_PIN, 1200);
    delay(150);
    noTone(BUZZER_PIN);
    delay(100);
  }
}

String riskLabel(int riskLevel) {
  if (riskLevel == 0) return "LOW RISK";
  if (riskLevel == 1) return "MEDIUM RISK";
  if (riskLevel == 2) return "HIGH RISK";
  return "---";
}

void showIdleScreen(String message) {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("AERIS - HTAD-06");
  display.drawLine(0, 10, 127, 10, SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 25);
  display.println(message);
  display.display();
}

void showResultScreen(int riskLevel, int32_t spo2, int32_t hr, float pi, bool sent) {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("AERIS - RESULT");
  display.drawLine(0, 10, 127, 10, SSD1306_WHITE);

  display.setTextSize(2);
  display.setCursor(0, 16);
  display.println(riskLabel(riskLevel));

  display.setTextSize(1);
  display.setCursor(0, 40);
  display.print("SpO2: ");
  display.print(spo2);
  display.println("%");

  display.setCursor(0, 50);
  display.print("HR: ");
  display.print(hr);
  display.println(" bpm");

  display.setCursor(64, 50);
  display.print("PI: ");
  display.print(pi, 1);
  display.println("%");

  display.setCursor(0, 56);
  display.setTextSize(1);
  display.print(sent ? "Synced" : "Sync failed");

  display.display();
}

// Add standard PKCS7 padding to align payload block size to 16 bytes
int add_pkcs7_padding(const unsigned char* input, int input_len, unsigned char* output) {
  int padding_len = 16 - (input_len % 16);
  int padded_len = input_len + padding_len;
  memcpy(output, input, input_len);
  for (int i = input_len; i < padded_len; i++) {
    output[i] = padding_len;
  }
  return padded_len;
}

// AES-256-CBC Encryption implementation using ESP32 mbedtls
bool encrypt_payload(const char* plaintext, String& out_encrypted_base64, String& out_iv_base64) {
  unsigned char iv[16];
  for (int i = 0; i < 16; i += 4) {
    uint32_t r = esp_random();
    memcpy(&iv[i], &r, 4);
  }

  size_t iv_base64_len = 0;
  mbedtls_base64_encode(NULL, 0, &iv_base64_len, iv, 16);
  unsigned char* iv_base64_buf = (unsigned char*)malloc(iv_base64_len + 1);
  if (!iv_base64_buf) {
    Serial.println("Memory allocation failed for IV buffer");
    return false;
  }
  mbedtls_base64_encode(iv_base64_buf, iv_base64_len, &iv_base64_len, iv, 16);
  iv_base64_buf[iv_base64_len] = '\0';
  out_iv_base64 = String((char*)iv_base64_buf);
  free(iv_base64_buf);

  int plaintext_len = strlen(plaintext);
  int padded_len = plaintext_len + (16 - (plaintext_len % 16));
  unsigned char* padded_input = (unsigned char*)malloc(padded_len);
  if (!padded_input) {
    Serial.println("Memory allocation failed for padded input");
    return false;
  }
  add_pkcs7_padding((const unsigned char*)plaintext, plaintext_len, padded_input);

  mbedtls_aes_context aes;
  mbedtls_aes_init(&aes);

  if (mbedtls_aes_setkey_enc(&aes, (const unsigned char*)aes_key, 256) != 0) {
    Serial.println("Failed to set AES key");
    mbedtls_aes_free(&aes);
    free(padded_input);
    return false;
  }

  unsigned char* ciphertext = (unsigned char*)malloc(padded_len);
  if (!ciphertext) {
    Serial.println("Memory allocation failed for ciphertext");
    mbedtls_aes_free(&aes);
    free(padded_input);
    return false;
  }

  unsigned char iv_copy[16];
  memcpy(iv_copy, iv, 16);

  int ret = mbedtls_aes_crypt_cbc(&aes, MBEDTLS_AES_ENCRYPT, padded_len, iv_copy, padded_input, ciphertext);
  mbedtls_aes_free(&aes);
  free(padded_input);

  if (ret != 0) {
    Serial.printf("AES CBC encryption failed with code: %d\n", ret);
    free(ciphertext);
    return false;
  }

  size_t cipher_base64_len = 0;
  mbedtls_base64_encode(NULL, 0, &cipher_base64_len, ciphertext, padded_len);
  unsigned char* cipher_base64_buf = (unsigned char*)malloc(cipher_base64_len + 1);
  if (!cipher_base64_buf) {
    Serial.println("Memory allocation failed for ciphertext base64 buffer");
    free(ciphertext);
    return false;
  }
  mbedtls_base64_encode(cipher_base64_buf, cipher_base64_len, &cipher_base64_len, ciphertext, padded_len);
  cipher_base64_buf[cipher_base64_len] = '\0';
  out_encrypted_base64 = String((char*)cipher_base64_buf);

  free(ciphertext);
  free(cipher_base64_buf);
  return true;
}

// Formats the inner patient payload JSON. red_raw/ir_raw are the same
// raw optical values fed to the on-device ML model, transmitted so the
// server can re-run the full classifier once it has the patient's real
// age/gender (see server_risk_level in the README's Two-Tier Risk Model).
String build_patient_json(const char* patient_id, float spo2, float hrv, float perfusion_index, int risk_level, float red_raw, float ir_raw, const char* timestamp) {
  String json = "{";
  json += "\"patient_id\":\"" + String(patient_id) + "\",";
  json += "\"spo2\":" + String(spo2, 1) + ",";
  json += "\"hrv\":" + String(hrv, 1) + ",";
  json += "\"perfusion_index\":" + String(perfusion_index, 2) + ",";
  json += "\"risk_level\":" + String(risk_level) + ",";
  json += "\"red_raw\":" + String(red_raw, 1) + ",";
  json += "\"ir_raw\":" + String(ir_raw, 1) + ",";
  json += "\"timestamp\":\"" + String(timestamp) + "\"";
  json += "}";
  return json;
}

String build_post_payload(const char* dev_id, const String& enc_payload, const String& iv) {
  String json = "{";
  json += "\"device_id\":\"" + String(dev_id) + "\",";
  json += "\"encrypted_payload\":\"" + enc_payload + "\",";
  json += "\"iv\":\"" + iv + "\"";
  json += "}";
  return json;
}

// Encrypts and POSTs one screening result to the backend. Returns true
// only on a confirmed 2xx response from the server, so the caller can
// show an honest "Synced" / "Sync failed" state on the OLED rather than
// assuming success once the packet leaves the device.
bool send_reading_to_backend(int32_t spo2, int32_t hr, float pi, int riskLevel, float red_raw, float ir_raw) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected. Skipping transmission.");
    return false;
  }

  // TODO: no RTC/NTP wired up yet — this is a placeholder timestamp, not
  // the real screening time. Fetch real time via NTP (WiFi is already
  // connected) or an RTC module before this is used for anything beyond
  // bench testing; a fixed/duplicate timestamp across readings will make
  // it impossible to tell them apart chronologically server-side.
  const char* timestamp = "2026-08-20T14:23:00Z";

  String patient_json = build_patient_json(patientId, (float)spo2, (float)hr, pi, riskLevel, red_raw, ir_raw, timestamp);
  Serial.print("Unencrypted Patient Data: ");
  Serial.println(patient_json);

  String encrypted_payload;
  String iv;
  if (!encrypt_payload(patient_json.c_str(), encrypted_payload, iv)) {
    Serial.println("ERROR: AES-256-CBC Encryption Failed.");
    return false;
  }

  String post_payload = build_post_payload(device_id, encrypted_payload, iv);

  HTTPClient http;
  http.begin(server_url);
  http.addHeader("Content-Type", "application/json");

  int httpResponseCode = http.POST(post_payload);
  bool success = false;

  if (httpResponseCode > 0) {
    Serial.printf("Response Code: %d\n", httpResponseCode);
    String response = http.getString();
    Serial.print("Server Response: ");
    Serial.println(response);
    success = (httpResponseCode >= 200 && httpResponseCode < 300);
  } else {
    Serial.printf("FAILED. Error Code: %s\n", http.errorToString(httpResponseCode).c_str());
  }

  http.end();
  return success;
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("=== AERIS UNIFIED DEVICE FIRMWARE ===");

  pinMode(RED_LED, OUTPUT);
  pinMode(YELLOW_LED, OUTPUT);
  pinMode(GREEN_LED, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  clearAllLEDs();

  Wire.begin(SDA_PIN, SCL_PIN);

  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
    Serial.println("[FAIL] OLED not found.");
    while (1) delay(1000);
  }

  showIdleScreen("Starting sensor...");

  if (!sensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("[FAIL] Sensor not found.");
    showIdleScreen("SENSOR NOT FOUND");
    while (1) delay(1000);
  }

  sensor.setup(0x1F, 4, 2, 100, 411, 4096);

  // Connect to Wi-Fi. Deliberately non-blocking-forever: the sensor/OLED/
  // LED pipeline below works fully offline (local screening still shows a
  // result), transmission is just skipped if Wi-Fi isn't up yet — there is
  // no local retry-queue for readings taken while offline (see the
  // dashboard's "UI simulation only" note on the offline-queue panel).
  Serial.print("Connecting to Wi-Fi...");
  WiFi.begin(ssid, password);
  int wifiAttempts = 0;
  while (WiFi.status() != WL_CONNECTED && wifiAttempts < 20) {
    delay(500);
    Serial.print(".");
    wifiAttempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nConnected to Wi-Fi!");
  } else {
    Serial.println("\n[WARN] Wi-Fi not connected — screenings will run locally but won't sync.");
  }

  Serial.println("[OK] Ready. Place finger on sensor.");
  showIdleScreen("Place finger to begin");
}

void loop() {
  for (int i = 0; i < BUFFER_SIZE; i++) {
    redBuffer[i] = sensor.getRed();
    irBuffer[i] = sensor.getIR();
    delay(10);
  }

  maxim_heart_rate_and_oxygen_saturation(
    irBuffer, BUFFER_SIZE, redBuffer,
    &spo2Value, &spo2Valid,
    &heartRateValue, &heartRateValid
  );

  float acComponent, dcComponent;
  float piValue = calculatePerfusionIndex(irBuffer, BUFFER_SIZE, &acComponent, &dcComponent);

  uint32_t lastIR = irBuffer[BUFFER_SIZE - 1];
  uint32_t maxIR = irBuffer[0];
  for (int i = 0; i < BUFFER_SIZE; i++) {
    if (irBuffer[i] > maxIR) maxIR = irBuffer[i];
  }

  if (lastIR < IR_FINGER_THRESHOLD) {
    Serial.print("[REJECTED] No finger. (IR=");
    Serial.print(lastIR);
    Serial.println(")");
    clearAllLEDs();
    showIdleScreen("Place finger to begin");
    readingSentForCurrentSession = false; // finger removed -> next placement is a new session
    return;
  }

  if (maxIR > IR_SATURATION_LIMIT) {
    Serial.println("[REJECTED] Signal saturated.");
    showIdleScreen("Ease finger pressure");
    return;
  }

  if (acComponent < MIN_AC_AMPLITUDE) {
    Serial.println("[REJECTED] Pulse too weak/flat.");
    showIdleScreen("Hold still...");
    return;
  }

  if (!spo2Valid) {
    Serial.println("[REJECTED] Algorithm not confident.");
    showIdleScreen("Reading... hold still");
    return;
  }

  if (spo2Value < SPO2_MIN_VALID || spo2Value > SPO2_MAX_VALID) {
    Serial.print("[REJECTED] SpO2 out of range (");
    Serial.print(spo2Value);
    Serial.println("%).");
    showIdleScreen("Retry - unclear reading");
    return;
  }

  if (piValue < PI_MIN_VALID || piValue > PI_MAX_VALID) {
    Serial.print("[REJECTED] PI out of range (");
    Serial.print(piValue);
    Serial.println("%).");
    showIdleScreen("Retry - unclear reading");
    return;
  }

  // ---- ML-based risk classification (on-device, placeholder demographics) ----
  uint32_t lastRed = redBuffer[BUFFER_SIZE - 1];
  int mlRisk = predictAnemiaRisk((float)lastRed, (float)lastIR, patientAge, patientGender);

  int riskLevel;
  if (mlRisk == RISK_LOW || mlRisk == RISK_MEDIUM || mlRisk == RISK_HIGH) {
    riskLevel = mlRisk;
  } else {
    Serial.print("[WARN] ML prediction out of range (");
    Serial.print(mlRisk);
    Serial.println("). Falling back to rule-based classifier.");
    riskLevel = classifyRiskFallback(piValue, spo2Value);
  }
  currentRiskLevel = riskLevel;

  Serial.println("[ACCEPTED] ---- Valid Reading ----");
  Serial.print("  SpO2: "); Serial.print(spo2Value); Serial.println("%");
  Serial.print("  Heart Rate: "); Serial.print(heartRateValue); Serial.println(" bpm");
  Serial.print("  Perfusion Index: "); Serial.print(piValue); Serial.println("%");
  Serial.print("  Risk: "); Serial.println(riskLabel(riskLevel));

  // ---- Transmit once per finger session ----
  bool sentThisLoop = false;
  if (!readingSentForCurrentSession) {
    sentThisLoop = send_reading_to_backend(spo2Value, heartRateValue, piValue, riskLevel, (float)lastRed, (float)lastIR);
    if (sentThisLoop) readingSentForCurrentSession = true;
  } else {
    sentThisLoop = true; // already synced this session — OLED should keep showing "Synced"
  }
  Serial.println("------------------------------");

  showResultScreen(riskLevel, spo2Value, heartRateValue, piValue, sentThisLoop);
  setRiskLED(riskLevel);

  if (riskLevel == 2) {
    alertHighRisk();
  }
}
