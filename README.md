# 🩺 Dr. Nudge — AI-Powered Medication Adherence System

**Transform prescription chaos into simple, personalized adherence plans.**

Dr. Nudge is a real-time, full-stack medication management system that combines OCR, AI, drug safety APIs, and behavioral science to help patients understand and remember their medicines.

## ⚠️ IMPORTANT REQUIREMENTS

**This system requires an OpenAI API key for accurate prescription reading.** The Vision API (GPT-4o) is the primary extraction method and provides significantly better accuracy than pure OCR. Without it, the system falls back to Tesseract OCR which has limited accuracy on handwritten prescriptions (~20-40%).

**What you'll need:**
- ✅ OpenAI API key (required for Vision API - ~$0.01 per image)
- ✅ Supabase account (free tier available)
- ✅ Good quality prescription images (clear, well-lit, flat)
- ✅ Internet connection (for API calls)

---

## ⚡ Quick Start

### 1. Set Up Supabase Database
1. Create project at [supabase.com](https://supabase.com)
2. Run `supabase-schema.sql` in SQL Editor
3. Copy Project URL and API keys

### 2. Configure Environment
```bash
# Backend
cd backend
cp .env.example .env
# Edit .env and paste your SUPABASE_URL and SUPABASE_SERVICE_KEY

# Frontend
cd ../frontend
cp .env.example .env
# Edit .env and paste your SUPABASE_URL and SUPABASE_ANON_KEY
```

### 3. Install & Run
```bash
# Terminal 1: Backend
cd backend
npm install
node server.js

# Terminal 2: Frontend
cd frontend
npm install
npm start
```

Visit `http://localhost:3000` 🎉

---

## 🚀 Features

- **📸 AI-Powered Prescription Reading** — GPT-4 Vision + Tesseract.js OCR fallback
- **✅ Verification UI** — Manual confirmation and correction of extracted medications
- **💊 Smart Nudge Generation** — AI-generated behavioral nudges with readability checking (Grade 8 target)
- **🛡️ Enhanced Drug Safety** — RxNorm + OpenFDA + food interactions + age-based warnings + dosage alerts
- **📊 Real-Time Sync** — Supabase Realtime subscriptions
- **📱 Responsive Design** — Mobile → Tablet → Desktop adaptive layout
- **♿ Accessibility** — Elderly mode, text-to-speech, large fonts
- **🖼️ Image Preprocessing** — Sharp library for contrast enhancement, noise reduction, and optimization
- **📝 Plain Language Validation** — Flesch-Kincaid Grade Level checking, jargon detection
- **✏️ Full CRUD** — Edit, update, and delete medications with complete customization

---

## 🏗️ Tech Stack

**Frontend:** React 18, Tailwind CSS, Framer Motion, Supabase JS Client  
**Backend:** Node.js, Express, Tesseract.js, OpenAI GPT-4 Vision, Sharp, RxNorm API  
**Database:** Supabase (PostgreSQL + Realtime)  
**APIs:** RxNorm (drug validation), OpenFDA (interactions), OpenAI GPT-4o (Vision + text generation)  
**Image Processing:** Sharp (preprocessing, enhancement, optimization)

---

## 📖 Full Documentation

See [SETUP-GUIDE.md](./SETUP-GUIDE.md) for:
- Complete setup instructions
- Database schema details
- API endpoint documentation
- Troubleshooting guide
- Architecture overview

---

## 📊 Accuracy & Limitations

**Extraction Accuracy:**
- **Printed prescriptions (clear):** ~85% accuracy with GPT-4 Vision
- **Handwritten prescriptions (neat):** ~60-70% accuracy
- **Poor handwriting/lighting:** ~20-40% accuracy
- **Without OpenAI API key:** Tesseract-only fallback (~20-40%)

**Best Practices:**
- ✅ Use good lighting and a flat surface
- ✅ Ensure prescription is in focus
- ✅ Take photos straight-on (not at an angle)
- ✅ Always verify extracted data in confirmation modal

**Known Limitations:**
- OCR: English + Hindi only (not 7 languages)
- Drug interactions: Database may not be comprehensive
- Behavioral nudges: AI-generated, not clinically validated
- Requires internet connection
- Vision API cost: ~$0.01 per image

---

## 🔧 Recent Improvements

- ✅ Real image preprocessing (Sharp)
- ✅ Confirmation UI for verification
- ✅ Readability checking (Flesch-Kincaid)
- ✅ Enhanced safety (food/age/dosage warnings)
- ✅ Failed extraction feedback
- ✅ Full CRUD operations
- ✅ Jargon detection & simplification

---

## 🧪 Test the Pipeline

1. Complete onboarding (5 steps)
2. Scan a prescription image
3. Watch the AI pipeline: OCR → Extract → Safety Check → Nudge Generation
4. Add medications and track adherence
5. Open in multiple tabs to see real-time sync

---

## 📊 Database Tables

| Table | Purpose |
|-------|---------|
| `patients` | User profiles, onboarding data |
| `medications` | Prescribed drugs + nudge cards |
| `interactions` | Drug interaction warnings |
| `medication_logs` | Dose history for adherence tracking |
| `caregivers` | Family members for notifications |

---

## 🔐 Environment Variables

### Backend (.env)
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...
OPENAI_API_KEY=sk-...  # Optional, has fallbacks
```

### Frontend (.env)
```env
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGc...
REACT_APP_API_URL=http://localhost:5000/api
```

---

## 🛠️ Development

```bash
# Backend with auto-reload
cd backend
npm install -g nodemon
nodemon server.js

# Frontend with hot-reload
cd frontend
npm start
```

---

## 🚢 Deployment

**Frontend:** Vercel, Netlify  
**Backend:** Railway, Render, Fly.io  
**Database:** Already on Supabase (production-ready)

---

## 📝 License

MIT License — see LICENSE file

---

## 🙏 Credits

Built with:
- [Supabase](https://supabase.com) — Real-time database
- [RxNorm](https://www.nlm.nih.gov/research/umls/rxnorm/) — Drug interaction data
- [OpenFDA](https://open.fda.gov/) — FDA drug safety database
- [Tesseract.js](https://tesseract.projectnaptha.com/) — OCR engine
- [OpenAI](https://openai.com) — GPT-4 for drug extraction
- [Tailwind CSS](https://tailwindcss.com) — UI framework
- [Framer Motion](https://www.framer.com/motion/) — Animations

---

## 🐛 Issues?

Check [SETUP-GUIDE.md](./SETUP-GUIDE.md) Troubleshooting section or open an issue.

---

**Made with ❤️ for patients and caregivers**
