'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { toast } from 'sonner';
import {
  Sliders,
  Plus,
  CheckCircle2,
  FileText,
  Upload,
  UserCheck,
  History,
  Loader2,
  Lock,
} from 'lucide-react';

interface Policy {
  id: string;
  policyNumber: string;
  contact: {
    firstName: string;
    lastName: string;
  };
}

interface Endorsement {
  id: string;
  endorsementNumber: string;
  policyId: string;
  type: string;
  status: string;
  reason: string;
  createdAt: string;
  policy: {
    policyNumber: string;
  };
  requestedBy: {
    firstName: string;
    lastName: string;
  };
}

export default function EndorsementsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [showCreate, setShowCreate] = useState(false);
  const [policyId, setPolicyId] = useState('');
  const [endType, setEndType] = useState('ADDRESS_CHANGE');
  const [reason, setReason] = useState('');
  const [comments, setComments] = useState('');
  const [selectedEndId, setSelectedEndId] = useState<string | null>(null);

  // Queries
  const { data: endorsements = [], isLoading } = useQuery<Endorsement[]>({
    queryKey: ['endorsements'],
    queryFn: () => api.get('/endorsements').then((res) => res.data),
  });

  const { data: policies = [] } = useQuery<Policy[]>({
    queryKey: ['active-policies-for-endorsements'],
    queryFn: () => api.get('/policies').then((res) => res.data), // Assumes general policy list endpoint exists
  });

  const { data: details, isLoading: loadingDetails } = useQuery<any>({
    queryKey: ['endorsement-details', selectedEndId],
    queryFn: () => api.get(`/endorsements/${selectedEndId}`).then((res) => res.data),
    enabled: !!selectedEndId,
  });

  // Create Request Mutation
  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/endorsements', {
        policyId,
        type: endType,
        reason,
      }),
    onSuccess: () => {
      setShowCreate(false);
      setPolicyId('');
      setReason('');
      queryClient.invalidateQueries({ queryKey: ['endorsements'] });
    },
  });

  // Approve Mutation
  const approveMutation = useMutation({
    mutationFn: () =>
      api.post(`/endorsements/${selectedEndId}/approve`, {
        comments,
      }),
    onSuccess: () => {
      setComments('');
      setSelectedEndId(null);
      queryClient.invalidateQueries({ queryKey: ['endorsements'] });
      toast.success('Endorsement completed and policy schedule version updated!');
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
      case 'APPROVED':
        return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      case 'REJECTED':
        return 'bg-rose-500/20 text-rose-400 border border-rose-500/30';
      default:
        return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Sliders className="h-5 w-5 text-indigo-400" /> Policy Endorsements & Alterations
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Perform post-issuance alterations on policies (Address changes, Nominee updates, Owner transfers).
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition-colors flex items-center gap-2 cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Request Endorsement
        </button>
      </div>

      {/* New Request Modal */}
      {showCreate && (
        <div className="glass p-6 rounded-xl border border-slate-900 max-w-lg space-y-4">
          <h3 className="text-sm font-bold text-white">Create Alteration Request</h3>
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-slate-400 uppercase block">Select Policy</label>
            <select
              value={policyId}
              onChange={(e) => setPolicyId(e.target.value)}
              className="w-full rounded-lg bg-slate-950 py-2 px-3 text-xs text-white border border-slate-900 focus:outline-none"
            >
              <option value="">Choose Policy...</option>
              {policies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.policyNumber} ({p.contact?.firstName} {p.contact?.lastName})
                </option>
              ))}
            </select>

            <label className="text-[10px] font-bold text-slate-400 uppercase block">Alteration Type</label>
            <select
              value={endType}
              onChange={(e) => setEndType(e.target.value)}
              className="w-full rounded-lg bg-slate-950 py-2 px-3 text-xs text-white border border-slate-900 focus:outline-none"
            >
              <option value="ADDRESS_CHANGE">Address Change</option>
              <option value="NOMINEE_CHANGE">Nominee Change</option>
              <option value="OWNER_TRANSFER">Owner Transfer</option>
            </select>

            <label className="text-[10px] font-bold text-slate-400 uppercase block">Reason & Details</label>
            <textarea
              placeholder="e.g. Updating address to new residence..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full rounded-lg bg-slate-950 p-3 text-xs text-white placeholder-slate-600 border border-slate-900 focus:outline-none"
            />

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => createMutation.mutate()}
                className="flex-1 rounded-lg bg-indigo-600 py-2 text-xs font-bold text-white hover:bg-indigo-500 cursor-pointer"
              >
                Submit Request
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

      {/* Main Panel */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Endorsements List */}
        <div className="md:col-span-2 glass rounded-xl border border-slate-900 overflow-hidden">
          <div className="p-6 border-b border-slate-900">
            <h3 className="text-sm font-bold text-white">Active Alterations Queue</h3>
          </div>
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-500 mx-auto" />
            </div>
          ) : endorsements.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-12">No alteration requests configured.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-900 bg-slate-950/20 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-4 px-6">ID</th>
                    <th className="py-4 px-6">Policy</th>
                    <th className="py-4 px-6">Type</th>
                    <th className="py-4 px-6">Requested By</th>
                    <th className="py-4 px-6">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 text-xs text-slate-300">
                  {endorsements.map((end) => (
                    <tr
                      key={end.id}
                      onClick={() => setSelectedEndId(end.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setSelectedEndId(end.id);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      className="hover:bg-slate-900/20 cursor-pointer transition-colors focus:bg-slate-900/40 focus:outline-none"
                    >
                      <td className="py-4 px-6 font-bold text-indigo-400">{end.endorsementNumber}</td>
                      <td className="py-4 px-6">{end.policy?.policyNumber}</td>
                      <td className="py-4 px-6 text-slate-400">{end.type}</td>
                      <td className="py-4 px-6 text-slate-400">
                        {end.requestedBy?.firstName} {end.requestedBy?.lastName}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-block rounded px-2 py-0.5 text-[9px] font-bold ${getStatusColor(end.status)}`}>
                          {end.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column Details & Underwriter actions */}
        <div>
          {selectedEndId ? (
            loadingDetails || !details ? (
              <div className="glass p-6 rounded-xl border border-slate-900 text-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-500 mx-auto" />
              </div>
            ) : (
              <div className="glass p-6 rounded-xl border border-slate-900 space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Alteration Details</h3>
                <div>
                  <h4 className="font-bold text-white text-sm">{details.endorsementNumber}</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Policy: {details.policy?.policyNumber}</p>
                </div>
                <div className="text-xs border-t border-slate-900 pt-3 space-y-2">
                  <span className="text-slate-500 block">Reason for Alteration:</span>
                  <p className="text-slate-300 italic bg-slate-950 p-3 rounded-lg border border-slate-900">
                    "{details.reason}"
                  </p>
                </div>

                {/* Manager Actions */}
                {details.status === 'REQUESTED' && (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
                  <div className="border-t border-slate-900 pt-4 space-y-3">
                    <h4 className="text-[10px] font-bold text-white uppercase">Approve & Regenerate Schedule</h4>
                    <textarea
                      placeholder="Enter review comments..."
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      rows={2}
                      className="w-full rounded-lg bg-slate-950 p-2 text-xs text-white border border-slate-900 focus:outline-none"
                    />
                    <button
                      onClick={() => approveMutation.mutate()}
                      className="w-full rounded-lg bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer"
                    >
                      Approve & Reissue Schedule
                    </button>
                  </div>
                )}

                {/* Review status locked */}
                {details.status === 'REQUESTED' && !(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
                  <div className="border-t border-slate-900 pt-4 text-center py-6">
                    <Lock className="h-5 w-5 text-slate-600 mx-auto mb-2" />
                    <p className="text-[10px] text-slate-500">Waiting for manager approval and version update.</p>
                  </div>
                )}

                {/* History Timeline logs */}
                <div className="border-t border-slate-900 pt-4 space-y-3">
                  <h4 className="text-[10px] font-bold text-white uppercase flex items-center gap-1">
                    <History className="h-4.5 w-4.5 text-indigo-400" /> Timeline
                  </h4>
                  <div className="space-y-3">
                    {details.histories?.map((log: any) => (
                      <div key={log.id} className="text-[11px] border-l border-slate-800 pl-2">
                        <span className="text-[9px] text-slate-500 block">
                          {log.performedBy?.firstName} {log.performedBy?.lastName}
                        </span>
                        <span className="font-bold text-slate-300">{log.status}</span>
                        <p className="text-slate-400 mt-0.5">{log.comments}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="glass p-6 rounded-xl border border-slate-900 text-center py-12">
              <Sliders className="h-6 w-6 text-slate-700 mx-auto mb-2" />
              <p className="text-xs text-slate-500">Select a request from the queue to view approval details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
