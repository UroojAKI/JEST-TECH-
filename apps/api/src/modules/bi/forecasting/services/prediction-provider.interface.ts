import { Decimal } from '@prisma/client/runtime/library';

export interface PredictionProvider {
  forecastRevenue(monthsAhead: number, branchId?: string): Promise<Decimal>;
  forecastRenewals(monthsAhead: number, branchId?: string): Promise<number>;
  forecastClaims(monthsAhead: number, branchId?: string): Promise<Decimal>;
  predictCustomerRisk(customerId: string): Promise<number>;
}
