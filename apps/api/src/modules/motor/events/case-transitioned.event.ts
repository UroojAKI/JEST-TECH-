import { MotorCaseStatus } from '@prisma/client';

export class CaseTransitionedEvent {
  constructor(
    public readonly caseId: string,
    public readonly companyId: string,
    public readonly fromStatus: MotorCaseStatus,
    public readonly toStatus: MotorCaseStatus,
    public readonly command: string,
    public readonly actorId: string,
    public readonly reason?: string,
    public readonly metadata?: Record<string, unknown>,
  ) {}
}
