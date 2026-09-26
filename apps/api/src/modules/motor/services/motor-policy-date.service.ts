import { Injectable } from '@nestjs/common';

export interface AuthoritativeDates {
  odStartDate: string;
  odEndDate: string;
  tpStartDate: string;
  tpEndDate: string;
  effectiveStartDate: string;
  effectiveEndDate: string;
}

@Injectable()
export class MotorPolicyDateService {
  private readonly TIMEZONE = 'Asia/Kolkata';

  /**
   * Returns current business date in Asia/Kolkata formatted as YYYY-MM-DD
   */
  getBusinessToday(): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  }

  /**
   * Formats any Date, timestamp, or ISO string into Asia/Kolkata YYYY-MM-DD
   */
  toBusinessDate(date: Date | string | number): string {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(d);
  }

  /**
   * Check if date A is before date B in business date terms
   */
  isBefore(dateA: string, dateB: string): boolean {
    return dateA < dateB;
  }

  /**
   * Check if date A is after date B in business date terms
   */
  isAfter(dateA: string, dateB: string): boolean {
    return dateA > dateB;
  }

  /**
   * Returns whether a policy is active today (inclusive: expiring today is ACTIVE)
   */
  isPolicyActive(startDate: Date | string, endDate: Date | string): boolean {
    const today = this.getBusinessToday();
    const start = this.toBusinessDate(startDate);
    const end = this.toBusinessDate(endDate);
    return start <= today && today <= end;
  }

  /**
   * Returns whether a policy is expired (false if expiring today or in future)
   */
  isExpired(endDate: Date | string): boolean {
    const today = this.getBusinessToday();
    const end = this.toBusinessDate(endDate);
    return end < today;
  }

  /**
   * Calculate difference in full calendar days between two YYYY-MM-DD dates
   */
  daysBetween(dateA: string, dateB: string): number {
    const d1 = new Date(dateA + 'T00:00:00Z');
    const d2 = new Date(dateB + 'T00:00:00Z');
    const diffMs = d2.getTime() - d1.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Add calendar years minus 1 day (standard Indian insurance policy tenure rule)
   * e.g., 2026-09-26 + 1 year => 2027-09-25
   * e.g., 2026-09-26 + 3 years => 2029-09-25
   */
  addYearsMinusOneDay(startDateStr: string, years: number): string {
    const [y, m, d] = startDateStr.split('-').map(Number);
    const targetYear = y + years;
    const targetDate = new Date(Date.UTC(targetYear, m - 1, d));
    targetDate.setUTCDate(targetDate.getUTCDate() - 1);
    const endY = targetDate.getUTCFullYear();
    const endM = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
    const endD = String(targetDate.getUTCDate()).padStart(2, '0');
    return `${endY}-${endM}-${endD}`;
  }

  /**
   * Add calendar days to a YYYY-MM-DD string
   */
  addDays(dateStr: string, days: number): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    date.setUTCDate(date.getUTCDate() + days);
    const resY = date.getUTCFullYear();
    const resM = String(date.getUTCMonth() + 1).padStart(2, '0');
    const resD = String(date.getUTCDate()).padStart(2, '0');
    return `${resY}-${resM}-${resD}`;
  }

  /**
   * Generates authoritative policy dates based on vehicle status, policy type, tenure, and previous expiry
   */
  calculateMotorDates(params: {
    vehicleStatus?: string;
    vehicleCategory?: string;
    policyType?: string;
    policyTenure?: number;
    previousExpiryDate?: string | Date;
    requestedStartDate?: string | Date;
  }): AuthoritativeDates {
    const today = this.getBusinessToday();
    let startDate = today;

    if (params.previousExpiryDate) {
      const prevExp = this.toBusinessDate(params.previousExpiryDate);
      if (prevExp >= today) {
        // Continuous renewal: start the day after expiry
        startDate = this.addDays(prevExp, 1);
      } else {
        // Expired break-in: starts today or requested start date
        startDate = params.requestedStartDate ? this.toBusinessDate(params.requestedStartDate) : today;
      }
    } else if (params.requestedStartDate) {
      startDate = this.toBusinessDate(params.requestedStartDate);
    }

    const odTenure = 1;
    let tpTenure = params.policyTenure || 1;
    if (params.vehicleStatus === 'NEW') {
      const cat = params.vehicleCategory?.toString() ?? '';
      if (cat === 'PRIVATE_CAR') tpTenure = 3;
      else if (cat === 'BIKE') tpTenure = 5;
    }

    const odStartDate = startDate;
    const odEndDate = this.addYearsMinusOneDay(odStartDate, odTenure);

    const tpStartDate = startDate;
    const tpEndDate = this.addYearsMinusOneDay(tpStartDate, tpTenure);

    const effectiveStartDate = startDate;
    const isTpOnly = params.policyType === 'THIRD_PARTY_ONLY';
    const isOdOnly = params.policyType === 'STANDALONE_OD';
    const effectiveEndDate = isOdOnly ? odEndDate : tpEndDate;

    return {
      odStartDate,
      odEndDate,
      tpStartDate,
      tpEndDate,
      effectiveStartDate,
      effectiveEndDate,
    };
  }
}
