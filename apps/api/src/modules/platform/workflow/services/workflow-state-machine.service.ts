import { Injectable } from '@nestjs/common';

@Injectable()
export class WorkflowStateMachine {
  validateTransition(
    currentStateCode: string,
    transition: { fromState: { code: string } | null; toState: { code: string } },
  ): boolean {
    const fromCode = transition.fromState ? transition.fromState.code : 'DRAFT';
    return fromCode.toUpperCase() === currentStateCode.toUpperCase();
  }

  evaluateConditions(conditions: any, variables: Record<string, any>): boolean {
    if (!conditions) return true;
    const logic = conditions.logic || 'AND';
    const rules = conditions.rules || [];

    if (rules.length === 0) return true;

    if (logic === 'AND') {
      return rules.every((rule: any) => this.evaluateRule(rule, variables));
    } else if (logic === 'OR') {
      return rules.some((rule: any) => this.evaluateRule(rule, variables));
    }
    return false;
  }

  private evaluateRule(rule: any, variables: Record<string, any>): boolean {
    const { field, operator, value } = rule;
    const varValue = variables[field];

    if (varValue === undefined || varValue === null) return false;

    const left = varValue;
    const right = value;

    switch (operator.toLowerCase()) {
      case 'eq':
      case 'equals':
        return String(left).toLowerCase() === String(right).toLowerCase();
      case 'neq':
      case 'notequals':
        return String(left).toLowerCase() !== String(right).toLowerCase();
      case 'gt':
        return Number(left) > Number(right);
      case 'gte':
        return Number(left) >= Number(right);
      case 'lt':
        return Number(left) < Number(right);
      case 'lte':
        return Number(left) <= Number(right);
      case 'contains':
        return String(left).toLowerCase().includes(String(right).toLowerCase());
      default:
        return false;
    }
  }
}
