/**
 * Nudge Service — Uses AI to generate personalized adherence instructions.
 * NO GENERIC DEFAULTS - Everything is AI-generated based on the actual prescription.
 */
const OpenAI = require('openai');
const { validatePlainLanguage, simplifyText } = require('../utils/readability');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'demo-key',
});

const nudgeService = {

  /**
   * Generate a patient-facing adherence card using AI.
   * @param {Object} extractedData - { drug_name, dosage, frequency, duration, route, instructions }
   * @param {Object} patientContext - { name, age, language, lifestyle, concerns }
   * @param {Array} interactions - Interaction results
   * @returns {Object} - Patient-facing card
   */
  async generateCard(extractedData, patientContext = {}, interactions = []) {
    // CRITICAL: NO DEFAULTS - Return empty if data is missing
    if (!extractedData.drug_name || extractedData.drug_name === 'CLARIFICATION_NEEDED') {
      throw new Error('Cannot generate nudge: Drug name not extracted from prescription');
    }

    // If no OpenAI key, return minimal card with only extracted data
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'demo-key') {
      return {
        headline: extractedData.instructions || '',
        plain_instruction: extractedData.instructions || '',
        the_why: '',
        habit_hook: '',
        warning_label: interactions.length > 0 ? 'May interact with other medications' : '',
      };
    }

    try {
      const prompt = `You are Dr. Nudge, a medication adherence expert.

Given this EXACT prescription data:
- Drug: ${extractedData.drug_name}
- Dosage: ${extractedData.dosage || 'not specified'}
- Frequency: ${extractedData.frequency || 'not specified'}
- Duration: ${extractedData.duration || 'not specified'}
- Route: ${extractedData.route || 'not specified'}
- Instructions: ${extractedData.instructions || 'not specified'}

Patient context:
- Name: ${patientContext.name || 'Patient'}
- Age: ${patientContext.age || 'not specified'}
- Lifestyle: ${patientContext.lifestyle || 'not specified'}
- Concerns: ${patientContext.concerns || 'not specified'}

CRITICAL RULES:
1. Use ONLY the information provided above
2. DO NOT add generic advice like "helps your body heal"
3. DO NOT invent dosage, frequency, or instructions
4. If information is missing, leave that field empty
5. Be specific to THIS drug and THIS prescription
6. If frequency/dosage is not clear, say "as prescribed by your doctor"

Generate a personalized adherence card in JSON format.
Do NOT copy the example text below verbatim; fill it with content specific to THIS prescription.
Example shape (fields must exist, but content must be customized):
{
  "headline": "Short title that mentions this drug or timing",
  "plain_instruction": "Clear directions using the actual dosage and frequency from this prescription",
  "the_why": "Specific benefit of this drug (if you know it), otherwise empty string",
  "habit_hook": "Link to patient's lifestyle if provided, otherwise empty string",
  "warning_label": "Specific warnings for this drug if any, otherwise empty string"
}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a medical adherence expert. Generate personalized, accurate medication instructions. Never invent information that was not provided.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 400,
      });

      const content = response.choices[0].message.content;
      const json = JSON.parse(content.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
      
      // Validate plain language
      const fullText = [json.plain_instruction, json.the_why, json.habit_hook, json.headline]
        .filter(Boolean)
        .join(' ');
      
      const readability = validatePlainLanguage(fullText);
      
      // If text is too complex, try to simplify it
      let finalCard = {
        headline: json.headline || '',
        plain_instruction: json.plain_instruction || '',
        the_why: json.the_why || '',
        habit_hook: json.habit_hook || '',
        warning_label: json.warning_label || (interactions.length > 0 ? 'May interact with other medications' : ''),
      };

      // Guard against the model echoing the example placeholder text
      const placeholderHeadline = 'Simple instruction based on ACTUAL prescription';
      if (!finalCard.headline || finalCard.headline.trim() === placeholderHeadline) {
        const parts = [];
        if (extractedData.drug_name) parts.push(`Taking ${extractedData.drug_name}`);
        if (extractedData.dosage) parts.push(extractedData.dosage);
        if (extractedData.frequency) parts.push(`as ${extractedData.frequency}`);
        finalCard.headline = parts.length > 0
          ? parts.join(' ')
          : 'Follow this prescription as your doctor directed';
      }
      
      if (!readability.isPlain) {
        console.log(`[Nudge] ⚠️ Text not plain enough (Grade ${readability.gradeLevel})`);
        console.log('[Nudge] Jargon found:', readability.jargon);
        
        // Attempt automatic simplification
        finalCard = {
          headline: simplifyText(json.headline || ''),
          plain_instruction: simplifyText(json.plain_instruction || ''),
          the_why: simplifyText(json.the_why || ''),
          habit_hook: simplifyText(json.habit_hook || ''),
          warning_label: simplifyText(json.warning_label || (interactions.length > 0 ? 'May interact with other medications' : '')),
        };
        
        console.log('[Nudge] ✅ Applied automatic simplification');
      } else {
        console.log(`[Nudge] ✅ Plain language validated (Grade ${readability.gradeLevel})`);
      }
      
      return finalCard;
    } catch (err) {
      console.error('[Nudge] AI generation failed:', err.message);
      // Return minimal card with only extracted data
      return {
        headline: extractedData.instructions || '',
        plain_instruction: extractedData.instructions || '',
        the_why: '',
        habit_hook: '',
        warning_label: interactions.length > 0 ? 'May interact with other medications' : '',
      };
    }
  },
};

module.exports = nudgeService;
