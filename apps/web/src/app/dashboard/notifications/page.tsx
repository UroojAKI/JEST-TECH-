'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Bell, Pin, CheckCircle2, Trash2, Filter, Shield, AlertTriangle, ArrowRight } from 'lucide-react';
import { StatusBadge } from '../../../components/ui/status-badge';

const MOCK_NOTIFICATIONS = [
  {
    id: 'NOT-101',
    title: 'High Value Motor Claim Registered',
    message: 'Claim CLM-2026-0042 (Acme Logistics) raised for ₹3,84,500. Assigned to Surveyor R. K. Gupta.',
    category: 'CLAIMS',
    priority: 'CRITICAL',
    isPinned: true,
    isRead: false,
    timestamp: '10 mins ago',
    link: '/claims',
  },
  {
    id: 'NOT-102',
    title: 'Policy Renewal Countdown - 15 Days',
    message: 'Policy POL-001048 (Rahul Patil) expires on 15-Aug-2026. Renewal quote ready.',
    category: 'RENEWALS',
    priority: 'HIGH',
    isPinned: true,
    isRead: false,
    timestamp: '1 hour ago',
    link: '/policies',
  },
  {
    id: 'NOT-103',
    title: 'Commission Payout Approved',
    message: 'Agent Commission COMM-1001 (₹1,654.50) approved by Branch Manager Sunil Verma.',
    category: 'FINANCE',
    priority: 'MEDIUM',
    isPinned: false,
    isRead: true,
    timestamp: '3 hours ago',
    link: '/finance/commissions',
  },
];

export default function NotificationsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);

  const handleTogglePin = (id: string) => {
    setNotifications(
      notifications.map((n) => (n.id === id ? { ...n, isPinned: !n.isPinned } : n))
    );
  };

  const handleMarkRead = (id: string) => {
    setNotifications(
      notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const handleMarkAllRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, isRead: true })));
  };

  const filteredNotifications = notifications.filter((n) => {
    if (selectedCategory === 'ALL') return true;
    if (selectedCategory === 'CRITICAL') return n.priority === 'CRITICAL';
    return n.category === selectedCategory;
  });

  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" /> Enterprise Notification Center
          </h1>
          <p className="text-xs text-muted-foreground">Monitor real-time system notifications, workflow escalations, renewal alerts, and claim dispatches</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleMarkAllRead}
            className="flex items-center space-x-1 px-3 py-2 text-xs font-semibold rounded-lg border bg-card hover:bg-accent shadow-sm"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span>Mark All as Read</span>
          </button>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex border-b text-xs overflow-x-auto p-1 bg-card rounded-xl border space-x-1">
        {[
          { id: 'ALL', label: 'All Alerts' },
          { id: 'CRITICAL', label: 'Critical Alerts' },
          { id: 'CLAIMS', label: 'Claims' },
          { id: 'RENEWALS', label: 'Renewals' },
          { id: 'FINANCE', label: 'Finance' },
          { id: 'WORKFLOW', label: 'Workflow' },
        ].map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3.5 py-2 rounded-lg font-bold transition-colors ${
              selectedCategory === cat.id
                ? 'bg-primary text-primary-foreground shadow'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Notification Stream */}
      <div className="space-y-3 text-xs">
        {filteredNotifications.map((n) => (
          <div
            key={n.id}
            className={`p-4 rounded-xl border transition-all shadow-sm flex items-start justify-between gap-4 ${
              !n.isRead ? 'bg-primary/5 border-primary/30' : 'bg-card'
            }`}
          >
            <div className="space-y-1 flex-1">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                  {n.category}
                </span>
                {n.priority === 'CRITICAL' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-600 border border-red-500/20">
                    ⚠️ CRITICAL
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground">{n.timestamp}</span>
              </div>

              <h4 className="font-extrabold text-sm text-foreground">{n.title}</h4>
              <p className="text-muted-foreground text-xs leading-relaxed">{n.message}</p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleTogglePin(n.id)}
                className={`p-1.5 rounded border transition-colors ${
                  n.isPinned ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' : 'bg-background text-muted-foreground hover:bg-accent'
                }`}
                title="Pin Notification"
              >
                <Pin className="h-3.5 w-3.5" />
              </button>

              {!n.isRead && (
                <button
                  onClick={() => handleMarkRead(n.id)}
                  className="px-2.5 py-1 rounded bg-primary text-primary-foreground font-bold text-[10px]"
                >
                  Mark Read
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
