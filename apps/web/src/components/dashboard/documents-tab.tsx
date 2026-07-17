'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  FileText,
  Upload,
  Download,
  Trash2,
  History,
  Eye,
  X,
  FileCheck2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface DocumentsTabProps {
  entityType: string;
  entityId: string;
}

interface Document {
  id: string;
  documentNumber: string;
  name: string;
  originalFileName: string;
  mimeType: string;
  size: number;
  version: number;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  expiryDate?: string;
  tags: string[];
}

interface AccessLog {
  id: string;
  action: string;
  ipAddress?: string;
  createdAt: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

export default function DocumentsTab({ entityType, entityId }: DocumentsTabProps) {
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docName, setDocName] = useState('');
  const [category, setCategory] = useState('KYC');
  const [expiryDate, setExpiryDate] = useState('');
  const [uploadProgress, setUploadProgress] = useState(false);

  // Modals state
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [historyDoc, setHistoryDoc] = useState<Document | null>(null);

  // Fetch documents for the entity
  const { data: documents = [], isLoading } = useQuery<Document[]>({
    queryKey: ['documents', entityType, entityId],
    queryFn: async () => {
      const res = await api.get(`/documents/entity/${entityType}/${entityId}`);
      return res.data;
    },
  });

  // Fetch document history logs
  const { data: accessLogs = [], isLoading: loadingHistory } = useQuery<AccessLog[]>({
    queryKey: ['documents-history', historyDoc?.id],
    queryFn: async () => {
      const res = await api.get(`/documents/${historyDoc?.id}/history`);
      return res.data;
    },
    enabled: !!historyDoc,
  });

  // Upload Mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      setUploadProgress(false);
      setSelectedFile(null);
      setDocName('');
      setExpiryDate('');
      queryClient.invalidateQueries({ queryKey: ['documents', entityType, entityId] });
    },
    onError: () => {
      setUploadProgress(false);
      alert('Upload failed');
    },
  });

  // Replace Mutation
  const replaceMutation = useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: FormData }) => {
      await api.post(`/documents/${id}/replace`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', entityType, entityId] });
      alert('Version updated successfully!');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', entityType, entityId] });
    },
  });

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploadProgress(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('name', docName || selectedFile.name);
    formData.append('entityType', entityType);
    formData.append('entityId', entityId);
    formData.append('category', category);
    if (expiryDate) {
      formData.append('expiryDate', expiryDate);
    }
    formData.append('tags', 'central,verification');

    uploadMutation.mutate(formData);
  };

  const handleReplaceClick = (id: string) => {
    const input = window.document.createElement('input');
    input.type = 'file';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        replaceMutation.mutate({ id, formData });
      }
    };
    input.click();
  };

  const handlePreviewOpen = async (doc: Document) => {
    setPreviewDoc(doc);
    try {
      const response = await api.get(`/documents/${doc.id}/download`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      setPreviewBlobUrl(url);
    } catch (err) {
      alert('Error fetching file preview');
      setPreviewDoc(null);
    }
  };

  const handlePreviewClose = () => {
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
    }
    setPreviewDoc(null);
    setPreviewBlobUrl(null);
  };

  const handleDownload = (id: string, fileName: string) => {
    api.get(`/documents/${id}/download`, { responseType: 'blob' }).then((response) => {
      const url = window.URL.createObjectURL(response.data);
      const link = window.document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      case 'REJECTED':
        return 'bg-rose-500/20 text-rose-400 border border-rose-500/30';
      default:
        return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Box Form */}
      <form onSubmit={handleUploadSubmit} className="glass rounded-xl p-6 border border-slate-900">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Upload className="h-4 w-4 text-indigo-400" /> Upload Document
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 items-end">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Document Name</label>
            <input
              type="text"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              placeholder="e.g. Aadhaar Card"
              className="w-full rounded-lg bg-slate-900/60 py-2 px-3 text-xs text-white placeholder-slate-600 border border-slate-900 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg bg-slate-900/60 py-2 px-3 text-xs text-white border border-slate-900 focus:border-indigo-500 focus:outline-none"
            >
              <option value="KYC">KYC Details</option>
              <option value="VEHICLE">Vehicle Details</option>
              <option value="POLICY">Policy Document</option>
              <option value="CLAIM">Claim Evidence</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Expiry Date</label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full rounded-lg bg-slate-900/60 py-2 px-3 text-xs text-white border border-slate-900 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex gap-2 items-center">
            <label className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-lg p-2 bg-slate-900/20 hover:bg-slate-900/40 cursor-pointer transition-colors">
              <span className="text-[10px] font-bold text-slate-400 truncate max-w-[120px]">
                {selectedFile ? selectedFile.name : 'Select File'}
              </span>
              <input
                type="file"
                required
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
            <button
              type="submit"
              disabled={uploadProgress || !selectedFile}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-40 cursor-pointer"
            >
              {uploadProgress ? 'Uploading...' : 'Submit'}
            </button>
          </div>
        </div>
      </form>

      {/* Documents List */}
      <div className="glass rounded-xl overflow-hidden border border-slate-900">
        <div className="p-6 border-b border-slate-900 flex justify-between items-center">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText className="h-4 w-4 text-indigo-400" /> central Documents Vault
          </h3>
          <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
            {documents.length} files
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent mx-auto" />
            <p className="text-xs text-slate-400 mt-2">Loading documents...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-8 w-8 text-slate-700 mx-auto mb-3" />
            <p className="text-xs font-bold text-slate-400">No documents found.</p>
            <p className="text-[10px] text-slate-600 mt-1">Uploaded files for this entity will show up here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900 bg-slate-950/20 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-4 px-6">Doc Details</th>
                  <th className="py-4 px-6">Verification</th>
                  <th className="py-4 px-6">Version</th>
                  <th className="py-4 px-6">Size</th>
                  <th className="py-4 px-6">Expiry Date</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900 text-xs text-slate-300">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-900/20 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-bold text-white">{doc.name}</div>
                      <div className="text-[10px] text-slate-500">{doc.originalFileName}</div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-block rounded px-2 py-0.5 text-[9px] font-bold ${getStatusBadge(doc.verificationStatus)}`}>
                        {doc.verificationStatus}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-semibold text-slate-200">v{doc.version}</td>
                    <td className="py-4 px-6 text-slate-400">{(doc.size / 1024).toFixed(1)} KB</td>
                    <td className="py-4 px-6 text-slate-400">
                      {doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="py-4 px-6 text-right space-x-2">
                      {/* View icon if previewable */}
                      {(doc.mimeType === 'application/pdf' || doc.mimeType.startsWith('image/')) && (
                        <button
                          onClick={() => handlePreviewOpen(doc)}
                          className="p-1.5 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-white cursor-pointer"
                          title="Preview"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDownload(doc.id, doc.originalFileName)}
                        className="p-1.5 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-white cursor-pointer"
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleReplaceClick(doc.id)}
                        className="p-1.5 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-indigo-400 cursor-pointer"
                        title="Upload New Version"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setHistoryDoc(doc)}
                        className="p-1.5 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-amber-400 cursor-pointer"
                        title="Access Audit Log"
                      >
                        <History className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Delete document?')) deleteMutation.mutate(doc.id);
                        }}
                        className="p-1.5 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-rose-400 cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Built-in Preview Modal */}
      {previewDoc && previewBlobUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="glass w-full max-w-4xl h-[85vh] rounded-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-900 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-white">{previewDoc.name}</h3>
                <p className="text-[10px] text-slate-500">{previewDoc.originalFileName}</p>
              </div>
              <button onClick={handlePreviewClose} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="flex-1 bg-slate-950 flex items-center justify-center p-4">
              {previewDoc.mimeType === 'application/pdf' ? (
                <iframe src={previewBlobUrl} className="w-full h-full rounded-lg border-0" />
              ) : (
                <img src={previewBlobUrl} alt={previewDoc.name} className="max-w-full max-h-full object-contain rounded-lg" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Access Logs Modal */}
      {historyDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="glass w-full max-w-lg rounded-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-900 flex justify-between items-center">
              <h3 className="font-bold text-white flex items-center gap-2">
                <History className="h-5 w-5 text-indigo-400" /> Access Audit History
              </h3>
              <button onClick={() => setHistoryDoc(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[50vh] space-y-4">
              {loadingHistory ? (
                <div className="py-8 text-center">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent mx-auto" />
                </div>
              ) : accessLogs.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No access logs found.</p>
              ) : (
                accessLogs.map((log) => (
                  <div key={log.id} className="flex justify-between items-center border-b border-slate-900 pb-3 last:border-0 last:pb-0">
                    <div>
                      <span className="inline-block rounded bg-indigo-500/10 text-indigo-400 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                        {log.action}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-1">
                        By: {log.user.firstName} {log.user.lastName} ({log.user.email})
                      </p>
                    </div>
                    <div className="text-right text-[9px] text-slate-500">
                      <div>IP: {log.ipAddress || 'Unknown'}</div>
                      <div className="mt-1">{new Date(log.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
