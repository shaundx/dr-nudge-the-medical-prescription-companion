/**
 * Readability Utilities - Ensures plain language output
 * Uses Flesch-Kincaid Grade Level and other metrics
 */

/**
 * Calculate Flesch-Kincaid Grade Level
 * Target: Grade 6-8 (middle school level)
 * @param {string} text - Text to analyze
 * @returns {number} - Grade level (lower is simpler)
 */
function calculateFleschKincaid(text) {
  if (!text || text.trim().length === 0) return 0;

  // Remove extra whitespace
  const cleanText = text.trim().replace(/\s+/g, ' ');
  
  // Count sentences (periods, exclamation marks, question marks)
  const sentences = cleanText.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const sentenceCount = sentences.length || 1;
  
  // Count words
  const words = cleanText.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length || 1;
  
  // Count syllables
  let syllableCount = 0;
  words.forEach(word => {
    syllableCount += countSyllables(word);
  });
  
  // Flesch-Kincaid Grade Level formula
  const gradeLevel = 0.39 * (wordCount / sentenceCount) + 11.8 * (syllableCount / wordCount) - 15.59;
  
  return Math.max(0, gradeLevel);
}

/**
 * Count syllables in a word (rough approximation)
 */
function countSyllables(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;
  
  // Count vowel groups
  const vowels = word.match(/[aeiouy]+/g);
  let count = vowels ? vowels.length : 1;
  
  // Subtract silent 'e' at end
  if (word.endsWith('e')) count--;
  
  // Minimum 1 syllable
  return Math.max(1, count);
}

/**
 * Check if text contains medical jargon
 * @param {string} text - Text to check
 * @returns {Array} - Array of jargon words found
 */
function detectMedicalJargon(text) {
  const jargonWords = [
    'contraindicated', 'comorbidity', 'efficacy', 'pharmacological',
    'therapeutic', 'administered', 'cardiovascular', 'hypertension',
    'hypotension', 'metabolize', 'bioavailability', 'prophylactic',
    'systemic', 'topical', 'subcutaneous', 'intravenous', 'titration',
    'renal', 'hepatic', 'gastrointestinal', 'prognosis', 'diagnosis',
    'adverse', 'reaction', 'contraindication', 'indication',
    'ventricular', 'remodeling', 'afterload', 'preload'
  ];
  
  const lowerText = text.toLowerCase();
  return jargonWords.filter(word => lowerText.includes(word));
}

/**
 * Validate text is plain language (elderly-friendly)
 * @param {string} text - Text to validate
 * @returns {Object} - { isPlain, gradeLevel, jargon, suggestions }
 */
function validatePlainLanguage(text) {
  const gradeLevel = calculateFleschKincaid(text);
  const jargon = detectMedicalJargon(text);
  const isPlain = gradeLevel <= 8 && jargon.length === 0;
  
  const suggestions = [];
  if (gradeLevel > 8) {
    suggestions.push(`Reading level too high (Grade ${gradeLevel.toFixed(1)}). Use shorter sentences and simpler words.`);
  }
  if (jargon.length > 0) {
    suggestions.push(`Medical jargon detected: ${jargon.join(', ')}. Use everyday language.`);
  }
  
  return {
    isPlain,
    gradeLevel: parseFloat(gradeLevel.toFixed(1)),
    jargon,
    suggestions,
    targetGrade: 8,
  };
}

/**
 * Simplify medical terms to plain language
 */
const MEDICAL_TO_PLAIN = {
  'contraindicated': 'should not be used',
  'administered': 'given',
  'cardiovascular': 'heart and blood vessels',
  'hypertension': 'high blood pressure',
  'hypotension': 'low blood pressure',
  'gastrointestinal': 'stomach and intestines',
  'adverse reaction': 'bad side effect',
  'prophylactic': 'preventive',
  'subcutaneous': 'under the skin',
  'intravenous': 'into a vein',
  'therapeutic': 'treatment',
  'efficacy': 'how well it works',
  'comorbidity': 'other health condition',
};

/**
 * Attempt to simplify text automatically
 */
function simplifyText(text) {
  let simplified = text;
  Object.keys(MEDICAL_TO_PLAIN).forEach(medical => {
    const plain = MEDICAL_TO_PLAIN[medical];
    const regex = new RegExp(medical, 'gi');
    simplified = simplified.replace(regex, plain);
  });
  return simplified;
}

module.exports = {
  calculateFleschKincaid,
  detectMedicalJargon,
  validatePlainLanguage,
  simplifyText,
  MEDICAL_TO_PLAIN,
};
