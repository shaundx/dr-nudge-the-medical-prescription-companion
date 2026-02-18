import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function AddMedModal({ onClose }) {
  const { addMedication, speak, t } = useApp();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [prescriptionImage, setPrescriptionImage] = useState(null);
  const fileInputRef = useRef(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    dosage: '',
    frequency: '',
    time: '08:00 AM',
    route: 'Oral',
    duration: '',
    nudge: {
      headline: '',
      plainInstruction: '',
      theWhy: '',
      habitHook: '',
      warning: '',
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

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPrescriptionImage(event.target?.result);
      };
      reader.readAsDataURL(file);
    }
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
      await addMedication({
        ...formData,
        prescriptionImage: prescriptionImage,
      });
      speak(`Added ${formData.name} successfully!`);
      onClose();
    } catch (err) {
      console.error('Failed to add medication:', err);
      setError('Failed to add medication. Please try again.');
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
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
            <h2 className="text-lg font-bold text-gray-900">Add Medication</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="px-5 py-4 overflow-y-auto">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error message */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                  {error}
                </div>
              )}

              {/* Basic Info */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Medicine Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="e.g., Aspirin"
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dosage</label>
                <input
                  type="text"
                  value={formData.dosage}
                  onChange={(e) => handleChange('dosage', e.target.value)}
                  placeholder="e.g., 500mg"
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                <input
                  type="text"
                  value={formData.frequency}
                  onChange={(e) => handleChange('frequency', e.target.value)}
                  placeholder="e.g., Once daily"
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => handleChange('time', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Route</label>
                  <select
                    value={formData.route}
                    onChange={(e) => handleChange('route', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all"
                  >
                    <option>Oral</option>
                    <option>Injectable</option>
                    <option>Topical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                <input
                  type="text"
                  value={formData.duration}
                  onChange={(e) => handleChange('duration', e.target.value)}
                  placeholder="e.g., 30 days"
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all"
                />
              </div>

              {/* Prescription Image */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Prescription Image</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                {prescriptionImage ? (
                  <div className="relative w-full h-40 bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center">
                    <img src={prescriptionImage} alt="Prescription" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPrescriptionImage(null)}
                      className="absolute top-2 right-2 p-1 bg-black/50 rounded-lg text-white hover:bg-black/70"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-gray-400 transition-colors"
                  >
                    <Upload size={24} className="text-gray-400" />
                    <span className="text-sm font-medium text-gray-600">Upload prescription image</span>
                  </button>
                )}
              </div>

              {/* Nudge Information */}
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Reminders & Motivation</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Headline/Tagline</label>
                  <input
                    type="text"
                    value={formData.nudge.headline}
                    onChange={(e) => handleNudgeChange('headline', e.target.value)}
                    placeholder="e.g., Take with breakfast"
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plain Instruction</label>
                  <textarea
                    value={formData.nudge.plainInstruction}
                    onChange={(e) => handleNudgeChange('plainInstruction', e.target.value)}
                    rows={2}
                    placeholder="e.g., Swallow the tablet with water"
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Why (Benefits)</label>
                  <textarea
                    value={formData.nudge.theWhy}
                    onChange={(e) => handleNudgeChange('theWhy', e.target.value)}
                    rows={2}
                    placeholder="e.g., Helps prevent heart disease"
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Habit Hook</label>
                  <input
                    type="text"
                    value={formData.nudge.habitHook}
                    onChange={(e) => handleNudgeChange('habitHook', e.target.value)}
                    placeholder="e.g., Take after breakfast"
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all"
                  />
                </div>
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-5 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || !formData.name}
              className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? 'Adding...' : <><Plus size={18} /> Add Medicine</>}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
