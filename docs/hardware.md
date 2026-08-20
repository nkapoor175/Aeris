# AERIS (HTAD-06) — Hardware & Wiring

This is the wiring reference for the physical device. The pin map below is
taken directly from [`AerisDevice/AerisDevice.ino`](../AerisDevice/AerisDevice.ino)
(the real device firmware — see the "Which `.ino` do I actually flash?" table
in the [README](../README.md)) — if the two ever disagree, the `.ino` file is
the source of truth, not this document.

No soldering required — everything connects via breadboard + jumper wires.

---

## Components

| Component | What it does | Qty |
|---|---|---|
| ESP32 DevKit v1 | Microcontroller — runs the firmware, Wi-Fi | 1 |
| MAX30102 | Optical PPG sensor — dual wavelength (660nm Red / 880nm IR), I2C | 1 |
| 0.96" OLED (SSD1306, 128×64, I2C, address `0x3C`) | Live reading + result display | 1 |
| Red / Yellow / Green LEDs | Risk indicator (Code 2 / 1 / 0) | 3 |
| 220Ω resistors | Current-limiting for the LEDs | 3 |
| Piezo buzzer | Audible alert on High risk (Code 2) only | 1 |
| Breadboard + jumper wires | No-solder assembly | 1 set |

**Note on the original plan vs. what's actually implemented**: the original
team briefing (`HTAD-06_Team_Briefing.pdf`) lists a push button "to trigger a
new reading." `AerisDevice.ino` does **not** use a button — it triggers a new
screening automatically on finger detection (`IR_FINGER_THRESHOLD`) and resets
that trigger when the finger is removed. If you want the button-triggered flow
described in the original plan, that's not implemented and would need adding
(a pin, a debounce, and gating `send_reading_to_backend()` on it) — flagging
this rather than silently pretending the button is wired in.

---

## Pin Map (from `AerisDevice/AerisDevice.ino`)

| Signal | ESP32 Pin |
|---|---|
| I2C SDA (shared: sensor + OLED) | D21 |
| I2C SCL (shared: sensor + OLED) | D22 |
| Red LED | D18 |
| Yellow LED | D19 |
| Green LED | D23 |
| Buzzer | D5 |
| Sensor / OLED power | 3.3V rail |
| Ground | GND rail |

The MAX30102 and the SSD1306 OLED **share the same I2C bus** (SDA/SCL on
D21/D22) — both are wired to the same two data pins, just different power/GND
rows on the breadboard. I2C bus speed is set to `I2C_SPEED_FAST` in firmware.

## Wiring Diagram (text)

```
                    ESP32 DevKit v1
                 ┌───────────────────┐
   3.3V rail ────┤ 3V3               │
   GND rail  ────┤ GND               │
                 │                   │
   MAX30102 SDA ─┤ D21 (SDA)         │
   OLED     SDA ─┤ (same bus, D21)   │
   MAX30102 SCL ─┤ D22 (SCL)         │
   OLED     SCL ─┤ (same bus, D22)   │
                 │                   │
   Red LED (+220Ω) ┤ D18             │
   Yellow LED (+220Ω) ┤ D19          │
   Green LED (+220Ω) ┤ D23           │
   Buzzer (+) ────┤ D5              │
                 └───────────────────┘

MAX30102: VIN->3V3, GND->GND, SDA->D21, SCL->D22
OLED (SSD1306, addr 0x3C): VCC->3V3, GND->GND, SDA->D21, SCL->D22
LEDs: ESP32 pin -> 220Ω resistor -> LED anode -> LED cathode -> GND
Buzzer: ESP32 pin (D5) -> buzzer (+) -> buzzer (-) -> GND
```

---

## Bring-up order

If something isn't working, bring the hardware up in this order rather than
debugging the full pipeline at once — `HardwareTest/HardwareTest.ino` exists
specifically for this (see the README's sketch comparison table):

1. Flash `HardwareTest/HardwareTest.ino` first. It doesn't need Wi-Fi or a
   running backend — just confirms the OLED initializes, the sensor is
   detected, and the LEDs light up correctly.
2. Once that's confirmed, flash `AerisDevice/AerisDevice.ino` for the full
   pipeline (sensor → classify → display → encrypt → transmit).

## Known gaps (see also the README's Two-Tier Risk Model section)

- No RTC/NTP — timestamps sent to the backend are a fixed placeholder string,
  not the real screening time.
- No patient ID / age / gender input on the device (no keypad/serial/BLE) —
  hardcoded placeholders in firmware. This is why the backend's server-side
  risk estimate (`server_risk_level`) exists: a dashboard operator enters the
  patient's real demographics after the fact, and the server recomputes the
  full estimate using the reading's real Red/IR values.
- No local retry-queue for readings taken while Wi-Fi is disconnected — the
  screening still runs and displays locally, it just doesn't sync until
  Wi-Fi reconnects and a new reading is taken.
