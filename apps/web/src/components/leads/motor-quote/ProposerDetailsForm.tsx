'use client';

import React from 'react';
import { LEAD_SOURCE_OPTIONS } from './motorFormConfig';
import type { ProposerDetails } from './motorFormTypes';

interface Props {
  data: ProposerDetails;
  onChange: (data: ProposerDetails) => void;
}

const Field = ({
  label,
  mandatory,
  children,
  hint,
}: {
  label: string;
  mandatory: boolean;
  children: React.ReactNode;
  hint?: string;
}) => (
  <div>
    <label className="block text-[11px] font-bold text-foreground mb-1">
      {label}
      {mandatory && <span className="text-rose-500 ml-0.5">*</span>}
      {!mandatory && <span className="text-muted-foreground text-[9px] ml-1">(Optional)</span>}
    </label>
    {children}
    {hint && <p className="text-[9px] text-muted-foreground mt-0.5">{hint}</p>}
  </div>
);

const inputCls = (mandatory: boolean, value: string) =>
  `w-full p-2 rounded-lg border text-xs font-semibold bg-background transition-colors focus:outline-none focus:ring-1 focus:ring-primary ${
    mandatory && !value ? 'border-rose-400 focus:ring-rose-400' : 'border-border'
  }`;

export function ProposerDetailsForm({ data, onChange }: Props) {
  const set = (key: keyof ProposerDetails) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange({ ...data, [key]: e.target.value });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h3 className="font-black text-sm text-foreground">Proposer / Customer Details</h3>
          <p className="text-[11px] text-muted-foreground">Common across all motor forms — pre-filled from lead record</p>
        </div>
        <span className="text-[9px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">
          Fields marked <span className="text-rose-500">*</span> are mandatory
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Proposal / Enquiry Date" mandatory={true}>
          <input
            type="date"
            value={data.proposalDate}
            onChange={set('proposalDate')}
            className={inputCls(true, data.proposalDate)}
          />
        </Field>

        <Field label="Lead / Enquiry Source" mandatory={false}>
          <select
            value={data.leadSource}
            onChange={set('leadSource')}
            className={inputCls(false, data.leadSource)}
          >
            <option value="">— Select Source —</option>
            {LEAD_SOURCE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>

        <Field label="Proposer / Customer Name" mandatory={true} hint="As per RC / KYC document">
          <input
            type="text"
            value={data.customerName}
            onChange={set('customerName')}
            placeholder="e.g. Vikramaditya Patil"
            className={inputCls(true, data.customerName)}
          />
        </Field>

        <Field label="Mobile Number" mandatory={true} hint="OTP verification & CRM linking">
          <input
            type="text"
            value={data.mobileNumber}
            onChange={set('mobileNumber')}
            placeholder="e.g. 9876543210"
            maxLength={10}
            className={`${inputCls(true, data.mobileNumber)} font-mono`}
          />
        </Field>

        <Field label="Email ID" mandatory={false} hint="For policy & communication">
          <input
            type="email"
            value={data.emailId}
            onChange={set('emailId')}
            placeholder="customer@email.com"
            className={inputCls(false, data.emailId)}
          />
        </Field>

        <Field label="PAN Number" mandatory={false} hint="KYC optional during quote stage">
          <input
            type="text"
            value={data.panNumber}
            onChange={set('panNumber')}
            placeholder="ABCDE1234F"
            maxLength={10}
            className={`${inputCls(false, data.panNumber)} font-mono uppercase`}
          />
        </Field>
      </div>

      <Field label="Communication Address" mandatory={false}>
        <textarea
          rows={2}
          value={data.address}
          onChange={set('address')}
          placeholder="Full communication address"
          className={`${inputCls(false, data.address)} resize-none`}
        />
      </Field>

      <Field label="Relationship Manager / Sales Executive" mandatory={false} hint="Auto-mapped to logged-in user">
        <input
          type="text"
          value={data.relationshipManager}
          onChange={set('relationshipManager')}
          placeholder="RM / Sales Executive name"
          className={inputCls(false, data.relationshipManager)}
        />
      </Field>
    </div>
  );
}
