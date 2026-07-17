'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import {
  FileText,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Upload,
  UserCheck,
  History,
  ArrowLeft,
  Loader2,
  Lock,
} from 'lucide-react';

interface Proposal {
  id: string;
  proposalNumber: string;
  quotationId: string;
  status: string;
  createdAt: string;
  contact: {
    firstName: string;
    lastName: string;
    email: string;
  };
  quotation: {
    quotationCode: string;
    totalPremium: string;
    insurerName: string;
    productType: string;
  };
}

interface ChecklistItem {
  id: string;
  mandatory: boolean;
  verified: boolean;
  remarks: string; // Document Type Name
  documentId?: string;
  document?: {
    originalFileName: string;
  };
}

interface ProposalDetails extends Proposal {
  documents: ChecklistItem[];
  histories: {
    id: string;
    status: string;
    comments: string;
    createdAt: string;
    performedBy: {
      firstName: string;
      lastName: string;
    };
  }[];
}

export default function ProposalsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [selectedPropId, setSelectedPropId] = useState<string | null>(null);
  const [newQuotationId, setNewQuotationId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [reviewComments, setReviewComments] = useState('');

  // Fetch all proposals
  const { data: proposals = [], isLoading } = useQuery<Proposal[]>({
    queryKey: ['proposals'],
    queryFn: () => api.get('/proposals').then((res) => res.data),
  });

  // Fetch proposal details
  const { data: details, isLoading: loadingDetails } = useQuery<ProposalDetails>({
    queryKey: ['proposal-details', selectedPropId],
    queryFn: () => api.get(`/proposals/${selectedPropId}`).then((res) => res.data),
    enabled: !!selectedPropId,
  });

  // Create Proposal Mutation
  const createMutation = useMutation({
    mutationFn: (quotationId: string) => api.post('/proposals', { quotationId }),
    onSuccess: (res) => {
      setShowCreate(false);
      setNewQuotationId('');
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      setSelectedPropId(res.data.id);
    },
    onError: () => {
      alert('Error initializing proposal. Make sure the quotation exists and is not already converted.');
    },
  });

  // Document Upload & Attach Mutation
  const uploadDocMutation = useMutation({
    mutationFn: async ({ checklistItemId, file }: { checklistItemId: string; file: File }) => {
      // 1. Upload to general documents vault
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', file.name);
      formData.append('entityType', 'PROPOSAL');
      formData.append('entityId', selectedPropId!);
      formData.append('category', 'KYC');

      const uploadRes = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // 2. Attach to proposal checklist item
      await api.post(`/proposals/${selectedPropId}/attach`, {
        checklistItemId,
        documentId: uploadRes.data.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-details', selectedPropId] });
    },
  });

  // Submit Mutation
  const submitMutation = useMutation({
    mutationFn: () => api.post(`/proposals/${selectedPropId}/submit`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      queryClient.invalidateQueries({ queryKey: ['proposal-details', selectedPropId] });
      alert('Proposal submitted for underwriting review!');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Checklist is incomplete');
    },
  });

  // Review (Approve/Reject) Mutation
  const reviewMutation = useMutation({
    mutationFn: (approve: boolean) =>
      api.post(`/proposals/${selectedPropId}/review`, {
        approve,
        remarks: reviewComments,
      }),
    onSuccess: () => {
      setReviewComments('');
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      queryClient.invalidateQueries({ queryKey: ['proposal-details', selectedPropId] });
      alert('Review action completed!');
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'POLICY_ISSUED':
      case 'APPROVED':
        return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      case 'REJECTED':
        return 'bg-rose-500/20 text-rose-400 border border-rose-500/30';
      case 'SUBMITTED':
      case 'UNDER_REVIEW':
        return 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30';
      default:
        return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
    }
  };

  const handleFileUpload = (checklistItemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadDocMutation.mutate({ checklistItemId, file });
    }
  };

  return (
    <div className="space-y-6">
      {/* Back Header if detailed view */}
      {selectedPropId ? (
        <button
          onClick={() => setSelectedPropId(null)}
          className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white cursor-pointer transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Proposals Register
        </button>
      ) : (
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-400" /> Proposals & Underwriting
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Centralized underwriting pipeline: review document checklists and issue policies.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Initialize Proposal
          </button>
        </div>
      )}

      {/* Initialize Form Modal */}
      {showCreate && (
        <div className="glass p-6 rounded-xl border border-slate-900 max-w-md">
          <h3 className="text-sm font-bold text-white mb-4">Initialize Proposal</h3>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Enter Quotation UUID..."
              value={newQuotationId}
              onChange={(e) => setNewQuotationId(e.target.value)}
              className="w-full rounded-lg bg-slate-950 py-2 px-3 text-xs text-white border border-slate-900 focus:border-indigo-500 focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => createMutation.mutate(newQuotationId)}
                className="flex-1 rounded-lg bg-indigo-600 py-2 text-xs font-bold text-white hover:bg-indigo-500 cursor-pointer"
              >
                Create Draft
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: List vs Details */}
      {!selectedPropId ? (
        <div className="glass rounded-xl border border-slate-900 overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500 mx-auto" />
              <p className="text-xs text-slate-400 mt-2">Loading underwriting register...</p>
            </div>
          ) : proposals.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="h-8 w-8 text-slate-700 mx-auto mb-3" />
              <p className="text-xs font-bold text-slate-400">No active proposals found.</p>
              <p className="text-[10px] text-slate-600 mt-1">Convert a Quotation to start a new proposal.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-900 bg-slate-950/20 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-4 px-6">Proposal ID</th>
                    <th className="py-4 px-6">Customer</th>
                    <th className="py-4 px-6">Insurer / product</th>
                    <th className="py-4 px-6">Premium</th>
                    <th className="py-4 px-6">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 text-xs text-slate-300">
                  {proposals.map((prop) => (
                    <tr
                      key={prop.id}
                      onClick={() => setSelectedPropId(prop.id)}
                      className="hover:bg-slate-900/20 cursor-pointer transition-colors"
                    >
                      <td className="py-4 px-6 font-bold text-indigo-400 hover:underline">{prop.proposalNumber}</td>
                      <td className="py-4 px-6">
                        <div className="font-bold text-white">
                          {prop.contact.firstName} {prop.contact.lastName}
                        </div>
                        <div className="text-[10px] text-slate-500">{prop.contact.email}</div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-white">{prop.quotation.insurerName}</div>
                        <div className="text-[10px] text-slate-500">{prop.quotation.productType}</div>
                      </td>
                      <td className="py-4 px-6 font-semibold text-slate-200">
                        ₹{Number(prop.quotation.totalPremium).toLocaleString()}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-block rounded px-2 py-0.5 text-[9px] font-bold ${getStatusColor(prop.status)}`}>
                          {prop.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Detailed Underwriting View */
        <div className="grid gap-6 md:grid-cols-3">
          {loadingDetails || !details ? (
            <div className="md:col-span-3 p-12 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500 mx-auto" />
            </div>
          ) : (
            <>
              {/* Left Column: Details & Checklist */}
              <div className="md:col-span-2 space-y-6">
                {/* Proposal Overview */}
                <div className="glass p-6 rounded-xl border border-slate-900 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-lg font-bold text-white">{details.proposalNumber}</h2>
                      <p className="text-[10px] text-slate-400 mt-1">Originating Quotation: {details.quotation.quotationCode}</p>
                    </div>
                    <span className={`inline-block rounded px-3 py-1 text-xs font-bold ${getStatusColor(details.status)}`}>
                      {details.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t border-slate-900 pt-4 text-xs">
                    <div>
                      <span className="text-slate-500">Applicant Details</span>
                      <p className="font-bold text-white mt-1">
                        {details.contact.firstName} {details.contact.lastName}
                      </p>
                      <p className="text-slate-400 mt-0.5">{details.contact.email}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Carrier Pricing details</span>
                      <p className="font-bold text-indigo-400 mt-1">{details.quotation.insurerName}</p>
                      <p className="text-slate-300 mt-0.5">₹{Number(details.quotation.totalPremium).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Document Checklist Panel */}
                <div className="glass rounded-xl border border-slate-900 overflow-hidden">
                  <div className="p-6 border-b border-slate-900">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-indigo-400" /> Mandatory Document Checklist
                    </h3>
                  </div>
                  <div className="divide-y divide-slate-900">
                    {details.documents.map((doc) => (
                      <div key={doc.id} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-white">{doc.remarks}</p>
                          <p className="text-[10px] text-slate-500">
                            {doc.documentId ? `Attached: ${doc.document?.originalFileName}` : 'Not Uploaded'}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          {doc.documentId ? (
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                              Uploaded
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Missing
                            </span>
                          )}

                          {details.status === 'DRAFT' && (
                            <label className="rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 px-3 py-1.5 text-[10px] font-bold flex items-center gap-2 cursor-pointer transition-colors">
                              <Upload className="h-3 w-3" /> Upload File
                              <input
                                type="file"
                                onChange={(e) => handleFileUpload(doc.id, e)}
                                className="hidden"
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Underwriting review & History */}
              <div className="space-y-6">
                {/* Submit Actions */}
                {details.status === 'DRAFT' && (
                  <div className="glass p-6 rounded-xl border border-slate-900 space-y-4">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Submit to Underwriting</h3>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Confirming that all mandatory checklist documents are verified and correct.
                    </p>
                    <button
                      onClick={() => submitMutation.mutate()}
                      className="w-full rounded-lg bg-indigo-600 py-3 text-xs font-bold text-white hover:bg-indigo-500 transition-colors cursor-pointer"
                    >
                      Submit Proposal
                    </button>
                  </div>
                )}

                {/* Underwriter Approval Decisions */}
                {details.status === 'SUBMITTED' && (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
                  <div className="glass p-6 rounded-xl border border-slate-900 space-y-4">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-indigo-400" /> Underwriting Assessment
                    </h3>
                    <textarea
                      placeholder="Enter approval comments or rejection reasons..."
                      value={reviewComments}
                      onChange={(e) => setReviewComments(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg bg-slate-950 p-3 text-xs text-white placeholder-slate-600 border border-slate-900 focus:border-indigo-500 focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => reviewMutation.mutate(true)}
                        className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer"
                      >
                        Approve & Issue
                      </button>
                      <button
                        onClick={() => reviewMutation.mutate(false)}
                        className="flex-1 rounded-lg bg-rose-600 py-2.5 text-xs font-bold text-white hover:bg-rose-500 cursor-pointer"
                      >
                        Reject Request
                      </button>
                    </div>
                  </div>
                )}

                {/* Review locked for non-admins */}
                {details.status === 'SUBMITTED' && !(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
                  <div className="glass p-6 rounded-xl border border-slate-900 text-center py-8">
                    <Lock className="h-6 w-6 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-400">Review Pending</p>
                    <p className="text-[10px] text-slate-500 mt-1">This proposal is waiting for underwriter assessment.</p>
                  </div>
                )}

                {/* History Logs Timeline */}
                <div className="glass p-6 rounded-xl border border-slate-900 space-y-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <History className="h-4 w-4 text-indigo-400" /> Proposal Timeline Logs
                  </h3>
                  <div className="space-y-4 max-h-[30vh] overflow-y-auto">
                    {details.histories.map((log) => (
                      <div key={log.id} className="text-xs border-l-2 border-slate-800 pl-3 py-1">
                        <div className="flex justify-between items-center text-[10px] text-slate-500">
                          <span>{log.performedBy.firstName} {log.performedBy.lastName}</span>
                          <span>{new Date(log.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="font-semibold text-slate-300 mt-1">{log.status}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{log.comments}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
