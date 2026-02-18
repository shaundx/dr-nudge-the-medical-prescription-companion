import React from 'react';
import { useApp } from '../context/AppContext';

export default function MobileHeader() {
  const { t } = useApp();
  return (
    <div className="mobile-header lg:hidden mb-6 bg-white">
      {/* Brand ribbon — bigger and scrollable */}
      <div className="px-4 py-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 bg-gray-900">
            <span className="text-4xl">💊</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold leading-tight text-gray-900">
              Dr. Nudge
            </h1>
            <p className="text-sm text-gray-400">{t('welcomeSubtitle', 'Your pill buddy')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
