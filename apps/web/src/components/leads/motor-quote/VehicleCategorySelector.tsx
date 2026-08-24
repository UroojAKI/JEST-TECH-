'use client';

import React from 'react';
import { VEHICLE_CATEGORIES } from './motorFormConfig';
import type { VehicleCategory } from './motorFormTypes';

interface Props {
  selected: VehicleCategory | null;
  onChange: (cat: VehicleCategory) => void;
}

export function VehicleCategorySelector({ selected, onChange }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-black text-sm text-foreground">Select Vehicle Category</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Choose the vehicle type to load the correct data capture form fields
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {VEHICLE_CATEGORIES.map((cat) => {
          const isSelected = selected === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onChange(cat.id)}
              className={`relative p-3.5 rounded-xl border-2 text-left transition-all group ${
                isSelected
                  ? 'border-primary bg-primary/10 shadow-md ring-1 ring-primary'
                  : 'border-border bg-card hover:border-primary/40 hover:bg-accent'
              }`}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                  <svg className="h-2.5 w-2.5 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              <div className="text-2xl mb-1.5">{cat.icon}</div>
              <div className={`text-[11px] font-black leading-tight ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                {cat.label}
              </div>
              <div className="text-[9px] text-muted-foreground mt-0.5 leading-tight">
                {cat.description}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
