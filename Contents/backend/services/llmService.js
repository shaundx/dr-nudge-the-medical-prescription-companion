const OpenAI = require('openai');
const fs = require('fs');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'demo-key',
});

/**
 * LLM Service — Uses ChatGPT for medical reasoning, drug extraction, and translation.
 */
const llmService = {

  /**
   * 🔥 NEW: Extract drug data directly from prescription image using GPT-4 Vision
   * This is MORE ACCURATE than OCR→text→LLM pipeline
   */
  async extractFromImage(imagePath) {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'demo-key') {
      throw new Error('OpenAI API key required for Vision API');
    }

    try {
      console.log('[Vision] Analyzing prescription image with GPT-4 Vision...');
      
      // Convert image to base64
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      const imageExt = imagePath.split('.').pop().toLowerCase();
      const mimeType = imageExt === 'png' ? 'image/png' : 'image/jpeg';

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a medical prescription reader. Extract ALL medications from the prescription image.

CRITICAL EXTRACTION RULES:
1. Extract EXACTLY what is written - don't make assumptions if not clearly visible
2. Read each medication line separately - each has its own dosage/frequency

FREQUENCY & DOSE TIMING RULES:
3. IF frequency/timing IS clearly visible in the image:
   - "once daily" OR "OD" OR "QD" OR "1x a day" = frequency: "Once daily", dose_timing: "1-0-0"
   - "twice daily" OR "BD" OR "BID" OR "2x a day" = frequency: "Twice daily", dose_timing: "1-0-1"
   - "three times daily" OR "TDS" OR "TID" OR "3x a day" = frequency: "Three times daily", dose_timing: "1-1-1"
   - "four times daily" OR "QID" OR "4x a day" = frequency: "Four times daily", dose_timing: "1-1-1-1"
   - For multi-tablet: "2 caps 3x a day" = dose_timing: "2-2-2"

4. IF frequency/timing is NOT visible in the image:
   - Use your medical knowledge to suggest standard therapeutic dosing for that medication
   - Base it on typical prescribing patterns for that drug for an average adult
   - MUST set dosing_source: "ai_generated" to indicate this was not in the image

5. DOSAGE FIELD:
   - Extract the SINGLE TABLET/CAPSULE strength (e.g., "50mg" NOT "100mg")
   - If dosage strength is not clearly visible, use typical strength for that medication

OUTPUT FORMAT (valid JSON only):
{
  "medications": [
    {
      "drug_name": "Medicine name exactly as written",
      "dosage": "Single tablet/capsule strength",
      "frequency": "How often in plain text",
      "dose_timing": "M-N-E format showing NUMBER of tablets (e.g., 1-0-0, 1-0-1, 1-1-1)",
      "dosing_source": "prescription" OR "ai_generated",
      "duration": "Duration if mentioned (e.g., 7 days, Finish course)",
      "route": "Oral (default if not specified)"
    }
  ]
}

EXAMPLES:

Example 1 - Clear frequency visible: "Amoxicillin 500mg Cap#21, Sig: 1 cap 3x a day per seven days"
→ {"drug_name": "Amoxicillin", "dosage": "500mg", "frequency": "Three times daily", "dose_timing": "1-1-1", "dosing_source": "prescription", "duration": "7 days", "route": "Oral"}

Example 2 - NO frequency visible: "Amoxicillin 250mg - Finish course"
→ {"drug_name": "Amoxicillin", "dosage": "250mg", "frequency": "Three times daily", "dose_timing": "1-1-1", "dosing_source": "ai_generated", "duration": "Finish course", "route": "Oral"}
(Note: Standard Amoxicillin dosing is TID based on medical knowledge)

Example 3 - Clear frequency: "Betaloc 100mg - 1 tab BID"
→ {"drug_name": "Betaloc", "dosage": "100mg", "frequency": "Twice daily", "dose_timing": "1-0-1", "dosing_source": "prescription", "duration": "NA", "route": "Oral"}`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all medication information from this prescription image:',
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        temperature: 0, // Use 0 for maximum consistency
        max_tokens: 800, // Allow more space for multiple medications
        response_format: { type: "json_object" }, // Force JSON output
      });

      const content = response.choices[0].message.content;
      console.log('[Vision] Raw response:', content);
      
      // Clean and parse JSON response
      let cleaned = content.trim();
      // Remove markdown code blocks
      cleaned = cleaned.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      
      let json;
      try {
        json = JSON.parse(cleaned);
      } catch (parseErr) {
        console.error('[Vision] JSON parse failed:', parseErr.message);
        console.error('[Vision] Raw content was:', content);
        throw new Error('Vision API returned invalid JSON format');
      }
      
      console.log('[Vision] Parsed JSON:', json);
      
      // Validate response structure
      if (!json.medications || !Array.isArray(json.medications)) {
        console.error('[Vision] Invalid structure - missing medications array');
        return { 
          medications: [],
          error: 'INVALID_RESPONSE',
          note: 'Vision API response was not in expected format'
        };
      }
      
      // Filter out invalid medications
      const validMedications = json.medications.filter(med => {
        if (!med.drug_name || med.drug_name === 'CLARIFICATION_NEEDED') {
          console.log('[Vision] Skipping unclear medication:', med);
          return false;
        }
        // Ensure required fields exist
        if (!med.dosage) med.dosage = 'Not specified';
        if (!med.frequency) med.frequency = 'As directed';
        if (!med.duration) med.duration = 'Not specified';
        if (!med.route) med.route = 'Oral';
        return true;
      });
      
      console.log(`[Vision] Validated ${validMedications.length} medications`);
      
      // Return empty if no valid medications
      if (validMedications.length === 0) {
        return { 
          medications: [],
          error: 'NO_MEDICATIONS_FOUND',
          note: 'Could not extract any clear medication names from prescription'
        };
      }
      
      return { medications: validMedications };
    } catch (err) {
      console.error('[Vision] Failed:', err.message);
      throw err;
    }
  },

  /**
   * Extract structured drug data from OCR text using ChatGPT (FALLBACK)
   */
  async extractDrugData(ocrText) {
    // If no API key, use pattern-based extraction
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'demo-key') {
      return this.extractDrugDataFallback(ocrText);
    }

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are Dr. Nudge, a Precision Adherence expert. Extract drug data from prescription text.
Return ONLY valid JSON with this exact structure:
{
  "drug_name": "Standardized drug name",
  "dosage": "Amount + Unit (e.g., 10mg)",
  "frequency": "Plain English (e.g., Once Daily, Twice Daily)",
  "duration": "e.g., 30 days",
  "route": "e.g., Oral, Topical"
}
If text is ambiguous or illegible, set drug_name to "CLARIFICATION_NEEDED" and explain in a "note" field.`,
          },
          {
            role: 'user',
            content: `Extract drug data from this prescription text:\n\n${ocrText}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 300,
      });

      const content = response.choices[0].message.content;
      const json = JSON.parse(content.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
      return json;
    } catch (err) {
      console.error('[LLM] Drug extraction failed:', err.message);
      return this.extractDrugDataFallback(ocrText);
    }
  },

  /**
   * Pattern-based drug extraction fallback (no API needed)
   */
  extractDrugDataFallback(ocrText) {
    const text = ocrText.toLowerCase();

    // Common drug patterns
    const drugPatterns = [
      { regex: /(amlodipine|amlo)\s*(\d+\s*mg)?/i, name: 'Amlodipine' },
      { regex: /(metformin|glucophage)\s*(\d+\s*mg)?/i, name: 'Metformin' },
      { regex: /(atorvastatin|lipitor)\s*(\d+\s*mg)?/i, name: 'Atorvastatin' },
      { regex: /(losartan|cozaar)\s*(\d+\s*mg)?/i, name: 'Losartan' },
      { regex: /(warfarin|coumadin)\s*(\d+\.?\d*\s*mg)?/i, name: 'Warfarin' },
      { regex: /(sertraline|zoloft)\s*(\d+\s*mg)?/i, name: 'Sertraline' },
      { regex: /(omeprazole|prilosec)\s*(\d+\s*mg)?/i, name: 'Omeprazole' },
      { regex: /(lisinopril|zestril)\s*(\d+\s*mg)?/i, name: 'Lisinopril' },
      { regex: /(levothyroxine|synthroid)\s*(\d+\s*mcg)?/i, name: 'Levothyroxine' },
      { regex: /(gabapentin|neurontin)\s*(\d+\s*mg)?/i, name: 'Gabapentin' },
      { regex: /(clopidogrel|plavix)\s*(\d+\s*mg)?/i, name: 'Clopidogrel' },
      { regex: /(ciprofloxacin|cipro)\s*(\d+\s*mg)?/i, name: 'Ciprofloxacin' },
      { regex: /(insulin\s*glargine|lantus)/i, name: 'Insulin Glargine' },
      { regex: /(aspirin|ecosprin)\s*(\d+\s*mg)?/i, name: 'Aspirin' },
    ];

    let drugName = 'CLARIFICATION_NEEDED';
    let dosage = 'Unknown';

    for (const pattern of drugPatterns) {
      const match = ocrText.match(pattern.regex);
      if (match) {
        drugName = pattern.name;
        if (match[2]) dosage = match[2].trim();
        break;
      }
    }

    // Extract dosage from common patterns
    const dosageMatch = ocrText.match(/(\d+\.?\d*)\s*(mg|mcg|ml|units?|iu)/i);
    if (dosageMatch && dosage === 'Unknown') {
      dosage = `${dosageMatch[1]}${dosageMatch[2]}`;
    }

    // Extract frequency
    let frequency = 'Once Daily';
    if (/bid|twice|2\s*times/i.test(text)) frequency = 'Twice Daily';
    else if (/tid|three|3\s*times/i.test(text)) frequency = 'Three Times Daily';
    else if (/qid|four|4\s*times/i.test(text)) frequency = 'Four Times Daily';
    else if (/prn|as needed/i.test(text)) frequency = 'As Needed';
    else if (/qhs|bedtime|night/i.test(text)) frequency = 'At Bedtime';

    return {
      drug_name: drugName,
      dosage,
      frequency,
      duration: '30 days',
      route: 'Oral',
    };
  },

  /**
   * Answer a voice query about medications
   */
  async answerVoiceQuery(text) {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'demo-key') {
      return this.answerVoiceQueryFallback(text);
    }

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are Dr. Nudge, a friendly medication assistant. Answer patient questions about their medications in simple, warm language. 
Keep responses under 2 sentences. Use Grade 5 reading level. 
If you're unsure about a specific medication, recommend they ask their doctor.`,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0.7,
        max_tokens: 150,
      });

      return response.choices[0].message.content;
    } catch (err) {
      console.error('[LLM] Voice query failed:', err.message);
      return this.answerVoiceQueryFallback(text);
    }
  },

  /**
   * Fallback voice answers
   */
  answerVoiceQueryFallback(text) {
    const lower = text.toLowerCase();

    if (lower.includes('blood pressure')) {
      return 'Take your blood pressure pill right after your morning chai. It keeps your blood vessels relaxed and protects your brain. ☕💊';
    }
    if (lower.includes('diabetes') || lower.includes('sugar')) {
      return 'Take your diabetes medicine with meals. It helps keep your blood sugar steady all day. 🍽️💊';
    }
    if (lower.includes('forgot') || lower.includes('missed')) {
      return "Take it as soon as you remember. If it's almost time for your next dose, skip the missed one. Never take 2 at once. ⚠️";
    }
    if (lower.includes('side effect')) {
      return 'If you feel dizzy or unwell, sit down and rest. If it continues, call your doctor. Most side effects go away in a few days. 🩺';
    }

    return "I'm here to help with your medication questions! Try asking about a specific medicine, side effects, or when to take your pills. 💊";
  },

  /**
   * Translate medical text to patient's language
   */
  async translateMedicalText(text, targetLanguage) {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'demo-key') {
      return `[${targetLanguage} translation]: ${text}`;
    }

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `Translate the following medical instruction to ${targetLanguage}. 
Keep it simple, use everyday words. This is for a patient, not a doctor.
If the target language uses a non-Latin script, provide both the script and a transliteration.`,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0.3,
        max_tokens: 300,
      });

      return response.choices[0].message.content;
    } catch (err) {
      console.error('[LLM] Translation failed:', err.message);
      return `[Translation unavailable] ${text}`;
    }
  },
};

module.exports = llmService;
