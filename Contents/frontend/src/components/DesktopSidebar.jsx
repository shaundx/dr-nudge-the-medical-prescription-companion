import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Home, Camera, Pill, ShieldAlert, User, LogOut, RefreshCw, History } from 'lucide-react';

const navItems = [
  { id: 'home', key: 'home', fallback: 'Home', Icon: Home },
  { id: 'scan', key: 'scanPrescription', fallback: 'Scan Prescription', Icon: Camera },
  { id: 'meds', key: 'myMedications', fallback: 'My Medicines', Icon: Pill },
  { id: 'history', key: 'history.title', fallback: 'History', Icon: History },
  { id: 'safety', key: 'medicationAlerts', fallback: 'Safety Alerts', Icon: ShieldAlert },
  { id: 'profile', key: 'settings', fallback: 'Profile & Settings', Icon: User },
];

export default function DesktopSidebar() {
  const { activePage, setActivePage, patient, unresolvedAlerts, logout, isSidebarCollapsed, toggleSidebarCollapse, t } = useApp();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    }
    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showUserMenu]);

  const handleSwitchAccount = async () => {
    await logout();
    setShowUserMenu(false);
  };

  const handleSignOut = async () => {
    await logout();
    setShowUserMenu(false);
  };

  return (
    <aside className={`desktop-sidebar ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Brand */}
      <div className="sidebar-brand">
        <button
          onClick={toggleSidebarCollapse}
          className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center flex-shrink-0 hover:bg-gray-800 transition-colors cursor-pointer"
          title="Toggle sidebar"
        >
          <span className="text-lg">💊</span>
        </button>
        {!isSidebarCollapsed && (
          <div className="flex-1 min-w-0">
            <h1 
              onClick={toggleSidebarCollapse}
              className="font-bold text-gray-900 leading-tight cursor-pointer hover:opacity-75 transition-opacity inline-block"
              style={{
                fontWeight: 700,
                lineHeight: 1.2,
              }}
            >
              Dr. Nudge
            </h1>
            <p className="text-[11px] text-gray-400">{t('welcomeSubtitle', 'Your pill buddy')}</p>
          </div>
        )}
        {isSidebarCollapsed && (
          <button
            onClick={toggleSidebarCollapse}
            className="ml-auto text-gray-600 hover:text-gray-900 transition-colors p-1"
            title="Expand sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5">
        {navItems.map(({ id, key, fallback, Icon }) => {
          const active = activePage === id;
          const hasAlert = id === 'safety' && unresolvedAlerts.length > 0;
          return (
            <button
              key={id}
              onClick={() => setActivePage(id)}
              className={`${active ? 'sidebar-nav-active' : 'sidebar-nav-item text-gray-600'} ${isSidebarCollapsed ? 'justify-center px-3' : ''}`}
              title={isSidebarCollapsed ? t(key, fallback) : undefined}
            >
              <Icon size={18} strokeWidth={active ? 2.2 : 1.8} className="flex-shrink-0" />
              {!isSidebarCollapsed && <span className="flex-1 text-left">{t(key, fallback)}</span>}
              {!isSidebarCollapsed && hasAlert && (
                <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">
                  {unresolvedAlerts.length}
                </span>
              )}
              {isSidebarCollapsed && hasAlert && (
                <span className="w-4 h-4 bg-red-500 rounded-full absolute top-2 right-2"></span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="pt-4 border-t border-gray-100" ref={userMenuRef}>
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className={`w-full p-3 rounded-xl transition-all relative hover:bg-gray-50 text-gray-900 ${isSidebarCollapsed ? 'flex justify-center' : ''}`}
          title={isSidebarCollapsed ? 'Account' : undefined}
        >
          <div className={`flex items-center gap-3 ${isSidebarCollapsed ? '' : 'flex-1'}`}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-blue-100 to-purple-100">
              <span className="text-lg">👤</span>
            </div>
            {!isSidebarCollapsed && (
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold truncate text-gray-900">
                  {patient.name || t('friend', 'Friend')}
                </p>
                <p className="text-xs text-gray-500">
                  {t('patientLabel', 'Patient')}
                </p>
              </div>
            )}
          </div>

          {/* Dropdown menu */}
          {showUserMenu && !isSidebarCollapsed && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
              <button
                onClick={() => {
                  setActivePage('profile');
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-gray-900 hover:bg-gray-50 transition-colors border-b border-gray-100 text-left"
              >
                <User size={16} className="text-gray-600" />
                <span className="text-sm font-medium">{t('myProfile', 'My Profile')}</span>
              </button>
              <button
                onClick={handleSwitchAccount}
                className="w-full flex items-center gap-3 px-4 py-3 text-gray-900 hover:bg-gray-50 transition-colors border-b border-gray-100 text-left"
              >
                <RefreshCw size={16} className="text-gray-600" />
                <span className="text-sm font-medium">{t('switchAccount', 'Switch Account')}</span>
              </button>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 transition-colors text-left"
              >
                <LogOut size={16} />
                <span className="text-sm font-medium">{t('signOut', 'Sign Out')}</span>
              </button>
            </div>
          )}
          {showUserMenu && isSidebarCollapsed && (
            <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden w-48">
              <button
                onClick={() => {
                  setActivePage('profile');
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-gray-900 hover:bg-gray-50 transition-colors border-b border-gray-100 text-left"
              >
                <User size={16} className="text-gray-600" />
                <span className="text-sm font-medium">{t('myProfile', 'My Profile')}</span>
              </button>
              <button
                onClick={handleSwitchAccount}
                className="w-full flex items-center gap-3 px-4 py-3 text-gray-900 hover:bg-gray-50 transition-colors border-b border-gray-100 text-left"
              >
                <RefreshCw size={16} className="text-gray-600" />
                <span className="text-sm font-medium">{t('switchAccount', 'Switch Account')}</span>
              </button>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 transition-colors text-left"
              >
                <LogOut size={16} />
                <span className="text-sm font-medium">{t('signOut', 'Sign Out')}</span>
              </button>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
