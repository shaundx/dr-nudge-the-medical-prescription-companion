import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { motion } from 'framer-motion';
import {
  User, Globe, Volume2, VolumeX, Eye, Phone,
  Mail, ChevronRight, Shield, RotateCcw, Heart, Users,
  Trash2, Plus, Bell, Accessibility, Languages, LogOut, Edit2, Save, X, Vibrate, Clock
} from 'lucide-react';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
  { code: 'ta', label: 'தமிழ் (Tamil)' },
];

export default function ProfilePage() {
  const {
    patient, updatePatient, caregivers, medications, addCaregiver, removeCaregiver,
    adherenceRate, bestStreak, resetOnboarding, logout, speak, t
  } = useApp();

  const [showLangPicker, setShowLangPicker] = useState(false);
  const [newCaregiver, setNewCaregiver] = useState({ name: '', phone: '', relationship: '' });
  const [showAddCaregiver, setShowAddCaregiver] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [profileImage, setProfileImage] = useState(patient.profile_image || '👤');
  const [formData, setFormData] = useState({
    name: patient.name || '',
    email: patient.email || '',
    newPassword: '',
    confirmPassword: ''
  });
  const [editErrors, setEditErrors] = useState({});
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(
    localStorage.getItem('notificationsEnabled') === 'true' && 'Notification' in window
  );
  const [vibrationEnabled, setVibrationEnabled] = useState(
    localStorage.getItem('vibrationEnabled') === 'true'
  );

  const toggleNotifications = async () => {
    if (!('Notification' in window)) {
      alert('Your browser does not support notifications');
      return;
    }

    if (!pushNotificationsEnabled) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setPushNotificationsEnabled(true);
        localStorage.setItem('notificationsEnabled', 'true');
        speak('Notifications enabled! You\'ll get reminders when it\'s time for your medications.');
      }
    } else {
      setPushNotificationsEnabled(false);
      localStorage.setItem('notificationsEnabled', 'false');
    }
  };

  const toggleVibration = () => {
    const newState = !vibrationEnabled;
    setVibrationEnabled(newState);
    localStorage.setItem('vibrationEnabled', newState ? 'true' : 'false');
  };

  const currentLang = LANGUAGES.find((l) => l.code === patient.language) || LANGUAGES[0];

  const toggleVoice = () => {
    const newVoiceState = !patient.voice_enabled;
    updatePatient({ voice_enabled: newVoiceState });
    if (newVoiceState) speak(t('voiceOutputOn', 'Voice output is now on!'));
  };

  const setScale = (newScale) => {
    updatePatient({ scale: newScale });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const validatePersonalInfo = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Name is required';
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format';
    }
    if (formData.newPassword) {
      if (formData.newPassword.length < 6) {
        errors.newPassword = 'Password must be at least 6 characters';
      }
      if (formData.newPassword !== formData.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
      }
    }
    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSavePersonalInfo = () => {
    if (validatePersonalInfo()) {
      updatePatient({
        name: formData.name,
        email: formData.email || patient.email,
        profile_image: profileImage
      });
      setEditMode(false);
      setFormData({
        name: formData.name,
        email: formData.email,
        newPassword: '',
        confirmPassword: ''
      });
    }
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setProfileImage(patient.profile_image || '👤');
    setFormData({
      name: patient.name || '',
      email: patient.email || '',
      newPassword: '',
      confirmPassword: ''
    });
    setEditErrors({});
  };

  return (
    <div className="page-content pb-6">
      {/* Profile header */}
      <div className="text-center mb-6">
        <div className="relative inline-block mb-3">
          <div className="w-20 h-20 bg-gradient-to-br from-gray-900 to-gray-700 rounded-3xl flex items-center justify-center mx-auto text-3xl cursor-pointer hover:shadow-xl transition-all">
            {typeof profileImage === 'string' && profileImage.length > 10 ? (
              <img src={profileImage} alt="Profile" className="w-full h-full rounded-3xl object-cover" />
            ) : (
              profileImage || '👤'
            )}
          </div>
          <label
            htmlFor="profile-pic-upload"
            className="absolute -bottom-1 -right-1 bg-blue-500 text-white p-2 rounded-full cursor-pointer hover:bg-blue-600 transition-all shadow-lg hover:scale-110"
          >
            <Edit2 size={14} />
          </label>
          <input
            id="profile-pic-upload"
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
          />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          {formData.name || t('friend', 'Friend')}
        </h1>
      </div>

      {/* Settings sections - reorganized */}
      <div className="space-y-4">
        {/* Personal Information & Language - side by side on larger screens */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Personal Information */}
          <div className="relative">
            <SettingsGroup title={t('personalInfo', 'Personal Information')}>
              {editMode && (
                <>
                  {/* Full-screen backdrop */}
                  <div
                    className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
                    onClick={handleCancelEdit}
                  />
                  {/* Centered modal */}
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 10 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 10 }}
                    className="fixed inset-0 z-50 flex items-center justify-center px-4"
                  >
                    <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-blue-100 p-4 md:p-5">
                    <h3 className="text-base font-bold text-gray-900 mb-4">{t('editProfileTitle', 'Edit Profile')}</h3>
                    <div className="space-y-3 mb-4">
                      <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1.5">{t('name', 'Name')}</label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className={`w-full p-2.5 text-sm border rounded-xl focus:outline-none transition-colors ${
                            editErrors.name
                              ? 'border-red-300 focus:border-red-500'
                              : 'border-gray-200 focus:border-gray-400'
                          }`}
                          placeholder={t('yourName', 'Your name')}
                          autoFocus
                        />
                        {editErrors.name && <p className="text-xs text-red-500 mt-1.5">{editErrors.name}</p>}
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1.5">{t('email', 'Email')}</label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className={`w-full p-2.5 text-sm border rounded-xl focus:outline-none transition-colors ${
                            editErrors.email
                              ? 'border-red-300 focus:border-red-500'
                              : 'border-gray-200 focus:border-gray-400'
                          }`}
                          placeholder={t('emailPlaceholder', 'your.email@example.com')}
                        />
                        {editErrors.email && <p className="text-xs text-red-500 mt-1.5">{editErrors.email}</p>}
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1.5">{t('newPasswordOptional', 'New Password (Optional)')}</label>
                        <input
                          type="password"
                          value={formData.newPassword}
                          onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                          className={`w-full p-2.5 text-sm border rounded-xl focus:outline-none transition-colors ${
                            editErrors.newPassword
                              ? 'border-red-300 focus:border-red-500'
                              : 'border-gray-200 focus:border-gray-400'
                          }`}
                            placeholder={t('leaveBlankToKeepPassword', 'Leave blank to keep current password')}
                        />
                        {editErrors.newPassword && <p className="text-xs text-red-500 mt-1.5">{editErrors.newPassword}</p>}
                      </div>

                      {formData.newPassword && (
                        <div>
                          <label className="text-xs font-medium text-gray-700 block mb-1.5">{t('confirmPassword', 'Confirm Password')}</label>
                          <input
                            type="password"
                            value={formData.confirmPassword}
                            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                            className={`w-full p-2.5 text-sm border rounded-xl focus:outline-none transition-colors ${
                              editErrors.confirmPassword
                                ? 'border-red-300 focus:border-red-500'
                                : 'border-gray-200 focus:border-gray-400'
                            }`}
                            placeholder={t('confirmNewPasswordPlaceholder', 'Confirm new password')}
                          />
                          {editErrors.confirmPassword && <p className="text-xs text-red-500 mt-1.5">{editErrors.confirmPassword}</p>}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={handleCancelEdit}
                        className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl text-sm text-gray-600 font-medium transition-colors flex items-center justify-center gap-1"
                      >
                        <X size={16} />
                        {t('cancel', 'Cancel')}
                      </button>
                      <button
                        onClick={handleSavePersonalInfo}
                        className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1"
                      >
                        <Save size={16} />
                        {t('save', 'Save')}
                      </button>
                    </div>
                    </div>
                  </motion.div>
                </>
              )}
              {!editMode && (
                <button
                  onClick={() => setEditMode(true)}
                  className="w-full p-4 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 rounded-2xl transition-all border-2 border-blue-200 hover:border-blue-300 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white flex-shrink-0 group-hover:scale-110 transition-transform">
                      <Edit2 size={16} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-bold text-gray-900">{t('editProfileTitle', 'Edit Profile')}</p>
                      <p className="text-xs text-gray-600">
                        {formData.email || t('editProfileSubtitle', 'Update your details')}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-blue-500 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              )}
            </SettingsGroup>
          </div>

          {/* Language */}
          <div className="relative">
            <SettingsGroup title={t('language', 'Language')}>
              <button
                onClick={() => setShowLangPicker(!showLangPicker)}
                className="w-full p-4 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 rounded-2xl transition-all border-2 border-blue-200 hover:border-blue-300 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Globe size={16} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-bold text-gray-900">{currentLang.label}</p>
                    <p className="text-xs text-gray-600">{t('tapToChange', 'Tap to change')}</p>
                  </div>
                  <ChevronRight size={16} className="text-blue-500 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            </SettingsGroup>

            {showLangPicker && (
              <>
                {/* Backdrop */}
                <div 
                  className="fixed inset-0 z-40"
                  onClick={() => setShowLangPicker(false)}
                />
                {/* Modal - positioned relative to parent */}
                <motion.div
                  initial={{ scale: 0.95, opacity: 0, y: -10 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: -10 }}
                  className="absolute top-full mt-2 left-0 right-0 bg-white rounded-2xl shadow-xl p-4 z-50 max-h-80 overflow-y-auto border border-blue-100"
                >
                <h3 className="text-sm font-bold text-gray-900 mb-3 px-2">{t('language', 'Language')}</h3>
                <div className="space-y-1">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        updatePatient({ language: lang.code });
                        setShowLangPicker(false);
                        speak(t('languageChangedTo', `Language changed to ${lang.label}`));
                      }}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl text-sm transition-all ${
                        patient.language === lang.code
                          ? 'bg-blue-500 text-white'
                          : 'hover:bg-blue-50 text-gray-700'
                      }`}
                    >
                      {lang.label}
                      {patient.language === lang.code && <span>✓</span>}
                    </button>
                  ))}
                </div>
              </motion.div>
            </>
          )}
          </div>
        </div>

        {/* Accessibility, Reminders, Meal Times, Caregivers - 2-column layout */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Accessibility */}
          <SettingsGroup title={t('accessibility', 'Accessibility')}>
            <SettingToggle
              icon={<Volume2 size={18} />}
              label={t('voiceOutputLabel', 'Voice Output')}
              desc={t('voiceOutputDesc', 'Read instructions aloud')}
              checked={patient.voice_enabled !== false}
              onChange={toggleVoice}
            />
            <ScaleSelector currentScale={patient.scale || '1'} onScaleChange={setScale} />
          </SettingsGroup>

          {/* Reminders */}
          <SettingsGroup title={t('reminders', 'Reminders')}>
            <SettingToggle
              icon={<Bell size={18} />}
              label={t('pushNotifications', 'Push Notifications')}
              desc={t('pushNotificationsDesc', "Get reminded when it's time for meds")}
              checked={pushNotificationsEnabled}
              onChange={toggleNotifications}
            />
            <SettingToggle
              icon={<Vibrate size={18} />}
              label={t('vibration', 'Vibration')}
              desc={t('vibrationDesc', 'Feel a vibration on reminders')}
              checked={vibrationEnabled}
              onChange={toggleVibration}
            />
          </SettingsGroup>

          {/* Meal Times */}
          <SettingsGroup title={t('mealTimes', 'Meal Times')}>
            <p className="text-xs text-gray-400 px-3 mb-2">
              {t('mealTimesDescription', 'Set when you usually have meals to get reminders at the right times')}
            </p>
            <div className="space-y-3 p-3">
              <TimeInput
                label={`🍳 ${t('breakfast', 'Breakfast')}`}
                value={patient.breakfast_time || '08:00'}
                onChange={(time) => updatePatient({ breakfast_time: time })}
              />
              <TimeInput
                label={`🍱 ${t('lunch', 'Lunch')}`}
                value={patient.lunch_time || '13:00'}
                onChange={(time) => updatePatient({ lunch_time: time })}
              />
              <TimeInput
                label={`🍝 ${t('dinner', 'Dinner')}`}
                value={patient.dinner_time || '19:00'}
                onChange={(time) => updatePatient({ dinner_time: time })}
              />
            </div>
          </SettingsGroup>

          {/* Caregivers */}
          <div className="relative">
            <SettingsGroup title={t('caregiversFamily', 'Caregivers & Family')}>
            <p className="text-xs text-gray-400 px-3 mb-2">
              {t('caregiversDescription', 'Share your medication updates with family members')}
            </p>
            {caregivers.length > 0 && (
              <div className="space-y-2">
                {caregivers.map((cg, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Users size={14} className="text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{cg.name}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {cg.relationship
                          ? `${cg.relationship} • ${cg.phone}`
                          : cg.phone}
                      </p>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md flex-shrink-0 ${
                      cg.notificationsEnabled
                        ? 'bg-green-100 text-green-600'
                        : 'bg-gray-100 text-gray-400'
                    }`}>
                      {cg.notificationsEnabled
                        ? t('caregiverActive', 'Active')
                        : t('caregiverOff', 'Off')}
                    </span>
                    <button
                      onClick={() => removeCaregiver(cg.id)}
                      className="p-1.5 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                    >
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {showAddCaregiver && (
              <>
                {/* Backdrop */}
                <div 
                  className="fixed inset-0 z-40"
                  onClick={() => setShowAddCaregiver(false)}
                />
                {/* Modal - positioned relative to parent */}
                <motion.div
                  initial={{ scale: 0.95, opacity: 0, y: -10 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: -10 }}
                  className="absolute top-full mt-2 left-0 right-0 bg-white rounded-2xl shadow-xl p-4 z-50 border border-purple-100"
                >
                  <h3 className="text-sm font-bold text-gray-900 mb-3">{t('addCaregiver', 'Add a Caregiver')}</h3>
                  <div className="space-y-2.5 mb-4">
                    <input
                      type="text"
                      value={newCaregiver.name}
                      onChange={(e) => setNewCaregiver({ ...newCaregiver, name: e.target.value })}
                      placeholder={t('caregiverNamePlaceholder', 'Caregiver name')}
                      className="w-full p-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={newCaregiver.relationship}
                      onChange={(e) => setNewCaregiver({ ...newCaregiver, relationship: e.target.value })}
                      placeholder={t('relationship', 'Relationship (e.g., Doctor, Daughter)')}
                      className="w-full p-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400"
                    />
                    <input
                      type="tel"
                      value={newCaregiver.phone}
                      onChange={(e) => setNewCaregiver({ ...newCaregiver, phone: e.target.value })}
                      placeholder={t('phonePlaceholder', 'Phone number')}
                      className="w-full p-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowAddCaregiver(false)}
                      className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm text-gray-700 font-medium transition-colors"
                    >
                      {t('cancel', 'Cancel')}
                    </button>
                    <button
                      onClick={() => {
                        if (newCaregiver.name.trim()) {
                          addCaregiver(newCaregiver);
                          setShowAddCaregiver(false);
                          setNewCaregiver({ name: '', phone: '', relationship: '' });
                        }
                      }}
                      className="flex-1 py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-xl text-sm font-medium transition-colors"
                    >
                      {t('add', 'Add')}
                    </button>
                  </div>
                </motion.div>
              </>
            )}
            
            <button
              onClick={() => setShowAddCaregiver(true)}
              className="w-full flex items-center gap-3 p-3 text-purple-600 hover:bg-purple-50 rounded-xl transition-colors mt-2"
            >
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <Plus size={16} className="text-purple-600" />
              </div>
              <span className="text-sm font-medium">{t('addCaregiverShort', 'Add a caregiver')}</span>
            </button>
            </SettingsGroup>
          </div>
        </div>

        {/* Account Actions */}
        <SettingsGroup title={t('account', 'Account')}>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 p-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
          >
            <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center">
              <LogOut size={16} />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium">{t('logout', 'Log out')}</p>
              <p className="text-xs text-red-400">{t('logoutDescription', 'Sign out and return to login')}</p>
            </div>
          </button>
          <button
            onClick={resetOnboarding}
            className="w-full flex items-center gap-3 p-3 text-orange-600 hover:bg-orange-50 rounded-xl transition-colors border-t border-gray-100 mt-0"
          >
            <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center">
              <RotateCcw size={16} />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium">{t('redoSetup', 'Redo Setup')}</p>
              <p className="text-xs text-orange-400">{t('redoSetupDescription', 'Go through onboarding again')}</p>
            </div>
          </button>
        </SettingsGroup>
      </div>
    </div>
  );
}

/* ─── Helpers ─── */
function StatBox({ value, label, icon }) {
  return (
    <div className="bg-gray-50 rounded-2xl p-3 text-center">
      <span className="text-lg">{icon}</span>
      <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
      <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{label}</p>
    </div>
  );
}

function SettingsGroup({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 pt-3 pb-1">
        {title}
      </h3>
      {children}
    </div>
  );
}

function SettingToggle({ icon, label, desc, checked, onChange }) {
  return (
    <button
      onClick={onChange}
      className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-colors"
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
        checked ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
      }`}>
        {icon}
      </div>
      <div className="flex-1 text-left">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-400">{desc}</p>
      </div>
      <div className={`w-11 h-6 rounded-full p-0.5 transition-colors ${
        checked ? 'bg-green-500' : 'bg-gray-300'
      }`}>
        <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`} />
      </div>
    </button>
  );
}

function ScaleSelector({ currentScale, onScaleChange }) {
  const scales = ['0.5', '1', '1.5', '2'];
  const scaleLabels = { '0.5': '0.5x', '1': '1x', '1.5': '1.5x', '2': '2x' };
  
  return (
    <div className="p-3 border-t border-gray-100">
      <p className="text-sm font-medium text-gray-900 mb-3">Text Scale</p>
      <div className="grid grid-cols-4 gap-2">
        {scales.map((scale) => (
          <button
            key={scale}
            onClick={() => onScaleChange(scale)}
            className={`py-2 px-2 rounded-lg font-semibold text-sm transition-colors whitespace-nowrap ${
              currentScale === scale
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {scaleLabels[scale]}
          </button>
        ))}
      </div>
    </div>
  );
}

function TimeInput({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 transition-colors"
      />
    </div>
  );
}
