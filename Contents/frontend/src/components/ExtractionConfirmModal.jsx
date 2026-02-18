import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X, AlertTriangle, Edit2, Plus, RefreshCw, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { clearImageCache } from '../services/api';

/**
 * Confirmation Modal - Shows extracted medications for user verification
 * Allows corrections before saving to database
 */
export default function ExtractionConfirmModal({ 
  extractedMeds, 
  failedExtractions, 
  onConfirm, 
  onCancel,
  onRetry,
  currentImageFile
}) {
  const { t } = useApp();
  const [editingIndex, setEditingIndex] = useState(null);
  const [medications, setMedications] = useState(extractedMeds);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const handleEdit = (index, field, value) => {
    const updated = [...medications];
    if (!updated[index].extracted_data) updated[index].extracted_data = {};
    updated[index].extracted_data[field] = value;
    setMedications(updated);
  };

  const handleRemove = (index) => {
    setMedications(meds => meds.filter((_, i) => i !== index));
  };

  const handleAddSuggestion = (suggestion, failedExtraction) => {
    console.log('📋 Adding suggestion:', suggestion);
    console.log('📋 Failed extraction object:', failedExtraction);
    console.log('📋 Extracted data:', failedExtraction.extractedData);
    
    // Create a new medication from the suggestion
    // Try to preserve original dosage/frequency/timing if available
    const extractedData = failedExtraction.extractedData || {};
    
    const newMedication = {
      extracted_data: {
        drug_name: suggestion,
        dosage: extractedData.dosage || '',
        frequency: extractedData.frequency || 'Once daily',
        dose_timing: extractedData.dose_timing || '1-0-0',
        dosing_source: extractedData.dosing_source || 'prescription',
        duration: extractedData.duration || '',
        route: extractedData.route || 'Oral'
      },
      safety_flag: 'YELLOW', // Mark as needing review since it was a suggestion
      interactions: [],
      fromSuggestion: true, // Flag to show special indicator
      skipValidation: true // Skip validation since this is already a validated suggestion
    };
    
    console.log('✅ Created medication with preserved data:');
    console.log('   Drug name:', newMedication.extracted_data.drug_name);
    console.log('   Dosage:', newMedication.extracted_data.dosage);
    console.log('   Frequency:', newMedication.extracted_data.frequency);
    console.log('   Dose timing:', newMedication.extracted_data.dose_timing);
    
    setMedications(prev => [...prev, newMedication]);
    
    // Visual feedback
    console.log(`✅ Added suggested medication: ${suggestion}`);
  };

  const handleConfirm = async () => {
    if (isConfirming) return; // Prevent multiple clicks
    
    setIsConfirming(true);
    try {
      await onConfirm(medications);
    } catch (error) {
      console.error('Error confirming medications:', error);
      setIsConfirming(false); // Re-enable button on error
    }
    // Note: Don't set isConfirming to false on success - modal will close
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetry(); // This will call processImage with forceRefresh=true
    } catch (error) {
      console.error('Error during retry:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Verify Extracted Medications</h2>
              <p className="text-sm text-gray-500 mt-1">
                Please review and confirm the extracted information
              </p>
            </div>
            <button
              onClick={onCancel}
              className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <X size={18} className="text-gray-600" />
            </button>
          </div>

          {/* Failed extractions warning */}
          {failedExtractions && failedExtractions.length > 0 && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle size={18} className="text-yellow-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-yellow-800">
                    {failedExtractions.length} medication(s) could not be verified
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    Click a suggestion below to add it to your medications list
                  </p>
                  <div className="mt-3 space-y-3">
                    {failedExtractions.map((failed, i) => (
                      <div key={i} className="bg-white rounded-lg p-3 border border-yellow-300">
                        <p className="text-sm font-medium text-gray-900">
                          Couldn't verify: <strong>"{failed.originalName || 'Unknown'}"</strong>
                        </p>
                        {failed.suggestions && failed.suggestions.length > 0 ? (
                          <div className="mt-2">
                            <p className="text-xs text-gray-600 mb-2 font-medium">Did you mean one of these?</p>
                            <div className="flex flex-wrap gap-2">
                              {failed.suggestions.slice(0, 5).map((suggestion, si) => (
                                <button
                                  key={si}
                                  onClick={() => handleAddSuggestion(suggestion, failed)}
                                  className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                                >
                                  + Add "{suggestion}"
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-gray-600 italic">
                            No suggestions available. Try using the "Try Again" button below for a fresh scan.
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Medication List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {medications.length === 0 ? (
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold text-gray-900">{t('verifyMedications', 'Verify Extracted Medications')}</h2>
              <p className="text-sm text-gray-500 mt-1">{t('reviewAndConfirm', 'Please review and confirm the extracted information')}</p>
              <p className="text-gray-400 mt-4">
                {failedExtractions && failedExtractions.length > 0 ? (
                  <>
                    No medications could be verified automatically.
                    <br />
                    {failedExtractions.some(f => f.suggestions && f.suggestions.length > 0) ? (
                      <span>Please review the suggestions above or try again with a clearer photo.</span>
                    ) : (
                      <span>Please try taking a clearer photo with good lighting.</span>
                    )}
                  </>
                ) : (
                  <>
                    {t('nothingFound', 'No medications were found in this image.')}
                    <br />
                    {t('tryAgain', 'Please try taking a clearer photo')}
                  </>
                )}
              </p>
            </div>
          ) : (
            <>
              {failedExtractions && failedExtractions.length > 0 && (
                <div className="h-4" />
              )}
              {medications.map((med, index) => (
                <MedicationCard
                  key={index}
                  medication={med}
                  index={index}
                  isEditing={editingIndex === index}
                  onEdit={handleEdit}
                  onStartEdit={() => setEditingIndex(index)}
                  onStopEdit={() => setEditingIndex(null)}
                  onRemove={handleRemove}
                />
              ))}
              {failedExtractions.length > 0 && (
                <div className="mt-4 p-3 bg-yellow-50 rounded-xl border border-yellow-200">
                  <p className="text-sm font-semibold text-yellow-800">
                    {failedExtractions.length} {t('couldNotReadClearly', 'medication(s) could not be read clearly')}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 space-y-3">
          <button
            onClick={handleConfirm}
            disabled={medications.length === 0 || isConfirming}
            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold text-base flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isConfirming ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Saving medications...
              </>
            ) : medications.length === 0 ? (
              <>
                <Check size={20} />
                Add at least one medication first
              </>
            ) : (
              <>
                <Check size={20} />
                {t('confirmAndAdd', 'Confirm & Add')} {medications.length} {t('medication', 'Medication')}{medications.length !== 1 ? 's' : ''}
              </>
            )}
          </button>

          {/* Try Again Button - Always available to force re-extraction */}
          {onRetry && (
            <button
              onClick={handleRetry}
              disabled={isRetrying || isConfirming}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-base flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              <RefreshCw size={20} className={isRetrying ? 'animate-spin' : ''} />
              {isRetrying ? 'Re-scanning...' : t('tryAgain', 'Try Again (Force Re-extraction)')}
            </button>
          )}

          <button
            onClick={onCancel}
            disabled={isConfirming}
            className="w-full py-4 bg-white border border-gray-300 text-gray-700 rounded-2xl font-medium text-base hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('cancel', 'Cancel')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function MedicationCard({ medication, index, isEditing, onEdit, onStartEdit, onStopEdit, onRemove }) {
  const data = medication.extracted_data || {};
  const safetyFlag = medication.safety_flag || 'GREEN';
  
  const borderColor = {
    RED: 'border-l-red-500 bg-red-50',
    YELLOW: 'border-l-yellow-500 bg-yellow-50',
    GREEN: 'border-l-green-500 bg-green-50',
  }[safetyFlag];

  if (isEditing) {
    return (
      <div className={`border-l-4 ${borderColor} rounded-xl p-4`}>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Medicine Name</label>
            <input
              value={data.drug_name || ''}
              onChange={(e) => onEdit(index, 'drug_name', e.target.value)}
              className="w-full px-3 py-2 bg-white rounded-lg text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Dosage</label>
              <input
                type="text"
                value={data.dosage || ''}
                onChange={(e) => onEdit(index, 'dosage', e.target.value)}
                className="w-full px-3 py-2 bg-white rounded-lg text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Dose Timing (M-N-E)</label>
              <input
                type="text"
                value={data.dose_timing || '1-0-0'}
                onChange={(e) => onEdit(index, 'dose_timing', e.target.value)}
                placeholder="e.g., 1-0-1"
                className="w-full px-3 py-2 bg-white rounded-lg text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Frequency</label>
            <input
              type="text"
              value={data.frequency || ''}
              onChange={(e) => onEdit(index, 'frequency', e.target.value)}
              className="w-full px-3 py-2 bg-white rounded-lg text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>
          <button
            onClick={onStopEdit}
            className="w-full py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            Done Editing
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`border-l-4 ${borderColor} rounded-xl p-4`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-gray-900 text-lg">{data.drug_name || 'Unknown'}</h3>
            {medication.fromSuggestion && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                From suggestion - please verify
              </span>
            )}
          </div>
          <div className="mt-2 space-y-1 text-sm text-gray-600">
            <p><span className="font-medium">Dosage:</span> {data.dosage || 'Not specified'}</p>
            <p className="flex items-center gap-2 flex-wrap">
              <span><span className="font-medium">Dose Timing:</span> {data.dose_timing || '1-0-0'} <span className="text-xs text-gray-500">(Morning-Noon-Night)</span></span>
              {data.dosing_source === 'ai_generated' && (
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded" title="Dosing schedule was generated based on standard medical guidelines as it was not clearly visible in the prescription image">
                  AI-suggested
                </span>
              )}
            </p>
            <p><span className="font-medium">Frequency:</span> {data.frequency || 'Not specified'}</p>
            {data.duration && (
              <p><span className="font-medium">Duration:</span> {data.duration}</p>
            )}
          </div>
          {medication.safety_flag !== 'GREEN' && (
            <div className="mt-2 text-xs text-gray-500 bg-white/50 rounded-lg p-2">
              ⚠️ {medication.safety_reasoning || 'Potential safety concerns detected'}
            </div>
          )}
        </div>
        <div className="flex gap-2 ml-4">
          <button
            onClick={onStartEdit}
            className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center hover:bg-blue-200 transition-colors"
            title="Edit"
          >
            <Edit2 size={14} className="text-blue-600" />
          </button>
          <button
            onClick={() => onRemove(index)}
            className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center hover:bg-red-200 transition-colors"
            title="Remove"
          >
            <X size={14} className="text-red-600" />
          </button>
        </div>
      </div>
    </div>
  );
}
