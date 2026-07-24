'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { UserCheck, CheckCircle2, AlertTriangle, Play, Shield, Layers, Plus, Bug, Search } from 'lucide-react';

const MOCK_UAT_MODULES = [
  { id: 'CRM', name: 'Customer Relationship Management (CRM)', totalTests: 12, passed: 12, failed: 0, status: 'PASSED' },
  { id: 'SALES', name: 'Quotation & Proposal Engine', totalTests: 15, passed: 15, failed: 0, status: 'PASSED' },
  { id: 'OPERATIONS', name: 'Policy Operations, Renewals & Claims', totalTests: 18, passed: 18, failed: 0, status: 'PASSED' },
  { id: 'FINANCE', name: 'Finance, Double-Entry Ledger & Commissions', totalTests: 14, passed: 14, failed: 0, status: 'PASSED' },
  { id: 'REPORTS', name: 'Reports, BI Engine & Visualization Studio', totalTests: 10, passed: 10, failed: 0, status: 'PASSED' },
  { id: 'ADMIN', name: 'System Administration, RBAC & Workflows', totalTests: 16, passed: 16, failed: 0, status: 'PASSED' },
  { id: 'PORTAL', name: 'Agent & Partner Self-Service Portal', totalTests: 14, passed: 14, failed: 0, status: 'PASSED' },
];

const MOCK_TEST_CASES = [
  { id: 'TC-01', module: 'SALES', title: 'Sales End-to-End: Lead -> Quote -> Proposal -> Policy Issue', status: 'PASSED', duration: '1.2s', tester: 'Super Admin' },
  { id: 'TC-02', module: 'OPERATIONS', title: 'Renewal Cockpit 1-Click Renewal Quote Generation', status: 'PASSED', duration: '0.8s', tester: 'Renewal Exec' },
  { id: 'TC-03', module: 'OPERATIONS', title: 'Motor Claim Intimation -> Surveyor Photo -> Settlement', status: 'PASSED', duration: '1.4s', tester: 'Claims Specialist' },
  { id: 'TC-04', module: 'FINANCE', title: 'Receipt Voucher Posting & Double-Entry Ledger Impact', status: 'PASSED', duration: '0.9s', tester: 'Finance Officer' },
  { id: 'TC-05', module: 'ADMIN', title: 'Dynamic Permission Matrix Update & Instant Enforcement', status: 'PASSED', duration: '0.6s', tester: 'System Admin' },
  { id: 'TC-06', module: 'PORTAL', title: 'POSP Agent Instant WhatsApp Quote Comparison Dispatch', status: 'PASSED', duration: '0.7s', tester: 'Sales Agent' },
];

export default function UatCockpitPage() {
  const [activeRole, setActiveRole] = useState<string>('SUPER_ADMIN');
  const [selectedModule, setSelectedModule] = useState<string>('ALL');

  const filteredTests = MOCK_TEST_CASES.filter((tc) => {
    if (selectedModule === 'ALL') return true;
    return tc.module === selectedModule;
  });

  return (
    <AppShell>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" /> Interactive UAT & Demo Mode Cockpit
          </h1>
          <p className="text-xs text-muted-foreground">
            Execute UAT test suites across CRM, Sales, Operations, Finance, BI, Administration, and Agent Portal modules
          </p>
        </div>

        {/* 1-Click Role Demo Switcher */}
        <div className="flex items-center space-x-1.5 bg-card p-1.5 rounded-xl border text-xs">
          <span className="text-[10px] font-bold text-muted-foreground uppercase px-1">Role Demo Switcher:</span>
          {[
            { id: 'SUPER_ADMIN', label: 'Super Admin' },
            { id: 'BRANCH_MANAGER', label: 'Branch Mgr' },
            { id: 'UNDERWRITER', label: 'Underwriter' },
            { id: 'AGENT', label: 'Sales Agent' },
            { id: 'FINANCE', label: 'Finance' },
          ].map((role) => (
            <button
              key={role.id}
              onClick={() => setActiveRole(role.id)}
              className={`px-2.5 py-1 rounded-lg font-bold text-[10px] transition-colors ${
                activeRole === role.id
                  ? 'bg-primary text-primary-foreground shadow'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {role.label}
            </button>
          ))}
        </div>
      </div>

      {/* Module Categorized UAT Progress */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        {MOCK_UAT_MODULES.map((mod) => (
          <div key={mod.id} className="p-4 rounded-xl border bg-card shadow-sm space-y-2">
            <div className="flex justify-between items-start">
              <span className="font-mono font-bold text-[10px] text-primary">{mod.id}</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-bold text-[10px] border border-emerald-500/20">
                ✓ {mod.status}
              </span>
            </div>
            <h4 className="font-bold text-foreground text-xs">{mod.name}</h4>
            <div className="flex justify-between text-[11px] text-muted-foreground font-semibold border-t pt-2">
              <span>{mod.passed} / {mod.totalTests} Passed</span>
              <span className="text-emerald-600 font-bold">100% Pass Rate</span>
            </div>
          </div>
        ))}
      </div>

      {/* Test Case Execution Suite Table */}
      <div className="space-y-3 pt-2">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-xs uppercase text-muted-foreground">Detailed UAT Acceptance Test Cases</h3>
          <div className="flex border text-xs overflow-x-auto p-1 bg-card rounded-lg space-x-1">
            {['ALL', 'SALES', 'OPERATIONS', 'FINANCE', 'ADMIN', 'PORTAL'].map((mod) => (
              <button
                key={mod}
                onClick={() => setSelectedModule(mod)}
                className={`px-2.5 py-1 rounded font-bold text-[10px] transition-colors ${
                  selectedModule === mod ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
                }`}
              >
                {mod}
              </button>
            ))}
          </div>
        </div>

        <div className="border rounded-xl overflow-hidden bg-card text-xs shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/40 text-[10px] text-muted-foreground font-bold border-b uppercase">
                <th className="p-3">Test Case ID</th>
                <th className="p-3">Module</th>
                <th className="p-3">Test Scenario & Acceptance Criteria</th>
                <th className="p-3">Result</th>
                <th className="p-3">Latency</th>
                <th className="p-3">Verified By</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredTests.map((tc) => (
                <tr key={tc.id} className="hover:bg-accent/40">
                  <td className="p-3 font-mono font-bold text-primary">{tc.id}</td>
                  <td className="p-3 font-bold text-[10px] uppercase text-muted-foreground">{tc.module}</td>
                  <td className="p-3 font-semibold text-foreground">{tc.title}</td>
                  <td className="p-3 font-bold text-emerald-600">✓ {tc.status}</td>
                  <td className="p-3 font-mono text-muted-foreground">{tc.duration}</td>
                  <td className="p-3 font-bold">{tc.tester}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
