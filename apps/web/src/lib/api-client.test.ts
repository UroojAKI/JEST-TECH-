import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getApiCorrelationId,
  getApiErrorMessage,
  showApiErrorToast,
} from './api-client';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('api-client traceability helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getApiCorrelationId', () => {
    it('extracts requestId from response envelope meta', () => {
      const error: any = {
        isAxiosError: true,
        response: {
          data: {
            meta: {
              requestId: 'corr-12345-abc',
            },
          },
        },
      };
      expect(getApiCorrelationId(error)).toBe('corr-12345-abc');
    });

    it('extracts correlation ID from response headers', () => {
      const error: any = {
        isAxiosError: true,
        response: {
          headers: {
            'x-correlation-id': '018f3a5e-7b2c-7a91-8d4e-123456789abc',
          },
        },
      };
      expect(getApiCorrelationId(error)).toBe(
        '018f3a5e-7b2c-7a91-8d4e-123456789abc'
      );
    });

    it('extracts correlation ID from request config headers', () => {
      const error: any = {
        isAxiosError: true,
        config: {
          headers: {
            'X-Correlation-ID': 'req-conf-999',
          },
        },
      };
      expect(getApiCorrelationId(error)).toBe('req-conf-999');
    });

    it('returns null for non-axios errors without requestId', () => {
      expect(getApiCorrelationId(new Error('Network error'))).toBeNull();
      expect(getApiCorrelationId(null)).toBeNull();
    });
  });

  describe('getApiErrorMessage', () => {
    it('extracts message from error.response.data.error.message', () => {
      const error: any = {
        isAxiosError: true,
        response: {
          data: {
            error: {
              message: 'Invalid policy status',
            },
          },
        },
      };
      expect(getApiErrorMessage(error)).toBe('Invalid policy status');
    });

    it('joins array error messages', () => {
      const error: any = {
        isAxiosError: true,
        response: {
          data: {
            error: {
              message: ['Field A is required', 'Field B must be positive'],
            },
          },
        },
      };
      expect(getApiErrorMessage(error)).toBe(
        'Field A is required | Field B must be positive'
      );
    });

    it('extracts message from root data.message', () => {
      const error: any = {
        isAxiosError: true,
        response: {
          data: {
            message: 'Unauthorized access',
          },
        },
      };
      expect(getApiErrorMessage(error)).toBe('Unauthorized access');
    });

    it('falls back to custom message when no message is found', () => {
      expect(getApiErrorMessage({}, 'Custom fallback')).toBe('Custom fallback');
    });
  });

  describe('showApiErrorToast', () => {
    it('renders toast with trace ID and action when correlation ID is present', () => {
      const error: any = {
        isAxiosError: true,
        response: {
          data: {
            error: { message: 'Database transaction aborted' },
            meta: { requestId: '019a-corr-id' },
          },
        },
      };

      showApiErrorToast(error);

      expect(toast.error).toHaveBeenCalledWith(
        'Database transaction aborted',
        expect.objectContaining({
          description: 'Trace ID: 019a-corr-id',
          action: expect.objectContaining({
            label: 'Copy Trace ID',
            onClick: expect.any(Function),
          }),
        })
      );
    });

    it('renders simple toast when no correlation ID is found', () => {
      showApiErrorToast(new Error('Simple failure'));

      expect(toast.error).toHaveBeenCalledWith('Simple failure');
    });
  });
});
