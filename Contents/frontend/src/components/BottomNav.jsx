import React from 'react';
import { useApp } from '../context/AppContext';
import { Home, Camera, Pill, ShieldAlert, User, History } from 'lucide-react';

const tabs = [
  { id: 'home', key: 'home', fallback: 'Home', Icon: Home },
  { id: 'meds', key: 'medicines', fallback: 'Meds', Icon: Pill },
  { id: 'scan', key: 'scan', fallback: 'Scan', Icon: Camera },
  { id: 'history', key: 'history.title', fallback: 'History', Icon: History },
  { id: 'safety', key: 'alerts', fallback: 'Safety', Icon: ShieldAlert },
  { id: 'profile', key: 'profile', fallback: 'Me', Icon: User },
];

export default function BottomNav() {
  const { activePage, setActivePage, unresolvedAlerts, t } = useApp();

  return (
    <nav className="bottom-nav">
      <div className="flex items-center justify-around px-2 py-1">
        {tabs.map(({ id, key, fallback, Icon }) => {
          const active = activePage === id;
          const hasAlert = id === 'safety' && unresolvedAlerts.length > 0;
          return (
            <button
              key={id}
              onClick={() => setActivePage(id)}
              className={`nav-item relative ${active ? 'nav-item-active' : 'nav-item-inactive'}`}
            >
              {/* Scan button gets special treatment */}
              {id === 'scan' ? (
                <div className={`w-12 h-12 -mt-5 rounded-2xl flex items-center justify-center shadow-lg ${
                  active ? 'bg-gray-900' : 'bg-gray-800'
                }`}>
                  <Icon size={22} className="text-white" strokeWidth={2.2} />
                </div>
              ) : (
                <Icon
                  size={22}
                  strokeWidth={active ? 2.4 : 1.8}
                  className={active ? 'text-gray-900' : 'text-gray-400'}
                />
              )}
              <span className={`text-[11px] font-medium ${active ? 'text-gray-900' : 'text-gray-400'}`}>
                {t(key, fallback)}
              </span>

              {/* Alert dot */}
              {hasAlert && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
