'use client';

import React, { useState } from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { Sliders, Bell, Shield, Key, Database, Globe, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [whatsappNotifications, setWhatsappNotifications] = useState(true);
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);
  const [currency, setCurrency] = useState('INR');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('System preferences updated successfully!');
  };

  return (
    <AppShell>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Sliders className="h-5 w-5 text-primary" /> Application Settings & Preferences
          </h1>
          <p className="text-xs text-muted-foreground">Configure personal preferences, notification alerts, and security options</p>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center space-x-1 px-4 py-2 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow"
        >
          <Save className="h-4 w-4" />
          <span>Save Changes</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Navigation Tabs Stub */}
        <div className="space-y-1 bg-card border p-3 rounded-xl">
          <button className="w-full flex items-center space-x-2 px-3 py-2 text-xs font-bold rounded-lg bg-primary/10 text-primary">
            <Bell className="h-4 w-4" />
            <span>Notifications & Alerts</span>
          </button>
          <button className="w-full flex items-center space-x-2 px-3 py-2 text-xs font-medium text-muted-foreground rounded-lg hover:bg-accent hover:text-foreground">
            <Shield className="h-4 w-4" />
            <span>Security & 2FA</span>
          </button>
          <button className="w-full flex items-center space-x-2 px-3 py-2 text-xs font-medium text-muted-foreground rounded-lg hover:bg-accent hover:text-foreground">
            <Globe className="h-4 w-4" />
            <span>Localization & Currency</span>
          </button>
        </div>

        {/* Settings Panels */}
        <div className="md:col-span-2 space-y-6 bg-card border p-6 rounded-xl">
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

          <div className="space-y-4 pt-4 border-t">
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
        </div>
      </div>
    </AppShell>
  );
}
