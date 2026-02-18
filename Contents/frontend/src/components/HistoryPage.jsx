import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { motion } from 'framer-motion';
import {
  History, Check, Undo2, X, Calendar, Clock, Filter, ChevronDown, Package
} from 'lucide-react';

export default function HistoryPage() {
  const { medicationLogs, medications, t } = useApp();
  const [filterAction, setFilterAction] = useState('all'); // all, taken, undo, missed
  const [groupBy, setGroupBy] = useState('date'); // date, medication

  // Filter logs based on selected action
  const filteredLogs = useMemo(() => {
    if (filterAction === 'all') return medicationLogs;
    return medicationLogs.filter(log => log.action === filterAction);
  }, [medicationLogs, filterAction]);

  // Group logs by date or medication
  const groupedLogs = useMemo(() => {
    if (groupBy === 'date') {
      // Group by date
      const groups = {};
      filteredLogs.forEach(log => {
        const date = new Date(log.loggedAt).toLocaleDateString();
        if (!groups[date]) groups[date] = [];
        groups[date].push(log);
      });
      return Object.entries(groups).sort(([a], [b]) => new Date(b) - new Date(a));
    } else {
      // Group by medication
      const groups = {};
      filteredLogs.forEach(log => {
        const medName = log.medicationName || 'Unknown';
        if (!groups[medName]) groups[medName] = [];
        groups[medName].push(log);
      });
      return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
    }
  }, [filteredLogs, groupBy]);

  // Calculate stats
  const totalTaken = medicationLogs.filter(log => log.action === 'taken').length;
  const totalUndo = medicationLogs.filter(log => log.action === 'undo').length;
  const totalMissed = medicationLogs.filter(log => log.action === 'missed').length;
  const thisWeekTaken = medicationLogs.filter(log => {
    const logDate = new Date(log.loggedAt);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return log.action === 'taken' && logDate >= weekAgo;
  }).length;

  return (
    <div className="page-content pb-6">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900 lg:text-3xl">
          {t('history.title', 'Medication History')}
        </h1>
        <p className="text-sm text-gray-500 mt-1 lg:text-base">
          {t('history.subtitle', 'Track your medication adherence over time')}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard
          icon={<Check size={18} />}
          label={t('history.dosesTaken', 'Doses Taken')}
          value={totalTaken}
          color="bg-green-50 text-green-600"
        />
        <StatCard
          icon={<Calendar size={18} />}
          label={t('history.thisWeek', 'This Week')}
          value={thisWeekTaken}
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          icon={<Undo2 size={18} />}
          label={t('history.undone', 'Undone')}
          value={totalUndo}
          color="bg-orange-50 text-orange-600"
        />
        <StatCard
          icon={<X size={18} />}
          label={t('history.missed', 'Missed')}
          value={totalMissed}
          color="bg-red-50 text-red-600"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <FilterButton
          active={filterAction === 'all'}
          onClick={() => setFilterAction('all')}
          label={t('filterAll', 'All')}
        />
        <FilterButton
          active={filterAction === 'taken'}
          onClick={() => setFilterAction('taken')}
          label={t('history.dosesTaken', 'Taken')}
          icon={<Check size={14} />}
        />
        <FilterButton
          active={filterAction === 'undo'}
          onClick={() => setFilterAction('undo')}
          label={t('history.undone', 'Undone')}
          icon={<Undo2 size={14} />}
        />
        <FilterButton
          active={filterAction === 'missed'}
          onClick={() => setFilterAction('missed')}
          label={t('history.missed', 'Missed')}
          icon={<X size={14} />}
        />

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setGroupBy(groupBy === 'date' ? 'medication' : 'date')}
            className="px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5"
          >
            {groupBy === 'date' ? <Calendar size={14} /> : <Package size={14} />}
            {t('history.groupBy', 'Group by')} {groupBy === 'date' ? t('history.groupByDate', 'Date') : t('history.groupByMedication', 'Medication')}
          </button>
        </div>
      </div>

      {/* History List */}
      {filteredLogs.length === 0 ? (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center py-12"
        >
          <div className="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <History size={32} className="text-gray-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-700 mb-1">{t('history.noHistory', 'No History Yet')}</h2>
          <p className="text-sm text-gray-500">
            {filterAction === 'all' 
              ? t('history.startTaking', 'Start taking your medications to see history here')
              : t('history.noRecords', 'No records found for this filter')}
          </p>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {groupedLogs.map(([groupKey, logs]) => (
            <HistoryGroup
              key={groupKey}
              groupKey={groupKey}
              logs={logs}
              groupBy={groupBy}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Helper Components ─── */

function StatCard({ icon, label, value, color }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${color}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 font-medium">{label}</p>
    </div>
  );
}

function FilterButton({ active, onClick, label, icon }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
        active
          ? 'bg-gray-900 text-white'
          : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function HistoryGroup({ groupKey, logs, groupBy }) {
  const [expanded, setExpanded] = useState(true);
  const { t } = useApp();

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Group Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {groupBy === 'date' ? (
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Calendar size={18} className="text-blue-600" />
            </div>
          ) : (
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
              <Package size={18} className="text-purple-600" />
            </div>
          )}
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">{groupKey}</h3>
            <p className="text-xs text-gray-500">{logs.length} {t('history.logsLabel', 'logs')}</p>
          </div>
        </div>
        <ChevronDown
          size={20}
          className={`text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Group Items */}
      {expanded && (
        <div className="border-t border-gray-100">
          {logs
            .sort((a, b) => new Date(b.loggedAt) - new Date(a.loggedAt))
            .map((log, idx) => (
              <HistoryLogItem key={log.id || idx} log={log} groupBy={groupBy} />
            ))}
        </div>
      )}
    </div>
  );
}

function HistoryLogItem({ log, groupBy }) {
  const { t } = useApp();
  const actionConfig = {
    taken: {
      icon: <Check size={16} />,
      color: 'bg-green-50 text-green-600',
      label: t('history.dosesTaken', 'Taken'),
    },
    undo: {
      icon: <Undo2 size={16} />,
      color: 'bg-orange-50 text-orange-600',
      label: t('history.undone', 'Undone'),
    },
    missed: {
      icon: <X size={16} />,
      color: 'bg-red-50 text-red-600',
      label: t('history.missed', 'Missed'),
    },
  };

  const config = actionConfig[log.action] || actionConfig.taken;
  const logDate = new Date(log.loggedAt);
  const timeStr = logDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = logDate.toLocaleDateString();

  return (
    <div className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${config.color}`}>
        {config.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 text-sm truncate">
          {groupBy === 'date' ? log.medicationName : dateStr}
        </p>
        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
          <Clock size={12} />
          <span>{timeStr}</span>
          {groupBy === 'medication' && (
            <>
              <span>•</span>
              <span>{dateStr}</span>
            </>
          )}
        </div>
      </div>
      <span className={`text-xs font-medium px-2 py-1 rounded-md flex-shrink-0 ${config.color}`}>
        {config.label}
      </span>
    </div>
  );
}
