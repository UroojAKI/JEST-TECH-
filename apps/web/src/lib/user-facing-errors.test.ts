import { describe, it, expect } from 'vitest';
import { formatUserFacingError } from './user-facing-errors';

describe('formatUserFacingError (REQ-8 Plain Language Error Handling)', () => {
  it('translates 409 pending change request conflict into plain language with approval instructions', () => {
    const error: any = {
      isAxiosError: true,
      response: {
        status: 409,
        data: {
          errorCode: 'PENDING_CHANGE_REQUEST_EXISTS',
          message: 'Policy has a pending change request under review',
        },
      },
    };

    const formatted = formatUserFacingError(error);

    expect(formatted.title).toBe('Policy Change Under Review');
    expect(formatted.message).toContain('already pending administrative approval');
    expect(formatted.actionHint).toContain('wait for the administrator or back-office team');
    expect(formatted.dataPreserved).toBe(true);
    expect(formatted.statusCode).toBe(409);
  });

  it('translates 409 stale version conflict into clear resolution guidance', () => {
    const error: any = {
      isAxiosError: true,
      response: {
        status: 409,
        data: {
          errorCode: 'POLICY_CHANGE_STALE_VERSION',
          message: 'Conflict: Stale version',
        },
      },
    };

    const formatted = formatUserFacingError(error);

    expect(formatted.title).toBe('Record Updated by Another User');
    expect(formatted.message).toContain('modified by another user');
    expect(formatted.actionHint).toContain('refresh the page to view the latest changes');
    expect(formatted.dataPreserved).toBe(true);
  });

  it('translates 400 vehicle inspection incomplete error with all 7 mandatory slots guidance', () => {
    const error: any = {
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          message: 'Inspection incomplete: all 7 mandatory distinct photos required',
        },
      },
    };

    const formatted = formatUserFacingError(error);

    expect(formatted.title).toBe('Mandatory Vehicle Inspection Incomplete');
    expect(formatted.message).toContain('all 7 photos');
    expect(formatted.actionHint).toContain('upload and assign photos to all 7 inspection slots');
    expect(formatted.dataPreserved).toBe(true);
  });

  it('translates 400 missing policy PDF error with upload guidance', () => {
    const error: any = {
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          message: 'Policy PDF schedule document is required before completing policy',
        },
      },
    };

    const formatted = formatUserFacingError(error);

    expect(formatted.title).toBe('Policy PDF Required');
    expect(formatted.message).toContain('official policy PDF schedule attached');
    expect(formatted.actionHint).toContain('upload the signed policy schedule document in PDF format');
  });

  it('translates 400 renewal 45-day restriction into plain language', () => {
    const error: any = {
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          errorCode: 'RENEWAL_RESTRICTION_45_DAYS',
          message: 'Policy renewal is only permitted within 45 days of policy expiry',
        },
      },
    };

    const formatted = formatUserFacingError(error);

    expect(formatted.title).toBe('Renewal Window Not Yet Open');
    expect(formatted.message).toContain('within 45 days of policy expiration');
    expect(formatted.actionHint).toContain('45-day renewal window');
  });

  it('translates 400 renewal reminder 90-day restriction into plain language', () => {
    const error: any = {
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          message: 'Renewal reminder is only permitted within 90 days of policy expiry',
        },
      },
    };

    const formatted = formatUserFacingError(error);

    expect(formatted.title).toBe('Reminder Not Yet Available');
    expect(formatted.message).toContain('within 90 days of policy expiration');
  });

  it('translates 400 missing PIN code and customer address into clear instructions', () => {
    const error: any = {
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          message: 'Invalid pincode: customer address and 6-digit PIN code required',
        },
      },
    };

    const formatted = formatUserFacingError(error);

    expect(formatted.title).toBe('Customer Address Incomplete');
    expect(formatted.actionHint).toContain('6-digit numeric PIN code');
  });

  it('translates 403 forbidden into role permission guidance', () => {
    const error: any = {
      isAxiosError: true,
      response: {
        status: 403,
        data: { message: 'Forbidden' },
      },
    };

    const formatted = formatUserFacingError(error);

    expect(formatted.title).toBe('Access Restricted');
    expect(formatted.actionHint).toContain('contact your company administrator');
  });

  it('translates 500 server error confirming data preservation', () => {
    const error: any = {
      isAxiosError: true,
      response: {
        status: 500,
        data: { message: 'Internal Server Error' },
      },
    };

    const formatted = formatUserFacingError(error);

    expect(formatted.title).toBe('Service Temporarily Unavailable');
    expect(formatted.dataPreserved).toBe(true);
  });
});

