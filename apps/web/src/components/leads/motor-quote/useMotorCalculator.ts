import { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api-client';

export function useMotorCalculator(inputData: any) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

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

    const currentRequestId = ++requestIdRef.current;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setError(null);

    const calculate = async () => {
      try {
        // Sanitize payload: strip any legacy editedOdRate to ensure OD-rate validation is never triggered
        const { editedOdRate: _discarded, ...sanitizedInput } = inputData;
        const response = await apiClient.post('/motor/calculate', sanitizedInput, {
          signal: abortController.signal,
        });

        if (currentRequestId === requestIdRef.current) {
          setResult(response.data);
          setError(null);
          setLoading(false);
        }
      } catch (err: any) {
        if (err.name !== 'CanceledError' && err.message !== 'canceled') {
          if (currentRequestId === requestIdRef.current) {
            setResult(null);
            setError(err.response?.data?.message || 'Failed to calculate premium');
            setLoading(false);
          }
        }
      }
    };

    const timeoutId = setTimeout(calculate, 400);

    return () => {
      abortController.abort();
      clearTimeout(timeoutId);
    };
  }, [JSON.stringify(inputData)]); // Serialize to deep compare

  return { loading, result, error };
}
