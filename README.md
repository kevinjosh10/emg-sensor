<div align="center">

# 🧠 SynapseLink EMG Sensor System

**A modular, real-time Electromyography (EMG) interface connecting human muscle signals to digital environments.**

![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Arduino](https://img.shields.io/badge/Arduino-00979D?style=for-the-badge&logo=arduino&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)
![Status: Active](https://img.shields.io/badge/Status-Active-success?style=for-the-badge)

</div>

---

## 📖 Project Overview

**SynapseLink** is an end-to-end open-source system designed to capture, process, and act upon human muscle signals. By detecting specific muscle contractions (like an eye blink or a fist clench), the system maps these signals to computer inputs via an Arduino micro-controller and a Python backend.

**The Problem It Solves:**
Traditional accessibility and experimental input devices can be prohibitively expensive or complex to integrate. SynapseLink provides an affordable, extensible, and visually appealing way to map physiological inputs to direct computer controls using accessible components and open web standards.

**Why It Matters:**
This opens up new possibilities for:
- **Accessibility:** Hands-free cursor control and clicking.
- **Human-Computer Interaction (HCI):** Researching new modalities for user interfaces.
- **Gaming:** Exploring alternative game input controllers.

---

## ✨ Features

- **Real-Time Signal Processing:** Captures high-frequency analog signals (~20Hz) from an Arduino.
- **Smart Smoothing:** Implements low-pass filtering and baseline shift for noise reduction and high-sensitivity detection.
- **Firebase Sync:** Pushes and pulls data, events, and configuration dynamically through Firebase Realtime Database.
- **PC Cursor Control:** Translates muscle movements into variable-speed cursor actions and clicks using Python's `pyautogui`.
- **Beautiful Dashboard:** Features a modern, dark-themed, glassmorphic UI built with HTML/CSS and Chart.js to visualize live EMG data and history.

---

## 🛠️ Tech Stack

- **Hardware:** Arduino Uno/Nano, Analog EMG Sensors.
- **Firmware:** C++ (Arduino IDE)
- **Backend:** Python 3, PySerial, PyAutoGUI, Requests
- **Frontend:** Vanilla JavaScript (ES6 Modules), CSS3, Chart.js
- **Database:** Firebase Realtime Database

---

## 📂 Project Structure

```text
emg-sensor/
│
├── backend/
│   ├── bridge.py              # Python script connecting Arduino to PC and Firebase
│   └── requirements.txt       # Python dependencies
│
├── firmware/
│   └── emg_sensor/
│       └── emg_sensor.ino     # High-sensitivity Arduino sketch
│
├── frontend/
│   ├── index.html             # The main Web Dashboard
│   ├── css/
│   │   └── style.css          # Design system and UI styling
│   └── js/
│       ├── config.js          # Firebase & app configuration
│       ├── firebase-service.js# Firebase initialization and helpers
│       └── main.js            # Core dashboard logic and charting
│
├── docs/
│   └── database-schema.json   # Documentation of Firebase data structure
│
├── .env.example               # Template for environment variables
├── .gitignore                 # Git ignore configuration
└── README.md                  # This file
```

---

## 🚀 Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/emg-sensor.git
cd emg-sensor
```

### 2. Hardware Setup
- Upload `firmware/emg_sensor/emg_sensor.ino` to your Arduino using the Arduino IDE.
- Ensure your EMG sensors are connected to pins `A0` (Eye) and `A1` (Fist).

### 3. Backend Setup
Create a Python virtual environment, install the dependencies, and set up your `.env` file.

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in the root of the project (use `.env.example` as a template):
```env
SERIAL_PORT=COM3
BAUD_RATE=9600
FIREBASE_DB_URL=https://your-project.firebaseio.com
```

### 4. Frontend Setup
- Open `frontend/js/config.js` and insert your Firebase API keys.
- You can run the dashboard locally using any simple HTTP server (e.g., Live Server extension in VSCode or `npx serve frontend`).

### 5. Run the System
Start the Python bridge to begin receiving signals from the Arduino and pushing them to your computer and Firebase.
```bash
cd backend
python bridge.py
```

---

## 💻 Usage

Once running:
- **Eye Blink:** A quick spike on the Eye channel changes the direction of movement. A double-blink triggers a mouse click.
- **Fist Clench:** A sustained spike on the Fist channel moves the mouse cursor in the currently selected direction. The harder the clench, the faster the cursor moves!
- **Dashboard:** Monitor the live charts on the web interface, tweak detection thresholds dynamically, and review the event logs.

---

## 🔮 Future Improvements

- **Machine Learning Integration:** Replace hardcoded thresholds with lightweight classification models (e.g., TensorFlow Lite) for gesture recognition.
- **Web Bluetooth:** Migrate the Python bridge entirely into the browser using the Web Serial API or Web Bluetooth for a 100% web-based solution.
- **User Profiles:** Add user authentication to allow multiple users to save their specific threshold profiles.
- **Native Applications:** Package the web dashboard using Electron or Tauri for a standalone desktop application.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.

---
<div align="center">
  <sub>Built with ❤️ for better Human-Computer Interaction.</sub>
</div>
