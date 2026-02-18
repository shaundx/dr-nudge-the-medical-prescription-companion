/**
 * Test script for drug name validation and correction.
 * Run: node test-drug-validator.js
 */

const drugService = require('./services/drugService');

const testCases = [
  // Correct names
  { input: 'Lisinopril', expected: 'Should pass as valid' },
  { input: 'Metformin', expected: 'Should pass as valid' },
  { input: 'Amlodipine', expected: 'Should pass as valid' },
  
  // Common OCR/Vision mistakes
  { input: 'Listnopril', expected: 'Should correct to Lisinopril' },
  { input: 'Metfornin', expected: 'Should correct to Metformin' },
  { input: 'Amlodepine', expected: 'Should correct to Amlodipine' },
  { input: 'Paracetarnol', expected: 'Should correct to Paracetamol' },
  { input: 'Omeprmzole', expected: 'Should correct to Omeprazole' },
 
  
  // Invalid names
  { input: 'XyzbcdefG', expected: 'Should reject as invalid' },
  { input: 'CLARIFICATION_NEEDED', expected: 'Should reject' },
];

async function runTests() {
  console.log('\n🧪 Testing Drug Name Validation & Correction\n');
  console.log('='.repeat(70));

  for (const testCase of testCases) {
    console.log(`\n📝 Testing: "${testCase.input}"`);
    console.log(`Expected: ${testCase.expected}`);
    console.log('-'.repeat(70));

    try {
      const result = await drugService.validateAndNormalizeDrugName(testCase.input);
      
      if (result.valid) {
        if (result.wasCorrected) {
          console.log(`✅ CORRECTED: "${result.originalName}" → "${result.correctedName}"`);
          console.log(`   Confidence: ${(result.confidence * 100).toFixed(0)}%`);
        } else {
          console.log(`✅ VALID: "${result.correctedName}"`);
          console.log(`   Confidence: ${(result.confidence * 100).toFixed(0)}%`);
        }
        if (result.rxcui) {
          console.log(`   RxCUI: ${result.rxcui}`);
        }
      } else {
        console.log(`❌ INVALID: "${result.originalName}"`);
        if (result.suggestions && result.suggestions.length > 0) {
          console.log(`   Suggestions: ${result.suggestions.join(', ')}`);
        }
      }
    } catch (err) {
      console.log(`❌ ERROR: ${err.message}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n✅ Test complete!\n');
}

// Run tests
runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
