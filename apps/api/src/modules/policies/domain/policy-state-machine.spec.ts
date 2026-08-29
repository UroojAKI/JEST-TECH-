import { BadRequestException } from '@nestjs/common';
import { PolicyStatus } from '@prisma/client';
import { PolicyStateMachine } from './policy-state-machine';

describe('PolicyStateMachine', () => {
  it('should allow valid transitions from DRAFT', () => {
    expect(() =>
      PolicyStateMachine.validateTransition(
        PolicyStatus.DRAFT,
        PolicyStatus.ISSUED,
      ),
    ).not.toThrow();
    expect(() =>
      PolicyStateMachine.validateTransition(
        PolicyStatus.DRAFT,
        PolicyStatus.ACTIVE,
      ),
    ).not.toThrow();
    expect(() =>
      PolicyStateMachine.validateTransition(
        PolicyStatus.DRAFT,
        PolicyStatus.CANCELLED,
      ),
    ).not.toThrow();
  });

  it('should allow valid transitions from ISSUED', () => {
    expect(() =>
      PolicyStateMachine.validateTransition(
        PolicyStatus.ISSUED,
        PolicyStatus.ACTIVE,
      ),
    ).not.toThrow();
    expect(() =>
      PolicyStateMachine.validateTransition(
        PolicyStatus.ISSUED,
        PolicyStatus.CANCELLED,
      ),
    ).not.toThrow();
  });

  it('should allow valid transitions from ACTIVE', () => {
    expect(() =>
      PolicyStateMachine.validateTransition(
        PolicyStatus.ACTIVE,
        PolicyStatus.PENDING_RENEWAL,
      ),
    ).not.toThrow();
    expect(() =>
      PolicyStateMachine.validateTransition(
        PolicyStatus.ACTIVE,
        PolicyStatus.LAPSED,
      ),
    ).not.toThrow();
  });

  it('should allow valid transitions from PENDING_RENEWAL', () => {
    expect(() =>
      PolicyStateMachine.validateTransition(
        PolicyStatus.PENDING_RENEWAL,
        PolicyStatus.RENEWED,
      ),
    ).not.toThrow();
  });

  it('should reject invalid transitions with BadRequestException', () => {
    expect(() =>
      PolicyStateMachine.validateTransition(
        PolicyStatus.CANCELLED,
        PolicyStatus.ACTIVE,
      ),
    ).toThrow(BadRequestException);

    expect(() =>
      PolicyStateMachine.validateTransition(
        PolicyStatus.RENEWED,
        PolicyStatus.DRAFT,
      ),
    ).toThrow(BadRequestException);

    expect(() =>
      PolicyStateMachine.validateTransition(
        PolicyStatus.DRAFT,
        PolicyStatus.LAPSED,
      ),
    ).toThrow(BadRequestException);
  });

  it('should allow self-transition (no-op)', () => {
    expect(() =>
      PolicyStateMachine.validateTransition(
        PolicyStatus.ACTIVE,
        PolicyStatus.ACTIVE,
      ),
    ).not.toThrow();
  });
});
