import axios, { AxiosError } from 'axios';

export interface UserFacingError {
  /** Short headline explaining what happened in plain language (no raw status codes) */
  title: string;
  /** Detailed plain-language explanation */
  message: string;
  /** Concrete action the user needs to take to resolve the situation */
  actionHint: string;
  /** Confirmation that user inputs have been kept safe in state */
  dataPreserved: boolean;
  /** Technical correlation / trace ID if available */
  correlationId?: string;
  /** Original HTTP status code if available */
  statusCode?: number;
}

/**
 * REQ-8: Proper Error Handling.
 * Translates raw technical errors (such as HTTP 409 Conflict, 400 Bad Request,
 * 403 Forbidden, stale version errors, inspection/PDF gate rejections) into
 * plain human language, providing clear next actions and confirming that entered data
 * is preserved.
 */
export function formatUserFacingError(
  error: unknown,
  fallbackMessage = 'An unexpected error occurred',
): UserFacingError {
  let correlationId: string | undefined;
  let statusCode: number | undefined;
  let rawMsg = '';
  let errorCode = '';

  if (axios.isAxiosError(error)) {
    statusCode = error.response?.status;
    const resData = error.response?.data as any;

    correlationId =
      resData?.meta?.requestId ||
      (error.response?.headers?.['x-correlation-id'] as string) ||
      (error.config?.headers?.['X-Correlation-ID'] as string);

    errorCode =
      resData?.error?.errorCode ||
      resData?.errorCode ||
      resData?.code ||
      '';

    if (Array.isArray(resData?.error?.message)) {
      rawMsg = resData.error.message.join(' | ');
    } else if (typeof resData?.error?.message === 'string') {
      rawMsg = resData.error.message;
    } else if (Array.isArray(resData?.message)) {
      rawMsg = resData.message.join(' | ');
    } else if (typeof resData?.message === 'string') {
      rawMsg = resData.message;
    } else if (typeof resData?.error === 'string') {
      rawMsg = resData.error;
    } else if (error.message) {
      rawMsg = error.message;
    }
  } else if (error && typeof error === 'object' && (error as any).response?.data) {
    const resData = (error as any).response.data;
    if (Array.isArray(resData?.error?.message)) {
      rawMsg = resData.error.message.join(' | ');
    } else if (typeof resData?.error?.message === 'string') {
      rawMsg = resData.error.message;
    } else if (Array.isArray(resData?.message)) {
      rawMsg = resData.message.join(' | ');
    } else if (typeof resData?.message === 'string') {
      rawMsg = resData.message;
    }
    correlationId = resData?.meta?.requestId;
  } else if (error instanceof Error) {
    rawMsg = error.message;
  } else if (typeof error === 'string') {
    rawMsg = error;
  }

  const lower = (rawMsg + ' ' + errorCode).toLowerCase();

  // ── 1. HTTP 409 CONFLICT / CONCURRENCY / PENDING APPROVALS ────────────
  if (
    statusCode === 409 ||
    lower.includes('conflict') ||
    lower.includes('stale') ||
    lower.includes('version') ||
    errorCode === 'POLICY_CHANGE_STALE_VERSION' ||
    errorCode === 'PENDING_CHANGE_REQUEST_EXISTS'
  ) {
    if (
      lower.includes('pending') ||
      lower.includes('approval') ||
      errorCode === 'PENDING_CHANGE_REQUEST_EXISTS'
    ) {
      return {
        title: 'Policy Change Under Review',
        message:
          'A change request for this policy is already pending administrative approval. Additional modifications cannot be submitted until the pending review is completed.',
        actionHint:
          'Please wait for the administrator or back-office team to approve or reject the pending change request before submitting further edits.',
        dataPreserved: true,
        correlationId,
        statusCode: 409,
      };
    }

    if (
      lower.includes('stale') ||
      lower.includes('version') ||
      lower.includes('modified') ||
      errorCode === 'POLICY_CHANGE_STALE_VERSION'
    ) {
      return {
        title: 'Record Updated by Another User',
        message:
          'This record has been modified by another user or background process since you opened it. Your changes cannot overwrite the newer version.',
        actionHint:
          'Please refresh the page to view the latest changes, then re-apply your updates if necessary.',
        dataPreserved: true,
        correlationId,
        statusCode: 409,
      };
    }

    if (
      lower.includes('already running') ||
      lower.includes('already active') ||
      errorCode === 'VEHICLE_POLICY_ALREADY_RUNNING'
    ) {
      return {
        title: 'Active Policy Already Exists',
        message:
          'An active policy is already running for this vehicle or registration number.',
        actionHint:
          'Please search for the existing policy in the Policies directory or initiate a policy renewal instead.',
        dataPreserved: true,
        correlationId,
        statusCode: 409,
      };
    }

    return {
      title: 'Action Conflict',
      message:
        'A conflicting update or submission is already registered for this record.',
      actionHint:
        'Please refresh the page to verify the current status before attempting to submit again.',
      dataPreserved: true,
      correlationId,
      statusCode: 409,
    };
  }

  // ── 2. HTTP 400 VALIDATION & BUSINESS GATE FAILURES ─────────────────
  if (statusCode === 400) {
    // Inspection slot validation
    if (
      lower.includes('inspection') ||
      lower.includes('7 mandatory') ||
      lower.includes('distinct photo') ||
      lower.includes('slot') ||
      errorCode.includes('INSPECTION')
    ) {
      return {
        title: 'Mandatory Vehicle Inspection Incomplete',
        message:
          'Pre-issuance vehicle inspection requires all 7 photos (Front, Rear, Left Side, Right Side, Windshield, Dashboard / Odometer, and Engine Compartment).',
        actionHint:
          'Please upload and assign photos to all 7 inspection slots before submitting.',
        dataPreserved: true,
        correlationId,
        statusCode: 400,
      };
    }

    // Policy PDF schedule validation (REQ-2)
    if (
      lower.includes('policy pdf') ||
      lower.includes('pdf document') ||
      lower.includes('policy schedule') ||
      (lower.includes('pdf') &&
        (lower.includes('mandatory') ||
          lower.includes('required') ||
          lower.includes('upload') ||
          lower.includes('attach') ||
          lower.includes('schedule') ||
          lower.includes('blocked'))) ||
      errorCode.includes('PDF_REQUIRED') ||
      errorCode.includes('DOCUMENT_COMPLIANCE') ||
      errorCode.includes('POLICY_PDF')
    ) {
      return {
        title: 'Policy PDF Required',
        message:
          'Under insurance underwriting rules, a policy cannot be completed or issued without the official policy PDF schedule attached.',
        actionHint:
          'Please upload the signed policy schedule document in PDF format before proceeding.',
        dataPreserved: true,
        correlationId,
        statusCode: 400,
      };
    }

    // Renewal 45-day window restriction
    if (
      lower.includes('45 days') ||
      lower.includes('renewal restriction') ||
      errorCode === 'RENEWAL_RESTRICTION_45_DAYS'
    ) {
      return {
        title: 'Renewal Window Not Yet Open',
        message:
          'Policy renewals and renewal quotations are strictly permitted only within 45 days of policy expiration.',
        actionHint:
          'Please check back when the policy enters its 45-day renewal window. Current coverage remains active.',
        dataPreserved: true,
        correlationId,
        statusCode: 400,
      };
    }

    // Renewal reminder 90-day window restriction
    if (
      lower.includes('90 days') ||
      lower.includes('renewal reminder') ||
      errorCode === 'REMINDER_RESTRICTION_90_DAYS'
    ) {
      return {
        title: 'Reminder Not Yet Available',
        message:
          'Renewal reminders can only be sent within 90 days of policy expiration.',
        actionHint:
          'Reminder notifications will become available once the policy is 90 days away from expiry.',
        dataPreserved: true,
        correlationId,
        statusCode: 400,
      };
    }

    // Customer address & PIN code validation
    if (
      lower.includes('pincode') ||
      lower.includes('pin code') ||
      lower.includes('address')
    ) {
      return {
        title: 'Customer Address Incomplete',
        message:
          'Customer profile requires a full street address (at least 5 characters) and a valid 6-digit Indian postal PIN code.',
        actionHint:
          'Please verify the address and enter a valid 6-digit numeric PIN code.',
        dataPreserved: true,
        correlationId,
        statusCode: 400,
      };
    }

    // Generic validation error
    return {
      title: 'Invalid Details Provided',
      message:
        rawMsg ||
        'One or more fields do not meet validation criteria. Please review the highlighted inputs.',
      actionHint:
        'Please review the entered information, correct any invalid fields, and submit again.',
      dataPreserved: true,
      correlationId,
      statusCode: 400,
    };
  }

  // ── 3. HTTP 401 & 403 PERMISSIONS & AUTHENTICATION ──────────────────
  if (statusCode === 401) {
    return {
      title: 'Session Expired',
      message: 'Your active session has expired or authentication credentials are no longer valid.',
      actionHint: 'Please log in again to continue your work. Any saved draft forms remain intact.',
      dataPreserved: true,
      correlationId,
      statusCode: 401,
    };
  }

  if (statusCode === 403) {
    return {
      title: 'Access Restricted',
      message: 'You do not have administrative or role-based permission to perform this action.',
      actionHint: 'If you need access to this feature, please contact your company administrator.',
      dataPreserved: true,
      correlationId,
      statusCode: 403,
    };
  }

  // ── 4. HTTP 404 NOT FOUND ──────────────────────────────────────────
  if (statusCode === 404) {
    return {
      title: 'Record Not Found',
      message: 'The requested record or resource could not be found. It may have been archived or removed.',
      actionHint: 'Please verify the ID or reference number, or return to the main dashboard.',
      dataPreserved: true,
      correlationId,
      statusCode: 404,
    };
  }

  // ── 5. HTTP 429 RATE LIMIT ─────────────────────────────────────────
  if (statusCode === 429) {
    return {
      title: 'Too Many Requests',
      message: 'You have submitted multiple requests in a short period.',
      actionHint: 'Please wait a few seconds before trying again.',
      dataPreserved: true,
      correlationId,
      statusCode: 429,
    };
  }

  // ── 6. HTTP 500+ SERVER & BACKEND ERRORS ───────────────────────────
  if (statusCode && statusCode >= 500) {
    return {
      title: 'Service Temporarily Unavailable',
      message:
        rawMsg ||
        'The server encountered an internal issue while processing your submission. Your entered data has been preserved.',
      actionHint:
        'Please wait a moment and try again. If the issue persists, quote the Trace ID to IT support.',
      dataPreserved: true,
      correlationId,
      statusCode,
    };
  }

  // ── 7. NETWORK / OFFLINE ERRORS ────────────────────────────────────
  if (
    lower.includes('network') ||
    lower.includes('offline') ||
    lower.includes('econnrefused') ||
    (axios.isAxiosError(error) && !error.response)
  ) {
    return {
      title: 'Connection Issue',
      message:
        'Unable to connect to the CRM server. Your entered inputs have been retained.',
      actionHint:
        'Please check your network connection and retry. Your form data has not been lost.',
      dataPreserved: true,
      correlationId,
    };
  }

  // ── 7.5. POLICY PDF REQUIREMENT FALLBACK (IF STATUS NOT SET) ──────
  if (
    lower.includes('policy pdf') ||
    lower.includes('pdf document') ||
    (lower.includes('pdf') &&
      (lower.includes('mandatory') ||
        lower.includes('required') ||
        lower.includes('upload') ||
        lower.includes('attach') ||
        lower.includes('schedule') ||
        lower.includes('blocked'))) ||
    errorCode.includes('PDF_REQUIRED') ||
    errorCode.includes('DOCUMENT_COMPLIANCE') ||
    errorCode.includes('POLICY_PDF')
  ) {
    return {
      title: 'Policy PDF Required',
      message:
        'Under insurance underwriting rules, a policy cannot be completed or issued without the official policy PDF schedule attached.',
      actionHint:
        'Please upload the signed policy schedule document in PDF format before proceeding.',
      dataPreserved: true,
      correlationId,
      statusCode: statusCode || 400,
    };
  }

  // ── 8. FALLBACK ────────────────────────────────────────────────────
  return {
    title: 'Submission Issue',
    message: rawMsg || fallbackMessage,
    actionHint: '',
    dataPreserved: true,
    correlationId,
    statusCode,
  };
}
