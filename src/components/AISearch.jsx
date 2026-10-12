import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAIStatus, aiSearch } from '../ai/aiClient';
import { useAI } from '../ai/useAI';

export default function AISearch() {
  const [question, setQuestion] = useState('');
  const [configured, setConfigured] = useState(null);
  const { run, loading, error, result, reset } = useAI();

  useEffect(() => {
    getAIStatus().then((s) => setConfigured(s.hasApiKey)).catch(() => setConfigured(false));
  }, []);

  const ask = () => {
    if (!question.trim() || loading) return;
    reset();
    run(() => aiSearch(question.trim()));
  };

  return (
    <div>
      <h2>AI patient search</h2>
      <p className="muted">
        Ask about patients in plain language. The AI searches the roster on the server and only sees
        what your role is allowed to see.
      </p>

      {configured === false && (
        <div className="panel restricted">
          <strong>No AI provider configured.</strong>
          <p className="muted">An administrator needs to add an API key in <Link to="/settings/ai">Settings → AI</Link> first.</p>
        </div>
      )}

      <div className="audit-bar">
        <input
          className="search"
          placeholder='e.g. "show me diabetic patients" or "who takes metformin?"'
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask()}
          disabled={!configured}
        />
        <button className="btn primary" onClick={ask} disabled={loading || !configured}>
          {loading ? 'Searching…' : 'Ask'}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {result && (
        <div className="panel">
          <h3>Answer</h3>
          <p className="notes">{result}</p>
          <p className="muted small">Assistive result — verify against the record. This query was audit-logged.</p>
        </div>
      )}

      <div className="panel">
        <h3>Try</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['Show me diabetic patients', 'Who takes atorvastatin?', 'Patients with asthma'].map((ex) => (
            <button key={ex} className="btn small" onClick={() => setQuestion(ex)} disabled={!configured}>
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
