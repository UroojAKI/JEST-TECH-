'use client';

import React, { useState } from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { Sliders, Bell, Shield, Key, Globe, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { adminRepository } from '../../repositories/admin.repository';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'notifications' | 'security' | 'password'>('notifications');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [whatsappNotifications, setWhatsappNotifications] = useState(true);
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('System preferences updated successfully!');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error('New password must be at least 6 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirmation do not match');
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await adminRepository.changePassword(newPassword, currentPassword);
      toast.success(res.message || 'Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <AppShell>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Sliders className="h-5 w-5 text-primary" /> Application Settings & Security
          </h1>
          <p className="text-xs text-muted-foreground">Configure personal preferences, notification alerts, and password security</p>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center space-x-1 px-4 py-2 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow"
        >
          <Save className="h-4 w-4" />
          <span>Save Preferences</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Navigation Tabs */}
        <div className="space-y-1 bg-card border p-3 rounded-xl h-fit">
          <button
            onClick={() => setActiveTab('notifications')}
            className={`w-full flex items-center space-x-2 px-3 py-2 text-xs font-bold rounded-lg transition-colors ${
              activeTab === 'notifications' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            <Bell className="h-4 w-4" />
            <span>Notifications & Alerts</span>
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`w-full flex items-center space-x-2 px-3 py-2 text-xs font-bold rounded-lg transition-colors ${
              activeTab === 'security' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            <Shield className="h-4 w-4" />
            <span>Security & 2FA</span>
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`w-full flex items-center space-x-2 px-3 py-2 text-xs font-bold rounded-lg transition-colors ${
              activeTab === 'password' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            <Key className="h-4 w-4" />
            <span>Change My Password</span>
          </button>
        </div>

        {/* Settings Content Panels */}
        <div className="md:col-span-2 space-y-6 bg-card border p-6 rounded-xl">
          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold border-b pb-2 flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" /> Notification Dispatch Rules
              </h3>
              
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-xs font-bold">Email Dispatch for Renewal Reminders</div>
                  <div className="text-[11px] text-muted-foreground">Receive daily digest of policies entering 45-day renewal window</div>
                </div>
                <input
                  type="checkbox"
                  checked={emailNotifications}
                  onChange={(e) => setEmailNotifications(e.target.checked)}
                  className="h-4 w-4 rounded border-primary text-primary focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-xs font-bold">WhatsApp Business Gateway Sync</div>
                  <div className="text-[11px] text-muted-foreground">Auto-dispatch policy quote PDFs directly to customer WhatsApp</div>
                </div>
                <input
                  type="checkbox"
                  checked={whatsappNotifications}
                  onChange={(e) => setWhatsappNotifications(e.target.checked)}
                  className="h-4 w-4 rounded border-primary text-primary focus:ring-primary"
                />
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold border-b pb-2 flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" /> Multi-Factor Authentication
              </h3>
              
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-xs font-bold">Require 2FA via Authenticator App</div>
                  <div className="text-[11px] text-muted-foreground">Enforce TOTP passcode on logins from unverified IP addresses</div>
                </div>
                <input
                  type="checkbox"
                  checked={twoFactorAuth}
                  onChange={(e) => setTwoFactorAuth(e.target.checked)}
                  className="h-4 w-4 rounded border-primary text-primary focus:ring-primary"
                />
              </div>
            </div>
          )}

          {activeTab === 'password' && (
            <div className="space-y-4 text-xs">
              <h3 className="text-sm font-bold border-b pb-2 flex items-center gap-2">
                <Key className="h-4 w-4 text-primary" /> Change Your Password
              </h3>
              <p className="text-muted-foreground">Update your login account password. Minimum 6 characters required.</p>
              
              <form onSubmit={handleChangePassword} className="space-y-3 max-w-md pt-2">
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Current Password</label>
                  <input
                    type="password"
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">New Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Confirm New Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold hover:bg-primary/90 shadow flex items-center space-x-1"
                  >
                    {isChangingPassword && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                    <span>{isChangingPassword ? 'Updating Password...' : 'Update Password'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
