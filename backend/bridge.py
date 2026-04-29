import serial
import json
import time
import requests
import pyautogui
import os
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# ==============================
# CONFIG
# ==============================
SERIAL_PORT = os.getenv("SERIAL_PORT", "COM3")
BAUD_RATE = int(os.getenv("BAUD_RATE", 9600))

BASE_URL = os.getenv("FIREBASE_DB_URL", "https://synapselink-6c405-default-rtdb.asia-southeast1.firebasedatabase.app")
SIGNALS_URL = BASE_URL + "/signals.json"
THRESHOLDS_URL = BASE_URL + "/thresholds.json"
DIRECTION_URL = BASE_URL + "/direction.json"

# Cursor settings
MAX_SPEED = 25
MIN_SPEED = 3
DELAY = 0.05
FIREBASE_INTERVAL = 0.1

def init_serial():
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        time.sleep(2)
        logging.info(f"✅ Connected to Arduino on {SERIAL_PORT}")
        return ser
    except Exception as e:
        logging.error(f"❌ Serial error: {e}")
        exit()

def move_cursor(direction, speed):
    if direction == "UP":
        pyautogui.moveRel(0, -speed)
    elif direction == "DOWN":
        pyautogui.moveRel(0, speed)
    elif direction == "LEFT":
        pyautogui.moveRel(-speed, 0)
    elif direction == "RIGHT":
        pyautogui.moveRel(speed, 0)

def calculate_speed(strength):
    normalized = min(1.0, strength / 200)
    curved = normalized ** 2
    speed = int(curved * MAX_SPEED)
    if speed < MIN_SPEED:
        speed = MIN_SPEED
    return speed

def send_direction(direction):
    try:
        requests.put(DIRECTION_URL, json=direction, timeout=0.5)
    except requests.exceptions.RequestException as e:
        logging.debug(f"Failed to sync direction: {e}")

def main():
    pyautogui.FAILSAFE = True
    ser = init_serial()

    directions = ["UP", "RIGHT", "DOWN", "LEFT"]
    dir_index = 0

    last_blink = 0
    prev_blink = 0

    DEBOUNCE = 0.6
    DOUBLE_BLINK_WINDOW = 0.5

    eye_threshold = 500
    fist_threshold = 500

    last_threshold_fetch = 0
    last_firebase_send = 0

    logging.info("🚀 System running: Arduino → Firebase + Cursor + Direction Sync")

    while True:
        try:
            line = ser.readline().decode('utf-8', errors='ignore').strip()

            if not line or not line.startswith("{"):
                continue

            data = json.loads(line)
            eye = int(data.get("eye", 0))
            fist = int(data.get("fist", 0))

            logging.info(f"📊 Eye: {eye} | Fist: {fist}")

            # 1. SEND SIGNALS (RATE LIMITED)
            now = time.time()
            if now - last_firebase_send > FIREBASE_INTERVAL:
                try:
                    requests.put(SIGNALS_URL, json={"eye": eye, "fist": fist}, timeout=1)
                    logging.debug("☁️ Synced signals")
                except requests.exceptions.RequestException as e:
                    logging.warning(f"⚠️ Firebase issue: {e}")

                last_firebase_send = now

            # 2. FETCH THRESHOLDS
            if now - last_threshold_fetch > 1:
                try:
                    res = requests.get(THRESHOLDS_URL, timeout=1)
                    t = res.json()
                    if t:
                        eye_threshold = t.get("eye", eye_threshold)
                        fist_threshold = t.get("fist", fist_threshold)
                        logging.debug(f"🎯 Thresholds → Eye:{eye_threshold} Fist:{fist_threshold}")
                except requests.exceptions.RequestException:
                    pass

                last_threshold_fetch = now

            # 3. BLINK → CHANGE DIRECTION
            if eye > eye_threshold and (now - last_blink) > DEBOUNCE:
                if (now - prev_blink) < DOUBLE_BLINK_WINDOW:
                    logging.info("🖱️ DOUBLE BLINK → CLICK")
                    pyautogui.click()
                else:
                    dir_index = (dir_index + 1) % 4
                    current_direction = directions[dir_index]
                    logging.info(f"🔄 Direction: {current_direction}")
                    send_direction(current_direction)

                prev_blink = last_blink
                last_blink = now

            # 4. CONTINUOUS MOVEMENT
            if fist > fist_threshold:
                strength = fist - fist_threshold
                speed = calculate_speed(strength)
                direction = directions[dir_index]
                logging.info(f"🚀 MOVE → {direction} | Speed: {speed}")
                move_cursor(direction, speed)

            time.sleep(DELAY)

        except json.JSONDecodeError:
            logging.warning("⚠️ Invalid JSON skipped")
        except serial.SerialException as e:
            logging.error(f"❌ Serial disconnected: {e}")
            break
        except Exception as e:
            logging.error(f"❌ Unexpected Error: {e}")

if __name__ == "__main__":
    main()
