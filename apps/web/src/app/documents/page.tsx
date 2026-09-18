'use client';

import React, { useState } from 'react';
import {
  Folder,
  FileText,
  Download,
  Search,
  Upload,
  ShieldCheck,
  Camera,
  Car,
  FileSpreadsheet,
} from 'lucide-react';
import { toast } from 'sonner';

export default function DocumentsPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');

  const docs = [
    {
      name: 'POL-2026-000001-Schedule.pdf',
      category: 'POLICY_SCHEDULE',
      type: 'PDF Document',
      size: '245 KB',
      uploadedAt: 'Today, 14:30',
      policyNumber: 'POL-2026-000001',
      insured: 'Rahul Kumar',
    },
    {
      name: 'INS-000001-Evidence-Photos.zip',
      category: 'INSPECTION_PACK',
      type: '7-Photo Evidence Pack',
      size: '14.2 MB',
      uploadedAt: 'Today, 11:15',
      policyNumber: 'MQT-000001',
      insured: 'Amit Sharma',
    },
    {
      name: 'MH02CB1234-RC-SmartCard.pdf',
      category: 'RC_COPY',
      type: 'Registration Certificate',
      size: '512 KB',
      uploadedAt: 'Yesterday',
      policyNumber: 'POL-2026-000002',
      insured: 'Pooja Verma',
    },
    {
      name: 'KYC-PAN-Card-Verified.pdf',
      category: 'KYC',
      type: 'Identity Verification',
      size: '180 KB',
      uploadedAt: 'Yesterday',
      policyNumber: 'CUST-000021',
      insured: 'Rahul Kumar',
    },
  ];

  const filtered = docs.filter((d) => {
    const matchesCat = category === 'ALL' || d.category === category;
    const matchesSearch =
      !search ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.insured.toLowerCase().includes(search.toLowerCase()) ||
      d.policyNumber.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Document Vault & Evidence Repository
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Authoritative documents: Policy Schedules, RC copies, Inspection Evidence, and Customer KYC.
          </p>
        </div>
        <button
          onClick={() => toast.info('Document upload wizard opening...')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs"
        >
          <Upload className="h-4 w-4" />
          <span>Upload Document</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 p-3 rounded-xl border border-border bg-card">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by filename, customer name, policy or quotation number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-input bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full sm:w-auto text-xs rounded-lg border border-input bg-background px-3 py-1.5 text-foreground"
        >
          <option value="ALL">All Document Types</option>
          <option value="POLICY_SCHEDULE">Policy Schedules & Certificates</option>
          <option value="INSPECTION_PACK">7-Photo Inspection Evidence</option>
          <option value="RC_COPY">Vehicle RC Copies</option>
          <option value="KYC">Customer KYC & Mandates</option>
        </select>
      </div>

      {/* Documents Grid / List */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="text-sm font-bold text-foreground">Authoritative Files ({filtered.length})</div>
          <div className="text-xs text-muted-foreground">Immutable audit storage (S3 / Local Encrypted)</div>
        </div>
        <div className="divide-y divide-border">
          {filtered.map((doc, idx) => (
            <div
              key={idx}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/40 transition"
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                  {doc.category === 'INSPECTION_PACK' ? (
                    <Camera className="h-5 w-5" />
                  ) : doc.category === 'RC_COPY' ? (
                    <Car className="h-5 w-5" />
                  ) : (
                    <FileText className="h-5 w-5" />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <span>{doc.name}</span>
                    <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border">
                      {doc.size}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{doc.insured}</span>
                    <span>•</span>
                    <span className="font-mono">{doc.policyNumber}</span>
                    <span>•</span>
                    <span>{doc.type}</span>
                    <span>•</span>
                    <span>{doc.uploadedAt}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  onClick={() => toast.success(`Downloading ${doc.name}...`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-xs font-semibold text-foreground shadow-2xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
