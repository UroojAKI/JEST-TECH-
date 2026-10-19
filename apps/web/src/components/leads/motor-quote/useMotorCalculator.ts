import { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api-client';

export function useMotorCalculator(inputData: any) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Basic validation to avoid empty calls
    if (!inputData.vehicleCategory || !inputData.policyType || !inputData.vehicleStatus) {
      setResult(null);
      setError(null);
      setLoading(false);
      return;
    }

    if (['STANDALONE_OD', 'PACKAGE_COMPREHENSIVE'].includes(inputData.policyType)) {
      if (!inputData.idv || inputData.idv <= 0) {
        setResult(null);
        setError(null);
        setLoading(false);
        return;
      }
    }

    if (inputData.policyType === 'STANDALONE_OD') {
      if (!inputData.activeTpPolicyNumber || !inputData.activeTpExpiryDate) {
        setResult(null);
        setError(null);
        setLoading(false);
        return;
      }
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    // Never leave a prior vehicle's premium visible while recalculating the current input.
    setResult(null);
    setError(null);
    setLoading(true);

    const calculate = async () => {
      setLoading(true);
      setError(null);
      try {
        // Sanitize payload: strip any legacy editedOdRate to ensure OD-rate validation is never triggered
        const { editedOdRate: _discarded, ...sanitizedInput } = inputData;
        const response = await apiClient.post('/motor/calculate', sanitizedInput, {
          signal: abortController.signal
        });
        setResult(response.data);
      } catch (err: any) {
        if (err.name !== 'CanceledError' && err.message !== 'canceled') {
          setResult(null);
          setError(err.response?.data?.message || 'Failed to calculate premium');
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    const timeoutId = setTimeout(calculate, 500);

    return () => {
      abortController.abort();
      clearTimeout(timeoutId);
    };
  }, [JSON.stringify(inputData)]); // Serialize to deep compare

  return { loading, result, error };
}
