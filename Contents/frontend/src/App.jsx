import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Auth from './components/Auth';
import Onboarding from './components/Onboarding';
import BottomNav from './components/BottomNav';
import DesktopSidebar from './components/DesktopSidebar';
import HomePage from './components/HomePage';
import ScanPage from './components/ScanPage';
import MedsPage from './components/MedsPage';
import AlertsPage from './components/AlertsPage';
import ProfilePage from './components/ProfilePage';
import HistoryPage from './components/HistoryPage';
import MedicationReminder from './components/MedicationReminder';
import { Loader } from 'lucide-react';

function AppShell() {
  const { user, isAuthenticated, authLoading, loading, patient, activePage, handleAuth, isSidebarCollapsed } = useApp();

  // Show loading spinner while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <img src="/logo.png" alt="App Logo" className="w-16 h-16 mx-auto mb-4" />
          <Loader size={40} className="animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show auth screen if not authenticated
  if (!isAuthenticated) {
    return <Auth onAuth={handleAuth} />;
  }

  // Show loading while fetching patient data
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader size={40} className="animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading your data...</p>
        </div>
      </div>
    );
  }

  // Show onboarding if user hasn't completed it
  if (!patient.onboarded) {
    return <Onboarding />;
  }

  const pages = {
    home: <HomePage />,
    scan: <ScanPage />,
    meds: <MedsPage />,
    safety: <AlertsPage />,
    history: <HistoryPage />,
    profile: <ProfilePage />,
  };

  return (
    <div 
      className={`app-shell ${
        patient.scale === '0.5' ? 'scale-0-5' :
        patient.scale === '1.5' ? 'scale-1-5' :
        patient.scale === '2' ? 'scale-2' :
        'scale-1'
      }`}
    >
      {/* Desktop sidebar — only visible on lg+ screens */}
      <DesktopSidebar />

      {/* Medication reminders */}
      <MedicationReminder />

      {/* Main content area */}
      <div 
        className={`main-content-area ${isSidebarCollapsed ? 'main-content-collapsed' : ''}`}
      >
        {pages[activePage] || <HomePage />}
      </div>

      {/* Mobile/tablet bottom nav — hidden on lg+ */}
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
