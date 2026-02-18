require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const ocrService = require('./services/ocrService');
const drugService = require('./services/drugService');
const nudgeService = require('./services/nudgeService');
const llmService = require('./services/llmService');

// ── In-memory cache for Vision API results (30 min TTL) ──
const visionCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Helper: Hash file content
function hashFile(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

// Helper: Clean expired cache entries
function cleanExpiredCache() {
  const now = Date.now();
  for (const [key, value] of visionCache.entries()) {
    if (value.expiresAt < now) {
      visionCache.delete(key);
    }
  }
}
setInterval(cleanExpiredCache, 5 * 60 * 1000); // Clean every 5 minutes

const app = express();
const PORT = process.env.PORT || 5000;

// ── Supabase client (service role for backend) ──
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'placeholder-key'
);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer setup for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/tiff', 'application/pdf'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ============================================================
// ROUTES
// ============================================================

// Root route - API info
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Dr. Nudge API</title>
        <style>
          body { font-family: system-ui; max-width: 800px; margin: 50px auto; padding: 20px; }
          h1 { color: #1a1a1a; }
          code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
          .endpoint { background: #f9f9f9; padding: 10px; margin: 10px 0; border-left: 3px solid #1a1a1a; }
          .method { display: inline-block; width: 70px; font-weight: bold; }
          .status { color: ${process.env.SUPABASE_URL && process.env.SUPABASE_URL !== 'https://YOUR_PROJECT_ID.supabase.co' ? 'green' : 'orange'}; }
        </style>
      </head>
      <body>
        <h1>🩺 Dr. Nudge API v2.0</h1>
        <p>Status: <span class="status">● ${process.env.SUPABASE_URL && process.env.SUPABASE_URL !== 'https://YOUR_PROJECT_ID.supabase.co' ? 'Running with Supabase' : 'Running (Supabase not configured)'}</span></p>
        
        <h2>Available Endpoints</h2>
        
        <div class="endpoint">
          <span class="method">GET</span> <code>/api/health</code> - Health check
        </div>
        
        <div class="endpoint">
          <span class="method">POST</span> <code>/api/prescription/upload</code> - OCR only
        </div>
        
        <div class="endpoint">
          <span class="method">POST</span> <code>/api/prescription/process</code> - Full pipeline (OCR → Extract → Interactions → Nudge)
        </div>
        
        <div class="endpoint">
          <span class="method">POST</span> <code>/api/interaction/check</code> - Check drug interactions
        </div>
        
        <div class="endpoint">
          <span class="method">POST</span> <code>/api/nudge/generate</code> - Generate nudge card
        </div>
        
        <div class="endpoint">
          <span class="method">POST</span> <code>/api/voice/query</code> - Voice query
        </div>
        
        <div class="endpoint">
          <span class="method">POST</span> <code>/api/translate</code> - Translate text
        </div>
        
        <div class="endpoint">
          <span class="method">GET</span> <code>/api/drug/lookup/:name</code> - RxNorm drug lookup
        </div>
        
        <div class="endpoint">
          <span class="method">POST</span> <code>/api/patient</code> - Create patient
        </div>
        
        <div class="endpoint">
          <span class="method">GET</span> <code>/api/patient/:id</code> - Get patient
        </div>
        
        <div class="endpoint">
          <span class="method">GET</span> <code>/api/patient/:id/medications</code> - Get medications
        </div>
        
        <div class="endpoint">
          <span class="method">GET</span> <code>/api/patient/:id/stats</code> - Get adherence stats
        </div>
        
        <p><strong>Frontend:</strong> <a href="http://localhost:3000">http://localhost:3000</a></p>
        <p><strong>Setup Guide:</strong> See SETUP-GUIDE.md in project root</p>
      </body>
    </html>
  `);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Dr. Nudge API', version: '2.0.0', database: 'supabase' });
});

// -----------------------------------------------------------
// 1. Upload & OCR prescription image (OCR only)
// -----------------------------------------------------------
app.post('/api/prescription/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image file provided' });

    const ocrText = await ocrService.extractText(req.file.path);
    const patientContext = req.body.patientContext ? JSON.parse(req.body.patientContext) : {};

    // Clean up file
    fs.unlink(req.file.path, () => {});

    res.json({
      success: true,
      ocrText,
      patientContext,
    });
  } catch (err) {
    console.error('OCR Error:', err);
    res.status(500).json({ error: 'OCR processing failed', detail: err.message });
  }
});

// -----------------------------------------------------------
// 2. Full pipeline: Image → OCR → Extract → Interactions → Nudge
//    Optionally saves to Supabase if patientId is provided
// -----------------------------------------------------------
app.post('/api/prescription/process', upload.single('image'), async (req, res) => {
  try {
    console.log('\n========================================');
    console.log('[Pipeline] New prescription processing request');
    console.log('[Pipeline] File:', req.file ? req.file.filename : 'NO FILE');
    console.log('[Pipeline] Body:', Object.keys(req.body));
    console.log('========================================\n');
    
    if (!req.file) {
      console.error('[Pipeline] ❌ No image file provided');
      return res.status(400).json({ error: 'No image file provided' });
    }

    const patientContext = req.body.patientContext ? JSON.parse(req.body.patientContext) : {};
    const currentMeds = req.body.currentMeds ? JSON.parse(req.body.currentMeds) : [];
    const patientId = req.body.patientId || null;
    const forceRefresh = req.body.forceRefresh === 'true';
    
    console.log('[Pipeline] Patient context:', patientContext);
    console.log('[Pipeline] Current meds:', currentMeds);
    console.log('[Pipeline] Force refresh:', forceRefresh);

    // ── STEP 1: Hash the image ──
    const imageHash = hashFile(req.file.path);
    console.log('[Pipeline] Image hash:', imageHash);

    // ── STEP 2: Check cache (unless force refresh) ──
    if (!forceRefresh) {
      // Check memory cache
      const cachedResult = visionCache.get(imageHash);
      if (cachedResult && cachedResult.expiresAt > Date.now()) {
        console.log('[Pipeline] ✅ Using cached result (in-memory)');
        fs.unlink(req.file.path, () => {});
        return res.json(cachedResult.data);
      }

      // Check database cache
      const { data: dbCache } = await supabase
        .from('scan_sessions')
        .select('*')
        .eq('image_hash', imageHash)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (dbCache) {
        console.log('[Pipeline] ✅ Using cached result (database)');
        const result = dbCache.normalized_result;
        
        // Store in memory cache
        visionCache.set(imageHash, {
          data: result,
          expiresAt: Date.now() + CACHE_TTL
        });
        
        fs.unlink(req.file.path, () => {});
        return res.json(result);
      }
    } else {
      console.log('[Pipeline] 🔄 Force refresh - skipping cache lookup');
    }

    // ── STEP 4: Call Vision API (cache miss or forced) ──
    let visionResult;

    // 🔥 NEW APPROACH: Try GPT-4 Vision first (more accurate)
    try {
      const apiCallReason = forceRefresh ? 'forced refresh' : 'not cached';
      console.log(`[Pipeline] 🔥 Calling Vision API (${apiCallReason})...`);
      visionResult = await llmService.extractFromImage(req.file.path);
      console.log('[Pipeline] ✅ Vision API result:', visionResult);
    } catch (visionErr) {
      // Fallback to OCR + LLM if Vision fails
      console.log('[Pipeline] Vision API failed, falling back to OCR pipeline...');
      console.log('[Pipeline] Error:', visionErr.message);
      
      console.log('[Pipeline] Step 1 (Fallback): OCR...');
      const ocrText = await ocrService.extractText(req.file.path);
      console.log('[Pipeline] OCR result:', ocrText.substring(0, 100));

      console.log('[Pipeline] Step 2 (Fallback): Extracting drug data from text...');
      const singleDrug = await llmService.extractDrugData(ocrText);
      visionResult = { medications: [singleDrug] };
      console.log('[Pipeline] Extracted:', visionResult);
    }

    // CRITICAL: Stop if extraction failed
    if (visionResult.error || !visionResult.medications || visionResult.medications.length === 0) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({
        error: 'Unable to read prescription',
        detail: visionResult.note || 'The prescription image is not clear enough. Please take a clearer photo.',
      });
    }

    console.log(`[Pipeline] Found ${visionResult.medications.length} medication(s)`);

    // Process each medication
    const processedMedications = [];
    const allInteractions = [];
    const failedExtractions = []; // Track failed medications

    for (const extractedData of visionResult.medications) {
      console.log(`[Pipeline] Processing: ${extractedData.drug_name}`);

      // Skip if drug name is missing
      if (!extractedData.drug_name || extractedData.drug_name === 'CLARIFICATION_NEEDED') {
        console.log('[Pipeline] Skipping medication with unclear name');
        failedExtractions.push({
          reason: 'unclear_name',
          extractedData,
          message: 'Could not read medication name clearly',
        });
        continue;
      }

      // 🔥 NEW: Validate and normalize drug name
      console.log('[Pipeline] Validating drug name...');
      const validation = await drugService.validateAndNormalizeDrugName(extractedData.drug_name);
      
      if (!validation.valid) {
        console.log(`[Pipeline] ⚠️ Invalid drug name: "${extractedData.drug_name}"`);
        failedExtractions.push({
          reason: 'invalid_drug',
          originalName: extractedData.drug_name,
          suggestions: validation.suggestions || [],
          message: `"${extractedData.drug_name}" is not a recognized medication`,
          extractedData: extractedData, // Include the original extracted data for reuse
        });
        if (validation.suggestions && validation.suggestions.length > 0) {
          console.log(`[Pipeline] Suggestions: ${validation.suggestions.join(', ')}`);
        }
        // Skip invalid drugs
        continue;
      }

      // Keep the original extracted name - validation only confirms it's real
      if (validation.wasCorrected) {
        console.log(`[Pipeline] ✅ Validated & corrected: "${validation.originalName}" → "${validation.correctedName}"`);
        // For minor corrections (>85% match), keep original name
        if (validation.confidence > 0.85) {
          extractedData.drug_name = validation.originalName;
        } else {
          extractedData.drug_name = validation.correctedName;
        }
        extractedData.name_confidence = validation.confidence;
      } else {
        console.log(`[Pipeline] ✅ Drug name validated: "${validation.originalName}"`);
        extractedData.drug_name = validation.originalName;
        extractedData.name_confidence = validation.confidence;
      }

      // Check interactions for this drug
      console.log('[Pipeline] Checking interactions...');
      const interactions = await drugService.checkInteractions(
        extractedData.drug_name,
        currentMeds
      );
      console.log('[Pipeline] Interactions:', interactions.length, 'found');
      allInteractions.push(...interactions);

      // Determine safety flag
      const safetyFlag = drugService.determineSafetyFlag(interactions);
      console.log('[Pipeline] Safety:', safetyFlag.flag);

      // 🔥 NEW: Enhanced safety check (food, age, dosage)
      console.log('[Pipeline] Running enhanced safety checks...');
      const enhancedSafety = drugService.getEnhancedSafetyInfo(
        extractedData.drug_name,
        extractedData.dosage,
        patientContext.age,
        currentMeds
      );
      console.log('[Pipeline] Enhanced safety:', enhancedSafety.overallSeverity);

      // ⚡ NUDGE GENERATION MOVED TO SEPARATE ENDPOINT (after user confirms)
      // This saves OpenAI tokens when extraction fails or user rejects

      processedMedications.push({
        extracted_data: extractedData,
        patient_facing_card: null, // Will be generated after confirmation
        safety_flag: safetyFlag.flag,
        safety_reasoning: safetyFlag.reasoning,
        interactions,
        enhanced_safety: enhancedSafety, // Pass through for nudge generation later
      });
    }

    // If no medications were successfully processed
    if (processedMedications.length === 0) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({
        error: 'Unable to extract medication information',
        detail: 'Could not read any medication names from the prescription.',
        failedExtractions: failedExtractions.length > 0 ? failedExtractions : undefined,
        suggestions: failedExtractions.length > 0 
          ? 'The prescription image may be unclear. Please try taking a clearer photo with good lighting.'
          : undefined,
      });
    }

    // ── STEP 5: Cache the result ──
    const finalResult = {
      medications: processedMedications,
      total_medications: processedMedications.length,
      failedExtractions: failedExtractions.length > 0 ? failedExtractions : undefined,
      warnings: failedExtractions.length > 0 
        ? `${failedExtractions.length} medication(s) could not be processed. Please verify the extracted information.`
        : undefined,
    };

    // Store in memory cache
    visionCache.set(imageHash, {
      data: finalResult,
      expiresAt: Date.now() + CACHE_TTL
    });

    // Store in database cache
    await supabase.from('scan_sessions').insert({
      image_hash: imageHash,
      raw_vision_json: visionResult,
      normalized_result: finalResult,
      expires_at: new Date(Date.now() + CACHE_TTL).toISOString()
    });

    console.log('[Pipeline] ✅ Result cached');

    // Clean up uploaded file
    fs.unlink(req.file.path, () => {});

    console.log('[Pipeline] ✅ SUCCESS - Sending response (NO NUDGES YET)');
    res.json(finalResult);
  } catch (err) {
    console.error('\n========================================');
    console.error('[Pipeline] ❌ ERROR:');
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    console.error('========================================\n');
    
    // Try to clean up
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    
    res.status(500).json({ 
      error: 'Processing failed', 
      detail: err.message,
      stage: err.stage || 'unknown'
    });
  }
});

// -----------------------------------------------------------
// 2b. Generate nudges for confirmed medications (AFTER user confirms)
//     This saves OpenAI tokens by only generating nudges when needed
// -----------------------------------------------------------
app.post('/api/nudge/generate-batch', async (req, res) => {
  try {
    console.log('\n========================================');
    console.log('[Nudge Batch] Generating nudges for confirmed medications');
    console.log('========================================\n');
    
    const { medications, patientContext } = req.body;
    
    if (!medications || !Array.isArray(medications)) {
      return res.status(400).json({ error: 'medications array is required' });
    }

    const medicationsWithNudges = [];
    const allMedicationNames = medications.map(m => m.extracted_data?.drug_name).filter(Boolean);
    
    for (const med of medications) {
      const extractedData = med.extracted_data;
      
      console.log(`[Nudge Batch] Processing: ${extractedData.drug_name}`);
      console.log(`[Nudge Batch] Dosage: ${extractedData.dosage}, Frequency: ${extractedData.frequency}, Dose Timing: ${extractedData.dose_timing}`);
      
      // Validate drug name (especially important for medications added from suggestions)
      if (!med.skipValidation) {
        const validation = await drugService.validateAndNormalizeDrugName(extractedData.drug_name);
        if (!validation.valid) {
          console.log(`[Nudge Batch] ⚠️ Invalid drug name: "${extractedData.drug_name}"`);
          // Skip invalid drugs even in batch
          continue;
        }
        
        // Use corrected name if needed
        if (validation.wasCorrected) {
          console.log(`[Nudge Batch] ✅ Using corrected name: "${validation.correctedName}"`);
          extractedData.drug_name = validation.correctedName;
        }
      }
      
      // Check interactions with other medications in this batch
      console.log('[Nudge Batch] Checking interactions...');
      const interactions = await drugService.checkInteractions(
        extractedData.drug_name,
        allMedicationNames.filter(name => name !== extractedData.drug_name)
      );
      const safetyFlag = drugService.determineSafetyFlag(interactions);
      
      // Enhanced safety check
      const enhancedSafety = drugService.getEnhancedSafetyInfo(
        extractedData.drug_name,
        extractedData.dosage,
        patientContext?.age,
        allMedicationNames.filter(name => name !== extractedData.drug_name)
      );
      
      console.log(`[Nudge Batch] Generating nudge for: ${extractedData.drug_name}`);
      
      let nudgeCard;
      try {
        nudgeCard = await nudgeService.generateCard(extractedData, patientContext || {}, interactions);
        
        // Add enhanced safety warnings to nudge
        if (enhancedSafety) {
          const safetyWarningText = drugService.generateSafetyWarningText(enhancedSafety);
          if (safetyWarningText) {
            nudgeCard.warning_label = [nudgeCard.warning_label, safetyWarningText]
              .filter(Boolean)
              .join('\n\n');
          }
        }
      } catch (nudgeErr) {
        console.log('[Nudge Batch] Nudge generation failed:', nudgeErr.message);
        nudgeCard = {
          headline: `Take ${extractedData.drug_name} as prescribed`,
          plain_instruction: '',
          the_why: '',
          habit_hook: '',
          warning_label: '',
        };
      }
      
      medicationsWithNudges.push({
        ...med,
        patient_facing_card: nudgeCard,
        interactions,
        safety_flag: safetyFlag.flag,
        safety_reasoning: safetyFlag.reasoning,
        enhanced_safety: enhancedSafety
      });
    }
    
    console.log('[Nudge Batch] ✅ Generated', medicationsWithNudges.length, 'nudges');
    res.json({ medications: medicationsWithNudges });
  } catch (err) {
    console.error('[Nudge Batch] ❌ ERROR:', err.message);
    res.status(500).json({ error: 'Nudge generation failed', detail: err.message });
  }
});

// -----------------------------------------------------------
// 3. Check drug interactions
// -----------------------------------------------------------
app.post('/api/interaction/check', async (req, res) => {
  try {
    const { drugName, currentMeds } = req.body;
    if (!drugName) return res.status(400).json({ error: 'drugName is required' });

    const interactions = await drugService.checkInteractions(drugName, currentMeds || []);
    const safetyFlag = drugService.determineSafetyFlag(interactions);

    res.json({ interactions, safetyFlag });
  } catch (err) {
    console.error('Interaction Check Error:', err);
    res.status(500).json({ error: 'Interaction check failed', detail: err.message });
  }
});

// -----------------------------------------------------------
// 4. Generate nudge card
// -----------------------------------------------------------
app.post('/api/nudge/generate', async (req, res) => {
  try {
    const { extractedData, patientContext } = req.body;
    if (!extractedData) return res.status(400).json({ error: 'extractedData is required' });

    const card = await nudgeService.generateCard(extractedData, patientContext || {}, []);
    res.json(card);
  } catch (err) {
    console.error('Nudge Generation Error:', err);
    res.status(500).json({ error: 'Nudge generation failed', detail: err.message });
  }
});

// -----------------------------------------------------------
// 5. Voice query
// -----------------------------------------------------------
app.post('/api/voice/query', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });

    const response = await llmService.answerVoiceQuery(text);
    res.json({ response });
  } catch (err) {
    console.error('Voice Query Error:', err);
    res.status(500).json({ error: 'Voice query failed', detail: err.message });
  }
});

// -----------------------------------------------------------
// 6. Translate text
// -----------------------------------------------------------
app.post('/api/translate', async (req, res) => {
  try {
    const { text, targetLanguage } = req.body;
    if (!text || !targetLanguage) {
      return res.status(400).json({ error: 'text and targetLanguage are required' });
    }

    const translated = await llmService.translateMedicalText(text, targetLanguage);
    res.json({ original: text, translated, targetLanguage });
  } catch (err) {
    console.error('Translation Error:', err);
    res.status(500).json({ error: 'Translation failed', detail: err.message });
  }
});

// -----------------------------------------------------------
// 7. RxNorm drug lookup
// -----------------------------------------------------------
app.get('/api/drug/lookup/:name', async (req, res) => {
  try {
    const info = await drugService.lookupDrug(req.params.name);
    res.json(info);
  } catch (err) {
    console.error('Drug Lookup Error:', err);
    res.status(500).json({ error: 'Drug lookup failed', detail: err.message });
  }
});

// -----------------------------------------------------------
// 8. Patient CRUD (alternative to direct Supabase from frontend)
// -----------------------------------------------------------
app.post('/api/patient', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('patients')
      .insert(req.body)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Create Patient Error:', err);
    res.status(500).json({ error: 'Failed to create patient', detail: err.message });
  }
});

app.get('/api/patient/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Get Patient Error:', err);
    res.status(500).json({ error: 'Failed to get patient', detail: err.message });
  }
});

app.put('/api/patient/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('patients')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Update Patient Error:', err);
    res.status(500).json({ error: 'Failed to update patient', detail: err.message });
  }
});

// -----------------------------------------------------------
// 9. Medications for a patient
// -----------------------------------------------------------

/**
 * Create a new medication
 */
app.post('/api/medications', async (req, res) => {
  try {
    const { 
      patient_id, name, dosage, frequency, dose_timing, dosing_source, time_of_day, route, duration,
      safety_flag, nudge_headline, nudge_plain_instruction, nudge_the_why,
      nudge_habit_hook, nudge_warning, total_doses 
    } = req.body;

    if (!patient_id || !name) {
      return res.status(400).json({ error: 'patient_id and name are required' });
    }

    console.log('Creating medication:', name, 'for patient:', patient_id);

    const { data: medication, error } = await supabase
      .from('medications')
      .insert({
        patient_id,
        name,
        dosage: dosage || '',
        frequency: frequency || '',
        dose_timing: dose_timing || '1-0-0',
        dosing_source: dosing_source || 'prescription',
        time_of_day: time_of_day || '08:00 AM',
        route: route || 'Oral',
        duration: duration || '',
        safety_flag: safety_flag || 'GREEN',
        nudge_headline: nudge_headline || '',
        nudge_plain_instruction: nudge_plain_instruction || '',
        nudge_the_why: nudge_the_why || '',
        nudge_habit_hook: nudge_habit_hook || '',
        nudge_warning: nudge_warning || '',
        streak: 0,
        total_doses: total_doses || 0,
        taken_doses: 0,
        active: true
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error creating medication:', error);
      throw error;
    }

    console.log('✅ Medication created:', medication.name);
    res.json(medication);
  } catch (err) {
    console.error('Create Medication Error:', err);
    res.status(500).json({ error: 'Failed to create medication', detail: err.message });
  }
});

/**
 * Get all medications for a patient
 */
app.get('/api/patient/:id/medications', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('medications')
      .select('*')
      .eq('patient_id', req.params.id)
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('Get Medications Error:', err);
    res.status(500).json({ error: 'Failed to get medications', detail: err.message });
  }
});

/**
 * Create a new drug interaction record
 */
app.post('/api/interactions', async (req, res) => {
  try {
    const { 
      patient_id, drug1, drug2, severity, description, 
      recommendation, plain_explanation 
    } = req.body;

    if (!patient_id || !drug1 || !drug2) {
      return res.status(400).json({ error: 'patient_id, drug1, and drug2 are required' });
    }

    console.log('Creating interaction:', drug1, 'with', drug2, 'for patient:', patient_id);

    const { data: interaction, error } = await supabase
      .from('interactions')
      .insert({
        patient_id,
        drug1,
        drug2,
        severity: severity || 'moderate',
        description: description || '',
        recommendation: recommendation || '',
        plain_explanation: plain_explanation || '',
        resolved: false
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error creating interaction:', error);
      throw error;
    }

    console.log('✅ Interaction created:', interaction.drug1, 'with', interaction.drug2);
    res.json(interaction);
  } catch (err) {
    console.error('Create Interaction Error:', err);
    res.status(500).json({ error: 'Failed to create interaction', detail: err.message });
  }
});

app.post('/api/medications/:id/take', async (req, res) => {
  try {
    // Get current med
    const { data: med } = await supabase
      .from('medications')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (!med) return res.status(404).json({ error: 'Medication not found' });

    // Update
    const { data, error } = await supabase
      .from('medications')
      .update({
        taken_doses: (med.taken_doses || 0) + 1,
        streak: (med.streak || 0) + 1,
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Log the action
    await supabase.from('medication_logs').insert({
      medication_id: req.params.id,
      patient_id: med.patient_id,
      action: 'taken',
    });

    res.json(data);
  } catch (err) {
    console.error('Take Med Error:', err);
    res.status(500).json({ error: 'Failed to log medication', detail: err.message });
  }
});

// -----------------------------------------------------------
// 10. Adherence stats
// -----------------------------------------------------------
app.get('/api/patient/:id/stats', async (req, res) => {
  try {
    const { data: meds } = await supabase
      .from('medications')
      .select('*')
      .eq('patient_id', req.params.id)
      .eq('active', true);

    const { data: logs } = await supabase
      .from('medication_logs')
      .select('*')
      .eq('patient_id', req.params.id)
      .order('logged_at', { ascending: false })
      .limit(100);

    const totalMeds = (meds || []).length;
    // With per-slot tracking, "takenToday" counts meds where all required doses are taken
    const takenToday = (meds || []).filter((m) => {
      const timing = (m.dose_timing || '1-0-0').split('-').map(Number);
      const morningDone = timing[0] === 0 || m.morning_taken;
      const noonDone = timing[1] === 0 || m.noon_taken;
      const eveningDone = timing[2] === 0 || m.evening_taken;
      return morningDone && noonDone && eveningDone;
    }).length;
    const adherenceRate =
      totalMeds > 0
        ? (meds || []).reduce(
            (sum, m) =>
              sum + (m.total_doses > 0 ? (m.taken_doses / m.total_doses) * 100 : 0),
            0
          ) / totalMeds
        : 0;
    const bestStreak = Math.max(...(meds || []).map((m) => m.streak || 0), 0);

    res.json({
      totalMeds,
      takenToday,
      adherenceRate: Math.round(adherenceRate * 10) / 10,
      bestStreak,
      recentLogs: (logs || []).slice(0, 20),
    });
  } catch (err) {
    console.error('Stats Error:', err);
    res.status(500).json({ error: 'Failed to get stats', detail: err.message });
  }
});

// Global error handlers
process.on('uncaughtException', (err) => {
  console.error('\n❌ UNCAUGHT EXCEPTION:');
  console.error(err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('\n❌ UNHANDLED REJECTION:');
  console.error(err);
  process.exit(1);
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🩺 Dr. Nudge API v2.0 running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
  console.log(`   Database: Supabase ${process.env.SUPABASE_URL ? '✅' : '⚠️  not configured'}\n`);
}).on('error', (err) => {
  console.error('\n❌ SERVER ERROR:', err);
  process.exit(1);
});
