# Google Form AutoFiller (Customized Automation Tool)

A lightweight, high-performance Node.js automation tool that programmatically fills out and submits Google Forms using direct HTTP requests (`/formResponse` POST requests) rather than heavy browser automation tools like Puppeteer or Selenium.

This customized version includes **anti-detection features**, **grid-question bypassing**, **User-Agent rotation**, and an **automated loop script with a built-in timer**.

---

## 🚀 Key Features

* **Direct HTTP Requests:** Parses form metadata (`FB_PUBLIC_LOAD_DATA` and `fbzx` session tokens) and submits payloads instantly via HTTP.
* **Smart Field Support:** Automatically populates:
  * Short & Long Answer text fields (via `config.js`)
  * Multiple Choice, Dropdowns, Linear Scales, and Star Ratings (with randomized options)
  * Checkboxes (with support for validation rules and random selections)
  * Dates and Times (automatically generated random values)
* **Anti-Bot Protection:** 
  * Rotates modern browser `User-Agent` headers randomly on every run.
  * Uses randomized jitter delays and simulated human "think times" between submissions.
* **Automated Looping:** Includes a timed loop script (`loop.js`) that runs autonomously and shuts down automatically after 30 minutes.

---

## 🛠️ Project Structure

* **`config.js`** — Central configuration file where you set your target Google Form URL and static text responses.
* **`assets.js`** — Core utility library handling form extraction, question-type parsing (including Type 7 grid-question bypass), and UA-rotated HTTP POST submission.
* **`loop.js`** — Automated multi-run script featuring randomized delays, human-like interaction timing, and an automatic 30-minute stop timer.

---

## 📦 Quick Setup & Installation

### Prerequisites
* **Node.js** (v18 or higher installed on your system)

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone [https://github.com/BlaizerBrumo/Google-Form-AutoFiller.git](https://github.com/BlaizerBrumo/Google-Form-AutoFiller.git)
cd Google-Form-AutoFiller
npm install