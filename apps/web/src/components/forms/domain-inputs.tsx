'use client';

import React from 'react';

// 1. Currency Input (INR Format)
export function CurrencyInput({
  value,
  onChange,
  placeholder = 'Enter amount (₹)',
}: {
  value?: number;
  onChange?: (val: number) => void;
  placeholder?: string;
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    const num = raw ? parseInt(raw, 10) : 0;
    onChange?.(num);
  };

  const formatted = value ? new Intl.NumberFormat('en-IN').format(value) : '';

  return (
    <div className="relative">
      <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-bold">₹</span>
      <input
        type="text"
        value={formatted}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full pl-7 pr-3 py-2 text-xs rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}

// 2. PAN Card Input (Indian Tax ID)
export function PANInput({
  value,
  onChange,
}: {
  value?: string;
  onChange?: (val: string) => void;
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().slice(0, 10);
    onChange?.(val);
  };

  return (
    <input
      type="text"
      value={value || ''}
      onChange={handleChange}
      placeholder="ABCDE1234F"
      maxLength={10}
      className="w-full px-3 py-2 text-xs font-mono uppercase rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
    />
  );
}

// 3. GSTIN Input (15-char Tax ID)
export function GSTInput({
  value,
  onChange,
}: {
  value?: string;
  onChange?: (val: string) => void;
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().slice(0, 15);
    onChange?.(val);
  };

  return (
    <input
      type="text"
      value={value || ''}
      onChange={handleChange}
      placeholder="27AAAAA0000A1Z5"
      maxLength={15}
      className="w-full px-3 py-2 text-xs font-mono uppercase rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
    />
  );
}

// 4. Vehicle Registration Input
export function VehicleRegInput({
  value,
  onChange,
}: {
  value?: string;
  onChange?: (val: string) => void;
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().slice(0, 13);
    onChange?.(val);
  };

  return (
    <input
      type="text"
      value={value || ''}
      onChange={handleChange}
      placeholder="MH-12-AB-1234"
      maxLength={13}
      className="w-full px-3 py-2 text-xs font-mono uppercase rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
    />
  );
}
