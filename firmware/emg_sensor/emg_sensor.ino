/*
  SynapseLink EMG Arduino Sketch (OPTIMIZED FINAL + HIGH SENSITIVITY)

  ✔ Smooth signal output
  ✔ Clean JSON format
  ✔ Stable ~20Hz
  ✔ Works with or without EMG sensor
  ✔ Increased sensitivity in software
*/

const int eyePin  = A0;
const int fistPin = A1;

const int BAUD_RATE = 9600;
const int DELAY_MS  = 50;   // 20 Hz

// Smoothing factor (0 = no smoothing, 1 = very slow)
const float alpha = 0.2;

// Smoothed values
float eyeSmooth  = 500;
float fistSmooth = 500;

// Sensitivity amplification factor
const float SENSITIVITY_MULTIPLIER = 1.5;  // Increase to make small signals more detectable

// Optional baseline shift (lower the resting level)
const int BASELINE_SHIFT = -50;  // subtract from smoothed value to detect smaller contractions

void setup() {
  Serial.begin(BAUD_RATE);
  delay(1000);
  Serial.println("Arduino EMG ready (High Sensitivity)");
}

void loop() {
  // Raw readings
  int eyeRaw  = analogRead(eyePin);
  int fistRaw = analogRead(fistPin);

  // Apply smoothing (low-pass filter)
  eyeSmooth  = alpha * eyeRaw  + (1 - alpha) * eyeSmooth;
  fistSmooth = alpha * fistRaw + (1 - alpha) * fistSmooth;

  // Apply sensitivity adjustments
  int eyeValue  = (int)((eyeSmooth + BASELINE_SHIFT) * SENSITIVITY_MULTIPLIER);
  int fistValue = (int)((fistSmooth + BASELINE_SHIFT) * SENSITIVITY_MULTIPLIER);

  // Ensure values stay within 0-1023
  eyeValue  = constrain(eyeValue, 0, 1023);
  fistValue = constrain(fistValue, 0, 1023);

  // Send JSON
  Serial.print("{\"eye\":");
  Serial.print(eyeValue);
  Serial.print(",\"fist\":");
  Serial.print(fistValue);
  Serial.println("}");

  delay(DELAY_MS);
}