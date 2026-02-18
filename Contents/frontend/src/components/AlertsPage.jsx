import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { motion } from 'framer-motion';
import {
  ShieldAlert, AlertTriangle, AlertCircle, Info, Volume2,
  ChevronDown, ChevronUp, Phone, Check, Shield
} from 'lucide-react';

export default function AlertsPage() {
  const { interactions, medications, speak, t, primaryDoctor, callDoctor } = useApp();

  // Get active medication names (case-insensitive)
  const activeMedNames = medications
    .filter(m => m.active !== false)
    .map(m => m.name.toLowerCase());

  // Filter interactions to only show those where both drugs are still active
  const activeInteractions = interactions.filter((i) => {
    const drug1Active = activeMedNames.some(name => 
      i.drug1.toLowerCase().includes(name) || name.includes(i.drug1.toLowerCase())
    );
    const drug2Active = activeMedNames.some(name => 
      i.drug2.toLowerCase().includes(name) || name.includes(i.drug2.toLowerCase())
    );
    return drug1Active && drug2Active;
  });

  // Categorize by severity
  const red = activeInteractions.filter((i) => i.severity === 'high');
  const yellow = activeInteractions.filter((i) => i.severity === 'moderate');
  const green = activeInteractions.filter((i) => i.severity === 'low');

  const totalAlerts = activeInteractions.length;

  return (
    <div className="page-content pb-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900 lg:text-3xl">{t('alerts.title', 'Safety Alerts')}</h1>
        <p className="text-sm text-gray-500 mt-1 lg:text-base">
          {t('alerts.subtitle', 'Drug interactions & dietary warnings')}
        </p>
      </div>

      {/* Summary banner */}
      {totalAlerts > 0 ? (
        <div className={`p-4 rounded-2xl mb-5 ${
          red.length > 0 ? 'bg-red-50 border border-red-200' :
          yellow.length > 0 ? 'bg-yellow-50 border border-yellow-200' :
          'bg-green-50 border border-green-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              red.length > 0 ? 'bg-red-100' : yellow.length > 0 ? 'bg-yellow-100' : 'bg-green-100'
            }`}>
              <ShieldAlert size={22} className={
                red.length > 0 ? 'text-red-600' : yellow.length > 0 ? 'text-yellow-600' : 'text-green-600'
              } />
            </div>
            <div>
              <h2 className={`font-bold text-base ${
                red.length > 0 ? 'text-red-700' : yellow.length > 0 ? 'text-yellow-700' : 'text-green-700'
              }`}>
                {red.length > 0
                  ? `${red.length} ${t('alertsSummaryCritical', 'Critical Alerts')}`
                  : yellow.length > 0
                    ? `${yellow.length} ${t('alertsSummaryWarnings', 'Warnings')}`
                    : t('alertsSummaryMinor', 'Minor Notices Only')}
              </h2>
              <p className={`text-sm ${
                red.length > 0 ? 'text-red-500' : yellow.length > 0 ? 'text-yellow-500' : 'text-green-500'
              }`}>
                {totalAlerts} {t('alertsTotalInteractions', 'total interactions found')}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center py-12 mb-4"
        >
          <div className="w-20 h-20 bg-green-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <Shield size={32} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-green-700 mb-1">{t('alertsAllClearTitle', 'All Clear! 🎉')}</h2>
          <p className="text-sm text-gray-500">{t('alertsAllClearMessage', 'No drug interactions detected')}</p>
          <p className="text-xs text-gray-400 mt-1">
            {t('alertsAllClearSub', 'We checked all your medicines against each other')}
          </p>
        </motion.div>
      )}

      {/* Critical (RED) alerts */}
      {red.length > 0 && (
        <AlertSection
          title={t('alertsCriticalTitle', '🚨 Critical — Talk to your doctor')}
          alerts={red}
          tier="red"
          speak={speak}
        />
      )}

      {/* Moderate (YELLOW) alerts */}
      {yellow.length > 0 && (
        <AlertSection
          title={t('alertsWarningTitle', '⚠️ Warnings — Be careful')}
          alerts={yellow}
          tier="yellow"
          speak={speak}
        />
      )}

      {/* Low (GREEN) notices */}
      {green.length > 0 && (
        <AlertSection
          title={t('alertsInfoTitle', 'ℹ️ Notices — Good to know')}
          alerts={green}
          tier="green"
          speak={speak}
        />
      )}

      {/* Dietary interactions from meds */}
      <DietarySection medications={medications} speak={speak} />

      {/* Emergency section */}
      {totalAlerts > 0 && (
        <div className="mt-6 p-4 bg-gray-50 rounded-2xl border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">{t('alertsNeedHelpTitle', 'Need help?')}</h3>
          <p className="text-xs text-gray-500 mb-3">
            {t('alertsNeedHelpBody', 'If you feel unwell or have questions about these interactions, contact your doctor.')}
          </p>
          <button
            onClick={callDoctor}
            disabled={!primaryDoctor || !primaryDoctor.phone}
            className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors
              ${primaryDoctor && primaryDoctor.phone
                ? 'bg-gray-900 text-white hover:bg-gray-800'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
          >
            <Phone size={16} /> {t('alertsCallDoctor', 'Call my doctor')}
          </button>
          {!primaryDoctor && (
            <p className="mt-2 text-[11px] text-gray-400">
              Add a caregiver with relationship "Doctor" in your profile to enable this button.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Alert Section by tier ─── */
function AlertSection({ title, alerts, tier, speak }) {
  const colors = {
    red: { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-500', text: 'text-red-700', desc: 'text-red-600' },
    yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: 'text-yellow-500', text: 'text-yellow-700', desc: 'text-yellow-600' },
    green: { bg: 'bg-green-50', border: 'border-green-200', icon: 'text-green-500', text: 'text-green-700', desc: 'text-green-600' },
  }[tier];

  const TierIcon = tier === 'red' ? AlertTriangle : tier === 'yellow' ? AlertCircle : Info;

  return (
    <div className="mb-5">
      <h3 className="text-sm font-semibold text-gray-500 mb-3">{title}</h3>
      <div className="space-y-2.5 sm:grid sm:grid-cols-2 sm:gap-3 sm:space-y-0 lg:grid-cols-3">
        {alerts.map((alert, i) => (
          <AlertCard key={i} alert={alert} colors={colors} TierIcon={TierIcon} speak={speak} />
        ))}
      </div>
    </div>
  );
}

function AlertCard({ alert, colors, TierIcon, speak }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useApp();

  const handleSpeak = () => {
    speak(alert.description || `${alert.drug1} and ${alert.drug2} may interact.`);
  };

  return (
    <motion.div
      layout
      className={`${colors.bg} border ${colors.border} rounded-2xl overflow-hidden`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex-shrink-0 ${colors.icon}`}>
            <TierIcon size={18} />
          </div>
          <div className="flex-1">
            <p className={`font-semibold text-sm ${colors.text}`}>
              {alert.drug1 && alert.drug2
                ? `${alert.drug1} + ${alert.drug2}`
                : 'Drug Interaction'}
            </p>
            <p className={`text-sm mt-1 ${colors.desc}`}>
              {alert.description || 'Potential interaction detected'}
            </p>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={handleSpeak} className="p-2 rounded-lg hover:bg-white/50 transition-colors">
              <Volume2 size={14} className={colors.icon} />
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-2 rounded-lg hover:bg-white/50 transition-colors"
            >
              {expanded
                ? <ChevronUp size={14} className={colors.icon} />
                : <ChevronDown size={14} className={colors.icon} />}
            </button>
          </div>
        </div>

        {/* Expanded details */}
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="mt-3 pt-3 border-t border-current/10"
          >
            {alert.recommendation && (
              <div className="mb-2">
                <p className="text-xs font-semibold text-gray-500">{t('alertsWhatToDo', 'What to do:')}</p>
                <p className="text-sm text-gray-600">{alert.recommendation}</p>
              </div>
            )}
            {alert.plainExplanation && (
              <div className="mb-2">
                <p className="text-xs font-semibold text-gray-500">{t('alertsInSimpleWords', 'In simple words:')}</p>
                <p className="text-sm text-gray-600">{alert.plainExplanation}</p>
              </div>
            )}
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                alert.severity === 'high' ? 'bg-red-100 text-red-600' :
                alert.severity === 'moderate' ? 'bg-yellow-100 text-yellow-600' :
                'bg-green-100 text-green-600'
              }`}>
                {alert.severity?.toUpperCase()} {t('alertsSeveritySuffix', 'severity')}
              </span>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Dietary Interactions Section ─── */
function DietarySection({ medications, speak }) {
  const { t } = useApp();
  const dietaryTips = [
    { drug: 'Metformin', tip: 'Limit alcohol — it can cause dangerous lactic acid buildup', icon: '🍷' },
    { drug: 'Warfarin', tip: 'Eat consistent amounts of green leafy veggies (vitamin K)', icon: '🥬' },
    { drug: 'Amlodipine', tip: 'Avoid grapefruit — it makes the medicine too strong', icon: '🍊' },
    { drug: 'Lisinopril', tip: 'Don\'t use potassium salt substitutes', icon: '🧂' },
    { drug: 'Atorvastatin', tip: 'Avoid grapefruit juice — it increases side effects', icon: '🍊' },
  ];

  // Only show dietary tips for ACTIVE medications
  const relevantTips = dietaryTips.filter((tip) =>
    medications.some((med) => 
      med.active !== false && 
      med.name.toLowerCase().includes(tip.drug.toLowerCase())
    )
  );

  if (relevantTips.length === 0) return null;

  return (
    <div className="mb-5">
      <h3 className="text-sm font-semibold text-gray-500 mb-3">{t('alertsFoodDrinkWarnings', '🍽️ Food & Drink Warnings')}</h3>
      <div className="space-y-2 sm:grid sm:grid-cols-2 sm:gap-3 sm:space-y-0">
        {relevantTips.map((tip, i) => (
          <div key={i} className="flex items-start gap-3 p-3 bg-orange-50 rounded-xl border border-orange-200">
            <span className="text-xl">{tip.icon}</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-orange-700">{tip.drug}</p>
              <p className="text-sm text-orange-600">{tip.tip}</p>
            </div>
            <button
              onClick={() => speak(`${tip.drug}: ${tip.tip}`)}
              className="p-1.5 rounded-lg hover:bg-orange-100 flex-shrink-0"
            >
              <Volume2 size={14} className="text-orange-400" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
