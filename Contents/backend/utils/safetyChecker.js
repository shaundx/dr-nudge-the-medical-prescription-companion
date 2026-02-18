/**
 * Enhanced Safety Checker - Food interactions, age warnings, dosage alerts
 */

/**
 * Common drug-food interactions database
 */
const FOOD_INTERACTIONS = {
  // Cardiovascular
  'warfarin': { avoid: ['vitamin K-rich foods (spinach, kale)', 'alcohol', 'cranberry juice'], reason: 'Can interfere with blood thinning' },
  'lisinopril': { avoid: ['potassium supplements', 'bananas', 'salt substitutes'], reason: 'Can cause high potassium levels' },
  'amlodipine': { avoid: ['grapefruit juice'], reason: 'Increases drug levels and side effects' },
  'atorvastatin': { avoid: ['grapefruit juice', 'large amounts of alcohol'], reason: 'Can increase side effects and liver damage' },
  'simvastatin': { avoid: ['grapefruit juice'], reason: 'Increases drug levels and muscle problems' },
  
  // Antibiotics
  'ciprofloxacin': { avoid: ['dairy products', 'calcium supplements'], reason: 'Reduces medication absorption', timing: 'Take 2 hours before or after dairy' },
  'azithromycin': { avoid: ['aluminum/magnesium antacids'], reason: 'Reduces absorption' },
  'metronidazole': { avoid: ['alcohol'], reason: 'Causes severe nausea and vomiting' },
  
  // Diabetes
  'metformin': { avoid: ['excessive alcohol'], reason: 'Increases risk of low blood sugar and lactic acidosis' },
  
  // Pain/Inflammation
  'ibuprofen': { avoid: ['alcohol'], reason: 'Increases stomach bleeding risk' },
  'aspirin': { avoid: ['alcohol', 'other NSAIDs'], reason: 'Increases bleeding risk' },
  
  // Acid Reflux
  'omeprazole': { avoid: ['none'], note: 'Take before meals for best effect' },
  
  // Thyroid
  'levothyroxine': { avoid: ['coffee', 'soy', 'calcium', 'iron'], reason: 'Reduces absorption', timing: 'Take on empty stomach, 30 min before eating' },
};

/**
 * Age-based medication warnings
 */
const AGE_WARNINGS = {
  // Elderly warnings (65+)
  elderly: {
    'benzodiazepines': { warning: 'Increased fall risk and confusion in elderly', alternatives: 'Discuss non-drug options with doctor' },
    'diphenhydramine': { warning: 'Can cause confusion and dizziness in seniors', alternatives: 'Consider non-drowsy alternatives' },
    'aspirin': { warning: 'Higher bleeding risk in elderly', note: 'Monitor for bruising or bleeding' },
    'nsaids': { warning: 'Increased stomach and kidney problems', note: 'Use lowest effective dose' },
    'anticholinergics': { warning: 'Can cause memory problems and confusion', note: 'Regular monitoring recommended' },
  },
  
  // Pediatric warnings (<18)
  pediatric: {
    'aspirin': { warning: 'Risk of Reye syndrome in children', alternatives: 'Use acetaminophen or ibuprofen instead' },
    'tetracycline': { warning: 'Can cause permanent tooth discoloration', note: 'Avoid in children under 8' },
    'fluoroquinolones': { warning: 'May affect bone and cartilage development', note: 'Use only when no alternatives' },
  },
  
  // Pregnancy warnings
  pregnancy: {
    'warfarin': { warning: 'Can cause birth defects', note: 'Switch to safer alternatives during pregnancy' },
    'ace_inhibitors': { warning: 'Can harm fetus in 2nd and 3rd trimester', note: 'Stop immediately if pregnant' },
    'statins': { warning: 'May harm developing fetus', note: 'Use effective contraception or stop medication' },
  },
};

/**
 * Dosage-specific alerts
 */
const DOSAGE_ALERTS = {
  'aspirin': [
    { minDose: 325, alert: 'High dose aspirin increases bleeding risk', note: 'Monitor for bruising, black stools' },
  ],
  'acetaminophen': [
    { maxDaily: 4000, alert: 'DO NOT exceed 4000mg per day', note: 'Can cause liver damage' },
  ],
  'ibuprofen': [
    { maxDaily: 2400, alert: 'DO NOT exceed 2400mg per day', note: 'Higher doses increase stomach and heart risks' },
  ],
};

/**
 * Check food interactions for a drug
 */
function checkFoodInteractions(drugName) {
  const normalizedName = drugName.toLowerCase().trim();
  
  // Check exact match
  if (FOOD_INTERACTIONS[normalizedName]) {
    return {
      hasFoodInteraction: true,
      ...FOOD_INTERACTIONS[normalizedName],
    };
  }
  
  // Check if drug name contains key ingredient
  for (const [key, value] of Object.entries(FOOD_INTERACTIONS)) {
    if (normalizedName.includes(key)) {
      return {
        hasFoodInteraction: true,
        ...value,
      };
    }
  }
  
  return { hasFoodInteraction: false };
}

/**
 * Check age-based warnings
 */
function checkAgeWarnings(drugName, patientAge) {
  const normalizedName = drugName.toLowerCase().trim();
  const warnings = [];
  
  // Check elderly warnings (65+)
  if (patientAge >= 65) {
    for (const [drug, warning] of Object.entries(AGE_WARNINGS.elderly)) {
      if (normalizedName.includes(drug)) {
        warnings.push({
          category: 'elderly',
          severity: 'moderate',
          ...warning,
        });
      }
    }
  }
  
  // Check pediatric warnings (<18)
  if (patientAge < 18) {
    for (const [drug, warning] of Object.entries(AGE_WARNINGS.pediatric)) {
      if (normalizedName.includes(drug)) {
        warnings.push({
          category: 'pediatric',
          severity: 'high',
          ...warning,
        });
      }
    }
  }
  
  return warnings;
}

/**
 * Parse dosage string and check for alerts
 */
function checkDosageAlerts(drugName, dosageString) {
  const normalizedName = drugName.toLowerCase().trim();
  
  // Extract numeric dose from string (e.g., "500mg" → 500)
  const match = dosageString.match(/(\d+)\s*mg/i);
  if (!match) return [];
  
  const dose = parseInt(match[1]);
  const alerts = [];
  
  if (DOSAGE_ALERTS[normalizedName]) {
    DOSAGE_ALERTS[normalizedName].forEach(rule => {
      if (rule.minDose && dose >= rule.minDose) {
        alerts.push({
          severity: 'high',
          alert: rule.alert,
          note: rule.note,
        });
      }
      if (rule.maxDaily && dose > rule.maxDaily) {
        alerts.push({
          severity: 'critical',
          alert: rule.alert,
          note: rule.note,
        });
      }
    });
  }
  
  return alerts;
}

/**
 * Comprehensive safety check
 */
function comprehensiveSafetyCheck(drugName, dosage, patientAge, currentMeds = []) {
  const safetyReport = {
    drugName,
    foodInteractions: checkFoodInteractions(drugName),
    ageWarnings: patientAge ? checkAgeWarnings(drugName, patientAge) : [],
    dosageAlerts: dosage ? checkDosageAlerts(drugName, dosage) : [],
    overallSeverity: 'low',
  };
  
  // Determine overall severity
  const hasHighSeverity = safetyReport.ageWarnings.some(w => w.severity === 'high') ||
                          safetyReport.dosageAlerts.some(a => a.severity === 'high' || a.severity === 'critical');
  
  if (hasHighSeverity) {
    safetyReport.overallSeverity = 'high';
  } else if (safetyReport.foodInteractions.hasFoodInteraction || safetyReport.ageWarnings.length > 0) {
    safetyReport.overallSeverity = 'moderate';
  }
  
  return safetyReport;
}

module.exports = {
  checkFoodInteractions,
  checkAgeWarnings,
  checkDosageAlerts,
  comprehensiveSafetyCheck,
  FOOD_INTERACTIONS,
  AGE_WARNINGS,
  DOSAGE_ALERTS,
};
