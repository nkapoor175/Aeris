/*
  Aeris (HTAD-06) Fingertip Anemia/Malnutrition Device
  ESP32 Reference Firmware - Encrypted Ingestion Pipeline
  
  This reference sketch demonstrates:
  1. Reading mock data from the sensor (SpO2, HRV, Perfusion Index, Risk Level)
  2. Formatting the patient data as a standard JSON string
  3. Generating a random 16-byte Initialization Vector (IV) using hardware entropy
  4. Encrypting the payload using AES-256-CBC via ESP32's built-in mbedtls library
  5. Base64-encoding the ciphertext and IV
  6. Transmitting the payload to the backend server via HTTP POST
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include "mbedtls/aes.h"
#include "mbedtls/base64.h"

// --- Wi-Fi Settings ---
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// --- Backend API Settings ---
const char* server_url = "http://YOUR_SERVER_IP:3001/api/reading";

// --- Shared Pre-Shared Key (32 bytes / 256 bits) ---
// ⚠️  SECURITY: Replace this placeholder with the ACTUAL key from your team's .env file.
// DO NOT commit the real key to version control.
// The key must be exactly 32 ASCII characters (256 bits) and match AES_KEY on the server.
const char* aes_key = "REPLACE_WITH_YOUR_32_CHAR_SECRET";

// --- Allowed Device ID ---
// MUST be registered in the backend server's ALLOWED_DEVICES env list.
const char* device_id = "aeris-001";

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
  // 1. Generate a random 16-byte IV using the ESP32 hardware random number generator
  unsigned char iv[16];
  for (int i = 0; i < 16; i += 4) {
    uint32_t r = esp_random();
    memcpy(&iv[i], &r, 4);
  }

  // 2. Base64-encode IV
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

  // 3. Determine padded length and prepare plaintext
  int plaintext_len = strlen(plaintext);
  int padded_len = plaintext_len + (16 - (plaintext_len % 16));
  unsigned char* padded_input = (unsigned char*)malloc(padded_len);
  if (!padded_input) {
    Serial.println("Memory allocation failed for padded input");
    return false;
  }
  add_pkcs7_padding((const unsigned char*)plaintext, plaintext_len, padded_input);

  // 4. Initialize mbedtls AES context
  mbedtls_aes_context aes;
  mbedtls_aes_init(&aes);
  
  // Set encryption key (256 bits = 32 bytes)
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

  // mbedtls_aes_crypt_cbc modifies the IV buffer during encryption, 
  // so we duplicate our IV to maintain integrity for transmission.
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

  // 5. Base64-encode Ciphertext
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

// Formats mock patient data into unencrypted JSON payload
String build_patient_json(const char* patient_id, float spo2, float hrv, float perfusion_index, int risk_level, const char* timestamp) {
  String json = "{";
  json += "\"patient_id\":\"" + String(patient_id) + "\",";
  json += "\"spo2\":" + String(spo2, 1) + ",";
  json += "\"hrv\":" + String(hrv, 1) + ",";
  json += "\"perfusion_index\":" + String(perfusion_index, 2) + ",";
  json += "\"risk_level\":" + String(risk_level) + ",";
  json += "\"timestamp\":\"" + String(timestamp) + "\"";
  json += "}";
  return json;
}

// Formats outer payload for transmission
String build_post_payload(const char* dev_id, const String& enc_payload, const String& iv) {
  String json = "{";
  json += "\"device_id\":\"" + String(dev_id) + "\",";
  json += "\"encrypted_payload\":\"" + enc_payload + "\",";
  json += "\"iv\":\"" + iv + "\"";
  json += "}";
  return json;
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  // Initialize random number generator seed
  randomSeed(analogRead(0));

  // Connect to Wi-Fi
  Serial.print("Connecting to Wi-Fi...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected to Wi-Fi!");
}

void loop() {
  // Send readings every 30 seconds
  send_reading();
  delay(30000);
}

void send_reading() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected. Skipping post.");
    return;
  }

  Serial.println("\n--- Preparing New Screening Data ---");

  // 1. Simulating clinical metrics from MAX30102
  float spo2 = 94.0 + random(0, 60) / 10.0;            // Simulated SpO2 (94.0% to 100.0%)
  float hrv = 35.0 + random(0, 150) / 10.0;            // Simulated HRV (35.0 to 50.0 ms)
  float perfusion_index = 0.5 + random(0, 250) / 100.0;// Simulated Perfusion Index (0.5 to 3.0)
  
  // Risk assessment: 0=Low/Green, 1=Medium/Yellow, 2=High/Red
  int risk_level = 0;
  if (spo2 < 92.0 || perfusion_index < 0.8) {
    risk_level = 2; // High Risk
  } else if (spo2 < 95.0 || perfusion_index < 1.5) {
    risk_level = 1; // Medium Risk
  }

  // Real timestamp (simulate UTC ISO string; in production, fetch via NTP or RTC)
  const char* timestamp = "2026-08-20T14:23:00Z"; 

  // 2. Build the inner patient payload JSON
  String patient_json = build_patient_json("PT-0042", spo2, hrv, perfusion_index, risk_level, timestamp);
  Serial.print("1. Unencrypted Patient Data: ");
  Serial.println(patient_json);

  // 3. Encrypt the patient data
  String encrypted_payload;
  String iv;
  if (!encrypt_payload(patient_json.c_str(), encrypted_payload, iv)) {
    Serial.println("ERROR: AES-256-CBC Encryption Failed.");
    return;
  }
  Serial.println("2. Encryption completed successfully.");
  Serial.print("   IV (Base64): "); Serial.println(iv);
  Serial.print("   Ciphertext (Base64): "); Serial.println(encrypted_payload);

  // 4. Construct outer transmission JSON
  String post_payload = build_post_payload(device_id, encrypted_payload, iv);
  Serial.println("3. Outermost Request Payload constructed.");

  // 5. Send POST request over HTTP
  HTTPClient http;
  http.begin(server_url);
  http.addHeader("Content-Type", "application/json");

  Serial.print("4. Transmitting reading to API... ");
  int httpResponseCode = http.POST(post_payload);
  
  if (httpResponseCode > 0) {
    Serial.printf("Response Code: %d\n", httpResponseCode);
    String response = http.getString();
    Serial.print("   Server Response: ");
    Serial.println(response);
  } else {
    Serial.printf("FAILED. Error Code: %s\n", http.errorToString(httpResponseCode).c_str());
  }

  http.end();
}
