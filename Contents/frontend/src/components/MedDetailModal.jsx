import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Volume2, Check, AlertTriangle, Clock, Flame, Heart, Pill, Phone, Calendar, Edit2, Trash2 } from 'lucide-react';
import EditMedModal from './EditMedModal';

export default function MedDetailModal({ med, onClose }) {
  const { speak, takeMedication, deleteMedication, t, patient, primaryDoctor, callDoctor } = useApp();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  if (!med) return null;

  const nudge = med.nudge || {};
  const safetyBg = {
    RED: 'from-red-500 to-red-600',
    YELLOW: 'from-yellow-500 to-yellow-600',
    GREEN: 'from-green-500 to-green-600',
  }[med.safetyFlag || 'GREEN'];

  // Dose timing helper: morning-noon-evening pattern like 1-1-1
  const timing = (med.doseTiming || '1-0-0').split('-').map(Number);

  const parseTimeToMinutes = (timeStr, fallback) => {
    const raw = timeStr || fallback;
    const [h, m] = (raw || '00:00').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const getSlotDueMinutes = (slot) => {
    if (slot === 'morning') return parseTimeToMinutes(patient.breakfast_time, '08:00');
    if (slot === 'noon') return parseTimeToMinutes(patient.lunch_time, '13:00');
    if (slot === 'evening') return parseTimeToMinutes(patient.dinner_time, '19:00');
    return 0;
  };

  const getNextPendingSlot = () => {
    if (timing[0] > 0 && !med.morningTaken) return 'morning';
    if (timing[1] > 0 && !med.noonTaken) return 'noon';
    if (timing[2] > 0 && !med.eveningTaken) return 'evening';
    return null;
  };

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nextPendingSlot = getNextPendingSlot();
  const nextSlotDueMinutes = nextPendingSlot ? getSlotDueMinutes(nextPendingSlot) : null;
  const canTakeNow = !!nextPendingSlot && nowMinutes >= nextSlotDueMinutes;

  const handleReadAloud = () => {
    const text = [
      nudge.headline || med.name,
      nudge.plainInstruction || `Take ${med.dosage} at ${med.time}`,
      nudge.theWhy,
      nudge.habitHook,
      nudge.warning,
    ].filter(Boolean).join('. ');
    speak(text);
  };

  const handleTakeAndClose = () => {
    // Only allow marking a dose when the next scheduled slot time has been reached
    if (!nextPendingSlot || !canTakeNow) return;

    takeMedication(med.id, nextPendingSlot);
    speak(t('greatJobTookMedicine', `Great job! You took your ${med.name}.`));
    onClose();
  };

  const handleDelete = async () => {
    await deleteMedication(med.id);
    speak(`Removed ${med.name} from your list.`);
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="modal-sheet"
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* Header with safety gradient */}
          <div className={`mx-4 rounded-2xl bg-gradient-to-r ${safetyBg} p-4 mb-4`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">💊</span>
                  <h2 className="text-xl font-bold text-white">{med.name}</h2>
                </div>
                <p className="text-white/80 text-sm">{med.dosage}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleReadAloud}
                  className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"
                >
                  <Volume2 size={18} className="text-white" />
                </button>
                <button
                  onClick={onClose}
                  className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"
                >
                  <X size={18} className="text-white" />
                </button>
              </div>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
            {/* Headline nudge (hide generic placeholder) */}
            {nudge.headline && nudge.headline !== 'Simple instruction based on ACTUAL prescription' && (
              <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
                <p className="text-base font-semibold text-amber-800">
                  💡 {nudge.headline}
                </p>
              </div>
            )}

            {/* Plain instruction */}
            {nudge.plainInstruction && (
              <Section icon={<Pill size={16} />} title="How to take" color="blue">
                <p className="text-gray-700 text-[15px] leading-relaxed">
                  {nudge.plainInstruction}
                </p>
              </Section>
            )}

            {/* Time & schedule */}
            <Section icon={<Clock size={16} />} title="When to take" color="purple">
              {med.doseTiming && (() => {
                const timing = med.doseTiming.split('-').map(Number);
                const times = [];
                
                if (timing[0] > 0) {
                  times.push({
                    slot: 'Morning (Breakfast)',
                    time: patient.breakfast_time || '08:00',
                    doses: timing[0],
                    taken: med.morningTaken
                  });
                }
                if (timing[1] > 0) {
                  times.push({
                    slot: 'Noon (Lunch)',
                    time: patient.lunch_time || '13:00',
                    doses: timing[1],
                    taken: med.noonTaken
                  });
                }
                if (timing[2] > 0) {
                  times.push({
                    slot: 'Evening (Dinner)',
                    time: patient.dinner_time || '19:00',
                    doses: timing[2],
                    taken: med.eveningTaken
                  });
                }
                
                return (
                  <div className="space-y-2">
                    {times.map((t, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-purple-50 rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{t.slot}</p>
                          <p className="text-xs text-gray-500">
                            {t.doses} tablet{t.doses > 1 ? 's' : ''} at {t.time}
                          </p>
                        </div>
                        {t.taken ? (
                          <span className="text-xs font-medium px-2 py-1 bg-green-100 text-green-700 rounded-md">
                            ✓ Taken
                          </span>
                        ) : (
                          <span className="text-xs font-medium px-2 py-1 bg-gray-100 text-gray-500 rounded-md">
                            Pending
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
              {med.frequency && (
                <p className="text-gray-500 text-sm mt-3">{med.frequency}</p>
              )}
              {med.dosingSource === 'ai_generated' && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-purple-600">
                  <span className="px-2 py-0.5 bg-purple-100 rounded-md font-medium">AI-suggested</span>
                  <span className="text-gray-500">Based on medical guidelines</span>
                </div>
              )}
            </Section>

            {/* The Why — motivation */}
            {nudge.theWhy && (
              <Section icon={<Heart size={16} />} title="Why this matters" color="pink">
                <p className="text-gray-700 text-[15px] leading-relaxed">
                  {nudge.theWhy}
                </p>
              </Section>
            )}

            {/* Habit hook */}
            {nudge.habitHook && (
              <Section icon={<Flame size={16} />} title="Easy reminder trick" color="orange">
                <p className="text-gray-700 text-[15px] leading-relaxed italic">
                  "{nudge.habitHook}"
                </p>
              </Section>
            )}

            {/* Safety warning */}
            {nudge.warning && (
              <div className="bg-red-50 rounded-2xl p-4 border border-red-200">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-red-700 mb-1">Safety Note</p>
                    <p className="text-sm text-red-600 leading-relaxed">{nudge.warning}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Adherence stats */}
            <div className="bg-gray-50 rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-gray-500 mb-3">Your Progress</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xl font-bold text-gray-900">{med.streak || 0}</p>
                  <p className="text-[10px] text-gray-400 font-medium">DAY STREAK</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">
                    {med.takenDoses || 0}/{med.totalDoses || 0}
                  </p>
                  <p className="text-[10px] text-gray-400 font-medium">THIS WEEK</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">
                    {med.totalDoses > 0 ? Math.round((med.takenDoses / med.totalDoses) * 100) : 0}%
                  </p>
                  <p className="text-[10px] text-gray-400 font-medium">ADHERENCE</p>
                </div>
              </div>
            </div>

            {/* Refill date */}
            {med.refillDate && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
                <Calendar size={16} className="text-blue-500" />
                <div>
                  <p className="text-sm font-medium text-blue-700">Refill by {med.refillDate}</p>
                  <p className="text-xs text-blue-500">Set a reminder so you don't run out</p>
                </div>
              </div>
            )}
          </div>

          {/* Bottom actions */}
          <div className="p-4 border-t border-gray-100 bg-white space-y-2">
            {med.takenToday ? (
              <div className="w-full py-4 bg-green-100 text-green-700 rounded-2xl font-bold text-base text-center">
                ✅ {t('allDosesTakenToday', 'All doses taken today')}
              </div>
            ) : canTakeNow ? (
              <button
                onClick={handleTakeAndClose}
                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold text-base flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors"
              >
                <Check size={20} /> {t('iTookThisPill', 'I took this pill ✅')}
              </button>
            ) : (
              <div className="w-full py-4 bg-gray-100 text-gray-500 rounded-2xl font-medium text-base text-center">
                {nextPendingSlot
                  ? t('nextDoseAtTime', `Next dose at ${
                      nextPendingSlot === 'morning'
                        ? patient.breakfast_time || '08:00'
                        : nextPendingSlot === 'noon'
                        ? patient.lunch_time || '13:00'
                        : patient.dinner_time || '19:00'
                    }`)
                  : t('noDoseDueNow', 'No dose due right now')}
              </div>
            )}
            
            {/* Edit and Delete buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowEditModal(true)}
                className="py-3 bg-blue-100 text-blue-700 rounded-2xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-blue-200 transition-colors"
              >
                <Edit2 size={16} /> Edit
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="py-3 bg-red-100 text-red-700 rounded-2xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-red-200 transition-colors"
              >
                <Trash2 size={16} /> Delete
              </button>
            </div>
              <button
                onClick={callDoctor}
                disabled={!primaryDoctor || !primaryDoctor.phone}
                className={`w-full py-3 rounded-2xl font-medium text-sm flex items-center justify-center gap-2 transition-colors
                  ${primaryDoctor && primaryDoctor.phone
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-gray-50 text-gray-400 cursor-not-allowed'}`}
              >
                <Phone size={16} /> {t('alertsCallDoctor', 'Call my doctor')}
              </button>
          </div>
        </motion.div>

        {/* Edit Modal */}
        {showEditModal && (
          <EditMedModal med={med} onClose={() => setShowEditModal(false)} />
        )}

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-sm w-full"
            >
              <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
                <Trash2 size={24} className="text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                Delete Medicine?
              </h3>
              <p className="text-gray-600 text-center mb-6">
                Are you sure you want to remove <strong>{med.name}</strong> from your medicine list? This action cannot be undone.
              </p>
              <div className="space-y-2">
                <button
                  onClick={handleDelete}
                  className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors"
                >
                  Yes, Delete
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/* ─── Reusable section block ─── */
function Section({ icon, title, color, children }) {
  const colors = {
    blue: 'bg-blue-100 text-blue-600',
    purple: 'bg-purple-100 text-purple-600',
    pink: 'bg-pink-100 text-pink-600',
    orange: 'bg-orange-100 text-orange-600',
  };
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${colors[color]}`}>
          {icon}
        </div>
        <h3 className="text-sm font-semibold text-gray-500">{title}</h3>
      </div>
      {children}
    </div>
  );
}
