# Dr. Nudge: AI-Powered Medication Adherence System  
Transform prescription chaos into simple, personalized adherence plans.

Dr. Nudge is a real-time, full-stack medication management system that combines OCR, AI, drug safety APIs, and behavioral science to help patients understand and remember their medicines.

---

## IMPORTANT REQUIREMENTS

This system works on the OpenAI API key for accurate prescription reading. The Vision API (GPT-4o) is the primary extraction method and provides significantly better accuracy than pure OCR. If the vision API does not work, the system falls back to Tesseract OCR which has limited accuracy on handwritten prescriptions (approximately ~20-40%).

Requirements:

✅ OpenAI API key (required for Vision API - ~$0.01 per image)  
✅ Supabase account (free tier available)  
✅ Good quality prescription images (clear, well-lit, flat)  
✅ Internet connection (for API calls)

---

## Quick Start

### 1. Set Up Supabase Database
Create project at supabase.com  
Run `supabase-schema.sql` in SQL Editor  
Copy Project URL and API keys  

### 2. Environment Configuration

#### Backend
```bash
cd backend
cp .env.example .env
# Edit .env and paste your SUPABASE_URL and SUPABASE_SERVICE_KEY
```

#### Frontend
```bash
cd ../frontend
cp .env.example .env
# Edit .env and paste your SUPABASE_URL and SUPABASE_ANON_KEY
```

### 3. Installation and Running

#### Terminal 1: Backend
```bash
cd backend
npm install
node server.js
```

#### Terminal 2: Frontend
```bash
cd frontend
npm install
npm start
```

Go to http://localhost:3000

---

## Features

![OpenAI](https://img.shields.io/badge/OpenAI_GPT--4o_Vision-412991?style=for-the-badge&logo=openai&logoColor=white)
![Tesseract](https://img.shields.io/badge/Tesseract.js-4A90E2?style=for-the-badge&logo=tesseract&logoColor=white)
![Sharp](https://img.shields.io/badge/Sharp-99CC00?style=for-the-badge)
![Supabase](https://img.shields.io/badge/Supabase_Realtime-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![RxNorm](https://img.shields.io/badge/RxNorm_API-005EB8?style=for-the-badge)


<b>AI-Powered Prescription Reading:</b> GPT-4 Vision + Tesseract.js OCR fallback  
<b>Verification UI:</b> Manual confirmation and correction of extracted medications  
<b>Smart Nudge Generation:</b> AI-generated behavioral nudges with readability checking (Grade 8 target)  
<b>Enhanced Drug Safety:</b> RxNorm + OpenFDA + food interactions + age-based warnings + dosage alerts  
<b>Real-Time Sync:</b> Supabase Realtime subscriptions  
<b>Responsive Design:</b> Mobile → Tablet → Desktop adaptive layout  
<b>Accessibility:</b> Elderly mode, text-to-speech, large fonts  
<b>Image Preprocessing:</b> Sharp library for contrast enhancement and optimization  
<b>Plain Language Validation:</b> Flesch-Kincaid Grade Level checking  
<b>Full CRUD:</b> Edit, update, and delete medications  

---

## Tech Stack

### Frontend
![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Framer](https://img.shields.io/badge/Framer_Motion-0055FF?style=for-the-badge&logo=framer&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase_JS_Client-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)

React 18, Tailwind CSS, Framer Motion, Supabase JS Client

### Backend
![NodeJS](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI_GPT--4o-412991?style=for-the-badge&logo=openai&logoColor=white)
![Tesseract](https://img.shields.io/badge/Tesseract.js-4A90E2?style=for-the-badge)
![Sharp](https://img.shields.io/badge/Sharp_Image_Processing-99CC00?style=for-the-badge)

Node.js, Express, Tesseract.js, OpenAI GPT-4 Vision, Sharp, RxNorm API

### Database
![Supabase](https://img.shields.io/badge/Supabase_PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?style=for-the-badge&logo=postgresql&logoColor=white)

Supabase (PostgreSQL + Realtime)

### APIs
![RxNorm](https://img.shields.io/badge/RxNorm-005EB8?style=for-the-badge)
![OpenAI](https://img.shields.io/badge/OpenAI_API-412991?style=for-the-badge&logo=openai&logoColor=white)

RxNorm, OpenAI, Model GPT-4o

---

## Deployment

![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)
![Netlify](https://img.shields.io/badge/Netlify-00C7B7?style=for-the-badge&logo=netlify&logoColor=white)
![Railway](https://img.shields.io/badge/Railway-0B0D0E?style=for-the-badge&logo=railway&logoColor=white)
![Render](https://img.shields.io/badge/Render-0099E5?style=for-the-badge&logo=render&logoColor=white)
![Fly.io](https://img.shields.io/badge/Fly.io-8C6FF7?style=for-the-badge)
![Supabase](https://img.shields.io/badge/Supabase_DB-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)

Frontend: Vercel, Netlify  
Backend: Railway, Render, Fly.io  
Database: Supabase  

---

## References

![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![RxNorm](https://img.shields.io/badge/RxNorm-005EB8?style=for-the-badge)
![OpenFDA](https://img.shields.io/badge/OpenFDA-0033A0?style=for-the-badge)
![Tesseract](https://img.shields.io/badge/Tesseract.js-4A90E2?style=for-the-badge)
![OpenAI](https://img.shields.io/badge/OpenAI_GPT--4-412991?style=for-the-badge&logo=openai&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Framer](https://img.shields.io/badge/Framer_Motion-0055FF?style=for-the-badge&logo=framer&logoColor=white)

Built with:

Supabase for Real-time database  
RxNorm for Drug interaction data  
OpenFDA for FDA drug safety database  
Tesseract.js for OCR engine  
OpenAI for GPT-4 for drug extraction  
Tailwind CSS for UI framework  
Framer Motion for Animations  

---

## License

MIT License — see LICENSE file
