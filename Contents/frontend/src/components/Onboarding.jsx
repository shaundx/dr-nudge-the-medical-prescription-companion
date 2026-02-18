import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe, ChevronRight, Sun, Moon, Clock, Heart, Users,
  Pill, Camera, Sparkles, ArrowLeft, Check, Volume2, ShieldAlert
} from 'lucide-react';

const STEPS = ['details', 'ready'];

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
];

const ROUTINE_OPTIONS = [
  { id: 'early', label: 'Early Riser', desc: 'I wake up before 6 AM', time: '5:30 AM' },
  { id: 'morning', label: 'Morning Person', desc: 'I wake up around 7-8 AM', time: '7:30 AM' },
  { id: 'flexible', label: 'Flexible Schedule', desc: 'My times vary each day', time: '8:00 AM' },
  { id: 'night', label: 'Night Owl', desc: 'I stay up late', time: '10:00 AM' },
];

const MOTIVATION_OPTIONS = [
  { id: 'family', label: 'For my family', desc: 'I want to stay healthy for the people I love' },
  { id: 'independence', label: 'Stay independent', desc: 'I want to take care of myself' },
  { id: 'fear', label: 'Avoid hospital', desc: 'I don\'t want to get sicker' },
  { id: 'doctor', label: 'Doctor said so', desc: 'I trust my doctor\'s advice' },
];

const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir < 0 ? 300 : -300, opacity: 0 }),
};

export default function Onboarding() {
  const { patient, updatePatient, completeOnboarding, speak, t } = useApp();
  const [stepIdx, setStepIdx] = useState(0);
  const [direction, setDirection] = useState(1);
  const [age, setAge] = useState(patient.age || '');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [restoredPatient, setRestoredPatient] = useState(null);

  useEffect(() => {
    // Check for previous patientId in localStorage
    const pid = localStorage.getItem('drNudge_patientId');
    if (pid && !patient.onboarded) {
      // Try to fetch patient name from localStorage or Supabase if needed
      // For now, just show the restore prompt
      setShowRestorePrompt(true);
    }
  }, [patient.onboarded]);

  const step = STEPS[stepIdx];

  const next = () => { setDirection(1); setStepIdx((i) => Math.min(i + 1, STEPS.length - 1)); };
  const back = () => { setDirection(-1); setStepIdx((i) => Math.max(i - 1, 0)); };

  const handleLanguageSelect = (code) => {
    updatePatient({ language: code });
    speak('Welcome to Dr. Nudge!');
    next();
  };

  const handleFinish = async () => {
    await completeOnboarding({
      name: patient.name || 'Friend',
      age: age || '',
      height: height || '',
      weight: weight || '',
    });
  };

  const handleRestore = () => {
    // Just reload the page or trigger useEffect in AppContext to reload patient
    window.location.reload();
  };

  const handleNewUser = () => {
    // Remove patientId and reload onboarding
    localStorage.removeItem('drNudge_patientId');
    setShowRestorePrompt(false);
  };

  const handleInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (step === 'details') {
        // If all fields are filled, move to next step
        if (age && height && weight) {
          next();
        }
      } else if (step === 'ready') {
        // On ready step, press Enter to finish
        handleFinish();
      }
    }
  };

  if (showRestorePrompt) {
    return (
      <div className="onboarding-shell flex flex-col items-center justify-center min-h-screen p-6">
        <h2 className="text-2xl font-bold mb-4 text-center">{t('welcomeTitle', 'Welcome to Dr. Nudge')}</h2>
        <p className="mb-6 text-center text-gray-600">{t('welcomeSubtitle', 'Your friendly medication companion')}</p>
        <div className="w-full max-w-xs">
          <button
            className="btn-primary w-full"
            onClick={() => setShowRestorePrompt(false)}
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="onboarding-shell onboarding-scrollable px-4 py-6 md:px-8 md:py-10">
      {/* Progress bar */}
      <div className="max-w-2xl mx-auto w-full mb-6 flex items-center gap-3">
        {stepIdx > 0 && (
          <button onClick={back} className="p-2 -ml-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft size={22} className="text-gray-600" />
          </button>
        )}
        <div className="flex-1 flex items-center">
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-2 bg-gray-900 rounded-full transition-all duration-500"
              style={{ width: `${((stepIdx + 1) / STEPS.length) * 100}%` }}
            />
          </div>
          <span className="ml-3 text-xs text-gray-500">Step {stepIdx + 1} of {STEPS.length}</span>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto w-full">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="px-0 py-0 flex flex-col"
          >

            {/* --- WELCOME STEP --- */}

            {/* --- DETAILS STEP --- */}
            {step === 'details' && (
              <div className="flex-1 flex flex-col justify-center">
                <h1 className="text-2xl font-bold text-gray-900 mb-4 text-center">{t('tellUsAboutYou', 'A few more details')}</h1>
                <div className="space-y-5 max-w-md mx-auto w-full">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">{t('yourAge', 'Age')}</label>
                    <input
                      type="number"
                      min="0"
                      value={age}
                      onChange={e => setAge(e.target.value)}
                      onKeyPress={handleInputKeyPress}
                      placeholder={t('yourAge', 'Your age')}
                      className="w-full p-4 text-lg rounded-2xl border-2 border-gray-200 focus:border-gray-900 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">{t('height', 'Height (cm)')}</label>
                    <input
                      type="number"
                      min="0"
                      value={height}
                      onChange={e => setHeight(e.target.value)}
                      onKeyPress={handleInputKeyPress}
                      placeholder={t('height', 'Your height in cm')}
                      className="w-full p-4 text-lg rounded-2xl border-2 border-gray-200 focus:border-gray-900 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">{t('weight', 'Weight (kg)')}</label>
                    <input
                      type="number"
                      min="0"
                      value={weight}
                      onChange={e => setWeight(e.target.value)}
                      onKeyPress={handleInputKeyPress}
                      placeholder={t('weight', 'Your weight in kg')}
                      className="w-full p-4 text-lg rounded-2xl border-2 border-gray-200 focus:border-gray-900 focus:outline-none transition-colors"
                    />
                  </div>
                </div>
                <button
                  onClick={next}
                  className="btn-primary w-full text-lg font-semibold rounded-2xl mt-6"
                  disabled={!age || !height || !weight}
                >
                  {t('next', 'Continue')} <ChevronRight size={20} className="inline ml-1" />
                </button>
              </div>
            )}


            {/* --- READY STEP --- */}
            {step === 'ready' && (
              <div className="flex-1 flex flex-col justify-center text-center" onKeyPress={handleInputKeyPress} tabIndex="0">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                  className="mb-8"
                >
                  <div className="text-7xl mb-6">🎉</div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-3">
                    {t('setupComplete', "You're all set, ")} {patient.name || t('yourName', 'Friend')}!
                  </h1>
                  <p className="text-lg text-gray-500 max-w-xs mx-auto mb-8">
                    {t('welcomeSubtitle', "Here's what you can do:")}
                  </p>
                </motion.div>

                <div className="space-y-3 mb-8 max-w-2xl mx-auto w-full px-2">
                  {[
                    { Icon: Camera, text: t('scanPrescription', 'Scan Prescription'), desc: 'Upload & analyze medicine prescriptions', color: 'from-blue-500 to-blue-600', bgColor: 'bg-blue-50' },
                    { Icon: Pill, text: t('takeMedicine', 'Track Medicines'), desc: 'Log when you take your medications', color: 'from-green-500 to-green-600', bgColor: 'bg-green-50' },
                    { Icon: ShieldAlert, text: t('medicationAlerts', 'Safety Alerts'), desc: 'Get warned about drug interactions', color: 'from-red-500 to-red-600', bgColor: 'bg-red-50' },
                    { Icon: Volume2, text: t('voiceEnabled', 'Audio Guide'), desc: 'Instructions read aloud to you', color: 'from-purple-500 to-purple-600', bgColor: 'bg-purple-50' },
                  ].map(({ Icon, text, desc, color, bgColor }, i) => (
                    <motion.div
                      key={i}
                      initial={{ x: -30, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.2 + i * 0.1 }}
                      className={`${bgColor} border-2 border-gray-100 rounded-2xl p-4 flex items-start gap-4 text-left hover:shadow-md transition-shadow`}
                    >
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${color}`}>
                        <Icon size={24} className="text-white" strokeWidth={2} />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-gray-900 text-base">{text}</p>
                        <p className="text-sm text-gray-600 mt-1">{desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <button
                  onClick={handleFinish}
                  className="btn-primary w-full max-w-xs mx-auto text-lg font-bold rounded-2xl flex items-center justify-center gap-2"
                >
                  <Sparkles size={20} /> {t('letsGo', "Let's go!")}
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
    );
}
