import { BadRequestException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { ValidationError, validateSync } from 'class-validator';
import { HealthPlanCategory, HealthPolicyForm } from '@prisma/client';
import {
  PLAN_DETAILS_DTO,
  RenewalPortabilityDetailsDto,
  TopUpPlanDetailsDto,
} from '../dto/health-plan-details.dto';

export interface MemberFacts {
  dateOfBirth: string | Date;
  relation: string;
  heightCm: number;
  weightKg: number;
  preExistingDiseases: string;
  isSmoker: boolean;
}

/** Critical illness first-diagnosis waiting period, Section 1.4 field 6: "90 days standard" (fixed). */
const CI_FIRST_DIAGNOSIS_WAITING_DAYS = 90;
const SENIOR_CITIZEN_MIN_AGE = 60;
const NO_DISEASE = ['', 'none', 'nil', 'na', 'n/a', 'no'];

const flattenErrors = (errors: ValidationError[], prefix: string): string[] =>
  errors.flatMap((e) => {
    const path = prefix ? `${prefix}.${e.property}` : e.property;
    const own = Object.values(e.constraints ?? {}).map((msg) => msg.replace(e.property, path));
    return [...own, ...flattenErrors(e.children ?? [], path)];
  });

@Injectable()
export class HealthPlanValidationService {
  /**
   * Validates Section A for the case's plan category and returns the cleaned object
   * (unknown keys are rejected) plus values derived from the insured members.
   */
  validatePlanDetails(
    category: HealthPlanCategory,
    raw: Record<string, any>,
    members: MemberFacts[],
  ): Record<string, any> & { derived: ReturnType<HealthPlanValidationService['deriveMemberFacts']>; warnings: string[] } {
    const details = this.validateAgainst(PLAN_DETAILS_DTO[category], raw, 'planDetails') as Record<string, any>;

    if (category === HealthPlanCategory.TOP_UP) {
      const topUp = details as TopUpPlanDetailsDto;
      if (topUp.deductibleAmount > topUp.basePolicySumInsured) {
        throw new BadRequestException(
          'planDetails.deductibleAmount cannot exceed planDetails.basePolicySumInsured (deductible eligibility)',
        );
      }
    }

    const derived = this.deriveMemberFacts(members);
    const warnings: string[] = [];

    if (category === HealthPlanCategory.SENIOR_CITIZEN && derived.eldestMemberAge < SENIOR_CITIZEN_MIN_AGE) {
      warnings.push(`Eldest insured is ${derived.eldestMemberAge}; senior citizen plans typically start at ${SENIOR_CITIZEN_MIN_AGE}`);
    }

    const extra: Record<string, any> = {};
    if (category === HealthPlanCategory.CRITICAL_ILLNESS) {
      extra.firstDiagnosisWaitingDays = CI_FIRST_DIAGNOSIS_WAITING_DAYS;
    }

    return { ...details, ...extra, derived, warnings };
  }

  /** Policy Form (ii) fields - required only when the case is RENEWAL_PORTABILITY. */
  validateRenewal(policyForm: HealthPolicyForm, raw: Record<string, any> | undefined) {
    if (policyForm !== HealthPolicyForm.RENEWAL_PORTABILITY) {
      return undefined;
    }
    if (!raw) {
      throw new BadRequestException('previousPolicySnapshot is required for RENEWAL_PORTABILITY');
    }
    return this.validateAgainst(RenewalPortabilityDetailsDto, raw, 'previousPolicySnapshot');
  }

  deriveMemberFacts(members: MemberFacts[]) {
    const now = new Date();
    const ages = members.map((m) => this.ageOn(new Date(m.dateOfBirth), now));

    return {
      memberCount: members.length,
      relationships: members.map((m) => m.relation),
      eldestMemberAge: Math.max(...ages),
      youngestMemberAge: Math.min(...ages),
      anyPreExistingDisease: members.some(
        (m) => !NO_DISEASE.includes((m.preExistingDiseases ?? '').trim().toLowerCase()),
      ),
      anySmoker: members.some((m) => m.isSmoker),
      bmi: members.map((m) => Math.round((m.weightKg / (m.heightCm / 100) ** 2) * 10) / 10),
    };
  }

  private validateAgainst(cls: new () => object, raw: Record<string, any>, label: string): object {
    const instance = plainToInstance(cls, raw ?? {}, { enableImplicitConversion: false });
    const errors = validateSync(instance, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length) {
      throw new BadRequestException(flattenErrors(errors, label));
    }
    return { ...instance };
  }

  private ageOn(dob: Date, on: Date): number {
    let age = on.getFullYear() - dob.getFullYear();
    const beforeBirthday =
      on.getMonth() < dob.getMonth() || (on.getMonth() === dob.getMonth() && on.getDate() < dob.getDate());
    if (beforeBirthday) age -= 1;
    return age;
  }
}
