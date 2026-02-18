import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, Undo2, Volume2, ChevronRight, Flame, Trophy, Sun,
  Sunset, Moon, Clock, Info, AlertTriangle, Sparkles, Plus, Camera,
  Settings, Mic, Phone
} from 'lucide-react';
import MedDetailModal from './MedDetailModal';
import MobileHeader from './MobileHeader';

function ProgressRing({ percent, size = 120, stroke = 10 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={percent >= 100 ? '#22c55e' : '#111827'}
        strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />
    </svg>
  );
}

function getGreeting(t) {
  const h = new Date().getHours();
  if (h < 12) return { text: t('goodMorning', 'Good Morning'), Icon: Sun, emoji: '☀️' };
  if (h < 17) return { text: t('goodAfternoon', 'Good Afternoon'), Icon: Sunset, emoji: '🌤️' };
  return { text: t('goodEvening', 'Good Evening'), Icon: Moon, emoji: '🌙' };
}

function getTimeOfDay(timeStr) {
  if (!timeStr) return 'anytime';
  const h = parseInt(timeStr.split(':')[0], 10);
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}


export default function HomePage() {
  const {
    patient, medications, pendingMeds, completedMeds,
    adherenceRate, bestStreak, takeMedication, undoTakeMedication,
    unresolvedAlerts, speak, setActivePage, updatePatient, t, primaryDoctor, callDoctor
  } = useApp();

  const [showStatsHover, setShowStatsHover] = useState(false);

  // BMI calculation
  const heightM = parseFloat(patient.height) ? parseFloat(patient.height) / 100 : null;
  const weight = parseFloat(patient.weight) || null;
  const bmi = heightM && weight ? (weight / (heightM * heightM)) : null;
  let bmiStatus = '';
  if (bmi) {
    if (bmi < 18.5) bmiStatus = t('bmi.underweight', 'Underweight');
    else if (bmi < 25) bmiStatus = t('bmi.normal', 'Normal');
    else if (bmi < 30) bmiStatus = t('bmi.overweight', 'Overweight');
    else bmiStatus = t('bmi.obese', 'Obese');
  }

  const [selectedMed, setSelectedMed] = useState(null);
  const [justTaken, setJustTaken] = useState(null);

  const greeting = getGreeting(t);
  // Calculate today's adherence based on individual dose slots (morning/noon/evening)
  const totalTodaySlots = medications.reduce((total, med) => {
    const timing = (med.doseTiming || '1-0-0').split('-').map(Number);
    const slotsRequired = (timing[0] > 0 ? 1 : 0) + (timing[1] > 0 ? 1 : 0) + (timing[2] > 0 ? 1 : 0);
    return total + slotsRequired;
  }, 0);

  const takenTodaySlots = medications.reduce((total, med) => {
    const timing = (med.doseTiming || '1-0-0').split('-').map(Number);
    const slotsTaken =
      (timing[0] > 0 && med.morningTaken ? 1 : 0) +
      (timing[1] > 0 && med.noonTaken ? 1 : 0) +
      (timing[2] > 0 && med.eveningTaken ? 1 : 0);
    return total + slotsTaken;
  }, 0);

  const percent = totalTodaySlots > 0 ? Math.round((takenTodaySlots / totalTodaySlots) * 100) : 0;

  // Helper: gate dose-taking by meal-time windows, same as MedDetailModal
  const canTakeSlotNow = (slotKey) => {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const parseTimeToMinutes = (timeStr, fallback) => {
      const [hStr, mStr] = (timeStr || fallback).split(':');
      const h = parseInt(hStr, 10);
      const m = parseInt(mStr || '0', 10);
      return h * 60 + m;
    };

    let dueMinutes;
    if (slotKey === 'morning') {
      dueMinutes = parseTimeToMinutes(patient.breakfast_time || '08:00', '08:00');
    } else if (slotKey === 'noon') {
      dueMinutes = parseTimeToMinutes(patient.lunch_time || '13:00', '13:00');
    } else {
      dueMinutes = parseTimeToMinutes(patient.dinner_time || '19:00', '19:00');
    }

    return nowMinutes >= dueMinutes;
  };

  const handleTake = (med, timeSlot = 'morning') => {
    // Prevent taking doses before their scheduled window
    if (!canTakeSlotNow(timeSlot)) {
      const nextTime =
        timeSlot === 'morning'
          ? patient.breakfast_time || '08:00'
          : timeSlot === 'noon'
          ? patient.lunch_time || '13:00'
          : patient.dinner_time || '19:00';
      speak(
        t(
          'noDoseDueNow',
          `It's not time for this dose yet. Next dose at ${nextTime}.`
        )
      );
      return;
    }

    takeMedication(med.id, timeSlot);
    setJustTaken(med.id);
    speak(t('greatJobTookMedicine', `Great job! You took your ${med.name}.`));
    setTimeout(() => setJustTaken(null), 2500);
  };

  const handleUndo = (med, timeSlot = null) => {
    undoTakeMedication(med.id, timeSlot);
    setJustTaken(null);
  };

  // Group pending doses by time slot (morning / afternoon / evening)
  const grouped = medications.reduce((acc, med) => {
    const timing = (med.doseTiming || '1-0-0').split('-').map(Number);

    const addToGroup = (slotKey) => {
      if (!acc[slotKey]) acc[slotKey] = [];
      acc[slotKey].push(med);
    };

    if (timing[0] > 0 && !med.morningTaken) addToGroup('morning');
    if (timing[1] > 0 && !med.noonTaken) addToGroup('afternoon');
    if (timing[2] > 0 && !med.eveningTaken) addToGroup('evening');

    return acc;
  }, {});

  const timeLabels = {
    morning: { label: t('time.morning', 'Morning'), icon: '🌅' },
    afternoon: { label: t('time.afternoon', 'Afternoon'), icon: '☀️' },
    evening: { label: t('time.evening', 'Evening'), icon: '🌙' },
    anytime: { label: t('time.anytime', 'Any Time'), icon: '💊' },
  };

  return (
    <>
      <div className="page-content pb-6 lg:pt-0">
        <MobileHeader />
        {/* Greeting header */}
        <div className="mb-5 pt-4">
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex items-center justify-between flex-wrap gap-2"
        >
          <div>
            <p className="text-gray-400 text-sm font-medium">{greeting.emoji} {greeting.text}</p>
            <h1 className="text-2xl font-bold text-gray-900 mt-0.5">
              {patient.name || t('friend', 'Friend')}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Call doctor icon */}
            <button
              onClick={callDoctor}
              disabled={!primaryDoctor || !primaryDoctor.phone}
              className={`w-9 h-9 rounded-full flex items-center justify-center border transition-colors
                ${primaryDoctor && primaryDoctor.phone
                  ? 'border-gray-300 text-gray-700 hover:bg-gray-100'
                  : 'border-gray-200 text-gray-300 cursor-not-allowed'}`}
              title={primaryDoctor && primaryDoctor.phone
                ? t('alertsCallDoctor', 'Call my doctor')
                : 'Add a doctor in your profile to enable calling'}
            >
              <Phone size={16} />
            </button>

            {/* Streak badge */}
            <motion.div
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-1.5 bg-orange-50 px-3 py-1.5 rounded-xl"
            >
              <Flame size={18} className="text-orange-500" />
              <span className="font-bold text-orange-600">{bestStreak}</span>
              <span className="text-xs text-orange-400">{t('dayStreak', 'day streak')}</span>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Nudge of the day - moved to top */}
      {pendingMeds.length > 0 && pendingMeds[0].nudge && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-4 mb-5 p-4 bg-amber-50 rounded-2xl border border-amber-200"
        >
          <div className="flex items-start gap-3">
            <Sparkles size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900 mb-1">{t('nudgeOfTheDay', "Today's Nudge")}</p>
              <p className="text-sm text-amber-700">
                {pendingMeds[0].nudge.plainInstruction ||
                  pendingMeds[0].nudge.habitHook ||
                  pendingMeds[0].nudge.headline ||
                  t('nudgeFallback', 'Stay consistent with your medicines today.')}    
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Safety alert banner */}
      {unresolvedAlerts.length > 0 && (
        <motion.button
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          onClick={() => setActivePage('safety')}
          className="w-full mb-4 p-3.5 rounded-2xl bg-red-50 border border-red-200 flex items-center gap-3"
        >
          <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} className="text-red-600" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-red-700">
              {unresolvedAlerts.length} safety alert{unresolvedAlerts.length > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-red-500">Tap to review drug interactions</p>
          </div>
          <ChevronRight size={16} className="text-red-400" />
        </motion.button>
      )}

      {/* BMI Card */}
      {bmi && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="bg-blue-50 border border-blue-200 rounded-3xl p-5 mb-5 flex flex-col items-center shadow-sm"
        >
          <div className="text-center mb-2">
            <span className="text-xs font-semibold text-blue-500 uppercase tracking-wider">BMI</span>
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="text-4xl font-bold text-blue-900 mt-1"
            >
              {bmi.toFixed(1)}
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className={`text-base font-semibold mt-1 ${
                bmiStatus === 'Normal' ? 'text-green-600' : bmiStatus === 'Underweight' ? 'text-yellow-500' : 'text-red-500'
              }`}
            >
              {bmiStatus}
            </motion.div>
          </div>
          <div className="w-full h-2 bg-blue-100 rounded-full mt-3">
            <motion.div
              className="h-2 rounded-full bg-blue-500"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((bmi / 40) * 100, 100)}%` }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
          </div>
          <div className="flex justify-between w-full text-xs text-blue-400 mt-1">
            <span>15</span>
            <span>20</span>
            <span>25</span>
            <span>30</span>
            <span>35+</span>
          </div>
        </motion.div>
      )}

      {/* Progress circle + stats */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-3xl p-5 mb-5 shadow-sm border border-gray-100 lg:p-6 relative"
      >
        <div className="flex items-center gap-5">
          <div
            className="relative"
            onMouseEnter={() => setShowStatsHover(true)}
            onMouseLeave={() => setShowStatsHover(false)}
          >
            <ProgressRing percent={percent} size={100} stroke={8} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-gray-900">{percent}%</span>
              <span className="text-[10px] text-gray-400 font-medium">{t('todayLabel', 'today')}</span>
            </div>

            {/* Popup stats anchored to the visualizer */}
            {showStatsHover && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute top-full left-1/2 -translate-x-1/2 mt-4 bg-white rounded-2xl shadow-2xl p-5 z-50 w-80 sm:w-96 border border-gray-100"
              >
                <div className="flex gap-4">
                  {/* Adherence Rate Box */}
                  <div className="flex-1 bg-gradient-to-br from-blue-100 to-blue-50 rounded-2xl p-5 text-center">
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <Check size={24} className="text-blue-600" strokeWidth={2.5} />
                      <p className="text-3xl font-bold text-blue-900">{percent}%</p>
                    </div>
                    <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">{t('adherence', 'Adherence')}</p>
                  </div>
                  {/* Best Streak Box */}
                  <div className="flex-1 bg-gradient-to-br from-orange-100 to-orange-50 rounded-2xl p-5 text-center">
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <Flame size={24} className="text-orange-600" strokeWidth={2.5} />
                      <p className="text-3xl font-bold text-orange-900">{bestStreak}</p>
                    </div>
                    <p className="text-xs font-bold text-orange-700 uppercase tracking-wider">{t('bestStreak', 'Best Streak')}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">{t('takenToday', 'Taken Today')}</span>
              <span className="text-sm font-bold text-green-600">
                {takenTodaySlots}/{totalTodaySlots}
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-green-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-400 pt-1">
              <span className="flex items-center gap-1">
                <Flame size={12} className="text-orange-400" /> {bestStreak} {t('dayStreak', 'day streak')}
              </span>
              <span className="flex items-center gap-1">
                <Trophy size={12} className="text-yellow-500" /> {completedMeds.length} {t('todayLabel', 'today')}
              </span>
            </div>
          </div>
        </div>

        
      </motion.div>

      {/* All done celebration */}
      {pendingMeds.length === 0 && medications.length > 0 && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center py-8 px-4 mb-4 bg-green-50 rounded-3xl border border-green-200"
        >
          <motion.div
            animate={{ rotate: [0, -10, 10, -10, 0] }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-5xl mb-3"
          >
            🎉
          </motion.div>
          <h2 className="text-xl font-bold text-green-700 mb-1">{t('homeAllDoneTodayTitle', 'All done for today!')}</h2>
          <p className="text-sm text-green-600">{t('homeAllDoneTodaySubtitle', 'You took all your medicines. Great job!')}</p>
        </motion.div>
      )}

      {/* Pending medications by time */}
      {Object.keys(grouped).length > 0 && (
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 px-1">
            {t('homeToTakeToday', 'To Take Today')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {['morning', 'afternoon', 'evening'].map((tod) => 
              grouped[tod] && grouped[tod].length > 0 ? (
                <React.Fragment key={tod}>
                  {/* Time period header - spans full width visually but not in grid */}
                  <div className="col-span-1 sm:col-span-2 md:col-span-2 lg:col-span-3 xl:col-span-4 flex items-center gap-2 px-1 mt-2 mb-2">
                    <span className="text-lg">{timeLabels[tod]?.icon}</span>
                    <span className="text-sm font-semibold text-gray-700">{timeLabels[tod]?.label}</span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock size={13} />{
                        tod === 'morning'
                          ? ` ${patient.breakfast_time || '08:00'}`
                          : tod === 'afternoon'
                          ? ` ${patient.lunch_time || '13:00'}`
                          : ` ${patient.dinner_time || '19:00'}`
                      }
                    </span>
                  </div>
                  {/* Medications flow naturally in grid */}
                  <AnimatePresence>
                    {grouped[tod].map((med) => (
                      <MedCard
                        key={med.id}
                        med={med}
                        onTake={() => handleTake(med, tod === 'afternoon' ? 'noon' : tod)}
                        onUndo={() => handleUndo(med, tod === 'afternoon' ? 'noon' : tod)}
                        onDetail={() => setSelectedMed(med)}
                        justTaken={justTaken === med.id}
                        onSpeak={() => speak(med.plainInstruction || `Take ${med.name} ${med.dosage}`)}
                      />
                    ))}
                  </AnimatePresence>
                </React.Fragment>
              ) : null
            )}
          </div>
        </div>
      )}

      {/* Completed medications */}
      {completedMeds.length > 0 && (
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 px-1">
            ✅ {t('homeTakenTodaySection', 'Taken Today')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {completedMeds.map((med) => (
              <motion.div
                key={med.id}
                layout
                className="flex items-center gap-3 p-3 bg-green-50 rounded-2xl border border-green-100 opacity-70"
              >
                <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Check size={18} className="text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-green-800 line-through">{med.name}</p>
                  <p className="text-xs text-green-600">{med.dosage} — {med.time}</p>
                </div>
                <button
                  onClick={() => handleUndo(med)}
                  className="p-2 rounded-xl hover:bg-green-100 transition-colors flex-shrink-0"
                >
                  <Undo2 size={15} className="text-green-500" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Feature Cards - Real Features Only */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 mb-4"
      >
        <h2 className="text-lg font-bold text-gray-900 mb-4">{t('homeKeyFeatures', 'Key Features')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Add & Track Medicines */}
          <motion.button
            whileHover={{ scale: 1.02, y: -5 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActivePage('meds')}
            className="text-left p-5 bg-white border border-gray-200 rounded-2xl hover:shadow-lg transition-all"
          >
            <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-xl mb-3">
              <Plus size={24} className="text-blue-600" />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">{t('homeAddTrackTitle', 'Add & Track Medicines')}</h3>
            <p className="text-sm text-gray-500">{t('homeAddTrackDesc', 'Easily add your medications and track daily intake with simple tap-to-confirm functionality.')}</p>
          </motion.button>

          {/* Scan Prescriptions */}
          <motion.button
            whileHover={{ scale: 1.02, y: -5 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActivePage('scan')}
            className="text-left p-5 bg-white border border-gray-200 rounded-2xl hover:shadow-lg transition-all"
          >
            <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-xl mb-3">
              <Camera size={24} className="text-purple-600" />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">{t('homeScanTitle', 'Scan Prescriptions')}</h3>
            <p className="text-sm text-gray-500">{t('homeScanDesc', 'Use your camera to scan prescription labels and automatically extract medication details.')}</p>
          </motion.button>

          {/* Safety Alerts */}
          <motion.button
            whileHover={{ scale: 1.02, y: -5 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActivePage('safety')}
            className="text-left p-5 bg-white border border-gray-200 rounded-2xl hover:shadow-lg transition-all"
          >
            <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-xl mb-3">
              <AlertTriangle size={24} className="text-red-600" />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">{t('homeSafetyTitle', 'Safety Alerts')}</h3>
            <p className="text-sm text-gray-500">{t('homeSafetyDesc', 'Get alerted about potential drug interactions and safety concerns with your medications.')}</p>
          </motion.button>

          {/* Daily Adherence */}
          <motion.button
            whileHover={{ scale: 1.02, y: -5 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActivePage('home')}
            className="text-left p-5 bg-white border border-gray-200 rounded-2xl hover:shadow-lg transition-all"
          >
            <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-xl mb-3">
              <Check size={24} className="text-green-600" />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">{t('homeAdherenceTitle', 'Daily Adherence')}</h3>
            <p className="text-sm text-gray-500">{t('homeAdherenceDesc', 'Track your medication adherence with streaks, completion rates, and daily progress.')}</p>
          </motion.button>

          {/* Voice Guidance */}
          <motion.button
            whileHover={{ scale: 1.02, y: -5 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActivePage('profile')}
            className="text-left p-5 bg-white border border-gray-200 rounded-2xl hover:shadow-lg transition-all"
          >
            <div className="flex items-center justify-center w-12 h-12 bg-cyan-100 rounded-xl mb-3">
              <Mic size={24} className="text-cyan-600" />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">{t('homeVoiceTitle', 'Voice Guidance')}</h3>
            <p className="text-sm text-gray-500">{t('homeVoiceDesc', 'Enable voice notifications to hear medication instructions and reminders read aloud.')}</p>
          </motion.button>

          {/* Personalize Settings */}
          <motion.button
            whileHover={{ scale: 1.02, y: -5 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActivePage('profile')}
            className="text-left p-5 bg-white border border-gray-200 rounded-2xl hover:shadow-lg transition-all"
          >
            <div className="flex items-center justify-center w-12 h-12 bg-orange-100 rounded-xl mb-3">
              <Settings size={24} className="text-orange-600" />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">{t('homeSettingsTitle', 'Personalize Settings')}</h3>
            <p className="text-sm text-gray-500">{t('homeSettingsDesc', 'Customize language, accessibility scale, wake time, and other preferences to suit your needs.')}</p>
          </motion.button>
        </div>
      </motion.div>

      {/* Med detail modal */}
      {selectedMed && (
        <MedDetailModal med={selectedMed} onClose={() => setSelectedMed(null)} />
      )}
      </div>
    </>
  );
}

/* ─── Individual Medication Card ─── */
function MedCard({ med, onTake, onUndo, onDetail, justTaken, onSpeak }) {
  const safetyColor = {
    RED: 'border-red-300 bg-red-50',
    YELLOW: 'border-yellow-300 bg-yellow-50',
    GREEN: 'border-gray-100 bg-white',
  }[med.safetyFlag || 'GREEN'];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className={`rounded-2xl border-2 p-4 shadow-sm transition-all hover-lift ${safetyColor}`}
    >
      <div className="flex items-start gap-3">
        {/* Pill icon with safety indicator */}
        <div className="relative flex-shrink-0">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
            med.safetyFlag === 'RED' ? 'bg-red-100' :
            med.safetyFlag === 'YELLOW' ? 'bg-yellow-100' : 'bg-gray-100'
          }`}>
            💊
          </div>
          {med.safetyFlag === 'RED' && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
              <AlertTriangle size={10} className="text-white" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-base font-bold text-gray-900 truncate">{med.name}</h3>
            {med.safetyFlag === 'RED' && (
              <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                ⚠️ ALERT
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mb-1">{med.dosage} — {med.time}</p>
          {med.nudge?.headline && (
            <p className="text-xs text-gray-400 italic">"{med.nudge.headline}"</p>
          )}
        </div>

        {/* Voice button */}
        <button
          onClick={onSpeak}
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors flex-shrink-0"
        >
          <Volume2 size={16} className="text-gray-400" />
        </button>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2 mt-3">
        <AnimatePresence mode="wait">
          {justTaken ? (
            <motion.div
              key="done"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-100 rounded-xl"
            >
              <Check size={18} className="text-green-600" />
              <span className="text-sm font-bold text-green-700">Taken! Great job! 🎉</span>
            </motion.div>
          ) : (
            <motion.button
              key="take"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              whileTap={{ scale: 0.95 }}
              onClick={onTake}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-900 text-white rounded-xl font-semibold text-sm hover:bg-gray-800 transition-colors"
            >
              <Check size={16} /> I took it ✅
            </motion.button>
          )}
        </AnimatePresence>
        <button
          onClick={onDetail}
          className="p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <Info size={16} className="text-gray-500" />
        </button>
      </div>
    </motion.div>
  );
}
