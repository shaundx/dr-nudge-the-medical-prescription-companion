import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const AppContext = createContext(null);

const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिंदी' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
];

const INITIAL_PATIENT = {
  name: '',
  age: '',
  language: 'en',
  wake_time: '07:00',
  morning_routine: '',
  motivation: '',
  height: '',
  weight: '',
  onboarded: false,
  voice_enabled: true,
  elderly_mode: false,
};

// ── Helper: map a Supabase medication row → frontend medication object ──
function mapMedRow(row) {
  return {
    id: row.id,
    name: row.name,
    dosage: row.dosage || '',
    frequency: row.frequency || '',
    time: row.time_of_day || '08:00 AM',
    route: row.route || 'Oral',
    duration: row.duration || '',
    safetyFlag: row.safety_flag || 'GREEN',
    nudge: {
      headline: row.nudge_headline || '',
      plainInstruction: row.nudge_plain_instruction || '',
      theWhy: row.nudge_the_why || '',
      habitHook: row.nudge_habit_hook || '',
      warning: row.nudge_warning || '',
    },
    takenToday: row.taken_today || false,
    streak: row.streak || 0,
    totalDoses: row.total_doses || 0,
    takenDoses: row.taken_doses || 0,
    refillDate: row.refill_date || null,
    active: row.active !== false,
    createdAt: row.created_at,
  };
}

function mapInteractionRow(row) {
  return {
    id: row.id,
    severity: row.severity || 'moderate',
    drug1: row.drug1,
    drug2: row.drug2,
    description: row.description || '',
    recommendation: row.recommendation || '',
    plainExplanation: row.plain_explanation || '',
    resolved: row.resolved || false,
  };
}

function mapCaregiverRow(row) {
  return {
    id: row.id,
    name: row.name,
    relationship: row.relationship || '',
    phone: row.phone || '',
    notificationsEnabled: row.notifications_enabled !== false,
  };
}

export function AppProvider({ children }) {
  // ── State ──
  const [patient, setPatientState] = useState(INITIAL_PATIENT);
  const [patientId, setPatientId] = useState(() => localStorage.getItem('drNudge_patientId'));
  const [medications, setMedications] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [caregivers, setCaregivers] = useState([]);
  const [activePage, setActivePage] = useState('home');
  const [loading, setLoading] = useState(true);
  const subscriptionsRef = useRef([]);

  // ── Boot: Load patient from Supabase if we have a stored ID ──
  useEffect(() => {
    if (patientId) {
      loadPatientData(patientId);
    } else {
      setLoading(false);
    }
    return () => {
      // Cleanup real-time subscriptions
      subscriptionsRef.current.forEach((sub) => sub.unsubscribe());
    };
  }, []);

  // ── Load all data for a patient ──
  async function loadPatientData(pid) {
    try {
      setLoading(true);

      // Fetch patient
      const { data: patientRow, error: pErr } = await supabase
        .from('patients')
        .select('*')
        .eq('id', pid)
        .single();

      if (pErr || !patientRow) {
        console.error('Patient not found, resetting:', pErr);
        localStorage.removeItem('drNudge_patientId');
        setPatientId(null);
        setLoading(false);
        return;
      }

      setPatientState({
        name: patientRow.name || '',
        age: patientRow.age || '',
        language: patientRow.language || 'en',
        wake_time: patientRow.wake_time || '07:00',
        morning_routine: patientRow.morning_routine || '',
        motivation: patientRow.motivation || '',
        height: patientRow.height || '',
        weight: patientRow.weight || '',
        onboarded: patientRow.onboarded || false,
        voice_enabled: patientRow.voice_enabled !== false,
        elderly_mode: patientRow.elderly_mode || false,
      });

      // Fetch medications
      const { data: medRows } = await supabase
        .from('medications')
        .select('*')
        .eq('patient_id', pid)
        .eq('active', true)
        .order('created_at', { ascending: false });

      setMedications((medRows || []).map(mapMedRow));

      // Fetch interactions
      const { data: intRows } = await supabase
        .from('interactions')
        .select('*')
        .eq('patient_id', pid)
        .order('created_at', { ascending: false });

      setInteractions((intRows || []).map(mapInteractionRow));

      // Fetch caregivers
      const { data: cgRows } = await supabase
        .from('caregivers')
        .select('*')
        .eq('patient_id', pid)
        .order('created_at', { ascending: false });

      setCaregivers((cgRows || []).map(mapCaregiverRow));

      // ── Set up Realtime subscriptions ──
      subscriptionsRef.current.forEach((sub) => sub.unsubscribe());
      subscriptionsRef.current = [];

      // Medications realtime
      const medSub = supabase
        .channel('meds-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'medications', filter: `patient_id=eq.${pid}` },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              setMedications((prev) => [mapMedRow(payload.new), ...prev]);
            } else if (payload.eventType === 'UPDATE') {
              setMedications((prev) =>
                prev.map((m) => (m.id === payload.new.id ? mapMedRow(payload.new) : m))
              );
            } else if (payload.eventType === 'DELETE') {
              setMedications((prev) => prev.filter((m) => m.id !== payload.old.id));
            }
          }
        )
        .subscribe();

      // Interactions realtime
      const intSub = supabase
        .channel('interactions-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'interactions', filter: `patient_id=eq.${pid}` },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              setInteractions((prev) => [mapInteractionRow(payload.new), ...prev]);
            } else if (payload.eventType === 'UPDATE') {
              setInteractions((prev) =>
                prev.map((i) => (i.id === payload.new.id ? mapInteractionRow(payload.new) : i))
              );
            } else if (payload.eventType === 'DELETE') {
              setInteractions((prev) => prev.filter((i) => i.id !== payload.old.id));
            }
          }
        )
        .subscribe();

      // Caregivers realtime
      const cgSub = supabase
        .channel('caregivers-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'caregivers', filter: `patient_id=eq.${pid}` },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              setCaregivers((prev) => [mapCaregiverRow(payload.new), ...prev]);
            } else if (payload.eventType === 'UPDATE') {
              setCaregivers((prev) =>
                prev.map((c) => (c.id === payload.new.id ? mapCaregiverRow(payload.new) : c))
              );
            } else if (payload.eventType === 'DELETE') {
              setCaregivers((prev) => prev.filter((c) => c.id !== payload.old.id));
            }
          }
        )
        .subscribe();

      subscriptionsRef.current = [medSub, intSub, cgSub];
    } catch (err) {
      console.error('Failed to load patient data:', err);
    } finally {
      setLoading(false);
    }
  }

  // ── Derived state ──
  const pendingMeds = medications.filter((m) => !m.takenToday);
  const completedMeds = medications.filter((m) => m.takenToday);
  const adherenceRate =
    medications.length > 0
      ? medications.reduce(
          (sum, m) => sum + (m.totalDoses > 0 ? (m.takenDoses / m.totalDoses) * 100 : 0),
          0
        ) / medications.length
      : 0;
  const bestStreak = Math.max(...medications.map((m) => m.streak || 0), 0);
  const unresolvedAlerts = interactions.filter((i) => !i.resolved);

  // ── Patient Actions ──
  const updatePatient = useCallback(
    async (updates) => {
      setPatientState((prev) => ({ ...prev, ...updates }));
      if (patientId) {
        // Map frontend keys to DB column names
        const dbUpdates = {};
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.age !== undefined) dbUpdates.age = updates.age;
        if (updates.language !== undefined) dbUpdates.language = updates.language;
        if (updates.wake_time !== undefined) dbUpdates.wake_time = updates.wake_time;
        if (updates.wakeTime !== undefined) dbUpdates.wake_time = updates.wakeTime;
        if (updates.morning_routine !== undefined) dbUpdates.morning_routine = updates.morning_routine;
        if (updates.morningRoutine !== undefined) dbUpdates.morning_routine = updates.morningRoutine;
        if (updates.motivation !== undefined) dbUpdates.motivation = updates.motivation;
        if (updates.height !== undefined) dbUpdates.height = updates.height;
        if (updates.weight !== undefined) dbUpdates.weight = updates.weight;
        if (updates.voice_enabled !== undefined) dbUpdates.voice_enabled = updates.voice_enabled;
        if (updates.voiceEnabled !== undefined) dbUpdates.voice_enabled = updates.voiceEnabled;
        if (updates.elderly_mode !== undefined) dbUpdates.elderly_mode = updates.elderly_mode;
        if (updates.elderlyMode !== undefined) dbUpdates.elderly_mode = updates.elderlyMode;
        dbUpdates.updated_at = new Date().toISOString();

        await supabase.from('patients').update(dbUpdates).eq('id', patientId);
      }
    },
    [patientId]
  );

  const completeOnboarding = useCallback(
    async (patientData) => {
      try {
        // Create patient in Supabase
        const { data: newPatient, error } = await supabase
          .from('patients')
          .insert({
            name: patientData.name || '',
            age: patientData.age || '',
            language: patientData.language || patient.language || 'en',
            wake_time: patientData.wakeTime || patient.wake_time || '07:00',
            morning_routine: patientData.morningRoutine || patient.morning_routine || '',
            motivation: patientData.motivation || patient.motivation || '',
            height: patientData.height || '',
            weight: patientData.weight || '',
            onboarded: true,
            voice_enabled: true,
            elderly_mode: false,
          })
          .select()
          .single();

        if (error) throw error;
            language: patientData.language || patient.language || 'en',
            wake_time: patientData.wakeTime || patient.wake_time || '07:00',
            morning_routine: patientData.morningRoutine || patient.morning_routine || '',
            motivation: patientData.motivation || patient.motivation || '',
            height: patientData.height || '',
            weight: patientData.weight || '',
            onboarded: true,
            voice_enabled: true,
            elderly_mode: false,
          })
          .select()
          .single();

        if (error) throw error;

        const pid = newPatient.id;
        localStorage.setItem('drNudge_patientId', pid);
        setPatientId(pid);
        setPatientState({
          name: newPatient.name,
          age: newPatient.age || '',
          height: newPatient.height || '',
          weight: newPatient.weight || '',
          onboarded: true,
          voice_enabled: true,
          elderly_mode: false,
        });

        // Load data (will be empty, but sets up realtime subscriptions)
        await loadPatientData(pid);
      } catch (err) {
        console.error('Onboarding failed:', err);
        // More detailed error logging
        if (err.message) console.error('Error message:', err.message);
        if (err.details) console.error('Error details:', err.details);
        if (err.hint) console.error('Error hint:', err.hint);
        
        // Clean up on failure
        localStorage.removeItem('drNudge_patientId');
        setPatientId(null);
        setPatientState(INITIAL_PATIENT);
        throw new Error(`Onboarding failed: ${err.message || err}`);
      }
    },
    []
  );

  const resetOnboarding = useCallback(async () => {
    // Remove local ID
    localStorage.removeItem('drNudge_patientId');
    // Clean up subscriptions
    subscriptionsRef.current.forEach((sub) => sub.unsubscribe());
    subscriptionsRef.current = [];
    // Reset state
    setPatientId(null);
    setPatientState(INITIAL_PATIENT);
    setMedications([]);
    setInteractions([]);
    setCaregivers([]);
    setActivePage('home');
  }, []);

  // ── Medication Actions ──
  const takeMedication = useCallback(
    async (medId) => {
      // Optimistic update
      setMedications((prev) =>
        prev.map((m) =>
          m.id === medId
            ? { ...m, takenToday: true, takenDoses: m.takenDoses + 1, streak: m.streak + 1 }
            : m
        )
      );

      // Persist to Supabase
      const med = medications.find((m) => m.id === medId);
      if (med) {
        await supabase
          .from('medications')
          .update({
            taken_today: true,
            taken_doses: med.takenDoses + 1,
            streak: med.streak + 1,
          })
          .eq('id', medId);

        // Log the dose
        if (patientId) {
          await supabase.from('medication_logs').insert({
            medication_id: medId,
            patient_id: patientId,
            action: 'taken',
          });
        }
      }
    },
    [medications, patientId]
  );

  const undoTakeMedication = useCallback(
    async (medId) => {
      // Optimistic update
      setMedications((prev) =>
        prev.map((m) =>
          m.id === medId
            ? {
                ...m,
                takenToday: false,
                takenDoses: Math.max(0, m.takenDoses - 1),
                streak: Math.max(0, m.streak - 1),
              }
            : m
        )
      );

      const med = medications.find((m) => m.id === medId);
      if (med) {
        await supabase
          .from('medications')
          .update({
            taken_today: false,
            taken_doses: Math.max(0, med.takenDoses - 1),
            streak: Math.max(0, med.streak - 1),
          })
          .eq('id', medId);

        if (patientId) {
          await supabase.from('medication_logs').insert({
            medication_id: medId,
            patient_id: patientId,
            action: 'undo',
          });
        }
      }
    },
    [medications, patientId]
  );

  const addMedication = useCallback(
    async (newMed) => {
      if (!patientId) return;

      const { data: row, error } = await supabase
        .from('medications')
        .insert({
          patient_id: patientId,
          name: newMed.name,
          dosage: newMed.dosage || '',
          frequency: newMed.frequency || '',
          time_of_day: newMed.time || '08:00 AM',
          route: newMed.route || 'Oral',
          duration: newMed.duration || '',
          safety_flag: newMed.safetyFlag || 'GREEN',
          nudge_headline: newMed.nudge?.headline || '',
          nudge_plain_instruction: newMed.nudge?.plainInstruction || newMed.nudge?.plain_instruction || '',
          nudge_the_why: newMed.nudge?.theWhy || newMed.nudge?.the_why || '',
          nudge_habit_hook: newMed.nudge?.habitHook || newMed.nudge?.habit_hook || '',
          nudge_warning: newMed.nudge?.warning || newMed.nudge?.warning_label || '',
          taken_today: false,
          streak: 0,
          total_doses: newMed.totalDoses || 0,
          taken_doses: 0,
          active: true,
        })
        .select()
        .single();

      if (!error && row) {
        // Realtime will pick this up, but add immediately for responsiveness
        setMedications((prev) => [mapMedRow(row), ...prev]);
      }
      return row;
    },
    [patientId]
  );

  const updateMedication = useCallback(
    async (medId, updates) => {
      if (!patientId) return;

      // Build DB updates object
      const dbUpdates = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.dosage !== undefined) dbUpdates.dosage = updates.dosage;
      if (updates.frequency !== undefined) dbUpdates.frequency = updates.frequency;
      if (updates.time !== undefined) dbUpdates.time_of_day = updates.time;
      if (updates.route !== undefined) dbUpdates.route = updates.route;
      if (updates.duration !== undefined) dbUpdates.duration = updates.duration;
      if (updates.safetyFlag !== undefined) dbUpdates.safety_flag = updates.safetyFlag;
      if (updates.refillDate !== undefined) dbUpdates.refill_date = updates.refillDate;
      
      // Handle nudge updates
      if (updates.nudge) {
        if (updates.nudge.headline !== undefined) dbUpdates.nudge_headline = updates.nudge.headline;
        if (updates.nudge.plainInstruction !== undefined) dbUpdates.nudge_plain_instruction = updates.nudge.plainInstruction;
        if (updates.nudge.theWhy !== undefined) dbUpdates.nudge_the_why = updates.nudge.theWhy;
        if (updates.nudge.habitHook !== undefined) dbUpdates.nudge_habit_hook = updates.nudge.habitHook;
        if (updates.nudge.warning !== undefined) dbUpdates.nudge_warning = updates.nudge.warning;
      }

      dbUpdates.updated_at = new Date().toISOString();

      // Optimistic update
      setMedications((prev) =>
        prev.map((m) => {
          if (m.id === medId) {
            const updatedMed = { ...m };
            if (updates.name !== undefined) updatedMed.name = updates.name;
            if (updates.dosage !== undefined) updatedMed.dosage = updates.dosage;
            if (updates.frequency !== undefined) updatedMed.frequency = updates.frequency;
            if (updates.time !== undefined) updatedMed.time = updates.time;
            if (updates.route !== undefined) updatedMed.route = updates.route;
            if (updates.duration !== undefined) updatedMed.duration = updates.duration;
            if (updates.safetyFlag !== undefined) updatedMed.safetyFlag = updates.safetyFlag;
            if (updates.refillDate !== undefined) updatedMed.refillDate = updates.refillDate;
            if (updates.nudge) {
              updatedMed.nudge = { ...updatedMed.nudge, ...updates.nudge };
            }
            return updatedMed;
          }
          return m;
        })
      );

      // Persist to Supabase
      const { data, error } = await supabase
        .from('medications')
        .update(dbUpdates)
        .eq('id', medId)
        .select()
        .single();

      if (error) {
        console.error('Failed to update medication:', error);
        // Revert optimistic update on error
        const med = medications.find((m) => m.id === medId);
        if (med) {
          setMedications((prev) =>
            prev.map((m) => (m.id === medId ? med : m))
          );
        }
      }

      return data;
    },
    [patientId, medications]
  );

  const deleteMedication = useCallback(
    async (medId) => {
      if (!patientId) return;

      // Optimistic update
      setMedications((prev) => prev.filter((m) => m.id !== medId));

      // Soft delete (mark as inactive) or hard delete
      const { error } = await supabase
        .from('medications')
        .update({ active: false })
        .eq('id', medId);

      if (error) {
        console.error('Failed to delete medication:', error);
        // Could revert here if needed
      }
    },
    [patientId]
  );

  const addInteraction = useCallback(
    async (inter) => {
      if (!patientId) return;

      const { data: row, error } = await supabase
        .from('interactions')
        .insert({
          patient_id: patientId,
          drug1: inter.drug1,
          drug2: inter.drug2,
          severity: inter.severity || 'moderate',
          description: inter.description || '',
          recommendation: inter.recommendation || '',
          plain_explanation: inter.plainExplanation || inter.plain_explanation || '',
          resolved: false,
        })
        .select()
        .single();

      if (!error && row) {
        setInteractions((prev) => [mapInteractionRow(row), ...prev]);
      }
    },
    [patientId]
  );

  const resolveInteraction = useCallback(async (intId) => {
    setInteractions((prev) =>
      prev.map((i) => (i.id === intId ? { ...i, resolved: true } : i))
    );
    await supabase.from('interactions').update({ resolved: true }).eq('id', intId);
  }, []);

  // ── Caregiver Actions ──
  const addCaregiver = useCallback(
    async (cg) => {
      if (!patientId) return;

      const { data: row, error } = await supabase
        .from('caregivers')
        .insert({
          patient_id: patientId,
          name: cg.name,
          relationship: cg.relationship || '',
          phone: cg.phone || '',
          notifications_enabled: cg.notificationsEnabled !== false,
        })
        .select()
        .single();

      if (!error && row) {
        setCaregivers((prev) => [mapCaregiverRow(row), ...prev]);
      }
    },
    [patientId]
  );

  const removeCaregiver = useCallback(async (cgId) => {
    setCaregivers((prev) => prev.filter((c) => c.id !== cgId));
    await supabase.from('caregivers').delete().eq('id', cgId);
  }, []);

  // ── Text-to-speech ──
  const speak = useCallback(
    (text) => {
      if (patient.voice_enabled === false) return;
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.85;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    },
    [patient.voice_enabled]
  );

  const value = {
    // Patient
    patient,
    patientId,
    updatePatient,
    completeOnboarding,
    resetOnboarding,
    // Navigation
    activePage,
    setActivePage,
    // Medications
    medications,
    pendingMeds,
    completedMeds,
    takeMedication,
    undoTakeMedication,
    addMedication,
    updateMedication,
    deleteMedication,
    // Interactions & Safety
    interactions,
    unresolvedAlerts,
    addInteraction,
    resolveInteraction,
    // Caregivers
    caregivers,
    setCaregivers,
    addCaregiver,
    removeCaregiver,
    // Stats
    adherenceRate,
    bestStreak,
    // Voice
    speak,
    // Data
    languages: LANGUAGES,
    // Loading
    loading,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
