/**
 * API Service — Handles all calls to the Dr. Nudge backend
 * (OCR processing, drug lookups, voice queries, translations)
 */
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API,
  timeout: 60000, // OCR can take a while
});

/**
 * Full pipeline: Upload image → OCR → Extract → Interactions → Nudge
 * @param {File} imageFile - The prescription image
 * @param {string[]} currentMeds - Names of current medications
 * @param {Object} patientContext - Patient info for nudge personalization
 * @param {boolean} forceRefresh - Skip cache and force fresh extraction
 * @returns {Object} { extracted_data, interactions, patient_facing_card, safety_flag, safety_reasoning }
 */
export async function processPrescription(imageFile, currentMeds = [], patientContext = {}, forceRefresh = false) {
  console.log('🔵 [API] processPrescription called');
  console.log('  Image:', imageFile.name, imageFile.size, 'bytes');
  console.log('  Current meds:', currentMeds);
  console.log('  Patient context:', patientContext);
  console.log('  Force refresh:', forceRefresh);
  
  const formData = new FormData();
  formData.append('image', imageFile);
  formData.append('currentMeds', JSON.stringify(currentMeds));
  formData.append('patientContext', JSON.stringify(patientContext));
  if (forceRefresh) {
    formData.append('forceRefresh', 'true');
  }
  
  console.log('  FormData created, sending to:', `${API}/prescription/process`);

  try {
    const { data } = await api.post('/prescription/process', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    console.log('✅ [API] Success:', data);
    return data;
  } catch (error) {
    console.error('❌ [API] Error:', error);
    console.error('  Response:', error.response?.data);
    console.error('  Status:', error.response?.status);
    throw error;
  }
}

/**
 * OCR-only: Upload image and get raw text back
 */
export async function uploadPrescription(imageFile) {
  const formData = new FormData();
  formData.append('image', imageFile);

  const { data } = await api.post('/prescription/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/**
 * Check interactions for a drug against current medications
 */
export async function checkInteractions(drugName, currentMeds = []) {
  const { data } = await api.post('/interaction/check', { drugName, currentMeds });
  return data;
}

/**
 * Create a new medication via backend API
 * @param {Object} medication - Medication data to create
 */
export async function createMedication(medication) {
  console.log('🏥 [API] Creating medication:', medication.name);
  
  const { data } = await api.post('/medications', medication);
  
  console.log('✅ [API] Medication created:', data.name);
  return data;
}

/**
 * Create a new drug interaction via backend API
 * @param {Object} interaction - Interaction data to create
 */
export async function createInteraction(interaction) {
  console.log('🏥 [API] Creating interaction:', interaction.drug1, 'with', interaction.drug2);
  
  const { data } = await api.post('/interactions', interaction);
  
  console.log('✅ [API] Interaction created');
  return data;
}

/**
 * Clear cached result for specific image
 * @param {string} imageHash - Hash of the image to clear from cache
 */
export async function clearImageCache(imageHash) {
  console.log('🗑️ [API] Clearing cache for:', imageHash);
  
  const response = await fetch(`${API}/cache/clear/${imageHash}`, {
    method: 'POST'
  });
  
  if (!response.ok) {
    throw new Error(`Failed to clear cache: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Generate nudges for multiple confirmed medications (batch)
 * Called AFTER user confirms extraction - saves tokens
 */
export async function generateNudgeBatch(medications, patientContext = {}) {
  console.log('🔵 [API] generateNudgeBatch called');
  console.log('  Medications:', medications.length);
  
  const { data } = await api.post('/nudge/generate-batch', { 
    medications, 
    patientContext 
  });
  
  console.log('✅ [API] Nudges generated:', data);
  return data;
}

/**
 * Generate a nudge card for extracted drug data
 */
export async function generateNudge(extractedData, patientContext = {}) {
  const { data } = await api.post('/nudge/generate', { extractedData, patientContext });
  return data;
}

/**
 * Ask a voice query about medications
 */
export async function voiceQuery(text) {
  const { data } = await api.post('/voice/query', { text });
  return data;
}

/**
 * Translate medical text to target language
 */
export async function translateText(text, targetLanguage) {
  const { data } = await api.post('/translate', { text, targetLanguage });
  return data;
}

/**
 * Look up drug info from RxNorm
 */
export async function lookupDrug(name) {
  const { data } = await api.get(`/drug/lookup/${encodeURIComponent(name)}`);
  return data;
}

/**
 * Health check
 */
export async function healthCheck() {
  const { data } = await api.get('/health');
  return data;
}

export default api;
