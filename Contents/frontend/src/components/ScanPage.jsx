import React, { useState, useRef, useCallback } from 'react';
import './ScanProgressBar.css';
import { useApp } from '../context/AppContext';
import { processPrescription, generateNudgeBatch } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import ExtractionConfirmModal from './ExtractionConfirmModal';
import {
  Camera, Upload, Loader, CheckCircle, AlertTriangle,
  RefreshCw, Sparkles, Volume2, Edit2, X, Save
} from 'lucide-react';

const PROCESSING_STEPS = [
  { id: 'upload', label: 'Upload complete' },
  { id: 'ocr', label: 'Scanning image' },
  { id: 'extract', label: 'Extracting medications' },
  { id: 'safety', label: 'Safety check' },
  { id: 'nudge', label: 'Preparing reminders' },
  { id: 'done', label: 'Complete' },
];

export default function ScanPage() {
  const { addMedication, addInteraction, medications, patient, speak, t } = useApp();
  const fileInputRef = useRef(null);

  const [stage, setStage] = useState('idle'); // idle | processing | confirm | results | error
  const [currentStep, setCurrentStep] = useState(0);
  const [preview, setPreview] = useState(null);
  const [currentImageFile, setCurrentImageFile] = useState(null); // Store the current image file for retries
  const [results, setResults] = useState(null);
  const [extractedData, setExtractedData] = useState(null); // For confirmation modal
  const [failedExtractions, setFailedExtractions] = useState([]); // Failed extractions
  const [error, setError] = useState('');
  const [editingDrugIndex, setEditingDrugIndex] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const processImage = useCallback(async (file, forceRefresh = false) => {
    setStage('processing');
    setCurrentStep(0);
    setPreview(URL.createObjectURL(file));
    setCurrentImageFile(file); // Store the file for retries

    let stepTimer;

    try {
      // Animate through the steps while the backend processes
      setCurrentStep(0);
      await sleep(400);
      setCurrentStep(1);

      // Call the real backend full-pipeline endpoint
      const currentMedNames = medications.map((m) => m.name);
      const patientContext = {
        name: patient.name,
        age: patient.age,
        language: patient.language,
        lifestyle: patient.morning_routine,
        concerns: patient.motivation,
      };

      // Start the real processing - advance the UI steps on a timer
      stepTimer = setInterval(() => {
        setCurrentStep((prev) => Math.min(prev + 1, 4));
      }, 1500);

      const data = await processPrescription(file, currentMedNames, patientContext, forceRefresh);

      clearInterval(stepTimer);

      // Backend now returns array of medications
      const extractedMedications = data.medications || [];
      
      if (extractedMedications.length === 0) {
        throw new Error('No medications found in prescription');
      }

      console.log(`Found ${extractedMedications.length} medication(s)`);

      // Map all medications
      const enrichedDrugs = extractedMedications.map((med) => {
        const extractedDrug = med.extracted_data || {};
        const nudgeCard = med.patient_facing_card || {};
        const safetyFlag = med.safety_flag || 'GREEN';
        const medInteractions = med.interactions || [];

        return {
          name: extractedDrug.drug_name || 'Unknown Medicine',
          dosage: extractedDrug.dosage || '',
          frequency: extractedDrug.frequency || 'Once Daily',
          doseTiming: extractedDrug.dose_timing || '1-0-0',
          route: extractedDrug.route || 'Oral',
          duration: extractedDrug.duration || '30 days',
          time: getTimeFromFrequency(extractedDrug.frequency),
          safetyFlag: safetyFlag,
          takenToday: false,
          streak: 0,
          takenDoses: 0,
          totalDoses: parseInt(extractedDrug.duration) || 30,
          nudge: {
            headline: nudgeCard.headline || `Take ${extractedDrug.drug_name} as directed`,
            plainInstruction: nudgeCard.plain_instruction || '',
            theWhy: nudgeCard.the_why || '',
            habitHook: nudgeCard.habit_hook || '',
            warning: nudgeCard.warning_label || '',
          },
          interactions: medInteractions,
        };
      });

      // Collect all unique interactions
      const allInteractions = [];
      const seenInteractions = new Set();
      
      extractedMedications.forEach((med) => {
        (med.interactions || []).forEach((inter) => {
          const key = `${inter.drug1}-${inter.drug2}-${inter.severity}`;
          if (!seenInteractions.has(key)) {
            seenInteractions.add(key);
            allInteractions.push({
              drug1: inter.drug1 || '',
              drug2: inter.drug2 || 'Unknown',
              severity: inter.severity === 'high' ? 'high' : 'moderate',
              description: inter.description || '',
              recommendation: inter.recommendation || '',
              plainExplanation: inter.plainExplanation || inter.description || '',
            });
          }
        });
      });

      // Step 5: Done
      setCurrentStep(5);
      await sleep(400);

      console.log('🔵 Processing complete!');
      console.log('📊 Extracted medications:', extractedMedications);
      console.log('📊 Failed extractions:', data.failedExtractions);
      console.log('📊 About to show confirmation modal...');

      // Store extracted data and show confirmation modal
      setExtractedData(extractedMedications);
      setFailedExtractions(data.failedExtractions || []);
      setStage('confirm'); // Show confirmation modal
      
      console.log('✅ Stage set to: confirm');
      console.log('✅ extractedData state updated');
      
      if (data.failedExtractions && data.failedExtractions.length > 0) {
        speak(`Found ${enrichedDrugs.length} medication${enrichedDrugs.length > 1 ? 's' : ''}. ${data.failedExtractions.length} could not be read.`);
      } else {
        const drugNames = enrichedDrugs.map(d => d.name).join(', ');
        speak(`Found ${enrichedDrugs.length} medication${enrichedDrugs.length > 1 ? 's' : ''}: ${drugNames}. Please verify.`);
      }
    } catch (err) {
      // Clear the step timer if it's still running
      if (stepTimer) clearInterval(stepTimer);
      
      console.error('❌ Scan error:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        config: err.config,
      });
      
      // Check if backend returned failedExtractions with suggestions
      if (err.response?.status === 400 && err.response?.data?.failedExtractions) {
        const failedExtractions = err.response.data.failedExtractions;
        console.log('🔵 No valid medications extracted, but got suggestions:', failedExtractions);
        
        // Show confirmation modal with suggestions even though no medications were validated
        setExtractedData([]); // Empty medications list
        setFailedExtractions(failedExtractions);
        setCurrentStep(5); // Complete the progress
        await sleep(200);
        setStage('confirm');
        
        const totalSuggestions = failedExtractions.reduce((count, failed) => 
          count + (failed.suggestions?.length || 0), 0
        );
        
        if (totalSuggestions > 0) {
          speak(`Could not verify medications, but found ${totalSuggestions} suggestion${totalSuggestions > 1 ? 's' : ''}. Please review.`);
        } else {
          speak('Could not read any medications clearly. Please try again with a clearer photo.');
        }
        return; // Don't show error screen
      }
      
      let errorMessage = 'Something went wrong. Please try again.';
      
      if (err.response?.status === 400 && err.response?.data?.detail) {
        // Backend couldn't read the prescription
        errorMessage = err.response.data.detail;
      } else if (err.response?.status === 500) {
        errorMessage = `Backend error: ${err.response?.data?.error || 'OCR processing failed'}. Check backend logs.`;
      } else if (err.code === 'ECONNREFUSED') {
        errorMessage = 'Cannot connect to backend. Make sure the backend is running on port 5000.';
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        errorMessage = 'Request timed out. The image may be too large or complex.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setStage('error');
    }
  }, [medications, patient, speak]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
  };

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) processImage(file);
    },
    [processImage]
  );

  const handleAddAll = async () => {
    if (!results) return;

    // Add each drug to Supabase via context
    for (const drug of results.drugs) {
      await addMedication(drug);
    }

    // Add interactions to Supabase via context
    for (const inter of results.interactions) {
      await addInteraction(inter);
    }

    speak('Medicines added to your list!');
    reset();
  };

  const handleConfirmExtraction = async (confirmedMeds) => {
    try {
      console.log('🔵 Confirming extraction of', confirmedMeds.length, 'medications');
      console.log('🔵 Confirmed meds data:', JSON.stringify(confirmedMeds, null, 2));
      
      // ⚡ STEP 1: Generate nudges for confirmed medications (saves tokens!)
      console.log('🔵 Generating nudges for confirmed medications...');
      speak('Generating personalized instructions...');
      
      const { medications: medsWithNudges } = await generateNudgeBatch(
        confirmedMeds,
        {
          name: patient.name,
          age: patient.age,
          language: patient.language,
          lifestyle: patient.morning_routine,
          concerns: patient.motivation,
        }
      );
      
      console.log('✅ Nudges generated');
      console.log('✅ Meds with nudges:', JSON.stringify(medsWithNudges, null, 2));
      
      // STEP 2: Map to frontend format
      const enrichedDrugs = medsWithNudges.map((med) => {
        const extractedDrug = med.extracted_data || {};
        const nudgeCard = med.patient_facing_card || {};
        const safetyFlag = med.safety_flag || 'GREEN';
        const medInteractions = med.interactions || [];

        console.log(`📋 Mapping medication: ${extractedDrug.drug_name}`);
        console.log(`📋   Dosage from backend: ${extractedDrug.dosage}`);
        console.log(`📋   Frequency from backend: ${extractedDrug.frequency}`);

        return {
          name: extractedDrug.drug_name || 'Unknown Medicine',
          dosage: extractedDrug.dosage || '',
          frequency: extractedDrug.frequency || 'Once Daily',
          doseTiming: extractedDrug.dose_timing || '1-0-0',
          dosingSource: extractedDrug.dosing_source || 'prescription',
          route: extractedDrug.route || 'Oral',
          duration: extractedDrug.duration || '30 days',
          time: getTimeFromFrequency(extractedDrug.frequency),
          safetyFlag: safetyFlag,
          takenToday: false,
          streak: 0,
          takenDoses: 0,
          totalDoses: parseInt(extractedDrug.duration) || 30,
          nudge: {
            headline: nudgeCard.headline || `Take ${extractedDrug.drug_name} as directed`,
            plainInstruction: nudgeCard.plain_instruction || '',
            theWhy: nudgeCard.the_why || '',
            habitHook: nudgeCard.habit_hook || '',
            warning: nudgeCard.warning_label || '',
          },
          interactions: medInteractions,
        };
      });

      // Collect all interactions
      const allInteractions = [];
      const seenInteractions = new Set();
      
      medsWithNudges.forEach((med) => {
        (med.interactions || []).forEach((inter) => {
          const key = `${inter.drug1}-${inter.drug2}-${inter.severity}`;
          if (!seenInteractions.has(key)) {
            seenInteractions.add(key);
            allInteractions.push({
              drug1: inter.drug1 || '',
              drug2: inter.drug2 || 'Unknown',
              severity: inter.severity === 'high' ? 'high' : 'moderate',
              description: inter.description || '',
              recommendation: inter.recommendation || '',
              plainExplanation: inter.plainExplanation || inter.description || '',
            });
          }
        });
      });

      // STEP 3: Add to database
      console.log('Adding', enrichedDrugs.length, 'medications...');
      for (const drug of enrichedDrugs) {
        await addMedication(drug);
      }

      console.log('Adding', allInteractions.length, 'interactions...');
      for (const inter of allInteractions) {
        await addInteraction(inter);
      }

      console.log('✅ Successfully added all medications and interactions');
      speak('Medicines added to your list!');
      reset();
    } catch (err) {
      console.error('❌ Failed to add medications:', err);
      setError(`Failed to save medications: ${err.message}`);
      setStage('error');
      speak('Sorry, there was an error saving your medications.');
    }
  };

  const handleCancelConfirmation = () => {
    setStage('idle');
    setExtractedData(null);
    setFailedExtractions([]);
    setPreview(null);
    setCurrentImageFile(null);
  };

  // Handle retry with fresh extraction (bypassing cache)
  const handleRetryExtraction = async () => {
    if (currentImageFile) {
      setExtractedData(null); // Clear current results
      await processImage(currentImageFile, true); // Force refresh (bypass cache)
    }
  };

  const reset = () => {
    setStage('idle');
    setPreview(null);
    setCurrentImageFile(null);
    setResults(null);
    setError('');
    setCurrentStep(0);
    setEditingDrugIndex(null);
    setEditForm(null);
  };

  const startEditing = (drug, index) => {
    setEditingDrugIndex(index);
    setEditForm({
      name: drug.name,
      dosage: drug.dosage,
      frequency: drug.frequency,
      route: drug.route,
      duration: drug.duration,
      plainInstruction: drug.nudge?.plainInstruction || '',
      habitHook: drug.nudge?.habitHook || '',
      theWhy: drug.nudge?.theWhy || '',
    });
  };

  const saveEdit = () => {
    if (editingDrugIndex === null || !editForm) return;
    
    const updatedDrugs = [...results.drugs];
    updatedDrugs[editingDrugIndex] = {
      ...updatedDrugs[editingDrugIndex],
      name: editForm.name,
      dosage: editForm.dosage,
      frequency: editForm.frequency,
      route: editForm.route,
      duration: editForm.duration,
      nudge: {
        ...updatedDrugs[editingDrugIndex].nudge,
        plainInstruction: editForm.plainInstruction,
        habitHook: editForm.habitHook,
        theWhy: editForm.theWhy,
      },
    };
    
    setResults({ ...results, drugs: updatedDrugs });
    setEditingDrugIndex(null);
    setEditForm(null);
  };

  const cancelEdit = () => {
    setEditingDrugIndex(null);
    setEditForm(null);
  };

  return (
    <div className="page-content pb-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900 lg:text-3xl">Scan Prescription</h1>
        <p className="text-sm text-gray-500 mt-1 lg:text-base">
          Take a photo and I'll read it for you
        </p>
      </div>

      <AnimatePresence mode="wait">
        {/* ─── IDLE: Camera / Upload ─── */}
        {stage === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="scan-area relative overflow-hidden border-2 border-dashed border-gray-300 rounded-3xl flex flex-col items-center justify-center p-8 mb-4 min-h-[280px] bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-20 h-20 bg-gray-900 rounded-3xl flex items-center justify-center mb-4 shadow-lg">
                <Camera size={32} className="text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">{t('scanTapToPhoto', 'Tap to take a photo')}</h3>
              <p className="text-sm text-gray-500 text-center mb-4">
                {t('scanOrDragDrop', 'or drag & drop your prescription image here')}
              </p>

              <div className="absolute top-4 left-4 w-8 h-8 border-t-3 border-l-3 border-gray-400 rounded-tl-lg" />
              <div className="absolute top-4 right-4 w-8 h-8 border-t-3 border-r-3 border-gray-400 rounded-tr-lg" />
              <div className="absolute bottom-4 left-4 w-8 h-8 border-b-3 border-l-3 border-gray-400 rounded-bl-lg" />
              <div className="absolute bottom-4 right-4 w-8 h-8 border-b-3 border-r-3 border-gray-400 rounded-br-lg" />
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture
              onChange={handleFileSelect}
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-4 bg-gray-100 rounded-2xl text-gray-700 font-semibold flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"
            >
              <Upload size={18} /> {t('scanUploadFromGallery', 'Upload from gallery')}
            </button>

            <div className="mt-5 space-y-2 lg:flex lg:gap-6 lg:space-y-0">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {t('scanTipsTitle', 'Tips for best results')}
              </p>
              {[
                t('scanTipFlatSurface', 'Place prescription on a flat surface'),
                t('scanTipGoodLighting', "Make sure there's good lighting"),
                t('scanTipFullPhoto', 'Include the full prescription in the photo'),
              ].map((tip, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="text-green-500">✓</span> {tip}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ─── PROCESSING ─── */}
        {stage === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="py-4"
          >
            {preview && (
              <div className="w-full h-40 rounded-2xl overflow-hidden mb-6 bg-gray-100">
                <img src={preview} alt="Prescription" className="w-full h-full object-cover" />
              </div>
            )}

            {/* Fluid Progress Bar */}
            <div className="upload-progress-container mb-6">
              <div className="progress-bar-bg">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${((currentStep + 1) / PROCESSING_STEPS.length) * 100}%` }}
                />
              </div>
              <div className="progress-steps">
                {PROCESSING_STEPS.map((step, idx) => (
                  <div
                    className={`progress-step${idx < currentStep ? ' done' : idx === currentStep ? ' active' : ''}`}
                    key={step.id}
                  >
                    <span className="progress-label">{t(step.id, step.label)}</span>
                    {idx < currentStep ? (
                      <span className="progress-check">&#10003;</span>
                    ) : idx === currentStep ? (
                      <span className="progress-spinner" />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── RESULTS ─── */}
        {stage === 'results' && results && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="text-center py-4 mb-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
                className="text-5xl mb-3"
              >
                🎉
              </motion.div>
              <h2 className="text-xl font-bold text-gray-900">
                Found {results.drugs.length} medicine{results.drugs.length > 1 ? 's' : ''}!
              </h2>
              <p className="text-sm text-gray-500 mt-1">Here's what's in your prescription</p>
            </div>

            <div className="space-y-3 mb-4 sm:grid sm:grid-cols-2 sm:gap-3 sm:space-y-0 xl:grid-cols-3">
              {results.drugs.map((drug, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`p-4 rounded-2xl border-2 ${
                    drug.safetyFlag === 'RED'
                      ? 'border-red-300 bg-red-50'
                      : drug.safetyFlag === 'YELLOW'
                      ? 'border-yellow-300 bg-yellow-50'
                      : 'border-gray-100 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">💊</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900">{drug.name}</h3>
                        {drug.safetyFlag === 'RED' && (
                          <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                            ⚠️ ALERT
                          </span>
                        )}
                        {drug.safetyFlag === 'YELLOW' && (
                          <span className="text-[10px] font-bold text-yellow-700 bg-yellow-100 px-1.5 py-0.5 rounded">
                            ⚡ CAUTION
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {drug.dosage} — {drug.frequency}
                      </p>
                      {drug.nudge?.plainInstruction && (
                        <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded-lg">
                          📝 {drug.nudge.plainInstruction}
                        </p>
                      )}
                      {drug.nudge?.habitHook && (
                        <p className="text-xs text-amber-600 mt-1 italic">
                          💡 {drug.nudge.habitHook}
                        </p>
                      )}
                      {drug.nudge?.theWhy && (
                        <p className="text-xs text-blue-600 mt-1">
                          🧠 {drug.nudge.theWhy}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => startEditing(drug, i)}
                        className="p-2 rounded-xl hover:bg-gray-100 flex-shrink-0"
                        title="Edit medication"
                      >
                        <Edit2 size={16} className="text-gray-400" />
                      </button>
                      <button
                        onClick={() =>
                          speak(drug.nudge?.plainInstruction || `Take ${drug.name} ${drug.dosage}`)
                        }
                        className="p-2 rounded-xl hover:bg-gray-100 flex-shrink-0"
                        title="Read aloud"
                      >
                        <Volume2 size={16} className="text-gray-400" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Edit Modal */}
            {editingDrugIndex !== null && editForm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
                onClick={cancelEdit}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-white rounded-3xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-900">Edit Medication</h3>
                    <button onClick={cancelEdit} className="p-2 hover:bg-gray-100 rounded-xl">
                      <X size={20} />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Drug Name
                      </label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Dosage
                        </label>
                        <input
                          type="text"
                          value={editForm.dosage}
                          onChange={(e) => setEditForm({ ...editForm, dosage: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Frequency
                        </label>
                        <input
                          type="text"
                          value={editForm.frequency}
                          onChange={(e) => setEditForm({ ...editForm, frequency: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Route
                        </label>
                        <input
                          type="text"
                          value={editForm.route}
                          onChange={(e) => setEditForm({ ...editForm, route: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Duration
                        </label>
                        <input
                          type="text"
                          value={editForm.duration}
                          onChange={(e) => setEditForm({ ...editForm, duration: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Instructions
                      </label>
                      <textarea
                        value={editForm.plainInstruction}
                        onChange={(e) => setEditForm({ ...editForm, plainInstruction: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Habit Hook
                      </label>
                      <input
                        type="text"
                        value={editForm.habitHook}
                        onChange={(e) => setEditForm({ ...editForm, habitHook: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                        placeholder="e.g., Take after breakfast"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Why (Benefits)
                      </label>
                      <textarea
                        value={editForm.theWhy}
                        onChange={(e) => setEditForm({ ...editForm, theWhy: e.target.value })}
                        rows={2}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                        placeholder="e.g., Helps lower blood pressure"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={cancelEdit}
                      className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveEdit}
                      className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 flex items-center justify-center gap-2"
                    >
                      <Save size={18} /> Save Changes
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}

            {/* Safety reasoning */}
            {results.safetyReasoning && (
              <div className="mb-4 p-3 bg-blue-50 rounded-2xl border border-blue-100">
                <p className="text-xs text-blue-700">
                  <span className="font-semibold">🛡️ Safety Analysis:</span>{' '}
                  {results.safetyReasoning}
                </p>
              </div>
            )}

            {/* Interactions warning */}
            {results.interactions.length > 0 && (
              <div className="mb-4 p-4 bg-red-50 rounded-2xl border border-red-200">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-700 text-sm mb-1">
                      ⚠️ {results.interactions.length} interaction
                      {results.interactions.length > 1 ? 's' : ''} found
                    </p>
                    {results.interactions.map((inter, i) => (
                      <p key={i} className="text-xs text-red-600 mb-1">
                        • {inter.description || `${inter.drug1} + ${inter.drug2}`}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2">
              <button
                onClick={handleAddAll}
                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold text-base flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors"
              >
                <Sparkles size={18} /> Add to my medicines
              </button>
              <button
                onClick={reset}
                className="w-full py-3 bg-gray-100 text-gray-600 rounded-2xl font-medium text-sm flex items-center justify-center gap-2"
              >
                <RefreshCw size={16} /> Scan another prescription
              </button>
            </div>
          </motion.div>
        )}

        {/* ─── ERROR ─── */}
        {stage === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center py-8"
          >
            <div className="text-5xl mb-4">😕</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Oops!</h2>
            <p className="text-sm text-gray-500 max-w-xs mx-auto mb-6">{error}</p>
            <button
              onClick={reset}
              className="px-8 py-3 bg-gray-900 text-white rounded-2xl font-semibold flex items-center gap-2 mx-auto hover:bg-gray-800 transition-colors"
            >
              <RefreshCw size={16} /> Try again
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      {stage === 'confirm' && extractedData && (
        <ExtractionConfirmModal
          extractedMeds={extractedData}
          failedExtractions={failedExtractions}
          onConfirm={handleConfirmExtraction}
          onCancel={handleCancelConfirmation}
          onRetry={handleRetryExtraction}
          currentImageFile={currentImageFile}
        />
      )}
    </div>
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTimeFromFrequency(freq) {
  if (!freq) return '08:00 AM';
  const f = freq.toLowerCase();
  if (f.includes('bedtime') || f.includes('night')) return '10:00 PM';
  if (f.includes('evening')) return '06:00 PM';
  if (f.includes('afternoon')) return '02:00 PM';
  return '08:00 AM';
}
