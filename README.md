# Unfair: AI Ethics Chrome Extension

## 🎯 Project Summary & Value
**Unfair** is a full-stack tool designed to monitor and visualize how AI tools are used during academic assignments. It consists of a Chrome extension that tracks copy/paste events and browser behavior, paired with a Python backend to store and analyze the data.

**Why I found this valuable:** 
Developing this project allowed me to build a complete, end-to-end product architecture. I gained deep hands-on experience with the Chrome Extensions API (Manifest V3), asynchronous JavaScript for client-side monitoring, and backend API design using Python and SQLite. It challenged me to think critically about system architecture, data flow, and building a user-centric dashboard to display complex analytical metrics in real-time.


Unfair is a full-stack tool designed to monitor and visualize how AI tools are used during academic assignments. It consists of a Chrome extension that tracks copy/paste events and browser behavior, paired with a Python backend to store and analyze the data.

## ?? Features
*   **Browser Monitoring:** Tracks copy, paste, and tab-switching behavior to detect potentially unethical use of AI text generators.
*   **Popup Dashboard:** A clean HTML/JS popup interface providing real-time feedback to the user.
*   **Data Aggregation:** Python backend (using SQLite) that logs events and stores usage metrics securely.
*   **Customizable Detection:** Flexible copyPasteDetector.js logic to identify large blocks of suspiciously acquired text.

## ??? Tech Stack
*   **Client:** JavaScript, HTML, CSS (Chrome Extensions API V3)
*   **Server:** Python (Flask/FastAPI), SQLite
*   **Other:** .env configuration for secure API access

## ?? Setup and Installation

### 1. Backend Server Setup
\\\ash
cd server
pip install -r requirements.txt
cp .env.example .env # Configure your environment variables
python main.py
\\\

### 2. Chrome Extension Setup
1. Open Google Chrome and navigate to \chrome://extensions/\.
2. Enable **Developer mode** in the top right corner.
3. Click **Load unpacked** and select the \client/public\ folder in this repository.
4. The extension should now be active and visible in your browser toolbar!

## ?? Architecture overview
See [architecture docs](docs/architecture.md) or the [Index](INDEX.md) for more details.
