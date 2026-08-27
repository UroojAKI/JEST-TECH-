import { Injectable, BadRequestException } from '@nestjs/common';

export interface SelectedAddons {
  zeroDepreciation?: boolean;
  engineProtection?: boolean;
  consumables?: boolean;
  returnToInvoice?: boolean;
  roadsideAssistance?: boolean;
  keyReplacement?: boolean;
  ncbProtect?: boolean;
}

export interface AddonBreakup {
  code: string;
  name: string;
  premium: number;
}

@Injectable()
export class AddonsService {
  /**
   * Calculates individual and total add-on premiums based on IDV and selected covers.
   */
  calculateAddons(
    idv: number,
    selected: SelectedAddons = {},
  ): {
    breakup: AddonBreakup[];
    totalAddonsPremium: number;
  } {
    const breakup: AddonBreakup[] = [];

    if (selected.zeroDepreciation) {
      breakup.push({
        code: 'ZERO_DEP',
        name: 'Zero Depreciation Cover',
        premium: Math.round(idv * 0.0065),
      });
    }

    if (selected.engineProtection) {
      breakup.push({
        code: 'ENGINE_PROTECT',
        name: 'Engine & Gearbox Protection',
        premium: Math.round(idv * 0.0035),
      });
    }

    if (selected.consumables) {
      breakup.push({
        code: 'CONSUMABLES',
        name: 'Consumables Cover',
        premium: Math.round(idv * 0.0015),
      });
    }

    if (selected.returnToInvoice) {
      breakup.push({
        code: 'RTI',
        name: 'Return to Invoice (RTI)',
        premium: Math.round(idv * 0.0045),
      });
    }

    if (selected.roadsideAssistance) {
      breakup.push({
        code: 'RSA',
        name: '24x7 Roadside Assistance',
        premium: 299,
      });
    }

    if (selected.keyReplacement) {
      breakup.push({
        code: 'KEY_REPLACE',
        name: 'Key Replacement Cover',
        premium: 199,
      });
    }

    if (selected.ncbProtect) {
      breakup.push({
        code: 'NCB_PROTECT',
        name: 'NCB Protection Cover',
        premium: Math.round(idv * 0.0020),
      });
    }

    const totalAddonsPremium = breakup.reduce((sum, item) => sum + item.premium, 0);

    return {
      breakup,
      totalAddonsPremium,
    };
  }

  calculateAddonsTotal(addons: { premium: number }[]): number {
    const total = (addons || []).reduce((sum, addon) => sum + (addon.premium || 0), 0);
    return Math.round(total * 100) / 100;
  }

  /**
   * Enforces IRDAI rule prohibiting zero-premium add-ons (G018).
   */
  validateAddons(addons: { addonName?: string; addonCode?: string; premium?: number }[]): void {
    for (const addon of addons || []) {
      if (addon.premium !== undefined && addon.premium <= 0) {
        throw new BadRequestException(
          `Addon "${addon.addonName || addon.addonCode}" cannot have zero or negative premium (₹${addon.premium}). Zero-premium add-ons are prohibited.`,
        );
      }
    }
  }
}
