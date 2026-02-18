import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { getTranslation } from '../lib/translations';

const AppContext = createContext(null);

const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिंदी' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
];

const INITIAL_PATIENT = {
  name: '',
  age: '',
  email: '',
  profile_image: '👤',
  language: 'en',
  wake_time: '07:00',
  breakfast_time: '08:00',
  lunch_time: '13:00',
  dinner_time: '19:00',
  morning_routine: '',
  motivation: '',
  height: '',
  weight: '',
  onboarded: false,
  voice_enabled: true,
  scale: '1',

};

// ── Helper: map a Supabase medication row → frontend medication object ──
function mapMedRow(row) {
  // Check if all required doses for today are taken
  const timing = (row.dose_timing || '1-0-0').split('-').map(Number);
  const morningDone = timing[0] === 0 || row.morning_taken;
  const noonDone = timing[1] === 0 || row.noon_taken;
  const eveningDone = timing[2] === 0 || row.evening_taken;
  const allDosesTaken = morningDone && noonDone && eveningDone;
  
  return {
    id: row.id,
    name: row.name,
    dosage: row.dosage || '',
    frequency: row.frequency || '',
    doseTiming: row.dose_timing || '1-0-0',
    dosingSource: row.dosing_source || 'prescription',
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
    morningTaken: row.morning_taken || false,
    noonTaken: row.noon_taken || false,
    eveningTaken: row.evening_taken || false,
    takenToday: allDosesTaken, // All required doses taken
    lastResetDate: row.last_reset_date,
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

function mapMedicationLogRow(row, medications) {
  // Find the medication name from the medications array
  const medication = medications.find(m => m.id === row.medication_id);
  return {
    id: row.id,
    medicationId: row.medication_id,
    medicationName: medication?.name || 'Unknown Medication',
    action: row.action,
    loggedAt: row.logged_at,
  };
}

export function AppProvider({ children }) {
  // ── State ──
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [patient, setPatientState] = useState(INITIAL_PATIENT);
  const [patientId, setPatientId] = useState(null);
  const [medications, setMedications] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [caregivers, setCaregivers] = useState([]);
  const [medicationLogs, setMedicationLogs] = useState([]);
  const [activePage, setActivePage] = useState('home');
  const [loading, setLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const subscriptionsRef = useRef([]);

  // ── Authentication: Listen to Supabase auth state changes ──
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Boot: Load patient from Supabase when user is authenticated ──
  const hasLoadedRef = useRef(false);
  
  useEffect(() => {
    if (user && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadPatientForUser(user.id);
    } else if (!user) {
      hasLoadedRef.current = false;
      setPatientId(null);
      setPatientState(INITIAL_PATIENT);
      setMedications([]);
      setInteractions([]);
      setCaregivers([]);
      setLoading(false);
    }
    
    return () => {
      // Cleanup real-time subscriptions only on unmount
      if (!user) {
        subscriptionsRef.current.forEach((sub) => sub.unsubscribe());
        subscriptionsRef.current = [];
      }
    };
  }, [user]);

  // ── Load patient data for authenticated user ──
  async function loadPatientForUser(userId) {
    try {
      setLoading(true);

      // Find patient associated with this user
      const { data: patientRow, error: pErr } = await supabase
        .from('patients')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (pErr && pErr.code !== 'PGRST116') {
        console.error('Error loading patient:', pErr);
        setLoading(false);
        return;
      }

      // If patient found, load their data
      if (patientRow) {
        setPatientId(patientRow.id);
        await loadPatientData(patientRow.id);
      } else {
        // No patient profile yet - they'll go through onboarding
        setPatientId(null);
        setPatientState(INITIAL_PATIENT);
        setLoading(false);
      }
    } catch (err) {
      console.error('Error loading patient for user:', err);
      setLoading(false);
    }
  }

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
        breakfast_time: patientRow.breakfast_time || '08:00',
        lunch_time: patientRow.lunch_time || '13:00',
        dinner_time: patientRow.dinner_time || '19:00',
        morning_routine: patientRow.morning_routine || '',
        motivation: patientRow.motivation || '',
        height: patientRow.height || '',
        weight: patientRow.weight || '',
        onboarded: patientRow.onboarded || false,
        voice_enabled: patientRow.voice_enabled !== false,
        scale: patientRow.scale || '1',

      });

      // Fetch medications
      const { data: medRows } = await supabase
        .from('medications')
        .select('*')
        .eq('patient_id', pid)
        .eq('active', true)
        .order('created_at', { ascending: false });

      // Reset daily slots if needed
      if (medRows && medRows.length > 0) {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        const medsToReset = medRows.filter(med => {
          if (!med.last_reset_date) return true; // Never reset before
          return med.last_reset_date !== today; // Reset date is from a previous day
        });

        if (medsToReset.length > 0) {
          console.log(`🔄 Resetting ${medsToReset.length} medications for new day`);
          
          // Reset in database
          const resetPromises = medsToReset.map(med =>
            supabase
              .from('medications')
              .update({
                morning_taken: false,
                noon_taken: false,
                evening_taken: false,
                last_reset_date: today
              })
              .eq('id', med.id)
          );
          
          await Promise.all(resetPromises);
          
          // Update local rows to reflect reset
          medsToReset.forEach(med => {
            med.morning_taken = false;
            med.noon_taken = false;
            med.evening_taken = false;
            med.last_reset_date = today;
          });
        }
      }

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

      // Fetch medication logs (last 90 days)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      
      const { data: logRows } = await supabase
        .from('medication_logs')
        .select('*')
        .eq('patient_id', pid)
        .gte('logged_at', ninetyDaysAgo.toISOString())
        .order('logged_at', { ascending: false });

      // Map logs with medication names
      const mappedMedications = (medRows || []).map(mapMedRow);
      setMedicationLogs((logRows || []).map(row => mapMedicationLogRow(row, mappedMedications)));

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
              // Check for duplicates before adding
              setMedications((prev) => {
                const exists = prev.some((m) => m.id === payload.new.id);
                if (exists) return prev; // Already added, skip
                return [mapMedRow(payload.new), ...prev];
              });
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
              // Check for duplicates before adding
              setInteractions((prev) => {
                const exists = prev.some((i) => i.id === payload.new.id);
                if (exists) return prev; // Already added, skip
                return [mapInteractionRow(payload.new), ...prev];
              });
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
              // Check for duplicates before adding
              setCaregivers((prev) => {
                const exists = prev.some((c) => c.id === payload.new.id);
                if (exists) return prev; // Already added, skip
                return [mapCaregiverRow(payload.new), ...prev];
              });
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

      // Medication logs realtime
      const logSub = supabase
        .channel('medication-logs-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'medication_logs', filter: `patient_id=eq.${pid}` },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              // Check for duplicates before adding
              setMedicationLogs((prev) => {
                const exists = prev.some((l) => l.id === payload.new.id);
                if (exists) return prev;
                return [mapMedicationLogRow(payload.new, medications), ...prev];
              });
            } else if (payload.eventType === 'UPDATE') {
              setMedicationLogs((prev) =>
                prev.map((l) => (l.id === payload.new.id ? mapMedicationLogRow(payload.new, medications) : l))
              );
            } else if (payload.eventType === 'DELETE') {
              setMedicationLogs((prev) => prev.filter((l) => l.id !== payload.old.id));
            }
          }
        )
        .subscribe();

      subscriptionsRef.current = [medSub, intSub, cgSub, logSub];
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
  
  // Only count interactions where both medications are still active
  const activeMedNames = medications
    .filter(m => m.active !== false)
    .map(m => m.name.toLowerCase());
  
  const unresolvedAlerts = interactions.filter((i) => {
    if (i.resolved) return false;
    
    // Check if both drugs are still in active medications
    const drug1Active = activeMedNames.some(name => 
      i.drug1.toLowerCase().includes(name) || name.includes(i.drug1.toLowerCase())
    );
    const drug2Active = activeMedNames.some(name => 
      i.drug2.toLowerCase().includes(name) || name.includes(i.drug2.toLowerCase())
    );
    
    return drug1Active && drug2Active;
  });

  // ── Patient Actions ──
  const updatePatient = useCallback(
    async (updates) => {
      // Normalize property names for state update
      const stateUpdates = { ...updates };
      if (updates.voiceEnabled !== undefined) {
        stateUpdates.voice_enabled = updates.voiceEnabled;
        delete stateUpdates.voiceEnabled;
      }
      if (updates.elderlyMode !== undefined) {
        stateUpdates.elderly_mode = updates.elderlyMode;
        delete stateUpdates.elderlyMode;
      }
      
      setPatientState((prev) => ({ ...prev, ...stateUpdates }));
      
      if (patientId) {
        // Map frontend keys to DB column names
        const dbUpdates = {};
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.age !== undefined) dbUpdates.age = updates.age;
        if (updates.email !== undefined) dbUpdates.email = updates.email;
        if (updates.profile_image !== undefined) dbUpdates.profile_image = updates.profile_image;
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
        if (updates.scale !== undefined) dbUpdates.scale = updates.scale;
        dbUpdates.updated_at = new Date().toISOString();

        await supabase.from('patients').update(dbUpdates).eq('id', patientId);
      }
    },
    [patientId]
  );

  const completeOnboarding = useCallback(
    async (patientData) => {
      if (!user) {
        console.error('No authenticated user');
        return;
      }

      try {
        // Check if patient already exists for this user
        const { data: existingPatient } = await supabase
          .from('patients')
          .select('id')
          .eq('user_id', user.id)
          .single();

        const updateData = {
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
          scale: '1',
        };

        let newPatient;
        let error;

        if (existingPatient) {
          // Patient exists, update them
          const result = await supabase
            .from('patients')
            .update(updateData)
            .eq('id', existingPatient.id)
            .select()
            .single();
          newPatient = result.data;
          error = result.error;
        } else {
          // Patient doesn't exist, create them
          const result = await supabase
            .from('patients')
            .insert({ user_id: user.id, ...updateData })
            .select()
            .single();
          newPatient = result.data;
          error = result.error;
        }

        if (error) throw error;

        const pid = newPatient.id;
        setPatientId(pid);
        setPatientState({
          name: newPatient.name,
          age: newPatient.age || '',
          language: newPatient.language || 'en',
          wake_time: newPatient.wake_time || '07:00',
          morning_routine: newPatient.morning_routine || '',
          motivation: newPatient.motivation || '',
          height: newPatient.height || '',
          weight: newPatient.weight || '',
          onboarded: true,
          voice_enabled: true,
          scale: '1',
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
    [patient, user]
  );

  const resetOnboarding = useCallback(async () => {
    // Just reset the onboarded flag without logging out
    await updatePatient({ onboarded: false });
  }, [updatePatient]);

  // ── Authentication Functions ──
  const login = useCallback(async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      return { user: data.user, error: null };
    } catch (error) {
      console.error('Login error:', error);
      return { user: null, error: error.message };
    }
  }, []);

  const signup = useCallback(async (email, password, name) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
          },
        },
      });
      
      if (error) throw error;
      
      // Check if email confirmation is required
      // If user exists but session is null, email confirmation is needed
      if (data.user && !data.session) {
        return { 
          user: data.user, 
          error: null, 
          needsConfirmation: true 
        };
      }
      
      return { user: data.user, error: null, needsConfirmation: false };
    } catch (error) {
      console.error('Signup error:', error);
      return { user: null, error: error.message, needsConfirmation: false };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      // Clean up local state
      localStorage.removeItem('drNudge_patientId');
      subscriptionsRef.current.forEach((sub) => sub.unsubscribe());
      subscriptionsRef.current = [];
      
      setPatientId(null);
      setPatientState(INITIAL_PATIENT);
      setMedications([]);
      setInteractions([]);
      setCaregivers([]);
      setActivePage('home');
      
      // Sign out from Supabase
      await supabase.auth.signOut();
      return { error: null };
    } catch (error) {
      console.error('Logout error:', error);
      return { error: error.message };
    }
  }, []);

  const handleAuth = useCallback(async ({ email, password, name, isLogin }) => {
    if (isLogin) {
      return await login(email, password);
    } else {
      return await signup(email, password, name);
    }
  }, [login, signup]);

  // ── Medication Actions ──
  const takeMedication = useCallback(
    async (medId, timeSlot = 'morning') => {
      // timeSlot can be 'morning', 'noon', or 'evening'
      const slotField = `${timeSlot}_taken`;
      
      // Optimistic update
      setMedications((prev) =>
        prev.map((m) => {
          if (m.id !== medId) return m;
          
          const updated = { ...m, [timeSlot + 'Taken']: true };
          
          // Check if all required doses are now taken
          const timing = (m.doseTiming || '1-0-0').split('-').map(Number);
          const morningDone = timing[0] === 0 || (timeSlot === 'morning' ? true : m.morningTaken);
          const noonDone = timing[1] === 0 || (timeSlot === 'noon' ? true : m.noonTaken);
          const eveningDone = timing[2] === 0 || (timeSlot === 'evening' ? true : m.eveningTaken);
          updated.takenToday = morningDone && noonDone && eveningDone;
          
          // Increment counters only if not already taken for this slot
          if (!m[timeSlot + 'Taken']) {
            updated.takenDoses = m.takenDoses + 1;
            if (updated.takenToday && !m.takenToday) {
              updated.streak = m.streak + 1;
            }
          }
          
          return updated;
        })
      );

      // Persist to Supabase
      const med = medications.find((m) => m.id === medId);
      if (med && !med[timeSlot + 'Taken']) {
        const timing = (med.doseTiming || '1-0-0').split('-').map(Number);
        const morningDone = timing[0] === 0 || (timeSlot === 'morning' ? true : med.morningTaken);
        const noonDone = timing[1] === 0 || (timeSlot === 'noon' ? true : med.noonTaken);
        const eveningDone = timing[2] === 0 || (timeSlot === 'evening' ? true : med.eveningTaken);
        const allDone = morningDone && noonDone && eveningDone;
        
        await supabase
          .from('medications')
          .update({
            [slotField]: true,
            taken_doses: med.takenDoses + 1,
            streak: allDone && !med.takenToday ? med.streak + 1 : med.streak,
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
    async (medId, timeSlot = null) => {
      // If no timeSlot provided, reset all slots
      if (!timeSlot) {
        setMedications((prev) =>
          prev.map((m) =>
            m.id === medId
              ? {
                  ...m,
                  morningTaken: false,
                  noonTaken: false,
                  eveningTaken: false,
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
              morning_taken: false,
              noon_taken: false,
              evening_taken: false,
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
      } else {
        // Undo specific time slot
        const slotField = `${timeSlot}_taken`;
        
        setMedications((prev) =>
          prev.map((m) => {
            if (m.id !== medId) return m;
            
            const updated = { ...m, [timeSlot + 'Taken']: false, takenToday: false };
            
            if (m[timeSlot + 'Taken']) {
              updated.takenDoses = Math.max(0, m.takenDoses - 1);
            }
            
            return updated;
          })
        );

        const med = medications.find((m) => m.id === medId);
        if (med && med[timeSlot + 'Taken']) {
          await supabase
            .from('medications')
            .update({
              [slotField]: false,
              taken_doses: Math.max(0, med.takenDoses - 1),
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
      }
    },
    [medications, patientId]
  );

  const addMedication = useCallback(
    async (newMed) => {
      if (!patientId) {
        console.error('❌ Cannot add medication: No patientId found. User may not be logged in or onboarded.');
        console.error('Patient state:', { patientId, user });
        throw new Error('Cannot add medication: User not properly authenticated');
      }

      console.log('Adding medication:', newMed.name);
      console.log('📋 Medication data being saved:', JSON.stringify({
        name: newMed.name,
        dosage: newMed.dosage,
        frequency: newMed.frequency,
        doseTiming: newMed.doseTiming
      }, null, 2));
      
      // Try backend API first, fallback to direct Supabase
      try {
        // Import API functions dynamically to avoid circular imports
        const { createMedication } = await import('../services/api');
        
        const medicationData = {
          patient_id: patientId,
          name: newMed.name,
          dosage: newMed.dosage || '',
          frequency: newMed.frequency || '',
          dose_timing: newMed.doseTiming || '1-0-0',
          dosing_source: newMed.dosingSource || 'prescription',
          time_of_day: newMed.time || '08:00 AM',
          route: newMed.route || 'Oral',
          duration: newMed.duration || '',
          safety_flag: newMed.safetyFlag || 'GREEN',
          nudge_headline: newMed.nudge?.headline || '',
          nudge_plain_instruction: newMed.nudge?.plainInstruction || newMed.nudge?.plain_instruction || '',
          nudge_the_why: newMed.nudge?.theWhy || newMed.nudge?.the_why || '',
          nudge_habit_hook: newMed.nudge?.habitHook || newMed.nudge?.habit_hook || '',
          nudge_warning: newMed.nudge?.warning || newMed.nudge?.warning_label || '',
          total_doses: newMed.totalDoses || 0,
        };

        const row = await createMedication(medicationData);
        
        console.log('✅ Medication added via backend:', row.name);
        // Realtime will pick this up, but add immediately for responsiveness
        setMedications((prev) => [mapMedRow(row), ...prev]);
        return row;
        
      } catch (apiError) {
        console.warn('⚠️ Backend API failed, trying direct Supabase:', apiError.message);
        
        // Fallback to direct Supabase call
        const { data: row, error } = await supabase
          .from('medications')
          .insert({
            patient_id: patientId,
            name: newMed.name,
            dosage: newMed.dosage || '',
            frequency: newMed.frequency || '',
            dose_timing: newMed.doseTiming || '1-0-0',
            dosing_source: newMed.dosingSource || 'prescription',
            time_of_day: newMed.time || '08:00 AM',
            route: newMed.route || 'Oral',
            duration: newMed.duration || '',
            safety_flag: newMed.safetyFlag || 'GREEN',
            nudge_headline: newMed.nudge?.headline || '',
            nudge_plain_instruction: newMed.nudge?.plainInstruction || newMed.nudge?.plain_instruction || '',
            nudge_the_why: newMed.nudge?.theWhy || newMed.nudge?.the_why || '',
            nudge_habit_hook: newMed.nudge?.habitHook || newMed.nudge?.habit_hook || '',
            nudge_warning: newMed.nudge?.warning || newMed.nudge?.warning_label || '',
            streak: 0,
            total_doses: newMed.totalDoses || 0,
            taken_doses: 0,
            active: true,
          })
          .select()
          .single();

        if (error) {
          console.error('❌ Failed to add medication via Supabase:', error);
          throw error;
        }

        if (row) {
          console.log('✅ Medication added via Supabase fallback:', row.name);
          setMedications((prev) => [mapMedRow(row), ...prev]);
        }
        return row;
      }
    },
    [patientId, user]
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

      // Find the medication name before deleting
      const medication = medications.find(m => m.id === medId);
      const medName = medication?.name;

      // Optimistic update
      setMedications((prev) => prev.filter((m) => m.id !== medId));

      // Soft delete (mark as inactive)
      const { error } = await supabase
        .from('medications')
        .update({ active: false })
        .eq('id', medId);

      if (error) {
        console.error('Failed to delete medication:', error);
        // Could revert here if needed
      }

      // Also remove related interactions from database
      if (medName) {
        // Remove from local state
        setInteractions((prev) => 
          prev.filter((i) => 
            !i.drug1.toLowerCase().includes(medName.toLowerCase()) &&
            !i.drug2.toLowerCase().includes(medName.toLowerCase())
          )
        );

        // Remove from database (case-insensitive matching)
        await supabase
          .from('interactions')
          .delete()
          .eq('patient_id', patientId)
          .or(`drug1.ilike.%${medName}%,drug2.ilike.%${medName}%`);
      }
    },
    [patientId, medications]
  );

  const addInteraction = useCallback(
    async (inter) => {
      if (!patientId) {
        console.error('❌ Cannot add interaction: No patientId found');
        throw new Error('Cannot add interaction: User not properly authenticated');
      }

      console.log('Adding interaction:', inter.drug1, 'with', inter.drug2);
      
      // Try backend API first, fallback to direct Supabase
      try {
        // Import API functions dynamically to avoid circular imports
        const { createInteraction } = await import('../services/api');
        
        const interactionData = {
          patient_id: patientId,
          drug1: inter.drug1,
          drug2: inter.drug2,
          severity: inter.severity || 'moderate',
          description: inter.description || '',
          recommendation: inter.recommendation || '',
          plain_explanation: inter.plainExplanation || inter.plain_explanation || '',
        };

        const row = await createInteraction(interactionData);
        
        console.log('✅ Interaction added via backend:', row.drug1, 'with', row.drug2);
        // Add to local state
        if (row) {
          setInteractions((prev) => [mapInteractionRow(row), ...prev]);
        }
        return row;
        
      } catch (apiError) {
        console.warn('⚠️ Backend API failed, trying direct Supabase:', apiError.message);
        
        // Fallback to direct Supabase call
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

        if (error) {
          console.error('❌ Failed to add interaction via Supabase:', error);
          throw error;
        }

        if (row) {
          console.log('✅ Interaction added via Supabase fallback:', row.drug1, 'with', row.drug2);
          setInteractions((prev) => [mapInteractionRow(row), ...prev]);
        }
        return row;
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

  const toggleSidebarCollapse = useCallback(() => {
    setIsSidebarCollapsed((prev) => !prev);
  }, []);

  // ── Derived: primary doctor from caregivers ──
  const primaryDoctor = useMemo(
    () => caregivers.find((c) => (c.relationship || '').toLowerCase() === 'doctor'),
    [caregivers]
  );

  const callDoctor = useCallback(() => {
    const doctor = caregivers.find((c) => (c.relationship || '').toLowerCase() === 'doctor');
    if (!doctor || !doctor.phone) {
      alert('No doctor phone number saved. Add a doctor under Caregivers in your profile first.');
      return;
    }
    try {
      window.location.href = `tel:${doctor.phone}`;
    } catch (err) {
      console.error('Failed to start phone call', err);
    }
  }, [caregivers]);

  const value = {
    // Authentication
    user,
    isAuthenticated: !!user,
    authLoading,
    login,
    signup,
    logout,
    handleAuth,
    // Patient
    patient,
    patientId,
    updatePatient,
    completeOnboarding,
    resetOnboarding,
    // Navigation
    activePage,
    setActivePage,
    isSidebarCollapsed,
    toggleSidebarCollapse,
    // Medications
    medications,
    pendingMeds,
    completedMeds,
    takeMedication,
    undoTakeMedication,
    addMedication,
    updateMedication,
    deleteMedication,
    medicationLogs,
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
    primaryDoctor,
    callDoctor,
    // Stats
    adherenceRate,
    bestStreak,
    // Voice
    speak,
    // Data
    languages: LANGUAGES,
    // Translation
    t: useMemo(() => getTranslation(patient.language || 'en'), [patient.language]),
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
