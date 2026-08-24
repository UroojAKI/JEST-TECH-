import { useState, useEffect, useRef } from 'react';
import apiClient from '@/lib/api-client';

export function useMotorCalculator(inputData: any) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Basic validation to avoid empty calls
    if (!inputData.vehicleCategory || !inputData.policyType || !inputData.vehicleStatus) {
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const calculate = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.post('/motor/calculate', inputData, {
          signal: abortController.signal
        });
        setResult(response.data);
      } catch (err: any) {
        if (err.name !== 'CanceledError' && err.message !== 'canceled') {
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
