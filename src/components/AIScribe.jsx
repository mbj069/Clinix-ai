import { useState } from 'react';
import { Link } from 'react-router-dom';
import { isConfigured } from '../ai/providers/openaiCompatible';
import { scribeNotes } from '../ai/aiService';
import { useAI } from '../ai/useAI';
import { PATIENTS } from '../data/mockData';
import { logAudit } from '../utils/auditLogger';
import { useAuth } from '../context/AuthContext';

export default function AIScribe() {
  const { user } = useAuth();
  const [patientId, setPatientId] = useState(PATIENTS[0].id);
  const [rough, setRough] = useState('');
  const { run, loading, error, result, reset } = useAI();
  const [saved, setSaved] = useState(false);
  const configured = isConfigured();
  const patient = PATIENTS.find((p) => p.id === patientId);

  const generate = () => {
    if (!rough.trim() || loading) return;
    setSaved(false);
    reset();
    run(() => scribeNotes({ user, patient, roughNotes: rough.trim() }));
  };

  const saveToRecord = () => {
    if (!result) return;
    logAudit({
      actorId: user.id, actorName: user.name, role: user.role,
      action: 'SCRIBE_SAVED', patientId: patient.id,
      details: `Clinician approved and saved AI SOAP draft for ${patient.name} (${patient.id})`,
    });
    setSaved(true);
  };

  return (
    <div>
      <h2>AI scribe</h2>
      <p className="muted">
        Dictate or type rough notes — the AI drafts a SOAP note. <strong>You review and approve</strong> before
        anything touches the record.
      </p>

      {!configured && (
        <div className="panel restricted">
          <strong>No AI provider configured.</strong>
          <p className="muted">An administrator needs to add an API key in <Link to="/settings/ai">Settings → AI</Link> first.</p>
        </div>
      )}

      <div className="panel" style={{ maxWidth: 720 }}>
        <label>Patient
          <select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            {PATIENTS.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
            ))}
          </select>
        </label>
        <label>Rough notes
          <textarea
            rows={5}
            value={rough}
            onChange={(e) => setRough(e.target.value)}
            placeholder="pt reports headache x3d, worse in mornings, took sumatriptan yesterday helped a bit, bp 118/76 in office…"
            disabled={!configured}
          />
        </label>
        <button className="btn primary" onClick={generate} disabled={loading || !configured || !rough.trim()}>
          {loading ? 'Drafting…' : 'Generate SOAP draft'}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {result && (
        <div className="panel" style={{ maxWidth: 720 }}>
          <h3>Draft SOAP note <span className="role-badge">AI draft — review required</span></h3>
          <p className="notes">{result}</p>
          {!saved ? (
            <button className="btn primary small" onClick={saveToRecord}>Approve & save to record</button>
          ) : (
            <p><strong>✓ Approved and logged.</strong> <Link to={`/patients/${patient.id}`}>View patient record →</Link></p>
          )}
        </div>
      )}
    </div>
  );
}
