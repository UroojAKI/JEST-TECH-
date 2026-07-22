'use client';

import React from 'react';
import { AlertTriangle, CheckSquare, Clock, ArrowRight } from 'lucide-react';

export function CustomerAlertsQueue() {
  const alerts = [
    { id: '1', level: 'CRITICAL', text: 'Policy #POL-001048 expires in 14 days — Renewal quote required.' },
    { id: '2', level: 'WARNING', text: 'Claim #CLM-000492 surveyor report pending > 5 days.' },
    { id: '3', level: 'INFO', text: 'Aadhaar e-KYC verification pending.' },
  ];

  const tasks = [
    { id: 't1', title: 'Call client to confirm renewal terms', due: 'Today, 4:00 PM', assignee: 'Agent Rajesh' },
    { id: 't2', title: 'Collect RC Copy for Motor Endorsement', due: 'Tomorrow', assignee: 'Agent Rajesh' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Active Alerts Panel */}
      <div className="lg:col-span-6 rounded-xl border bg-card p-4 shadow-sm space-y-3">
        <div className="flex items-center space-x-2 border-b pb-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider">Active Customer Alerts</h3>
        </div>

        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                alert.level === 'CRITICAL'
                  ? 'border-destructive/40 bg-destructive/5 text-destructive-foreground'
                  : alert.level === 'WARNING'
                  ? 'border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300'
                  : 'border-border bg-muted/20 text-muted-foreground'
              }`}
            >
              <span className="font-medium">{alert.text}</span>
              <button className="text-[11px] font-bold text-primary hover:underline ml-2 flex items-center whitespace-nowrap">
                Resolve <ArrowRight className="h-3 w-3 ml-0.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Workspace Today's Queue */}
      <div className="lg:col-span-6 rounded-xl border bg-card p-4 shadow-sm space-y-3">
        <div className="flex items-center space-x-2 border-b pb-2">
          <CheckSquare className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider">Workspace Queue & Pending Tasks</h3>
        </div>

        <div className="space-y-2">
          {tasks.map((task) => (
            <div key={task.id} className="p-2.5 rounded-lg border text-xs bg-muted/10 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="font-bold text-foreground">{task.title}</span>
                <div className="text-[10px] text-muted-foreground flex items-center space-x-2">
                  <span className="flex items-center"><Clock className="h-3 w-3 mr-1" />{task.due}</span>
                  <span>• Assigned: {task.assignee}</span>
                </div>
              </div>
              <button className="px-2.5 py-1 rounded bg-primary/10 text-primary font-bold hover:bg-primary/20 text-[10px]">
                Mark Done
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
