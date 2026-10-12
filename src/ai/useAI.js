import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { AIError } from './aiService';

/**
 * useAI(feature) — runs an AI feature with loading/error state.
 * Usage: const { run, loading, error, result, reset } = useAI('SUMMARY');
 *        const summary = await run((ctx) => summarizePatient({ user: ctx.user, can: ctx.can, patient }));
 */
export function useAI() {
  const { user, can } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const run = useCallback(
    async (fn) => {
      setLoading(true);
      setError('');
      setResult(null);
      try {
        const out = await fn({ user, can });
        setResult(out);
        return out;
      } catch (e) {
        const msg = e instanceof AIError ? e.message : 'Unexpected AI error. Please try again.';
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, can]
  );

  const reset = useCallback(() => {
    setResult(null);
    setError('');
  }, []);

  return { run, loading, error, result, reset };
}
