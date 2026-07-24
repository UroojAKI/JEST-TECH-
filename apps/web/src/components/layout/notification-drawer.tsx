'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { X, Bell, Clock, ShieldCheck, FileText, ArrowRight } from 'lucide-react';
import { useUIStore } from '../../store/ui-store';
import { NotificationItem } from '../../types';

const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'n1',
    title: 'Claim Settlement Required',
    message: 'Claim #CLM-000492 requires underwriter approval (> ₹50,000).',
    category: 'CLAIMS',
    priority: 'CRITICAL',
    createdAt: '10 mins ago',
    isRead: false,
    linkUrl: '/claims',
  },
  {
    id: 'n2',
    title: 'Policy Renewal Due',
    message: 'Policy #POL-001048 for Acme Corp expires in 15 days.',
    category: 'RENEWALS',
    priority: 'HIGH',
    createdAt: '1 hour ago',
    isRead: false,
    linkUrl: '/policies',
  },
  {
    id: 'n3',
    title: 'GST Compliance Export Ready',
    message: 'Monthly GST ledger summary export has been generated.',
    category: 'FINANCE',
    priority: 'MEDIUM',
    createdAt: '3 hours ago',
    isRead: true,
    linkUrl: '/finance/ledger',
  },
];

export function NotificationDrawer() {
  const isNotificationDrawerOpen = useUIStore((s) => s.isNotificationDrawerOpen);
  const setNotificationDrawerOpen = useUIStore((s) => s.setNotificationDrawerOpen);
  const [activeTab, setActiveTab] = useState<string>('ALL');

  if (!isNotificationDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-card border-l h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bell className="h-5 w-5 text-primary" />
            <h2 className="font-bold text-base">Notification Center</h2>
          </div>
          <button
            onClick={() => setNotificationDrawerOpen(false)}
            className="rounded-md p-1 hover:bg-accent text-muted-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Categories Tab Bar */}
        <div className="flex border-b text-xs overflow-x-auto p-1 bg-muted/30">
          {['ALL', 'CLAIMS', 'RENEWALS', 'FINANCE', 'WORKFLOW'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeTab === tab ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {MOCK_NOTIFICATIONS.filter(
            (n) => activeTab === 'ALL' || n.category === activeTab
          ).map((item) => (
            <div
              key={item.id}
              className={`p-3 rounded-lg border text-xs space-y-1.5 transition-all ${
                item.priority === 'CRITICAL'
                  ? 'border-destructive/40 bg-destructive/5'
                  : item.priority === 'HIGH'
                  ? 'border-amber-500/40 bg-amber-500/5'
                  : 'border-border bg-card'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">{item.title}</span>
                <span className="text-[10px] text-muted-foreground flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  {item.createdAt}
                </span>
              </div>
              <p className="text-muted-foreground">{item.message}</p>
              
              {/* Action Triggers */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted">
                  {item.category}
                </span>
                <Link
                  href={item.linkUrl || '#'}
                  onClick={() => setNotificationDrawerOpen(false)}
                  className="inline-flex items-center space-x-1 text-primary font-semibold hover:underline text-[11px]"
                >
                  <span>Action Item</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 border-t bg-muted/20 text-center">
          <button className="text-xs text-muted-foreground hover:text-foreground font-medium">
            Mark all as read
          </button>
        </div>
      </div>
    </div>
  );
}
