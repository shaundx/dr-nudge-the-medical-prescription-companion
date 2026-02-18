import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Filter, Check, Volume2, AlertTriangle, Flame,
  ChevronRight, Calendar, Clock, TrendingUp, Pill, Plus,
  ArrowUpDown, Trash2, CheckSquare, Square
} from 'lucide-react';
import MedDetailModal from './MedDetailModal';
import AddMedModal from './AddMedModal';

export default function MedsPage() {
  const { medications, speak, takeMedication, undoTakeMedication, deleteMedication, t } = useApp();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | pending | taken | alert
  const [sortBy, setSortBy] = useState('name'); // name | frequency | dosage | date
  const [selectedMed, setSelectedMed] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMeds, setSelectedMeds] = useState(new Set());
  const [bulkMode, setBulkMode] = useState(false);

  // Filter and sort medications
  const filtered = useMemo(() => {
    let result = medications.filter((med) => {
      if (!med || !med.name) return false;
      const matchSearch = med.name.toLowerCase().includes(search.toLowerCase());
      if (filter === 'pending') return matchSearch && !med.takenToday;
      if (filter === 'taken') return matchSearch && med.takenToday;
      if (filter === 'alert') return matchSearch && (med.safetyFlag === 'RED' || med.safetyFlag === 'YELLOW');
      return matchSearch;
    });

    // Sort medications
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'frequency': {
          const freqA = a.frequency?.toLowerCase() || '';
          const freqB = b.frequency?.toLowerCase() || '';
          return freqA.localeCompare(freqB);
        }
        case 'dosage': {
          const dosageA = parseInt(a.dosage) || 0;
          const dosageB = parseInt(b.dosage) || 0;
          return dosageB - dosageA; // Higher dosage first
        }
        case 'date':
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [medications, search, filter, sortBy]);

  const filterCounts = {
    all: medications.length,
    pending: medications.filter((m) => !m.takenToday).length,
    taken: medications.filter((m) => m.takenToday).length,
    alert: medications.filter((m) => m.safetyFlag === 'RED' || m.safetyFlag === 'YELLOW').length,
  };

  // Bulk selection handlers
  const toggleSelectAll = () => {
    if (selectedMeds.size === filtered.length) {
      setSelectedMeds(new Set());
    } else {
      setSelectedMeds(new Set(filtered.map(m => m.id)));
    }
  };

  const toggleSelectMed = (medId) => {
    const newSelected = new Set(selectedMeds);
    if (newSelected.has(medId)) {
      newSelected.delete(medId);
    } else {
      newSelected.add(medId);
    }
    setSelectedMeds(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedMeds.size === 0) return;
    
    const count = selectedMeds.size;
    if (!window.confirm(t('confirm', 'Confirm') + `: ` + t('delete', 'Delete') + ` ${count} ${t('medications', 'medicines')}?`)) {
      return;
    }

    try {
      // Delete all selected medications
      for (const medId of selectedMeds) {
        await deleteMedication(medId);
      }
      
      setSelectedMeds(new Set());
      setBulkMode(false);
      speak(`${count} ${t('medications', 'medicines')} ${t('medicationDeleted', 'deleted')}`);
    } catch (error) {
      console.error('Failed to delete medications:', error);
      speak('Sorry, failed to delete medicines');
    }
  };

  return (
    <div className="page-content pb-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 lg:text-3xl">{t('myMedications', 'My Medicines')}</h1>
          <p className="text-sm text-gray-500 mt-1 lg:text-base">
            {medications.length} {t('medications', 'medicine')}{medications.length !== 1 ? 's' : ''} {t('totalMedications', 'total')}
            {bulkMode && selectedMeds.size > 0 && (
              <span className="ml-2 text-blue-600 font-medium">
                ({selectedMeds.size} {t('select', 'Select')})
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {medications.length > 0 && (
            <button
              onClick={() => {
                setBulkMode(!bulkMode);
                setSelectedMeds(new Set());
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
                bulkMode
                  ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <CheckSquare size={18} /> {bulkMode ? t('cancel', 'Cancel') : t('select', 'Select')}
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
          >
            <Plus size={18} /> {t('add', 'Add')}
          </button>
        </div>
      </div>

      {/* Search and Sort bar */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search', 'Search medicines...')}
            className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-2xl text-sm font-medium text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all"
          />
        </div>
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="appearance-none pl-10 pr-10 py-3 bg-gray-100 rounded-2xl text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all cursor-pointer"
          >
            <option value="name">{t('sortByName', 'Name')}</option>
            <option value="frequency">{t('sortByFrequency', 'Frequency')}</option>
            <option value="dosage">{t('sortByDosage', 'Dosage')}</option>
            <option value="date">{t('sortByDateAdded', 'Date Added')}</option>
          </select>
          <ArrowUpDown size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <ChevronRight size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none rotate-90" />
        </div>
      </div>

      {/* Bulk actions bar */}
      <AnimatePresence>
        {bulkMode && selectedMeds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSelectAll}
                className="p-2 rounded-lg hover:bg-blue-100 transition-colors"
              >
                {selectedMeds.size === filtered.length ? (
                  <CheckSquare size={20} className="text-blue-600" />
                ) : (
                  <Square size={20} className="text-blue-600" />
                )}
              </button>
              <span className="text-sm font-medium text-blue-900">
                {selectedMeds.size === filtered.length
                  ? t('deselectAll', 'Deselect All')
                  : t('selectAll', 'Select All')}{' '}
                ({selectedMeds.size} {t('ofLabel', 'of')} {filtered.length})
              </span>
            </div>
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors"
            >
              <Trash2 size={18} />
              {t('delete', 'Delete')} {selectedMeds.size} {selectedMeds.size === 1 ? t('medicine', 'medicine') : t('medications', 'medicines')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1 -mx-1 px-1">
        {[
          { id: 'all', label: t('filterAll', 'All') },
          { id: 'pending', label: t('filterPending', 'Pending') },
          { id: 'taken', label: t('filterTaken', 'Taken') },
          { id: 'alert', label: t('filterAlerts', 'Alerts') },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              filter === f.id
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {f.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-md ${
              filter === f.id ? 'bg-white/20' : 'bg-gray-200'
            }`}>
              {filterCounts[f.id]}
            </span>
          </button>
        ))}
      </div>

      {/* Medication list */}
      {!medications || medications.length === 0 ? (
        <div className="text-center py-12">
          <Pill size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">
            {t('noMedicinesYet', 'No medicines yet')}
          </p>
          <p className="text-sm text-gray-300 mt-1">
            {t('scanPrescription', 'Scan a prescription to add medicines')}
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Pill size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">
            {search ? t('noMedicinesFound', 'No medicines found') : t('noMedicinesMatchFilter', 'No medicines match filter')}
          </p>
          <p className="text-sm text-gray-300 mt-1">
            {search ? t('tryDifferentSearch', 'Try a different search') : t('tryChangingFilter', 'Try changing the filter')}
          </p>
        </div>
      ) : (
        <div className="space-y-3 sm:grid sm:grid-cols-2 sm:gap-4 sm:space-y-0 xl:grid-cols-3">
          {filtered.map((med, i) => (
            <motion.div
              key={med.id || i}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <MedListCard
                med={med}
                bulkMode={bulkMode}
                isSelected={selectedMeds.has(med.id)}
                onToggleSelect={() => toggleSelectMed(med.id)}
                onTake={() => {
                  takeMedication(med.id);
                  speak(`Marked ${med.name} as taken!`);
                }}
                onUndo={() => undoTakeMedication(med.id)}
                onDetail={() => setSelectedMed(med)}
                onSpeak={() => speak(med.nudge?.plainInstruction || `Take ${med.name} ${med.dosage}`)}
              />
            </motion.div>
          ))}
        </div>
      )}

      {/* Med detail modal */}
      {selectedMed && (
        <MedDetailModal med={selectedMed} onClose={() => setSelectedMed(null)} />
      )}

      {/* Add medication modal */}
      {showAddModal && (
        <AddMedModal onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
}

/* ─── Individual Med Card for List ─── */
function MedListCard({ med, bulkMode, isSelected, onToggleSelect, onTake, onUndo, onDetail, onSpeak }) {
  const adherence = med.totalDoses > 0 ? Math.round((med.takenDoses / med.totalDoses) * 100) : 0;

  const borderColor = {
    RED: 'border-l-red-500',
    YELLOW: 'border-l-yellow-500',
    GREEN: 'border-l-green-500',
  }[med.safetyFlag || 'GREEN'];

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden border-l-4 ${
      isSelected ? 'border-blue-300 ring-2 ring-blue-200' : 'border-gray-100'
    } ${borderColor} transition-all`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Checkbox or Status circle */}
          {bulkMode ? (
            <button
              onClick={onToggleSelect}
              className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                isSelected
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}
            >
              {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
            </button>
          ) : (
            <button
              onClick={med.takenToday ? onUndo : onTake}
              className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                med.takenToday
                  ? 'bg-green-100 text-green-600'
                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}
            >
              {med.takenToday ? <Check size={20} /> : <span className="text-lg">💊</span>}
            </button>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0" onClick={onDetail}>
            <div className="flex items-center gap-2">
              <h3 className={`font-bold text-gray-900 ${med.takenToday ? 'line-through opacity-60' : ''}`}>
                {med.name}
              </h3>
              {med.safetyFlag === 'RED' && (
                <AlertTriangle size={14} className="text-red-500" />
              )}
            </div>
            <p className="text-sm text-gray-500">{med.dosage}</p>
            {med.doseTiming && (
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-xs text-gray-400">Timing:</span>
                <span className="text-xs font-mono text-purple-600">{med.doseTiming}</span>
              </div>
            )}

            {/* Time + Streak row */}
            <div className="flex items-center gap-3 mt-1.5">
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Clock size={10} /> {med.time || 'As needed'}
              </span>
              <span className="flex items-center gap-1 text-xs text-orange-400">
                <Flame size={10} /> {med.streak || 0} day streak
              </span>
            </div>

            {/* Adherence bar */}
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    adherence >= 80 ? 'bg-green-500' : adherence >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${adherence}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-400 font-medium">{adherence}%</span>
            </div>
          </div>

          {/* Voice + arrow */}
          <div className="flex flex-col items-center gap-1">
            <button onClick={onSpeak} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <Volume2 size={14} className="text-gray-400" />
            </button>
            <button onClick={onDetail} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronRight size={14} className="text-gray-400" />
            </button>
          </div>
        </div>

        {/* Nudge hint */}
        {med.nudge?.habitHook && !med.takenToday && (
          <div className="mt-2.5 px-3 py-2 bg-amber-50 rounded-xl text-xs text-amber-600 italic">
            💡 {med.nudge.habitHook}
          </div>
        )}

        {/* Refill warning */}
        {med.refillDate && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-blue-500">
            <Calendar size={10} />
            Refill by {med.refillDate}
          </div>
        )}
      </div>
    </div>
  );
}
