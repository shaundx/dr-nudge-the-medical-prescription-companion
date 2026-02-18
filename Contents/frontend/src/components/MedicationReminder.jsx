import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, Check, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function MedicationReminder() {
  const { patient, medications, takeMedication } = useApp();
  const [dueMeds, setDueMeds] = useState([]);
  const [dismissed, setDismissed] = useState(new Set());
  const [testMode, setTestMode] = useState(false);

  // Get time slots from user's custom meal times
  const getTimeSlots = (breakfastTime, lunchTime, dinnerTime) => {
    const parseTime = (timeStr) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    return {
      morning: parseTime(breakfastTime || '08:00'),
      noon: parseTime(lunchTime || '13:00'),
      evening: parseTime(dinnerTime || '19:00'),
    };
  };

  // Parse dose timing and get scheduled times
  const getMedicationSchedule = (med, breakfastTime, lunchTime, dinnerTime) => {
    const slots = getTimeSlots(breakfastTime, lunchTime, dinnerTime);
    const timing = (med.doseTiming || '1-0-0').split('-').map(Number);
    const schedule = [];

    if (timing[0] > 0) {
      schedule.push({ slot: 'morning', time: slots.morning, doses: timing[0] });
    }
    if (timing[1] > 0) {
      schedule.push({ slot: 'noon', time: slots.noon, doses: timing[1] });
    }
    if (timing[2] > 0) {
      schedule.push({ slot: 'evening', time: slots.evening, doses: timing[2] });
    }

    return schedule;
  };

  // Convert minutes to HH:MM format
  const minutesToTime = (minutes) => {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  // Check for due medications
  useEffect(() => {
    const checkDueMeds = () => {
      console.log('🔔 [Reminder] Checking for due meds...');
      console.log('🔔 Test mode:', testMode);
      console.log('🔔 Wake time:', patient.wake_time);
      console.log('🔔 Total medications:', medications.length);
      
      if (!medications.length) {
        console.log('⚠️ [Reminder] No medications');
        return;
      }

      // In test mode, show ALL active medications
      if (testMode) {
        const testDue = medications
          .filter(med => med.active && !med.takenToday && !dismissed.has(`${med.id}-test`))
          .map(med => {
            const timing = (med.doseTiming || '1-0-0').split('-').map(Number);
            return {
              ...med,
              dueSlot: 'morning',
              dueTime: '08:00',
              doses: timing[0] || 1,
              isOverdue: false,
              minutesLate: 0,
            };
          });
        console.log('🔔 TEST MODE: Showing', testDue.length, 'medications');
        setDueMeds(testDue);
        return;
      }

      if (!patient.breakfast_time || !patient.lunch_time || !patient.dinner_time) {
        console.log('⚠️ [Reminder] Meal times not set');
        return;
      }

      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      console.log('🔔 Current time (minutes):', currentMinutes, `(${now.getHours()}:${now.getMinutes()})`);
      
      const due = [];

      medications.forEach((med) => {
        console.log(`🔔 Checking ${med.name}:`, {
          active: med.active,
          takenToday: med.takenToday,
          morningTaken: med.morningTaken,
          noonTaken: med.noonTaken,
          eveningTaken: med.eveningTaken,
          doseTiming: med.doseTiming
        });
        
        if (!med.active) {
          console.log(`  ⏭️ Skipped (inactive)`);
          return;
        }
        
        // Don't skip if takenToday is true - check individual slots

        const schedule = getMedicationSchedule(med, patient.breakfast_time, patient.lunch_time, patient.dinner_time);
        console.log(`  📅 Schedule:`, schedule);
        
        schedule.forEach((slot) => {
          // Check if this specific slot is already taken
          const slotTaken = slot.slot === 'morning' ? med.morningTaken :
                           slot.slot === 'noon' ? med.noonTaken :
                           med.eveningTaken;
          
          if (slotTaken) {
            console.log(`    ✅ ${slot.slot} slot already taken`);
            return;
          }
          
          const timeDiff = currentMinutes - slot.time;
          console.log(`    Slot ${slot.slot}: time=${slot.time} (${minutesToTime(slot.time)}), diff=${timeDiff}min, taken=${slotTaken}`);
          
          // Production: Show if within 15 minutes before or 30 minutes after scheduled time
          if (timeDiff >= -15 && timeDiff <= 30 && !dismissed.has(`${med.id}-${slot.slot}`)) {
            console.log(`    ✅ DUE! Adding to reminder list`);
            due.push({
              ...med,
              dueSlot: slot.slot,
              dueTime: minutesToTime(slot.time),
              doses: slot.doses,
              isOverdue: timeDiff > 0,
              minutesLate: Math.max(0, timeDiff),
            });
          } else {
            console.log(`    ⏭️ Not in window (${timeDiff}min) or dismissed`);
          }
        });
      });

      console.log('🔔 Due medications:', due.length);
      setDueMeds(due);

      // Send browser notification if enabled
      if (due.length > 0 && 
          localStorage.getItem('notificationsEnabled') === 'true' &&
          'Notification' in window && 
          Notification.permission === 'granted') {
        
        due.forEach((med) => {
          if (!dismissed.has(`${med.id}-${med.dueSlot}-notified`)) {
            const notification = new Notification('💊 Time for your medication', {
              body: `${med.name} - ${med.doses} tablet${med.doses > 1 ? 's' : ''} (${med.dueSlot})`,
              icon: '/logo.png',
              badge: '/logo.png',
              tag: `med-${med.id}-${med.dueSlot}`,
              requireInteraction: false,
              silent: false,
            });

            notification.onclick = () => {
              window.focus();
              notification.close();
            };

            // Mark as notified
            setDismissed((prev) => new Set(prev).add(`${med.id}-${med.dueSlot}-notified`));

            // Vibrate if enabled
            if (localStorage.getItem('vibrationEnabled') === 'true' && 'vibrate' in navigator) {
              navigator.vibrate([200, 100, 200]);
            }
          }
        });
      }
    };

    checkDueMeds();
    const interval = setInterval(checkDueMeds, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [medications, patient.breakfast_time, patient.lunch_time, patient.dinner_time, dismissed, testMode]);

  const handleTakeMed = async (med) => {
    await takeMedication(med.id, med.dueSlot);
    setDismissed((prev) => new Set(prev).add(`${med.id}-${med.dueSlot}`));
  };

  const handleDismiss = (med) => {
    setDismissed((prev) => new Set(prev).add(`${med.id}-${med.dueSlot}`));
  };

  // Debug info - remove this after testing
  const now = new Date();
  const currentTime = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
  const hasNoReminders = dueMeds.length === 0;
  const hasMedications = medications.filter(m => m.active && !m.takenToday).length > 0;

  return (
    <>
      {/* Test Mode Toggle & Info Panel - Remove after testing */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-24 right-4 z-50 space-y-2">
          <button
            onClick={() => setTestMode(!testMode)}
            className="w-full px-4 py-2 bg-purple-600 text-white rounded-full shadow-lg hover:bg-purple-700 transition-all text-sm font-medium flex items-center gap-2 justify-center"
            title="Toggle test mode to show all medications as reminders"
          >
            {testMode ? '🔕 Test Mode ON' : '🔔 Test Reminders'}
          </button>
          {medications.length > 0 && (
            <div className="bg-gray-900 text-white rounded-xl p-3 shadow-lg text-xs max-w-xs">
              <div className="font-semibold mb-1">⏰ Reminder Schedule:</div>
              <div className="space-y-0.5 text-gray-300">
                <div>🍳 Breakfast: {patient.breakfast_time || '08:00'}</div>
                <div>🍛 Lunch: {patient.lunch_time || '13:00'}</div>
                <div>🍝 Dinner: {patient.dinner_time || '19:00'}</div>
                <div className="mt-2 text-yellow-300">Window: ±15-30min</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Medication Reminders */}
      {dueMeds.length > 0 && (
        <div className="fixed inset-x-0 z-50 flex flex-col items-center px-4 space-y-3 pointer-events-none"
             style={{ top: 'max(5rem, env(safe-area-inset-top))' }}>
          <AnimatePresence>
            {dueMeds.map((med) => (
          <motion.div
            key={`${med.id}-${med.dueSlot}`}
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="pointer-events-auto mb-2"
          >
            <div
              className={`rounded-2xl shadow-2xl border-2 backdrop-blur-lg max-w-md w-full ${
                med.safetyFlag === 'RED'
                  ? 'bg-red-50/95 border-red-400'
                  : med.isOverdue
                  ? 'bg-orange-50/95 border-orange-400'
                  : 'bg-blue-50/95 border-blue-400'
              }`}
            >
              <div className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-2 rounded-xl ${
                        med.safetyFlag === 'RED'
                          ? 'bg-red-100'
                          : med.isOverdue
                          ? 'bg-orange-100'
                          : 'bg-blue-100'
                      }`}
                    >
                      <Bell
                        className={`w-5 h-5 ${
                          med.safetyFlag === 'RED'
                            ? 'text-red-600'
                            : med.isOverdue
                            ? 'text-orange-600'
                            : 'text-blue-600'
                        }`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{med.name}</h3>
                        {med.isOverdue && (
                          <span className="text-xs bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full font-medium">
                            {med.minutesLate}m late
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mt-0.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="capitalize">{med.dueSlot}</span>
                        <span>•</span>
                        <span>{med.dueTime}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDismiss(med)}
                    className="p-1 hover:bg-gray-200/50 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>

                {/* Dosage info */}
                <div className="bg-white/60 rounded-xl p-3 mb-3">
                  <p className="text-sm text-gray-700">
                    Take <span className="font-semibold">{med.doses} tablet{med.doses > 1 ? 's' : ''}</span>
                    {med.dosage && <span> of {med.dosage}</span>}
                  </p>
                  {med.nudge?.plainInstruction && (
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                      💡 {med.nudge.plainInstruction}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <button
                  onClick={() => handleTakeMed(med)}
                  className={`w-full py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                    med.safetyFlag === 'RED'
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  Mark as Taken
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
        </div>
      )}
    </>
  );
}
