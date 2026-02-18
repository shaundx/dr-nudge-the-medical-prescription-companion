const axios = require('axios');
const { comprehensiveSafetyCheck } = require('../utils/safetyChecker');

const RXNORM_BASE = process.env.RXNORM_BASE_URL || 'https://rxnav.nlm.nih.gov/REST';
const OPENFDA_BASE = process.env.OPENFDA_BASE_URL || 'https://api.fda.gov/drug';

/**
 * Calculate Levenshtein distance for fuzzy string matching
 */
function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Drug Service — Handles drug lookups, interaction checks via RxNorm & OpenFDA
 */
const drugService = {
  /**
   * Validate and normalize drug name using RxNorm
   * Returns corrected name if found, or suggestions if not found
   */
  async validateAndNormalizeDrugName(drugName) {
    if (!drugName || drugName === 'CLARIFICATION_NEEDED') {
      return { valid: false, originalName: drugName, correctedName: null, confidence: 0 };
    }

    try {
      console.log(`[DrugValidator] Checking: "${drugName}"`);
      
      // Step 1: Check exact match
      const exactMatch = await this.lookupDrug(drugName);
      if (exactMatch.found && exactMatch.concepts && exactMatch.concepts.length > 0) {
        console.log(`[DrugValidator] ✅ Exact match found: ${exactMatch.concepts[0].name}`);
        return {
          valid: true,
          originalName: drugName,
          correctedName: exactMatch.concepts[0].name,
          confidence: 1.0,
          rxcui: exactMatch.concepts[0].rxcui
        };
      }

      // Step 2: Try approximate spelling search
      const approxRes = await axios.get(`${RXNORM_BASE}/approximateTerm.json`, {
        params: { term: drugName, maxEntries: 5 },
        timeout: 10000,
      });

      const candidates = approxRes.data?.approximateGroup?.candidate;
      if (candidates && candidates.length > 0) {
        // Find best match using Levenshtein distance
        let bestMatch = null;
        let bestScore = Infinity;
        
        for (const candidate of candidates) {
          // Safely handle candidate structure
          const candidateName = candidate.name || candidate;
          const candidateRxcui = candidate.rxcui || null;
          
          if (!candidateName || typeof candidateName !== 'string') {
            continue;
          }
          
          const distance = levenshteinDistance(
            drugName.toLowerCase(),
            candidateName.toLowerCase()
          );
          const similarity = 1 - (distance / Math.max(drugName.length, candidateName.length));
          
          if (distance < bestScore && similarity > 0.6) {
            bestScore = distance;
            bestMatch = {
              name: candidateName,
              rxcui: candidateRxcui,
              confidence: similarity
            };
          }
        }

        if (bestMatch) {
          console.log(`[DrugValidator] 📝 Spelling correction: "${drugName}" → "${bestMatch.name}" (confidence: ${(bestMatch.confidence * 100).toFixed(0)}%)`);
          return {
            valid: true,
            originalName: drugName,
            correctedName: bestMatch.name,
            confidence: bestMatch.confidence,
            rxcui: bestMatch.rxcui,
            wasCorrected: true
          };
        }
      }

      // Step 3: No valid match found
      console.log(`[DrugValidator] ❌ No valid drug found for: "${drugName}"`);
      const suggestions = candidates 
        ? candidates.slice(0, 3).map(c => typeof c === 'string' ? c : c.name).filter(Boolean)
        : [];
      return {
        valid: false,
        originalName: drugName,
        correctedName: null,
        confidence: 0,
        suggestions
      };
    } catch (err) {
      console.error('[DrugValidator] Validation failed:', err.message);
      return { valid: false, originalName: drugName, correctedName: null, confidence: 0 };
    }
  },

  /**
   * Lookup drug info from RxNorm
   */
  async lookupDrug(drugName) {
    try {
      const res = await axios.get(`${RXNORM_BASE}/drugs.json`, {
        params: { name: drugName },
        timeout: 10000,
      });

      const group = res.data?.drugGroup;
      if (!group || !group.conceptGroup) {
        return { found: false, name: drugName, message: 'Drug not found in RxNorm' };
      }

      const concepts = [];
      for (const cg of group.conceptGroup) {
        if (cg.conceptProperties) {
          concepts.push(...cg.conceptProperties.map(c => ({
            rxcui: c.rxcui,
            name: c.name,
            synonym: c.synonym,
            tty: c.tty,
          })));
        }
      }

      return { found: true, name: drugName, concepts };
    } catch (err) {
      console.error('[Drug] RxNorm lookup failed:', err.message);
      return { found: false, name: drugName, message: err.message };
    }
  },

  /**
   * Get RxCUI (RxNorm Concept Unique Identifier) for a drug
   */
  async getRxCUI(drugName) {
    try {
      const res = await axios.get(`${RXNORM_BASE}/rxcui.json`, {
        params: { name: drugName, search: 1 },
        timeout: 10000,
      });
      const ids = res.data?.idGroup?.rxnormId;
      return ids && ids.length > 0 ? ids[0] : null;
    } catch (err) {
      console.error('[Drug] RxCUI lookup failed:', err.message);
      return null;
    }
  },

  /**
   * Check drug interactions using RxNorm interaction API
   */
  async checkInteractions(drugName, currentMeds = []) {
    const interactions = [];

    try {
      // Get RxCUI for the new drug
      const rxcui = await this.getRxCUI(drugName);
      if (!rxcui) {
        console.log(`[Drug] No RxCUI found for ${drugName}, using fallback`);
        return this.getFallbackInteractions(drugName, currentMeds);
      }

      // Check interactions via RxNorm
      const res = await axios.get(`${RXNORM_BASE}/interaction/interaction.json`, {
        params: { rxcui },
        timeout: 10000,
      });

      const groups = res.data?.interactionTypeGroup;
      if (groups) {
        for (const group of groups) {
          for (const type of group.interactionType || []) {
            for (const pair of type.interactionPair || []) {
              const interacting = pair.interactionConcept?.map(c => c.minConceptItem?.name).join(' + ');
              const severity = pair.severity || 'N/A';

              // Determine tier based on severity
              let tier = 3;
              if (severity === 'high' || pair.description?.toLowerCase().includes('life-threatening')) {
                tier = 1;
              } else if (severity === 'moderate' || severity === 'medium') {
                tier = 2;
              }

              interactions.push({
                tier,
                drug: interacting || drugName,
                description: pair.description || 'Interaction detected',
                severity,
                recommendation: this.getRecommendation(tier),
              });
            }
          }
        }
      }

      // Also check against current meds
      if (currentMeds.length > 0) {
        const allRxcuis = [rxcui];
        for (const med of currentMeds) {
          const medRxcui = await this.getRxCUI(med);
          if (medRxcui) allRxcuis.push(medRxcui);
        }

        if (allRxcuis.length > 1) {
          const listRes = await axios.get(`${RXNORM_BASE}/interaction/list.json`, {
            params: { rxcuis: allRxcuis.join('+') },
            timeout: 10000,
          });

          const fullInteractions = listRes.data?.fullInteractionTypeGroup;
          if (fullInteractions) {
            for (const group of fullInteractions) {
              for (const type of group.fullInteractionType || []) {
                for (const pair of type.interactionPair || []) {
                  interactions.push({
                    tier: 2,
                    drug: pair.interactionConcept?.map(c => c.minConceptItem?.name).join(' + ') || 'Unknown',
                    description: pair.description || 'Interaction with current medication',
                    recommendation: 'Consult your physician about this combination.',
                  });
                }
              }
            }
          }
        }
      }

      // Add common dietary interactions
      interactions.push(...this.getDietaryInteractions(drugName));

    } catch (err) {
      console.error('[Drug] Interaction check failed:', err.message);
      return this.getFallbackInteractions(drugName, currentMeds);
    }

    return interactions;
  },

  /**
   * Determine safety flag from interactions
   */
  determineSafetyFlag(interactions) {
    if (!interactions || interactions.length === 0) {
      return { flag: 'GREEN', reasoning: 'No drug interactions detected. Safe to proceed with prescribed dosage.' };
    }

    const hasCritical = interactions.some(i => i.tier === 1);
    const hasModerate = interactions.some(i => i.tier === 2);

    if (hasCritical) {
      return {
        flag: 'RED',
        reasoning: 'Critical drug interaction detected. Immediate physician consultation required before starting this medication.',
      };
    }

    if (hasModerate) {
      return {
        flag: 'YELLOW',
        reasoning: 'Moderate interactions found. Monitor closely and follow up with your doctor within 7 days.',
      };
    }

    return {
      flag: 'GREEN',
      reasoning: 'Only minor dietary interactions found. Safe to proceed with normal precautions.',
    };
  },

  /**
   * Get dietary interactions for common drugs
   */
  getDietaryInteractions(drugName) {
    const dietaryMap = {
      amlodipine: [{ tier: 3, drug: 'Grapefruit', description: 'Grapefruit may increase blood levels of amlodipine, increasing the risk of side effects.', recommendation: 'Avoid grapefruit juice while on this medication.' }],
      atorvastatin: [{ tier: 3, drug: 'Grapefruit', description: 'Grapefruit can increase statin levels in the blood.', recommendation: 'Limit grapefruit consumption to small amounts.' }],
      warfarin: [{ tier: 2, drug: 'Vitamin K foods', description: 'Foods high in Vitamin K (spinach, kale) can reduce warfarin effectiveness.', recommendation: 'Keep vitamin K intake consistent day to day.' }],
      metformin: [{ tier: 3, drug: 'Alcohol', description: 'Alcohol increases the risk of lactic acidosis with metformin.', recommendation: 'Limit alcohol consumption.' }],
      lisinopril: [{ tier: 3, drug: 'Potassium-rich foods', description: 'Lisinopril can increase potassium. Avoid excess bananas, oranges, salt substitutes.', recommendation: 'Do not take potassium supplements without doctor advice.' }],
      ciprofloxacin: [{ tier: 3, drug: 'Dairy products', description: 'Calcium in dairy can reduce ciprofloxacin absorption.', recommendation: 'Take 2 hours before or 6 hours after dairy products.' }],
    };

    const key = drugName.toLowerCase();
    return dietaryMap[key] || [];
  },

  /**
   * Fallback interactions when API is unavailable
   */
  getFallbackInteractions(drugName, currentMeds) {
    const interactions = [];

    // Known major interactions (simplified)
    const knownInteractions = {
      warfarin: ['aspirin', 'ibuprofen', 'naproxen'],
      metformin: ['alcohol', 'contrast dye'],
      lisinopril: ['potassium supplements', 'spironolactone'],
      sertraline: ['tramadol', 'sumatriptan', 'maoi'],
    };

    const key = drugName.toLowerCase();
    if (knownInteractions[key]) {
      for (const med of currentMeds) {
        if (knownInteractions[key].includes(med.toLowerCase())) {
          interactions.push({
            tier: 1,
            drug: med,
            description: `Known interaction between ${drugName} and ${med}. This combination may be dangerous.`,
            recommendation: 'Contact your physician immediately before taking both medications.',
          });
        }
      }
    }

    interactions.push(...this.getDietaryInteractions(drugName));
    return interactions;
  },

  getRecommendation(tier) {
    if (tier === 1) return 'STOP — Contact your physician immediately before taking this medication.';
    if (tier === 2) return 'Schedule a follow-up with your doctor within 7 days. Monitor for side effects.';
    return 'Be aware of this interaction. Adjust diet as recommended.';
  },

  /**
   * Enhanced safety check with food, age, and dosage warnings
   */
  getEnhancedSafetyInfo(drugName, dosage, patientAge, currentMeds = []) {
    return comprehensiveSafetyCheck(drugName, dosage, patientAge, currentMeds);
  },

  /**
   * Generate complete safety warning text for patient
   */
  generateSafetyWarningText(safetyReport) {
    const warnings = [];
    
    // Food interactions
    if (safetyReport.foodInteractions.hasFoodInteraction) {
      const fi = safetyReport.foodInteractions;
      warnings.push(`⚠️ FOOD WARNING: Avoid ${fi.avoid.join(', ')}. ${fi.reason}.`);
      if (fi.timing) {
        warnings.push(`⏰ TIMING: ${fi.timing}`);
      }
    }
    
    // Age warnings
    safetyReport.ageWarnings.forEach(warning => {
      warnings.push(`👵 AGE WARNING: ${warning.warning}`);
      if (warning.note) {
        warnings.push(`   Note: ${warning.note}`);
      }
      if (warning.alternatives) {
        warnings.push(`   ${warning.alternatives}`);
      }
    });
    
    // Dosage alerts
    safetyReport.dosageAlerts.forEach(alert => {
      warnings.push(`💊 DOSAGE ALERT: ${alert.alert}`);
      if (alert.note) {
        warnings.push(`   ${alert.note}`);
      }
    });
    
    return warnings.join('\n');
  },
};

module.exports = drugService;
