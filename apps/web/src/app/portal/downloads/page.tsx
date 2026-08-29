'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Download, FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';

interface VaultDocument {
  id: string;
  name: string;
  category?: string;
  fileSize?: number;
  mimeType?: string;
  createdAt: string;
}

export default function AgentDownloadsPage() {
  const { data, isLoading } = useQuery<{ data: VaultDocument[] }>({
    queryKey: ['vault-documents'],
    queryFn: async () => {
      const res = await apiClient.get('/documents');
      return res.data;
    },
  });

  const files = data?.data || [];

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

      <div className="space-y-3 text-xs mt-4">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading document vault...</div>
        ) : files.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground border rounded-xl bg-card">
            No downloadable documents available in your vault.
          </div>
        ) : (
          files.map((file) => (
            <div key={file.id} className="p-4 rounded-xl border bg-card shadow-sm flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FileText className="h-5 w-5 text-primary" />
                <div>
                  <h4 className="font-bold text-foreground">{file.name}</h4>
                  <span className="text-[10px] text-muted-foreground">
                    {file.category || 'General'} • {file.fileSize ? `${Math.round(file.fileSize / 1024)} KB` : 'Document'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => window.open(`/api/v1/documents/${file.id}/download`, '_blank')}
                className="px-3 py-1.5 rounded-lg border bg-background hover:bg-accent font-bold text-[10px] flex items-center space-x-1"
              >
                <Download className="h-3.5 w-3.5 text-primary" />
                <span>Download File</span>
              </button>
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}

