'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { toast } from 'sonner';
import { UserPlus, AlertTriangle, CheckCircle, Zap } from 'lucide-react';

interface NewLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewLeadModal({ isOpen, onClose }: NewLeadModalProps) {
  const queryClient = useQueryClient();
  const [source, setSource] = useState('WALK_IN');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Belagavi');
  const [product, setProduct] = useState('MOTOR');
  const [remarks, setRemarks] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Duplicate Phone Check
  const checkDuplicate = async (mobileNo: string) => {
    if (mobileNo.length < 10) return;
    try {
      const res = await apiClient.get(`/leads/check-duplicate?phone=${mobileNo}`);
      if (res.data?.exists) {
        setDuplicateWarning(res.data.message);
      } else {
        setDuplicateWarning(null);
      }
    } catch {
      setDuplicateWarning(null);
    }
  };

  const createLeadMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiClient.post('/leads', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads-kpis'] });
      toast.success('Lead captured in under 30 seconds!');
      onClose();
      setName('');
      setPhone('');
      setRemarks('');
      setDuplicateWarning(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to capture lead');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) {
      toast.error('Name and Mobile Number are required');
      return;
    }
    const [firstName, ...rest] = name.split(' ');
    createLeadMutation.mutate({
      title: `${product} Insurance Inquiry - ${name}`,
      source,
      firstName: firstName || 'Lead',
      lastName: rest.join(' ') || 'Customer',
      phone,
      city,
      productInterest: product,
      remarks,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-md p-6 rounded-2xl border bg-card shadow-2xl space-y-4 text-xs">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center space-x-2 text-primary">
            <Zap className="h-5 w-5 fill-current" />
            <h3 className="text-sm font-black text-foreground">Rapid Lead Capture (&lt;30s)</h3>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-primary/10 text-primary">
            P0 Fast Entry
          </span>
        </div>

        {duplicateWarning && (
          <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 flex items-start space-x-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="text-[11px] font-semibold">{duplicateWarning}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-foreground block mb-1">Lead Source *</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full p-2.5 rounded-xl border bg-background font-semibold"
              >
                <option value="WALK_IN">Walk-in</option>
                <option value="REFERRAL">Referral</option>
                <option value="WEBSITE">Website</option>
                <option value="FACEBOOK">Facebook Ads</option>
                <option value="GOOGLE">Google Ads</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="EXISTING_CUSTOMER">Existing Customer</option>
                <option value="DEALER">Dealer / Agent</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-foreground block mb-1">Product Interest *</label>
              <select
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                className="w-full p-2.5 rounded-xl border bg-background font-semibold"
              >
                <option value="MOTOR">Motor Insurance</option>
                <option value="HEALTH">Health Insurance</option>
                <option value="LIFE">Life Insurance</option>
                <option value="PROPERTY">Property / Commercial</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-bold text-foreground block mb-1">Full Name *</label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Vikramaditya Patil"
              className="w-full p-2.5 rounded-xl border bg-background"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-foreground block mb-1">Mobile Number *</label>
              <input
                required
                type="text"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  checkDuplicate(e.target.value);
                }}
                placeholder="+91 98765 43210"
                className="w-full p-2.5 rounded-xl border bg-background font-mono"
              />
            </div>
            <div>
              <label className="font-bold text-foreground block mb-1">City / RTO Location</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Belagavi / KA22"
                className="w-full p-2.5 rounded-xl border bg-background"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-foreground block mb-1">Initial Remarks / Call Notes</label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Interested in Zero Dep Package for Mahindra XUV700"
              className="w-full p-2 rounded-xl border bg-background"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 font-semibold rounded-xl border hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createLeadMutation.isPending}
              className="px-4 py-1.5 font-extrabold rounded-xl bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50"
            >
              Save Lead
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
