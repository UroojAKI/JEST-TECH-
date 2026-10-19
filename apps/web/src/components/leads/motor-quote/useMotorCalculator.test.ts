import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMotorCalculator } from './useMotorCalculator';
import { apiClient } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

describe('useMotorCalculator hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does NOT call API when policyType is STANDALONE_OD and active TP details are missing', async () => {
    const { result } = renderHook(() =>
      useMotorCalculator({
        vehicleCategory: 'PRIVATE_CAR',
        vehicleStatus: 'EXISTING',
        policyType: 'STANDALONE_OD',
        idv: 500000,
        // Missing activeTpPolicyNumber and activeTpExpiryDate
      })
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();

    // Wait to ensure debounced setTimeout would have run
    await new Promise((resolve) => setTimeout(resolve, 600));

    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('calls /motor/calculate when policyType is STANDALONE_OD and active TP details are provided', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        outputs: {
          baseOdPremium: 10000,
          finalPayableAmount: 11800,
        },
      },
    } as any);

    const { result } = renderHook(() =>
      useMotorCalculator({
        vehicleCategory: 'PRIVATE_CAR',
        vehicleStatus: 'EXISTING',
        policyType: 'STANDALONE_OD',
        idv: 500000,
        activeTpPolicyNumber: 'TP123456',
        activeTpExpiryDate: '2027-01-01',
      })
    );

    await waitFor(() => {
      expect(result.current.result).not.toBeNull();
    }, { timeout: 1500 });

    expect(apiClient.post).toHaveBeenCalledWith(
      '/motor/calculate',
      expect.objectContaining({
        policyType: 'STANDALONE_OD',
        activeTpPolicyNumber: 'TP123456',
        activeTpExpiryDate: '2027-01-01',
        idv: 500000,
      }),
      expect.anything()
    );
    expect(result.current.result.outputs.finalPayableAmount).toBe(11800);
  });
});
