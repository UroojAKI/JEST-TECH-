'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Upload, CheckCircle2, FileText, Send } from 'lucide-react';

export default function AgentProposalsPage() {
  return (
    <AppShell>
      <div className="flex justify-between items-center border-b pb-3 text-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Proposal Submission & Document Upload Checklist
          </h1>
          <p className="text-xs text-muted-foreground">Upload RC copy, previous policy, Aadhaar/PAN, and submit for underwriting review</p>
        </div>
      </div>

      <div className="p-6 rounded-2xl border bg-card shadow-sm space-y-5 text-xs max-w-3xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="font-bold text-muted-foreground text-[10px] uppercase">Customer Full Name</label>
            <input type="text" defaultValue="Rahul Patil" className="w-full p-2.5 rounded-lg border bg-background font-bold text-xs" />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-muted-foreground text-[10px] uppercase">Selected Insurer</label>
            <input type="text" defaultValue="ICICI Lombard General Insurance" readOnly className="w-full p-2.5 rounded-lg border bg-muted font-bold text-xs" />
          </div>
        </div>

        <div className="space-y-3 pt-3 border-t">
          <h4 className="font-bold text-xs uppercase text-muted-foreground">Required Document Upload Checklist</h4>

          {[
            { label: 'Vehicle Registration Certificate (RC Copy)', uploaded: true },
            { label: 'Previous Policy Copy (NCB Verification)', uploaded: true },
            { label: 'Customer Aadhaar / PAN Card Copy', uploaded: false },
            { label: 'Vehicle Inspection / Break-in Photos (if applicable)', uploaded: false },
          ].map((doc, idx) => (
            <div key={idx} className="p-3 rounded-xl border bg-muted/10 flex justify-between items-center">
              <span className="font-bold text-foreground">{doc.label}</span>
              {doc.uploaded ? (
                <span className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-600 font-bold text-[10px]">✓ Uploaded</span>
              ) : (
                <button
                  onClick={() => alert(`Uploading ${doc.label}...`)}
                  className="px-3 py-1 rounded bg-primary text-primary-foreground font-bold text-[10px] shadow hover:bg-primary/90"
                >
                  Upload File
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={() => alert('Submitted proposal PRP-2026-0091 for underwriting review!')}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-extrabold text-xs flex items-center justify-center space-x-2 shadow-lg hover:bg-primary/90"
        >
          <Send className="h-4 w-4" />
          <span>Submit Proposal for Underwriting Review</span>
        </button>
      </div>
    </AppShell>
  );
}
