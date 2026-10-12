import { useState } from 'react';
import { isConfigured } from '../ai/providers/openaiCompatible';
import { aiSearch } from '../ai/aiService';
import { useAI } from '../ai/useAI';
import { Link } from 'react-router-dom';

export default function AISearch() {
  const [question, setQuestion] = useState('');
  const { run, loading, error, result, reset } = useAI();
  const configured = isConfigured();

  const ask = () => {
    if (!question.trim() || loading) return;
    reset();
    run(({ user, can }) => aiSearch({ user, can, question: question.trim() }));
  };

  return (
    <div>
      <h2>AI patient search</h2>
      <p className="muted">
        Ask about patients in plain language. The AI searches the roster with tools and only sees
        what your role is allowed to see.
      </p>

      {!configured && (
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
            <button key={ex} className="btn small" onClick={() => { setQuestion(ex); }} disabled={!configured}>
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
