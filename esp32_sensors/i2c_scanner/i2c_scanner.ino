/*
  I2C Scanner for ESP32
  Scans all I2C addresses (0x01-0x7F) and reports found devices
  SDA = GPIO21, SCL = GPIO22
*/

#include <Wire.h>

void setup() {
  Serial.begin(115200);
  while (!Serial) delay(10);
  
  Wire.begin(21, 22);  // SDA, SCL
  
  Serial.println("\n========================================");
  Serial.println("       ESP32 I2C Bus Scanner");
  Serial.println("  SDA=GPIO21, SCL=GPIO22");
  Serial.println("========================================\n");
}

void loop() {
  Serial.println("Scanning I2C bus...\n");
  
  byte deviceCount = 0;
  
  for (byte address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    byte error = Wire.endTransmission();
    
    if (error == 0) {
      Serial.print("Device found at address 0x");
      if (address < 16) Serial.print("0");
      Serial.print(address, HEX);
      Serial.print(" (");
      Serial.print(address);
      Serial.print(") - ");
      
      // Identify common sensors
      switch(address) {
        case 0x1D: Serial.println("ADXL345 (ALT)"); break;
        case 0x53: Serial.println("ADXL345 (DEFAULT)"); break;
        case 0x5A: Serial.println("MLX90614"); break;
        case 0x5B: Serial.println("MLX90614 (ALT)"); break;
        case 0x68: Serial.println("MPU6050 / DS3231"); break;
        case 0x69: Serial.println("MPU6050 (ALT)"); break;
        case 0x76: Serial.println("BME280 / BMP280"); break;
        case 0x77: Serial.println("BME280 / BMP280 (ALT)"); break;
        case 0x3C: Serial.println("SSD1306 OLED"); break;
        case 0x3D: Serial.println("SSD1306 OLED (ALT)"); break;
        case 0x27: Serial.println("PCF8574 / LCD"); break;
        case 0x20: Serial.println("PCF8574A"); break;
        default: Serial.println("Unknown device"); break;
      }
      deviceCount++;
    }
    else if (error == 4) {
      Serial.print("Error at address 0x");
      if (address < 16) Serial.print("0");
      Serial.println(address, HEX);
    }
  }
  
  Serial.println();
  if (deviceCount == 0) {
    Serial.println("*** No I2C devices found! ***");
    Serial.println("Check wiring:");
    Serial.println("  - VCC/VIN connected to 3.3V");
    Serial.println("  - GND connected");
    Serial.println("  - SDA to GPIO21");
    Serial.println("  - SCL to GPIO22");
  } else {
    Serial.print("Found ");
    Serial.print(deviceCount);
    Serial.println(" device(s)");
  }
  
  Serial.println("\n--- Rescanning in 5 seconds ---\n");
  delay(5000);
}
