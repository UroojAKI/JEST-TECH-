import { Decimal } from '@prisma/client/runtime/library';
import { ActorContext } from '../../../../common/interfaces/actor-context.interface';

export interface PredictionProvider {
  forecastRevenue(
    monthsAhead: number,
    branchId?: string,
    actor?: ActorContext,
  ): Promise<Decimal>;
  forecastRenewals(
    monthsAhead: number,
    branchId?: string,
    actor?: ActorContext,
  ): Promise<number>;
  forecastClaims(
    monthsAhead: number,
    branchId?: string,
    actor?: ActorContext,
  ): Promise<Decimal>;
  predictCustomerRisk(
    customerId: string,
    actor?: ActorContext,
  ): Promise<number>;
}
