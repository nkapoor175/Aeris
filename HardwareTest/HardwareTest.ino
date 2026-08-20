#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "MAX30105.h" // SparkFun library works for MAX30102
#include "AnemiaClassifier.h"

// -----------------------------------------
// Pin Definitions (Based on instructions)
// -----------------------------------------
#define I2C_SDA 21
#define I2C_SCL 22

#define LED_GREEN  27
#define LED_YELLOW 26
#define LED_RED    25

#define BUTTON_PIN 4

// -----------------------------------------
// OLED Display Settings
// -----------------------------------------
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1 // Share reset pin or use -1 if none
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// -----------------------------------------
// MAX30102 Sensor
// -----------------------------------------
MAX30105 particleSensor;

void setup() {
  Serial.begin(115200);
  while (!Serial); // Wait for Serial monitor to open
  Serial.println("Starting Hardware Diagnostic Test...");

  // 1. Initialize I2C Bus for MAX30102 & OLED
  Wire.begin(I2C_SDA, I2C_SCL);

  // 2. Initialize LEDs
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_YELLOW, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  
  // Turn off LEDs initially
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_YELLOW, LOW);
  digitalWrite(LED_RED, LOW);

  // 3. Initialize Push Button (Internal pull-up handles the resistor)
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  // 4. Initialize OLED
  // Address 0x3C is common for 0.96" 128x64 displays
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) { 
    Serial.println(F("OLED SSD1306 allocation failed. Check I2C wiring."));
    while(1); // Halt if display fails
  }
  
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0,0);
  display.println("OLED Init: OK");
  display.display();
  delay(1000);

  // 5. Initialize MAX30102 Pulse Sensor
  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) { // 400kHz speed
    Serial.println("MAX30102 not found. Check wiring/power.");
    display.println("MAX30102: FAILED");
    display.display();
    while (1); // Halt if sensor fails
  }
  
  Serial.println("MAX30102 Init: OK");
  display.println("MAX30102: OK");
  display.display();
  
  // Configure sensor with default settings
  particleSensor.setup(); 
  particleSensor.setPulseAmplitudeRed(0x0A); // Turn Red LED to low to indicate sensor is running
  particleSensor.setPulseAmplitudeGreen(0);  // Turn off Green LED

  delay(1000);
}

void loop() {
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("--- HTAD-06 TEST ---");

  // -----------------------------------------
  // TEST: Read Push Button
  // -----------------------------------------
  bool buttonPressed = (digitalRead(BUTTON_PIN) == LOW); // LOW = Pressed due to INPUT_PULLUP
  
  display.print("Button: ");
  if (buttonPressed) {
    display.println("PRESSED");
  } else {
    display.println("RELEASED");
  }

  // -----------------------------------------
  // ML PREDICTION & LED OUTPUT
  // -----------------------------------------
  long irValue = particleSensor.getIR();
  long redValue = particleSensor.getRed();
  
  display.print("IR Val: ");
  display.println(irValue);
  
  if (buttonPressed) {
    // Override for testing LEDs
    digitalWrite(LED_GREEN, HIGH);
    digitalWrite(LED_YELLOW, HIGH);
    digitalWrite(LED_RED, HIGH);
    display.println("LEDs  : ALL ON");
  } else if (irValue > 50000) { 
    // Finger detected, run the AI model!
    display.println("-> FINGER DETECTED");
    
    // TODO for Person 1: Replace these demo values with real inputs.
    // Options: dashboard selection, DIP switches, or serial input.
    int patientAge = 30;              // Demo default age
    int patientGender = GENDER_FEMALE; // Demo default: 0=Female, 1=Male
    
    int risk = predictAnemiaRisk((float)redValue, (float)irValue, patientAge, patientGender);
    
    // Reset all LEDs
    digitalWrite(LED_GREEN, LOW);
    digitalWrite(LED_YELLOW, LOW);
    digitalWrite(LED_RED, LOW);
    
    if (risk == RISK_HIGH) {
       digitalWrite(LED_RED, HIGH);
       display.println("RISK  : HIGH (RED)");
    } else if (risk == RISK_MEDIUM) {
       digitalWrite(LED_YELLOW, HIGH);
       display.println("RISK  : MEDIUM (YEL)");
    } else {
       digitalWrite(LED_GREEN, HIGH);
       display.println("RISK  : LOW (GRN)");
    }
  } else {
    // No finger, turn off LEDs
    digitalWrite(LED_GREEN, LOW);
    digitalWrite(LED_YELLOW, LOW);
    digitalWrite(LED_RED, LOW);
    display.println("-> No Finger");
  }

  // Push updates to OLED screen
  display.display();
  
  // Output everything to Serial Monitor for debugging without the screen
  Serial.print("Btn: "); Serial.print(buttonPressed ? "PRESSED" : "RELEASED");
  Serial.print("\t IR Value: "); Serial.println(irValue);

  delay(100); // Small delay to avoid flickering and spamming I2C
}
