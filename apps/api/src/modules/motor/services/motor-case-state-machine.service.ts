import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../database/prisma.service';
import { MotorCaseStatus, RoleType } from '@prisma/client';
import { RequestUser } from '../../auth/decorators/current-user.decorator';
import { CaseTransitionedEvent } from '../events/case-transitioned.event';

export type CaseCommand =
  | 'VERIFY_CUSTOMER'
  | 'VERIFY_VEHICLE'
  | 'GENERATE_QUOTE'
  | 'MARK_PROPOSAL_READY'
  | 'SUBMIT_FOR_REVIEW'
  | 'BEGIN_REVIEW'
  | 'REQUEST_INSPECTION'
  | 'SUBMIT_INSPECTION'
  | 'APPROVE_INSPECTION'
  | 'REJECT_INSPECTION'
  | 'VERIFY_PAYMENT'
  | 'VERIFY_DOCUMENTS'
  | 'AUTHORIZE_ISSUANCE'
  | 'ISSUE_POLICY'
  | 'COMPLETE_CASE'
  | 'REJECT_CASE'
  | 'REQUEST_REWORK'
  | 'RESUBMIT'
  | 'CANCEL_CASE';

export interface TransitionRule {
  command: CaseCommand;
  from: MotorCaseStatus[];
  to: MotorCaseStatus;
  allowedRoles: RoleType[];
  separationOfDuty?: boolean;
}

export const CASE_TRANSITION_RULES: Record<CaseCommand, TransitionRule> = {
  VERIFY_CUSTOMER: {
    command: 'VERIFY_CUSTOMER',
    from: [MotorCaseStatus.DRAFT, MotorCaseStatus.OPEN],
    to: MotorCaseStatus.CUSTOMER_VERIFIED,
    allowedRoles: [RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT],
  },
  VERIFY_VEHICLE: {
    command: 'VERIFY_VEHICLE',
    from: [MotorCaseStatus.CUSTOMER_VERIFIED],
    to: MotorCaseStatus.VEHICLE_VERIFIED,
    allowedRoles: [RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT],
  },
  GENERATE_QUOTE: {
    command: 'GENERATE_QUOTE',
    from: [MotorCaseStatus.VEHICLE_VERIFIED, MotorCaseStatus.QUOTE_GENERATED, MotorCaseStatus.QUOTED],
    to: MotorCaseStatus.QUOTE_GENERATED,
    allowedRoles: [RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT],
  },
  MARK_PROPOSAL_READY: {
    command: 'MARK_PROPOSAL_READY',
    from: [MotorCaseStatus.QUOTE_GENERATED, MotorCaseStatus.QUOTED, MotorCaseStatus.SELECTED],
    to: MotorCaseStatus.PROPOSAL_READY,
    allowedRoles: [RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT],
  },
  SUBMIT_FOR_REVIEW: {
    command: 'SUBMIT_FOR_REVIEW',
    from: [MotorCaseStatus.PROPOSAL_READY, MotorCaseStatus.RESUBMITTED, MotorCaseStatus.SELECTED],
    to: MotorCaseStatus.SUBMITTED_FOR_REVIEW,
    allowedRoles: [RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT],
  },
  BEGIN_REVIEW: {
    command: 'BEGIN_REVIEW',
    from: [MotorCaseStatus.SUBMITTED_FOR_REVIEW],
    to: MotorCaseStatus.BACK_OFFICE_REVIEW,
    allowedRoles: [RoleType.ADMIN, RoleType.BACK_OFFICE],
  },
  REQUEST_INSPECTION: {
    command: 'REQUEST_INSPECTION',
    from: [MotorCaseStatus.BACK_OFFICE_REVIEW],
    to: MotorCaseStatus.INSPECTION_REQUIRED,
    allowedRoles: [RoleType.ADMIN, RoleType.BACK_OFFICE],
  },
  SUBMIT_INSPECTION: {
    command: 'SUBMIT_INSPECTION',
    from: [MotorCaseStatus.INSPECTION_REQUIRED],
    to: MotorCaseStatus.INSPECTION_SUBMITTED,
    allowedRoles: [RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT],
  },
  APPROVE_INSPECTION: {
    command: 'APPROVE_INSPECTION',
    from: [MotorCaseStatus.INSPECTION_SUBMITTED],
    to: MotorCaseStatus.INSPECTION_APPROVED,
    allowedRoles: [RoleType.ADMIN, RoleType.BACK_OFFICE],
    separationOfDuty: true,
  },
  REJECT_INSPECTION: {
    command: 'REJECT_INSPECTION',
    from: [MotorCaseStatus.INSPECTION_SUBMITTED],
    to: MotorCaseStatus.REWORK_REQUIRED,
    allowedRoles: [RoleType.ADMIN, RoleType.BACK_OFFICE],
  },
  VERIFY_PAYMENT: {
    command: 'VERIFY_PAYMENT',
    from: [MotorCaseStatus.INSPECTION_APPROVED, MotorCaseStatus.BACK_OFFICE_REVIEW],
    to: MotorCaseStatus.PAYMENT_VERIFIED,
    allowedRoles: [RoleType.ADMIN, RoleType.BACK_OFFICE],
  },
  VERIFY_DOCUMENTS: {
    command: 'VERIFY_DOCUMENTS',
    from: [MotorCaseStatus.PAYMENT_VERIFIED, MotorCaseStatus.BACK_OFFICE_REVIEW],
    to: MotorCaseStatus.DOCUMENTS_VERIFIED,
    allowedRoles: [RoleType.ADMIN, RoleType.BACK_OFFICE],
  },
  AUTHORIZE_ISSUANCE: {
    command: 'AUTHORIZE_ISSUANCE',
    from: [MotorCaseStatus.DOCUMENTS_VERIFIED, MotorCaseStatus.PAYMENT_VERIFIED],
    to: MotorCaseStatus.READY_FOR_ISSUANCE,
    allowedRoles: [RoleType.ADMIN, RoleType.BACK_OFFICE],
    separationOfDuty: true,
  },
  ISSUE_POLICY: {
    command: 'ISSUE_POLICY',
    from: [MotorCaseStatus.READY_FOR_ISSUANCE],
    to: MotorCaseStatus.ISSUED,
    allowedRoles: [RoleType.ADMIN],
  },
  COMPLETE_CASE: {
    command: 'COMPLETE_CASE',
    from: [MotorCaseStatus.ISSUED, MotorCaseStatus.PAYMENT_VERIFIED, MotorCaseStatus.SELECTED],
    to: MotorCaseStatus.COMPLETED,
    allowedRoles: [RoleType.ADMIN, RoleType.BACK_OFFICE],
  },
  REJECT_CASE: {
    command: 'REJECT_CASE',
    from: [
      MotorCaseStatus.SUBMITTED_FOR_REVIEW,
      MotorCaseStatus.BACK_OFFICE_REVIEW,
      MotorCaseStatus.INSPECTION_SUBMITTED,
    ],
    to: MotorCaseStatus.REJECTED,
    allowedRoles: [RoleType.ADMIN, RoleType.BACK_OFFICE],
  },
  REQUEST_REWORK: {
    command: 'REQUEST_REWORK',
    from: [
      MotorCaseStatus.SUBMITTED_FOR_REVIEW,
      MotorCaseStatus.BACK_OFFICE_REVIEW,
      MotorCaseStatus.INSPECTION_SUBMITTED,
    ],
    to: MotorCaseStatus.REWORK_REQUIRED,
    allowedRoles: [RoleType.ADMIN, RoleType.BACK_OFFICE],
  },
  RESUBMIT: {
    command: 'RESUBMIT',
    from: [MotorCaseStatus.REWORK_REQUIRED],
    to: MotorCaseStatus.RESUBMITTED,
    allowedRoles: [RoleType.ADMIN, RoleType.AGENT],
  },
  CANCEL_CASE: {
    command: 'CANCEL_CASE',
    from: [
      MotorCaseStatus.DRAFT,
      MotorCaseStatus.OPEN,
      MotorCaseStatus.CUSTOMER_VERIFIED,
      MotorCaseStatus.VEHICLE_VERIFIED,
      MotorCaseStatus.QUOTE_GENERATED,
      MotorCaseStatus.QUOTED,
      MotorCaseStatus.PROPOSAL_READY,
      MotorCaseStatus.SELECTED,
      MotorCaseStatus.SUBMITTED_FOR_REVIEW,
      MotorCaseStatus.BACK_OFFICE_REVIEW,
      MotorCaseStatus.INSPECTION_REQUIRED,
      MotorCaseStatus.INSPECTION_SUBMITTED,
      MotorCaseStatus.REWORK_REQUIRED,
      MotorCaseStatus.RESUBMITTED,
    ],
    to: MotorCaseStatus.CANCELLED,
    allowedRoles: [RoleType.ADMIN, RoleType.BACK_OFFICE],
  },
};

@Injectable()
export class MotorCaseStateMachineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  assertNoDirectStatusMutation(payload: any): void {
    if (payload && (payload.status !== undefined || payload['status'] !== undefined)) {
      throw new BadRequestException(
        'Direct status mutation is forbidden. Use authoritative domain command endpoints.',
      );
    }
  }

  async transition(
    caseId: string,
    command: CaseCommand,
    actor: RequestUser,
    options?: { reason?: string; metadata?: Record<string, unknown> },
  ) {
    const rule = CASE_TRANSITION_RULES[command];
    if (!rule) {
      throw new BadRequestException('Unknown domain command: ' + command);
    }

    const companyId = actor.companyId || (actor as any).organizationId;
    if (!companyId) {
      throw new ForbiddenException('Tenant organizational context is required');
    }

    const motorCase = await this.prisma.motorQuotationCase.findFirst({
      where: { id: caseId, companyId },
      include: {
        lead: true,
        contact: true,
        vehicle: true,
        selectedQuote: true,
      },
    });

    if (!motorCase) {
      throw new NotFoundException(
        'MotorQuotationCase ' + caseId + ' not found or access denied for tenant ' + companyId,
      );
    }

    if (!rule.from.includes(motorCase.status)) {
      throw new BadRequestException(
        'Illegal state transition: command ' + command + ' cannot be executed from status ' + motorCase.status + '. Allowed starting statuses: ' + rule.from.join(', '),
      );
    }

    const userRoles: string[] = (actor as any).roles?.length
      ? (actor as any).roles
      : actor.role
        ? [actor.role]
        : [];

    const isAuthorizedRole = userRoles.some((r) =>
      rule.allowedRoles.includes(r as RoleType),
    );

    if (!isAuthorizedRole) {
      throw new ForbiddenException(
        'Actor role(s) [' + userRoles.join(', ') + '] not authorized for command ' + command + '. Allowed roles: ' + rule.allowedRoles.join(', '),
      );
    }

    if (rule.separationOfDuty) {
      const creatorId =
        (motorCase as any).createdById ||
        motorCase.lead?.createdById ||
        motorCase.lead?.assignedToId;

      if (creatorId && creatorId === actor.id) {
        throw new ForbiddenException(
          'Separation of duty violation: actor ' + actor.id + ' cannot approve/authorize a case they created or own',
        );
      }
    }

    const fromStatus = motorCase.status;
    const toStatus = rule.to;

    const updatedCase = await this.prisma.$transaction(async (tx) => {
      return tx.motorQuotationCase.update({
        where: { id: caseId },
        data: {
          status: toStatus,
        },
        include: {
          lead: true,
          contact: true,
          vehicle: true,
          selectedQuote: true,
        },
      });
    });

    const event = new CaseTransitionedEvent(
      caseId,
      companyId,
      fromStatus,
      toStatus,
      command,
      actor.id,
      options?.reason,
      options?.metadata,
    );

    this.eventEmitter.emit('case.transitioned', event);

    return updatedCase;
  }

  async getAvailableCommands(
    caseId: string,
    actor: RequestUser,
  ): Promise<CaseCommand[]> {
    const companyId = actor.companyId || (actor as any).organizationId;
    if (!companyId) return [];

    const motorCase = await this.prisma.motorQuotationCase.findFirst({
      where: { id: caseId, companyId },
      include: { lead: true },
    });

    if (!motorCase) return [];

    const userRoles: string[] = (actor as any).roles?.length
      ? (actor as any).roles
      : actor.role
        ? [actor.role]
        : [];

    const available: CaseCommand[] = [];

    for (const [cmd, rule] of Object.entries(CASE_TRANSITION_RULES)) {
      if (!rule.from.includes(motorCase.status)) continue;
      if (!userRoles.some((r) => rule.allowedRoles.includes(r as RoleType))) continue;

      if (rule.separationOfDuty) {
        const creatorId =
          (motorCase as any).createdById ||
          motorCase.lead?.createdById ||
          motorCase.lead?.assignedToId;
        if (creatorId && creatorId === actor.id) continue;
      }

      available.push(cmd as CaseCommand);
    }

    return available;
  }
}
