/*
  MindGuard ESP32 Multi-Sensor Reader
  Reads from:
  - MPU6050 Accelerometer/Gyroscope (I2C, Address 0x68)
  - MLX90614 Infrared Temperature Sensor (I2C, Address 0x5A)
  - AD8232 Heart Rate Monitor (Analog)
  
  Output: JSON lines over Serial at 115200 baud
  Format: {"accel":{"x":0.12,"y":-0.34,"z":9.81},"temp":{"ambient":28.5,"body":36.8},"heart":{"signal":2450,"bpm":72,"leads_off":false}}
  
  Wiring:
  - I2C: SDA=GPIO21, SCL=GPIO22
  - AD8232: OUTPUT=GPIO34, LO-=GPIO32, LO+=GPIO33
  - MPU6050: VCC=3.3V, GND, SDA=GPIO21, SCL=GPIO22
  - MLX90614: VCC=3.3V, GND, SDA=GPIO21, SCL=GPIO22
*/

#include <Wire.h>
#include <Adafruit_MLX90614.h>

// ==========================================
//  PIN DEFINITIONS
// ==========================================
#define AD8232_OUTPUT_PIN 34   // Analog output from AD8232 (ECG signal)
#define AD8232_LO_MINUS   32   // Leads off detection LO-
#define AD8232_LO_PLUS    33   // Leads off detection LO+

// ==========================================
//  MPU6050 DEFINITIONS
// ==========================================
#define MPU6050_ADDR 0x68      // Default I2C address
#define MPU6050_PWR_MGMT_1 0x6B
#define MPU6050_ACCEL_XOUT_H 0x3B
#define ACCEL_SCALE 16384.0    // ±2g sensitivity: 16384 LSB/g
#define GRAVITY_MS2 9.81       // Convert g to m/s²

// ==========================================
//  SENSOR OBJECTS
// ==========================================
Adafruit_MLX90614 mlx = Adafruit_MLX90614();

// ==========================================
//  HEART RATE VARIABLES
// ==========================================
unsigned long lastBeat = 0;
float bpm = 0;
int heartSignal = 0;
bool rising = false;
int lastSignal = 0;

// BPM smoothing - average over last few beats for stable reading
#define BPM_HISTORY_SIZE 5
float bpmHistory[BPM_HISTORY_SIZE];
int bpmHistoryIndex = 0;
int bpmHistoryCount = 0;

// ==========================================
//  TIMING
// ==========================================
unsigned long lastPrint = 0;
const unsigned long PRINT_INTERVAL = 500;  // Print JSON every 500ms (2 Hz)

// ==========================================
//  SENSOR STATUS FLAGS
// ==========================================
bool mpuReady = false;
bool mlxReady = false;

void setup() {
  Serial.begin(115200);
  while (!Serial) delay(10);
  
  Serial.println();
  Serial.println("========================================");
  Serial.println("  MindGuard ESP32 Sensor System");
  Serial.println("  MPU6050 + MLX90614 + AD8232");
  Serial.println("========================================");
  
  // Initialize I2C
  Wire.begin(21, 22);  // SDA=GPIO21, SCL=GPIO22
  Wire.setClock(100000);  // 100kHz for MLX90614 compatibility
  
  // ------------------------------------------
  //  Scan I2C Bus
  // ------------------------------------------
  Serial.println("\nScanning I2C bus...");
  byte deviceCount = 0;
  for (byte address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    if (Wire.endTransmission() == 0) {
      Serial.print("  Found device at 0x");
      if (address < 16) Serial.print("0");
      Serial.print(address, HEX);
      if (address == MPU6050_ADDR) Serial.print(" (MPU6050)");
      else if (address == 0x5A) Serial.print(" (MLX90614)");
      Serial.println();
      deviceCount++;
    }
  }
  Serial.print("Found "); Serial.print(deviceCount); Serial.println(" I2C device(s)");

  // ------------------------------------------
  //  Setup AD8232 Pins
  // ------------------------------------------
  pinMode(AD8232_LO_MINUS, INPUT);
  pinMode(AD8232_LO_PLUS, INPUT);
  Serial.println("AD8232 ECG: OK (GPIO34, LO-=GPIO32, LO+=GPIO33)");

  // ------------------------------------------
  //  Initialize MPU6050
  // ------------------------------------------
  Serial.print("Initializing MPU6050... ");
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(MPU6050_PWR_MGMT_1);  // PWR_MGMT_1 register
  Wire.write(0);                    // Write 0 to wake up from sleep
  byte error = Wire.endTransmission(true);
  
  if (error == 0) {
    mpuReady = true;
    Serial.println("OK!");
  } else {
    Serial.print("FAILED! Error code: ");
    Serial.println(error);
    Serial.println("  -> Check: VCC=3.3V, GND, SDA=GPIO21, SCL=GPIO22");
    Serial.println("  -> MPU6050 should appear at address 0x68");
  }

  // ------------------------------------------
  //  Initialize MLX90614
  // ------------------------------------------
  Serial.print("Initializing MLX90614... ");
  if (!mlx.begin()) {
    Serial.println("FAILED! Check wiring.");
    Serial.println("  -> Check: VIN=3.3V, GND, SDA=GPIO21, SCL=GPIO22");
    Serial.println("  -> MLX90614 should appear at address 0x5A");
  } else {
    mlxReady = true;
    Serial.println("OK!");
  }
  
  // Initialize BPM history
  for (int i = 0; i < BPM_HISTORY_SIZE; i++) {
    bpmHistory[i] = 0;
  }

  Serial.println("\n--- Starting sensor readings (JSON output) ---\n");
}

void loop() {
  // ==========================================
  //  READ AD8232 ECG (every loop for beat detection)
  // ==========================================
  bool leadsOff = (digitalRead(AD8232_LO_MINUS) == HIGH) || (digitalRead(AD8232_LO_PLUS) == HIGH);
  heartSignal = analogRead(AD8232_OUTPUT_PIN);
  
  // ------------------------------------------
  //  Beat Detection Algorithm
  // ------------------------------------------
  if (!leadsOff) {
    // Detect rising edge crossing threshold
    if (heartSignal > 2500 && lastSignal <= 2500 && !rising) {
      unsigned long now = millis();
      if (lastBeat > 0 && (now - lastBeat) > 300) {  // 300ms debounce (~200 BPM max)
        float interval = (now - lastBeat) / 1000.0;
        float instantBPM = 60.0 / interval;
        
        // Sanity check: 30-200 BPM range
        if (instantBPM >= 30 && instantBPM <= 200) {
          // Add to smoothing history
          bpmHistory[bpmHistoryIndex] = instantBPM;
          bpmHistoryIndex = (bpmHistoryIndex + 1) % BPM_HISTORY_SIZE;
          if (bpmHistoryCount < BPM_HISTORY_SIZE) bpmHistoryCount++;
          
          // Calculate smoothed BPM (average of history)
          float sum = 0;
          for (int i = 0; i < bpmHistoryCount; i++) {
            sum += bpmHistory[i];
          }
          bpm = sum / bpmHistoryCount;
        }
      }
      lastBeat = now;
      rising = true;
    }
    if (heartSignal < 2000) rising = false;
  } else {
    // Leads are off - don't reset BPM immediately (keep last valid reading briefly)
    // But if leads off for too long, BPM will naturally stale on server side
  }
  lastSignal = heartSignal;
  
  // ==========================================
  //  PRINT JSON AT INTERVAL
  // ==========================================
  if (millis() - lastPrint >= PRINT_INTERVAL) {
    lastPrint = millis();
    
    // ------------------------------------------
    //  Read MPU6050 Accelerometer (X, Y, Z)
    // ------------------------------------------
    float ax_ms2 = 0, ay_ms2 = 0, az_ms2 = 0;
    
    if (mpuReady) {
      Wire.beginTransmission(MPU6050_ADDR);
      Wire.write(MPU6050_ACCEL_XOUT_H);  // Start at register 0x3B
      Wire.endTransmission(false);
      Wire.requestFrom((uint8_t)MPU6050_ADDR, (uint8_t)6, (uint8_t)true);
      
      if (Wire.available() >= 6) {
        int16_t AcX = Wire.read() << 8 | Wire.read();
        int16_t AcY = Wire.read() << 8 | Wire.read();
        int16_t AcZ = Wire.read() << 8 | Wire.read();
        
        // Convert to m/s² (server expects m/s² for movement calculation)
        ax_ms2 = (AcX / ACCEL_SCALE) * GRAVITY_MS2;
        ay_ms2 = (AcY / ACCEL_SCALE) * GRAVITY_MS2;
        az_ms2 = (AcZ / ACCEL_SCALE) * GRAVITY_MS2;
      }
    }
    
    // ------------------------------------------
    //  Read MLX90614 Temperature
    // ------------------------------------------
    float ambientTemp = 0, bodyTemp = 0;
    
    if (mlxReady) {
      ambientTemp = mlx.readAmbientTempC();
      bodyTemp = mlx.readObjectTempC();
    }
    
    // ------------------------------------------
    //  Build JSON Output
    //  Format matches mindguard_server.py serial_thread() parser
    // ------------------------------------------
    Serial.print("{");
    
    // Accelerometer data (m/s²)
    Serial.print("\"accel\":{");
    Serial.print("\"x\":"); Serial.print(ax_ms2, 2);
    Serial.print(",\"y\":"); Serial.print(ay_ms2, 2);
    Serial.print(",\"z\":"); Serial.print(az_ms2, 2);
    Serial.print("}");
    
    // Temperature data (°C)
    Serial.print(",\"temp\":{");
    Serial.print("\"ambient\":"); Serial.print(ambientTemp, 1);
    Serial.print(",\"body\":"); Serial.print(bodyTemp, 1);
    Serial.print("}");
    
    // Heart rate data
    Serial.print(",\"heart\":{");
    Serial.print("\"signal\":"); Serial.print(heartSignal);
    Serial.print(",\"bpm\":"); Serial.print(bpm, 0);
    Serial.print(",\"leads_off\":"); Serial.print(leadsOff ? "true" : "false");
    Serial.print("}");
    
    Serial.println("}");
  }
  
  delay(10);  // Small delay for ADC stability (100Hz sampling for beat detection)
}
