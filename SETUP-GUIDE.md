# 🩺 Dr. Nudge — Full-Stack Setup Guide

## 🎯 What You've Built

**Dr. Nudge** is now a **fully functional real-time medication adherence system** with:

- ✅ **OCR-powered prescription scanning** (Tesseract.js + OpenAI GPT-4)
- ✅ **Real-time Supabase database** (PostgreSQL with live subscriptions)
- ✅ **Drug interaction checking** (RxNorm API + OpenFDA)
- ✅ **Behavioral nudge generation** (EAST Framework)
- ✅ **Responsive design** (Mobile → Tablet → Desktop)
- ✅ **Patient-first UX** (Onboarding → Scan → Track → Alerts)

---

## 🚀 STEP 1: Set Up Supabase Database

### 1.1 Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign up/login
2. Click **"New Project"**
3. Fill in:
   - **Name**: `dr-nudge`
   - **Database Password**: (generate a strong password)
   - **Region**: Choose closest to you
4. Click **"Create new project"** and wait 2-3 minutes

### 1.2 Run the Database Schema

1. In your Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **"New query"**
3. Copy the entire contents of `supabase-schema.sql` in the project root
4. Paste it into the SQL editor
5. Click **"Run"** — you should see "Success. No rows returned"

### 1.3 Get Your API Keys

1. Go to **Settings → API** (left sidebar)
2. Copy these two values:
   - **Project URL** (e.g., `https://abcdefg.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)
   - **service_role** key (KEEP THIS SECRET — only for backend)

---

## 🔧 STEP 2: Configure Environment Variables

### 2.1 Backend Configuration

Edit `backend/.env` and fill in your credentials:

```env
PORT=5000
NODE_ENV=development

# Supabase — PASTE YOUR VALUES HERE
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...your-service-role-key

# OpenAI (optional — fallback extraction works without it)
OPENAI_API_KEY=sk-...your-openai-key-or-leave-as-demo-key

# RxNorm API (free, no key needed)
RXNORM_BASE_URL=https://rxnav.nlm.nih.gov/REST
```

### 2.2 Frontend Configuration

Edit `frontend/.env` and fill in:

```env
# Supabase — PASTE YOUR VALUES HERE
REACT_APP_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGc...your-anon-public-key

# Backend API
REACT_APP_API_URL=http://localhost:5000/api
```

---

## 🏃 STEP 3: Install Dependencies & Run

### 3.1 Backend

```powershell
cd backend
npm install
node server.js
```

You should see:
```
🩺 Dr. Nudge API v2.0 running on http://localhost:5000
   Health check: http://localhost:5000/api/health
   Database: Supabase ✅
```

### 3.2 Frontend

Open a **new terminal**:

```powershell
cd frontend
npm install
npm start
```

The app should open at `http://localhost:3000`

---

## 🧪 STEP 4: Test the Full Pipeline

### 4.1 Onboarding Flow

1. Open `http://localhost:3000`
2. Complete the 5-step onboarding:
   - Choose language
   - Enter your name
   - Select your routine
   - Choose motivation
   - Click "Let's go!"
3. **✅ Check Supabase**: Go to **Table Editor → patients** — you should see your new patient row

### 4.2 Scan a Prescription

1. Click the **Scan** tab
2. Upload a prescription image (or take a photo)
3. Wait for the pipeline to run:
   - 📤 Upload
   - 🔍 OCR
   - 💊 Drug extraction
   - 🛡️ Safety check
   - ✨ Nudge generation
4. Review the results and click **"Add to my medicines"**
5. **✅ Check Supabase**: Go to **Table Editor → medications** — your drug should be there

### 4.3 Track Medications

1. Click **"My Meds"** tab
2. You should see the medication from the scan
3. Click **"I took it"** — the button should change to a checkmark
4. **✅ Check Supabase**: The `taken_today` field should now be `true` in the medications table

### 4.4 Safety Alerts

1. Click **"Safety"** tab
2. You should see any interactions found during the scan
3. Alerts are color-coded:
   - 🔴 **RED**: High-severity interaction
   - 🟡 **YELLOW**: Moderate interaction
   - 🟢 **GREEN**: No issues

### 4.5 Real-Time Sync

1. Open your app in **two browser tabs**
2. In Tab 1: Mark a medication as taken
3. In Tab 2: The medication should **instantly update** (no page refresh needed)
4. This is Supabase Realtime working!

---

## 📊 What's in the Database

### Tables Created

1. **patients** — User profiles (name, language, routine, motivation)
2. **medications** — All prescribed drugs with nudge cards
3. **interactions** — Drug interaction warnings
4. **medication_logs** — History of doses taken (for adherence tracking)
5. **caregivers** — Family members who get notifications

### Real-Time Subscriptions

The frontend automatically subscribes to changes in:
- medications
- interactions
- caregivers

Any change made (even from another device) will instantly reflect in the UI.

---

## 🔥 Key Features Now Working

### 1. OCR → AI Pipeline
- Upload prescription image
- Tesseract.js extracts text (English + Hindi)
- OpenAI GPT-4 parses drug data (with regex fallback)
- RxNorm API checks interactions
- EAST Framework generates behavioral nudges

### 2. Database Persistence
- All data saved to Supabase PostgreSQL
- CRUD operations for patients, medications, interactions
- Adherence tracking with streak counters
- Medication logs for dose history

### 3. Real-Time Updates
- Live subscriptions via Supabase Realtime
- Instant UI updates when data changes
- Multi-device sync (same patient across multiple browsers)

### 4. Responsive Design
- Mobile-first: Bottom nav, vertical stack
- Tablet: 2-column grids
- Desktop (1024px+): Sidebar nav, 3-column grids
- Elderly mode: Larger fonts, higher contrast

### 5. Safety System
- 3-tier flagging: RED (critical) / YELLOW (moderate) / GREEN (safe)
- RxNorm drug interaction checking
- Dietary interaction warnings (grapefruit, alcohol, etc.)
- OpenFDA fallback database

---

## 🛠️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (React 18 + Tailwind CSS)                         │
│  ├─ src/context/AppContext.jsx   (Supabase client + state) │
│  ├─ src/services/api.js          (Backend API calls)        │
│  ├─ src/lib/supabase.js          (Supabase init)            │
│  └─ components/                                              │
│     ├─ Onboarding.jsx            (5-step flow)              │
│     ├─ ScanPage.jsx              (OCR pipeline)             │
│     ├─ HomePage.jsx              (Dashboard)                │
│     ├─ MedsPage.jsx              (Medication list)          │
│     ├─ AlertsPage.jsx            (Safety alerts)            │
│     └─ ProfilePage.jsx           (Settings)                 │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ HTTP + Realtime WebSocket
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  BACKEND (Node.js + Express)                                │
│  ├─ server.js                    (API routes)               │
│  ├─ services/ocrService.js       (Tesseract OCR)            │
│  ├─ services/drugService.js      (RxNorm + OpenFDA)         │
│  ├─ services/nudgeService.js     (EAST Framework)           │
│  └─ services/llmService.js       (OpenAI GPT-4)             │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ SQL + Realtime
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  SUPABASE (PostgreSQL + Realtime)                           │
│  ├─ patients                                                 │
│  ├─ medications                                              │
│  ├─ interactions                                             │
│  ├─ medication_logs                                          │
│  └─ caregivers                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎨 Design System

### Colors
- **Brand**: `#1A1A1A` (deep charcoal)
- **Surface**: `#F7F7F5` (warm off-white)
- **Safety RED**: `#DC2626`
- **Safety YELLOW**: `#F59E0B`
- **Safety GREEN**: `#16A34A`

### Typography
- **Body**: Inter (16px → 18px on desktop)
- **Headlines**: Plus Jakarta Sans (bold, tight tracking)

### Responsive Breakpoints
- Mobile: `< 640px`
- Tablet: `640px → 1024px`
- Desktop: `≥ 1024px`

---

## 🐛 Troubleshooting

### Backend won't start
- **Error**: `Database: Supabase ⚠️ not configured`
- **Fix**: Make sure you filled in `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in `backend/.env`

### Frontend shows "Missing Supabase config"
- **Fix**: Check `frontend/.env` — make sure `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY` are set

### OCR returns "CLARIFICATION_NEEDED"
- **Cause**: Image is too blurry or text is illegible
- **Fix**: Take a clearer photo with good lighting, or enable OpenAI key for better extraction

### Medications not appearing after scan
- **Check**: Open browser DevTools → Console — look for errors
- **Common issue**: CORS error → make sure backend is running on port 5000

### Real-time updates not working
- **Check**: Supabase dashboard → Database → Replication → make sure realtime is enabled for medications, interactions, caregivers tables
- **Run this SQL** if needed:
  ```sql
  alter publication supabase_realtime add table medications;
  alter publication supabase_realtime add table interactions;
  alter publication supabase_realtime add table caregivers;
  ```

---

## 🚢 Next Steps (Optional Enhancements)

### 1. Deploy to Production
- **Frontend**: Vercel or Netlify
- **Backend**: Railway, Render, or Fly.io
- **Database**: Already on Supabase (production-ready)

### 2. Add Notifications
- Push notifications via Supabase Edge Functions
- SMS reminders via Twilio
- Email alerts via SendGrid

### 3. Caregiver Dashboard
- Separate view for family members
- Real-time adherence monitoring
- Alert forwarding

### 4. Voice Commands
- Integrate Web Speech API
- "Hey Dr. Nudge, did I take my metformin?"

### 5. Multi-Language Support
- Use Google Translate API
- Pre-translate nudge templates
- OCR for Hindi, Tamil, Telugu prescriptions

---

## 📝 File Structure

```
PROBLEM-2/
├── supabase-schema.sql          ← Run this in Supabase SQL Editor
├── backend/
│   ├── .env                     ← Your Supabase + OpenAI keys
│   ├── .env.example
│   ├── server.js                ← Express API with Supabase
│   ├── package.json
│   └── services/
│       ├── ocrService.js
│       ├── drugService.js
│       ├── nudgeService.js
│       └── llmService.js
└── frontend/
    ├── .env                     ← Your Supabase keys
    ├── .env.example
    ├── package.json
    ├── tailwind.config.js
    ├── src/
    │   ├── index.js
    │   ├── index.css
    │   ├── App.jsx
    │   ├── lib/
    │   │   └── supabase.js      ← Supabase client
    │   ├── services/
    │   │   └── api.js           ← Backend API wrapper
    │   ├── context/
    │   │   └── AppContext.jsx   ← Global state + Supabase
    │   └── components/
    │       ├── Onboarding.jsx
    │       ├── HomePage.jsx
    │       ├── ScanPage.jsx
    │       ├── MedsPage.jsx
    │       ├── AlertsPage.jsx
    │       ├── ProfilePage.jsx
    │       ├── MedDetailModal.jsx
    │       ├── BottomNav.jsx
    │       └── DesktopSidebar.jsx
```

---

## ✅ Verification Checklist

- [ ] Supabase project created
- [ ] SQL schema executed successfully
- [ ] `backend/.env` configured with Supabase keys
- [ ] `frontend/.env` configured with Supabase keys
- [ ] Backend server running on port 5000
- [ ] Frontend app running on port 3000
- [ ] Onboarding creates a patient in Supabase
- [ ] Prescription scan adds medication to database
- [ ] "I took it" button updates `taken_today` in database
- [ ] Real-time sync working across multiple browser tabs
- [ ] Safety alerts appear on AlertsPage
- [ ] Responsive design works on mobile/tablet/desktop

---

## 🎉 Congratulations!

You now have a **production-ready medication adherence system** with:

- Real database persistence (Supabase PostgreSQL)
- Live real-time updates (WebSocket subscriptions)
- AI-powered prescription reading (OCR + LLM)
- Drug safety checking (RxNorm + OpenFDA)
- Behavioral nudges (EAST Framework)
- Fully responsive UI (Mobile → Desktop)

**All the mock data is gone** — everything is now **real-time and fully functional**! 🚀
