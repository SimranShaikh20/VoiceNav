# ⚡ VoiceNav — Universal Web Automation Agent

> 
> *"Your AI hands on the internet. Speak any task. Watch it happen."*

---

## 🏆 Hackathon Alignment

| Challenge Requirement | VoiceNav Implementation | Status |
|---|---|---|
| Gemini Multimodal | Screenshots sent to Gemini Vision for UI understanding | ✅ |
| Gemini Live API | Real-time voice input and spoken responses | ✅ |
| Google ADK | Agent orchestration and planning loop | ✅ |
| Google GenAI SDK | All Gemini API calls via official SDK | ✅ |
| Google Cloud Hosting | Backend on Google Cloud Run | ✅ |
| No DOM/API dependency | Pure visual screenshot analysis only | ✅ |
| Executable actions | CLICK, TYPE, SCROLL, PRESS commands | ✅ |
| Breaks text-box paradigm | Voice in → screen actions out | ✅ |
| Live & context-aware | Continuous screenshot-verify loop | ✅ |

---

## 🔴 The Problem

Every day, millions of people waste hours on **repetitive, manual web tasks**:

- Searching multiple sites to compare prices
- Filling the same forms over and over
- Copying data between websites and apps
- Navigating complex software they don't fully understand

**Existing solutions are broken:**

- Browser extensions only work on specific sites
- Selenium/Playwright requires coding knowledge
- RPA tools cost thousands and break when websites update
- Regular AI can *talk* about tasks but cannot *do* them
- All tools rely on DOM access — they break every time a site redesigns

**Result:** Non-technical users have zero access to automation. Businesses pay huge amounts for tools that constantly break.

---

## ✅ The Solution

**VoiceNav** is your AI hands on the internet.

You speak. The agent sees your screen, plans the steps, and executes — entirely through **visual understanding** of screenshots. No DOM access. No website-specific APIs. Works on any website, any app, any platform.

```
User speaks → Gemini hears → Agent plans → Gemini sees screen → Agent acts → Verifies result
```

---

## 🏗 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER'S DEVICE                            │
│                                                                 │
│   🎤 Microphone                        🖥️  Screen               │
│       │                                    │                    │
│       ▼                                    ▼                    │
│   Web Speech API                    Screenshot Capture          │
│   (voice → text)                    (PyAutoGUI / Playwright)    │
│       │                                    │                    │
│       └──────────────┬─────────────────────┘                    │
│                      │                                          │
│              WebSocket / REST API                               │
└──────────────────────┼──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                   GOOGLE CLOUD RUN (Backend)                    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   ADK AGENT LOOP                        │   │
│  │                                                         │   │
│  │  LISTEN → PLAN → OBSERVE → DECIDE → ACT → VERIFY       │   │
│  │     │        │       │        │       │       │         │   │
│  │     ▼        ▼       ▼        ▼       ▼       ▼         │   │
│  │  Voice    Break   Take    Choose   Run    Check          │   │
│  │  Input    into   Screen   Next   Action  Result         │   │
│  │         Steps   Shot    Action                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│            │                    │                               │
│            ▼                    ▼                               │
│   ┌─────────────────┐  ┌─────────────────────┐                 │
│   │ Gemini Live API │  │  Gemini Vision API  │                 │
│   │ (voice I/O)     │  │  (screenshot → UI   │                 │
│   │                 │  │   understanding)    │                 │
│   └─────────────────┘  └─────────────────────┘                 │
│                                                                 │
│   ┌─────────────────┐  ┌─────────────────┐                     │
│   │  Cloud Storage  │  │ Cloud Logging   │                     │
│   │  (screenshots)  │  │ (action audit)  │                     │
│   └─────────────────┘  └─────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React)                           │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Voice Button │  │ Screen View  │  │    Action Log        │  │
│  │ (mic input + │  │ (live agent  │  │ (step-by-step trace) │  │
│  │  TTS output) │  │  view)       │  │                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔁 Agent Execution Loop

```
┌─────────────┐
│  STEP 1     │  User speaks command via microphone
│  LISTEN     │  Gemini Live API transcribes in real-time
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  STEP 2     │  Break task into ordered sub-steps
│  PLAN       │  Identify info needed from user upfront
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  STEP 3     │  Take screenshot of current screen
│  OBSERVE    │  Gemini Vision identifies all UI elements
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  STEP 4     │  Pick the best next single action
│  DECIDE     │  Handle blockers: CAPTCHA, login walls, errors
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  STEP 5     │  Execute: CLICK(x,y) / TYPE(text) /
│  ACT        │  SCROLL(dir) / PRESS(key) / WAIT(sec)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  STEP 6     │  Take new screenshot
│  VERIFY     │  Did the action work? If yes → next step
└──────┬──────┘  If no → retry or re-plan
       │
       ▼
┌─────────────┐
│  STEP 7     │  Before irreversible actions:
│  CONFIRM    │  Speak summary → wait for "yes"
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  STEP 8     │  Speak task summary to user
│  DONE       │  Show results with clickable links
└─────────────┘
```

---

## 📦 Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React | UI framework |
| Web Speech API | Voice input (microphone) |
| SpeechSynthesis API | Voice output (TTS) |
| WebSocket | Real-time communication with backend |

### Backend (Google Cloud)
| Technology | Purpose |
|---|---|
| **Google Cloud Run** | Hosts the agent backend (serverless, auto-scaling) |
| **Gemini Live API** | Real-time voice input and spoken response output |
| **Gemini Vision (gemini-2.0-flash)** | Screenshot analysis and UI element identification |
| **Google ADK** | Agent orchestration, planning loop, tool management |
| **Google GenAI SDK** | All Gemini API calls |
| **Google Cloud Storage** | Temporary screenshot storage during task execution |
| **Google Cloud Logging** | Action audit trail and debugging |
| **Secret Manager** | Secure API key storage |

### Action Execution
| Technology | Purpose |
|---|---|
| PyAutoGUI | Mouse clicks and keyboard input |
| Playwright | Browser-level automation fallback |
| PIL / Pillow | Screenshot capture and processing |

---

## 🎯 Judging Criteria Breakdown

### Innovation & Multimodal UX (40%)

VoiceNav completely eliminates the text box. The entire interaction is:

- **Input:** User's real voice (microphone)
- **Processing:** Gemini sees the screen like a human would
- **Output:** Real physical actions on screen + spoken narration

The agent has a distinct persona, narrates every step aloud, handles interruptions gracefully, and is context-aware — it re-plans dynamically when something unexpected appears on screen.

### Technical Implementation (30%)

- Uses **Google ADK** for the full agent orchestration loop
- Uses **Gemini Live API** for real-time bidirectional voice
- Uses **Gemini multimodal** for pure visual screen understanding
- Backend deployed on **Google Cloud Run** with auto-scaling
- Screenshots stored in **Cloud Storage**, actions logged in **Cloud Logging**
- Error handling: retries, re-planning, CAPTCHA detection, login wall handling
- Safe mode: confirms before any irreversible action

### Demo & Presentation (30%)

- 4-minute demo video showing real task execution end-to-end
- Architecture diagram included in this README
- Cloud deployment proof via Cloud Run console recording
- Clear problem → solution narrative

---

## 🗣️ Example Voice Commands

```
"Go to Amazon and find the best wireless headphones under $100"

"Open Gmail and find the latest invoice from my supplier"

"Search flights from Mumbai to London in April under $800"

"Go to LinkedIn and find remote Python developer jobs posted this week"

"Find hotels in Goa under ₹3000 per night on Booking.com"

"Go to Flipkart and compare iPhone 15 vs Samsung S24 prices"

"Open YouTube and search for 'learn React in 2025'"
```

---

## 🛡️ Safety Rules

VoiceNav is built with safety as a core principle:

- **NEVER** completes a purchase without explicit voice confirmation
- **NEVER** submits any form without showing the user what will be sent
- **NEVER** stores, logs, or repeats passwords or sensitive data
- **NEVER** clicks ads or suspicious popups unless explicitly asked
- **STOPS** and asks for help after 3 failed actions in a row
- **SAFE MODE** toggle — always on by default

---

## 🚀 Setup & Spin-up Instructions

### Prerequisites
- Google Cloud account
- Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)
- Node.js 18+
- Python 3.10+

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/voicenav
cd voicenav
```

### 2. Install dependencies
```bash
# Frontend
cd frontend
npm install

# Backend
cd ../backend
pip install -r requirements.txt
```

### 3. Set environment variables
```bash
export GEMINI_API_KEY=your_api_key_here
export GOOGLE_CLOUD_PROJECT=your_project_id
```

### 4. Deploy backend to Google Cloud Run
```bash
gcloud run deploy voicenav-backend \
  --source ./backend \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=$GEMINI_API_KEY
```

### 5. Run frontend locally
```bash
cd frontend
npm start
```

### 6. Open in Chrome
```
http://localhost:3000
```
> ⚠️ Voice features work best on **Chrome** or **Edge** browsers.

---

## 🏗 Google Cloud Architecture Proof

The following Google Cloud services are used and verifiable in the GCP console:

- **Cloud Run** — `voicenav-backend` service in `us-central1`
- **Cloud Storage** — bucket `voicenav-screenshots` for temp screenshot storage
- **Cloud Logging** — log name `voicenav-actions` for full action audit trail
- **Secret Manager** — secret `gemini-api-key` for secure key storage
- **Artifact Registry** — Docker image `voicenav-backend:latest`

---

## 📹 Demo Video

[Link to demo video — shows real-time task execution with voice input, screen understanding, and action execution]

---

## 📊 Bonus Points Completed

- [x] Published blog post about building with Google AI — #GeminiLiveAgentChallenge
- [x] Cloud deployment automated with `cloudbuild.yaml` (infrastructure-as-code)
- [x] Google Developer Group profile: [link]


---

## 📄 License

MIT License — see LICENSE file for details.
