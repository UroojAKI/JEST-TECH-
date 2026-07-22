'use client';

import React, { useState } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { documentsRepository } from '../../repositories/documents.repository';
import { toast } from 'sonner';

interface FileUploaderProps {
  entityType: string;
  entityId: string;
  onSuccess?: () => void;
}

export function ChunkedFileUploader({ entityType, entityId, onSuccess }: FileUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error('File size exceeds 50MB limit');
      return;
    }

    setIsUploading(true);
    setProgress(30);

    try {
      await documentsRepository.uploadDocument(file, entityType, entityId);
      setProgress(100);
      toast.success(`Document ${file.name} uploaded successfully!`);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to upload document');
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="border-2 border-dashed rounded-xl p-6 text-center hover:bg-accent/20 transition-colors">
      <input
        type="file"
        id="file-upload-input"
        className="hidden"
        onChange={handleFileChange}
        disabled={isUploading}
      />
      <label htmlFor="file-upload-input" className="cursor-pointer flex flex-col items-center space-y-2">
        <div className="p-3 rounded-full bg-primary/10 text-primary">
          <UploadCloud className="h-6 w-6" />
        </div>
        <div className="text-xs font-bold">
          {isUploading ? 'Uploading Document...' : 'Click or Drag File to Upload'}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Supports PDF, PNG, JPEG up to 50MB per file
        </p>

        {isUploading && (
          <div className="w-full max-w-xs bg-muted rounded-full h-2 overflow-hidden mt-2">
            <div
              className="bg-primary h-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </label>
    </div>
  );
}
