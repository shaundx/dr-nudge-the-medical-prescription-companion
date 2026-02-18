import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function EditMedModal({ med, onClose }) {
  const { updateMedication, speak, t } = useApp();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: med.name || '',
    dosage: med.dosage || '',
    frequency: med.frequency || '',
    time: med.time || '08:00 AM',
    route: med.route || 'Oral',
    duration: med.duration || '',
    refillDate: med.refillDate || '',
    nudge: {
      headline: med.nudge?.headline || '',
      plainInstruction: med.nudge?.plainInstruction || '',
      theWhy: med.nudge?.theWhy || '',
      habitHook: med.nudge?.habitHook || '',
      warning: med.nudge?.warning || '',
    },
  });

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNudgeChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      nudge: { ...prev.nudge, [field]: value },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Medicine name is required');
      return;
    }

    try {
      setSaving(true);
      await updateMedication(med.id, formData);
      speak(`Updated ${formData.name} successfully!`);
      onClose();
    } catch (err) {
      console.error('Failed to update medication:', err);
      setError('Failed to save changes. Please try again.');
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="modal-sheet max-h-[90vh]"
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* Header */}
          <div className="px-4 pb-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Edit Medicine</h2>
              <button
                onClick={onClose}
                className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <X size={18} className="text-gray-600" />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {/* Error message */}
            {error && (
              <div className="bg-red-50 rounded-xl p-3 flex items-start gap-2 border border-red-200">
                <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Basic Information */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Basic Information</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Medicine Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all"
                  placeholder="e.g., Aspirin"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dosage</label>
                  <input
                    type="text"
                    value={formData.dosage}
                    onChange={(e) => handleChange('dosage', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all"
                    placeholder="e.g., 100mg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Route</label>
                  <select
                    value={formData.route}
                    onChange={(e) => handleChange('route', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all"
                  >
                    <option value="Oral">Oral</option>
                    <option value="Topical">Topical</option>
                    <option value="Injection">Injection</option>
                    <option value="Inhalation">Inhalation</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                  <input
                    type="text"
                    value={formData.frequency}
                    onChange={(e) => handleChange('frequency', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all"
                    placeholder="e.g., Once daily"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                  <input
                    type="text"
                    value={formData.time}
                    onChange={(e) => handleChange('time', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all"
                    placeholder="e.g., 08:00 AM"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                  <input
                    type="text"
                    value={formData.duration}
                    onChange={(e) => handleChange('duration', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all"
                    placeholder="e.g., 7 days"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Refill Date</label>
                  <input
                    type="date"
                    value={formData.refillDate}
                    onChange={(e) => handleChange('refillDate', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Nudge/Reminder Information */}
            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Reminders & Motivation</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Headline/Tagline</label>
                <input
                  type="text"
                  value={formData.nudge.headline}
                  onChange={(e) => handleNudgeChange('headline', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all"
                  placeholder="e.g., Keep your heart healthy!"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">How to Take (Instructions)</label>
                <textarea
                  value={formData.nudge.plainInstruction}
                  onChange={(e) => handleNudgeChange('plainInstruction', e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all resize-none"
                  placeholder="e.g., Take 1 tablet with breakfast"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Why This Matters</label>
                <textarea
                  value={formData.nudge.theWhy}
                  onChange={(e) => handleNudgeChange('theWhy', e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all resize-none"
                  placeholder="e.g., This helps reduce your blood pressure"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Habit Reminder Trick</label>
                <input
                  type="text"
                  value={formData.nudge.habitHook}
                  onChange={(e) => handleNudgeChange('habitHook', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all"
                  placeholder="e.g., Take it with your morning coffee"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Safety Warning</label>
                <textarea
                  value={formData.nudge.warning}
                  onChange={(e) => handleNudgeChange('warning', e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all resize-none"
                  placeholder="e.g., Avoid alcohol while taking this medication"
                />
              </div>
            </div>
          </form>

          {/* Bottom Actions */}
          <div className="p-4 border-t border-gray-100 bg-white space-y-2">
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={saving}
              className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold text-base flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={20} />
                  Save Changes
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="w-full py-3 bg-gray-100 text-gray-600 rounded-2xl font-medium text-sm hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
