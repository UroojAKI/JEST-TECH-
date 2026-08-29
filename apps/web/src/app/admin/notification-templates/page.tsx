'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Mail, Save, Eye, Sparkles, MessageSquare, Loader2 } from 'lucide-react';
import { useNotificationTemplates } from '../../../hooks/useCommunications';
import { toast } from 'sonner';

export default function NotificationTemplatesPage() {
  const { templates, isLoading, updateTemplate } = useNotificationTemplates();
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [editedBody, setEditedBody] = useState<string>('');

  React.useEffect(() => {
    if (templates && templates.length > 0 && !selectedTemplate) {
      setSelectedTemplate(templates[0]);
      setEditedBody(templates[0].bodyTemplate);
    }
  }, [templates, selectedTemplate]);

  const renderLivePreview = () => {
    if (!selectedTemplate || !selectedTemplate.sampleData) return editedBody;
    let text = editedBody;
    Object.entries(selectedTemplate.sampleData).forEach(([key, val]) => {
      text = text.replace(new RegExp(`{{${key}}}`, 'g'), String(val));
    });
    return text;
  };

  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" /> Notification Template Manager & Live Preview Engine
          </h1>
          <p className="text-xs text-muted-foreground">Configure message templates for WhatsApp, SMS, Email, pick merge variables, and inspect rendered previews</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={async () => {
              if (selectedTemplate) {
                await updateTemplate({ id: selectedTemplate.id, bodyTemplate: editedBody });
                toast.success(`Saved template ${selectedTemplate.code}!`);
              }
            }}
            disabled={isUpdating}
            className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90"
          >
            {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>{isUpdating ? 'Saving...' : 'Save Template'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
        {/* Template List (Left Column) */}
        <div className="lg:col-span-4 space-y-3">
          <h3 className="font-bold text-xs uppercase text-muted-foreground">Notification Templates</h3>
          <div className="space-y-2">
            {isLoading ? (
              <div className="text-muted-foreground animate-pulse">Loading templates...</div>
            ) : (Array.isArray(templates) ? templates : ((templates as any)?.data || (templates as any)?.items || [])).map((tmpl: any) => (
              <div
                key={tmpl.id}
                onClick={() => {
                  setSelectedTemplate(tmpl);
                  setEditedBody(tmpl.bodyTemplate);
                }}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all shadow-sm ${
                  selectedTemplate?.id === tmpl.id
                    ? 'bg-primary/10 border-primary font-bold text-primary'
                    : 'bg-card hover:bg-accent'
                }`}
              >
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-mono">{tmpl.code}</span>
                  <span className="px-1.5 py-0.5 rounded bg-muted text-foreground border uppercase font-mono">{tmpl.channel}</span>
                </div>
                <div className="font-bold text-foreground text-xs mt-1">{tmpl.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Editor & Live Render Preview (Right Column) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Template Editor */}
          <div className="p-4 rounded-xl border bg-card shadow-sm space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-sm text-foreground">Edit Template: {selectedTemplate?.name || 'Select a template'}</h3>
              <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                {selectedTemplate?.channel || 'N/A'}
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Insert Merge Variables:</span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {selectedTemplate?.sampleData && Object.keys(selectedTemplate.sampleData).map((varKey) => (
                  <button
                    key={varKey}
                    onClick={() => setEditedBody(editedBody + ` {{${varKey}}}`)}
                    className="px-2 py-1 rounded bg-muted hover:bg-accent border font-mono text-[10px] font-bold"
                  >
                    + {`{{${varKey}}}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Body Textarea */}
            <div className="space-y-1">
              <label className="font-bold text-muted-foreground text-[10px] uppercase">Body Template</label>
              <textarea
                rows={5}
                value={editedBody}
                onChange={(e) => setEditedBody(e.target.value)}
                className="w-full p-3 rounded-lg border bg-background font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Live Rendered Message Preview Box */}
          <div className="p-5 rounded-xl border bg-emerald-500/5 border-emerald-500/20 shadow-sm space-y-2">
            <div className="flex items-center space-x-2 text-emerald-700 dark:text-emerald-300 font-bold border-b border-emerald-500/20 pb-2">
              <Sparkles className="h-4 w-4" />
              <h4 className="text-xs uppercase tracking-wider">Live Rendered Preview Output</h4>
            </div>
            <div className="p-4 rounded-lg bg-background border font-sans text-xs whitespace-pre-line text-foreground shadow-inner">
              {renderLivePreview()}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
