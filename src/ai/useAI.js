import { useState, useCallback } from 'react';
import { AIError } from './aiClient';

/**
 * useAI() — runs an async AI task with loading/error/result state.
 * Usage: const { run, loading, error, result, reset } = useAI();
 *        const summary = await run(() => aiSummarize(patientId));
 */
export function useAI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const run = useCallback(async (fn) => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const out = await fn();
      setResult(out);
      return out;
    } catch (e) {
      const msg = e instanceof AIError ? e.message : 'Unexpected AI error. Please try again.';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError('');
  }, []);

  return { run, loading, error, result, reset };
}
