'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { VEHICLE_FIELDS } from './motorFormConfig';
import type { VehicleCategory } from './motorFormTypes';

interface Props {
  category: VehicleCategory;
  data: Record<string, string>;
  onChange: (data: Record<string, string>) => void;
}

const inputBase = 'w-full px-3 py-2 rounded-md border text-sm font-medium bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors shadow-sm';

export function VehicleDetailsForm({ category, data, onChange }: Props) {
  const fields = VEHICLE_FIELDS[category];

  const cleanReg = (data.registrationNumber || '').toUpperCase().replace(/[\s\-\.]/g, '');
  const shouldCheckReg = data.vehicleStatus !== 'NEW' && cleanReg.length >= 6;

  const { data: vehicleCheck, isLoading: isCheckingVehicle } = useQuery({
    queryKey: ['vehicle-policy-check', cleanReg],
    queryFn: async () => {
      if (!shouldCheckReg) return { hasExisting: false };
      try {
        const res = await apiClient.get('/quotations/check-vehicle', {
          params: { registrationNumber: cleanReg },
        });
        return res.data || { hasExisting: false };
      } catch {
        return { hasExisting: false };
      }
    },
    enabled: shouldCheckReg,
    staleTime: 30 * 1000,
  });

  const { data: rtoList = [] } = useQuery({
    queryKey: ['rto-master-directory'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/motor/vehicles/rto');
        return Array.isArray(res.data) ? res.data : [];
      } catch {
        return [];
      }
    },
    staleTime: 10 * 60 * 1000,
  });

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    let value = e.target.value;
    const next = { ...data, [key]: value };

    if (key === 'trailerCount') {
      const count = String(value);
      if (count === '0') {
        next.trailer1RegistrationNumber = '';
        next.trailer2RegistrationNumber = '';
      } else if (count === '1') {
        next.trailer2RegistrationNumber = '';
      }
      // When count is '2', both trailer1 and trailer2 are retained and active
    } else if (key === 'attachmentUsed') {
      if (value === 'Trailer 1' && !next.trailerCount) {
        next.trailerCount = '1';
        next.trailer2RegistrationNumber = '';
      } else if (value === 'Trailer 2' && !next.trailerCount) {
        next.trailerCount = '2';
      }
    }

    if (key === 'registrationNumber') {
      value = value.toUpperCase().replace(/[\s\-\.]/g, '');
      next[key] = value;
      // Auto-detect RTO from registration plate prefix (e.g. KA01, MH02)
      if (value.length >= 4 && !data.rtoLocation && rtoList.length > 0) {
        const prefix = value.substring(0, 4);
        const match = rtoList.find((r: any) => r.code === prefix);
        if (match) {
          next.rtoLocation = `${match.code} - ${match.rtoOfficeName}`;
          next.rtoCode = match.code;
          next.rtoZone = match.rtoZone;
        }
      }
    } else if (key === 'rtoLocation') {
      const match = rtoList.find((r: any) => `${r.code} - ${r.rtoOfficeName}` === value || r.code === value);
      if (match) {
        next.rtoCode = match.code;
        next.rtoZone = match.rtoZone;
      }
    }

    onChange(next);
  };

  return (
    <div className="space-y-6">
      {/* Vehicle Status Toggle */}
      <div className="bg-muted/50 p-4 rounded-lg border border-border">
        <label className="block text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
          Vehicle Registration Status
        </label>
        <div className="flex gap-4">
          <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-md border cursor-pointer transition-colors ${data.vehicleStatus === 'NEW' ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-background hover:bg-muted'}`}>
            <input
              type="radio"
              name="vehicleStatus"
              value="NEW"
              checked={data.vehicleStatus === 'NEW'}
              onChange={set('vehicleStatus')}
              className="sr-only"
            />
            Brand New Vehicle
          </label>
          <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-md border cursor-pointer transition-colors ${(!data.vehicleStatus || data.vehicleStatus === 'EXISTING') ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-background hover:bg-muted'}`}>
            <input
              type="radio"
              name="vehicleStatus"
              value="EXISTING"
              checked={!data.vehicleStatus || data.vehicleStatus === 'EXISTING'}
              onChange={set('vehicleStatus')}
              className="sr-only"
            />
            Previously Registered (Existing)
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map((f) => {
          // Registration details based on trailerCount (or legacy attachmentUsed)
          const effectiveTrailerCount =
            data.trailerCount !== undefined && data.trailerCount !== ''
              ? Number(data.trailerCount)
              : data.attachmentUsed === 'Trailer 2'
              ? 2
              : data.attachmentUsed === 'Trailer 1'
              ? 1
              : 0;

          if (f.key === 'trailer1RegistrationNumber' && effectiveTrailerCount < 1) return null;
          if (f.key === 'trailer2RegistrationNumber' && effectiveTrailerCount < 2) return null;
          // If NEW, hide vehicle registration number; trailer registration remains mandatory when selected.
          if (data.vehicleStatus === 'NEW' && f.key === 'registrationNumber') return null;
          const val = data[f.key] || '';
          const isSelectedTrailer =
            (f.key === 'trailer1RegistrationNumber' && effectiveTrailerCount >= 1) ||
            (f.key === 'trailer2RegistrationNumber' && effectiveTrailerCount >= 2);
          const isMandatory = f.mandatory === true || isSelectedTrailer;
          const isConditional = f.mandatory === 'conditional' && !isSelectedTrailer;
          const hasError = isMandatory && !val;
          const borderCls = hasError ? 'border-destructive focus:ring-destructive/50' : 'border-border';

          return (
            <div key={f.key}>
              <label htmlFor={f.key} className="block text-xs font-semibold text-muted-foreground mb-1.5">
                {f.label}
                {isMandatory && <span className="text-destructive ml-1">*</span>}
                {isConditional && (
                  <span className="text-amber-600 text-[10px] ml-1 font-medium">(Conditional)</span>
                )}
                {!isMandatory && !isConditional && (
                  <span className="text-muted-foreground/60 text-[10px] ml-1 font-medium">(Optional)</span>
                )}
              </label>

              {f.type === 'dropdown' ? (
                <select
                  id={f.key}
                  value={val}
                  required={isMandatory}
                  onChange={set(f.key)}
                  className={`${inputBase} ${borderCls}`}
                >
                  <option value="">— Select —</option>
                  {f.key === 'rtoLocation' && rtoList.length > 0 ? (
                    <>
                      {val && !rtoList.some((r: any) => `${r.code} - ${r.rtoOfficeName}` === val || r.code === val) && (
                        <option value={val}>{val}</option>
                      )}
                      {rtoList.map((r: any) => (
                        <option key={r.id || r.code} value={`${r.code} - ${r.rtoOfficeName}`}>
                          {r.code} — {r.rtoOfficeName} ({r.district}, {r.state})
                        </option>
                      ))}
                    </>
                  ) : (
                    (f.options || []).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))
                  )}
                </select>
              ) : f.type === 'date' ? (
                <input
                  id={f.key}
                  type="month"
                  value={val}
                  required={isMandatory}
                  onChange={set(f.key)}
                  className={`${inputBase} ${borderCls}`}
                />
              ) : f.type === 'boolean' ? (
                <div className="flex gap-4 mt-1">
                  {['Yes', 'No'].map((opt) => (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                      <input
                        type="radio"
                        name={f.key}
                        value={opt}
                        checked={val === opt}
                        onChange={set(f.key)}
                        className="h-4 w-4 text-primary focus:ring-primary/50"
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              ) : (
                <>
                  <input
                    id={f.key}
                    type={f.type === 'numeric' ? 'number' : 'text'}
                    value={val}
                    required={isMandatory}
                    onChange={set(f.key)}
                    maxLength={f.key === 'registrationNumber' ? 11 : undefined}
                    placeholder={f.placeholder || ''}
                    className={`${inputBase} ${
                      f.key === 'registrationNumber' && vehicleCheck?.hasExisting
                        ? 'border-destructive focus:ring-destructive/50 bg-destructive/5'
                        : borderCls
                    } ${
                      f.key === 'registrationNumber' ? 'uppercase font-mono tracking-wider' : ''
                    }`}
                  />
                  {f.key === 'registrationNumber' && isCheckingVehicle && (
                    <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin text-primary shrink-0" />
                      <span>Checking active policy / quotation...</span>
                    </p>
                  )}
                  {f.key === 'registrationNumber' && vehicleCheck?.hasExisting && (
                    <div className="mt-2 p-3 rounded-lg border border-destructive/40 bg-destructive/10 text-destructive text-xs space-y-1 animate-in fade-in duration-200">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
                        <div className="flex-1 space-y-0.5">
                          <p className="font-semibold text-xs leading-snug">
                            {vehicleCheck.message}
                          </p>
                          {vehicleCheck.policyNumber && (
                            <p className="text-[11px] text-destructive/90">
                              Active Policy: <span className="font-mono font-medium">{vehicleCheck.policyNumber}</span>
                              {vehicleCheck.formattedRenewalDate && (
                                <span> &bull; Renewal Date: <span className="font-medium">{vehicleCheck.formattedRenewalDate}</span></span>
                              )}
                            </p>
                          )}
                          <p className="text-[10px] text-destructive/80 font-medium pt-0.5">
                            Only one active quotation or policy is allowed per vehicle number.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {f.hint && (!vehicleCheck?.hasExisting || f.key !== 'registrationNumber') && (
                <p className="text-[11px] text-muted-foreground mt-1">{f.hint}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
