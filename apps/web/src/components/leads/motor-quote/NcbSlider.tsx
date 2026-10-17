import React from 'react';

export const NCB_TIERS = [0, 20, 25, 35, 45, 50] as const;
export type NcbTier = (typeof NCB_TIERS)[number];

interface NcbSliderProps {
  value: string | number;
  onChange: (value: string) => void;
  disabled?: boolean;
  disabledReason?: string;
  label?: string;
  mandatory?: boolean;
}

export function NcbSlider({
  value,
  onChange,
  disabled = false,
  disabledReason,
  label = 'No Claim Bonus (NCB) %',
  mandatory = true,
}: NcbSliderProps) {
  const numericVal = typeof value === 'number' ? value : parseInt(value || '0', 10);
  const effectiveVal = isNaN(numericVal) ? 0 : numericVal;

  // Find closest tier index
  const tiers: readonly number[] = NCB_TIERS;
  let currentIndex = tiers.indexOf(effectiveVal);
  if (currentIndex === -1) {
    let closestIdx = 0;
    let minDiff = Infinity;
    for (let i = 0; i < tiers.length; i++) {
      const diff = Math.abs(tiers[i] - effectiveVal);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }
    currentIndex = closestIdx;
  }

  const activeTier = disabled ? 0 : NCB_TIERS[currentIndex];

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const index = parseInt(e.target.value, 10);
    const selectedTier = NCB_TIERS[index] ?? 0;
    onChange(selectedTier.toString());
  };

  const handleTierClick = (tier: NcbTier) => {
    if (disabled) return;
    onChange(tier.toString());
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-bold text-foreground flex items-center gap-1">
          {label}
          {mandatory && <span className="text-rose-500">*</span>}
          <span className="text-[9px] font-normal text-muted-foreground ml-1">
            (Underwriting Risk Rating)
          </span>
        </label>
        {disabled ? (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            {disabledReason || '0% — Ineligible'}
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
            {activeTier}% NCB
          </span>
        )}
      </div>

      <div className="px-1 py-1">
        <input
          type="range"
          min={0}
          max={NCB_TIERS.length - 1}
          step={1}
          value={disabled ? 0 : currentIndex}
          onChange={handleSliderChange}
          disabled={disabled}
          className={`w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          aria-label="No Claim Bonus percentage slider"
        />

        {/* Discrete Tick Markers */}
        <div className="flex justify-between items-center text-[10px] font-semibold text-muted-foreground mt-1 px-0.5">
          {NCB_TIERS.map((tier) => {
            const isSelected = activeTier === tier && !disabled;
            return (
              <button
                key={tier}
                type="button"
                disabled={disabled}
                onClick={() => handleTierClick(tier)}
                className={`transition-colors py-0.5 px-1 rounded hover:text-foreground ${
                  isSelected
                    ? 'font-bold text-primary bg-primary/10'
                    : 'text-muted-foreground'
                } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
              >
                {tier}%
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-[9px] text-muted-foreground">
        {disabled
          ? disabledReason || 'NCB is locked to 0% due to claim or new vehicle status.'
          : 'Underwriting selection: IRDAI claim-free progression tier (records underwriting metadata for risk rating).'}
      </p>
    </div>
  );
}
