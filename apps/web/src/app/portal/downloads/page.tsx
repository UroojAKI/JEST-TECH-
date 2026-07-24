'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Download, FileText, FolderArchive, Shield } from 'lucide-react';

const MOCK_FILES = [
  { name: 'ICICI Lombard Motor Comprehensive Brochure 2026.pdf', type: 'Product Brochure', size: '2.4 MB' },
  { name: 'Standard Motor Claim Intimation Form.pdf', type: 'Claims Form', size: '450 KB' },
  { name: 'Group Health Optima Proposal Form & Checklist.pdf', type: 'Proposal Form', size: '1.2 MB' },
  { name: 'POSP Agent Compliance & IRDAI Guidelines.pdf', type: 'Compliance', size: '3.1 MB' },
];

export default function AgentDownloadsPage() {
  return (
    <AppShell>
      <div className="flex justify-between items-center border-b pb-3 text-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" /> Self-Service Downloads & Document Vault
          </h1>
          <p className="text-xs text-muted-foreground">Access product brochures, claim forms, proposal checklists, and marketing creatives</p>
        </div>
      </div>

      <div className="space-y-3 text-xs">
        {MOCK_FILES.map((file, idx) => (
          <div key={idx} className="p-4 rounded-xl border bg-card shadow-sm flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <h4 className="font-bold text-foreground">{file.name}</h4>
                <span className="text-[10px] text-muted-foreground">{file.type} • {file.size}</span>
              </div>
            </div>

            <button
              onClick={() => alert(`Downloading ${file.name}...`)}
              className="px-3 py-1.5 rounded-lg border bg-background hover:bg-accent font-bold text-[10px] flex items-center space-x-1"
            >
              <Download className="h-3.5 w-3.5 text-primary" />
              <span>Download File</span>
            </button>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
