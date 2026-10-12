import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAIStatus, aiScribe } from '../ai/aiClient';
import { useAI } from '../ai/useAI';
import { api } from '../utils/api';

export default function AIScribe() {
  const [patients, setPatients] = useState([]);
  const [patientId, setPatientId] = useState('');
  const [rough, setRough] = useState('');
  const [configured, setConfigured] = useState(null);
  const { run, loading, error, result, reset } = useAI();
  const [saved, setSaved] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    api('/patients').then((d) => {
      setPatients(d.patients);
      if (d.patients.length) setPatientId(d.patients[0].id);
    }).catch(() => {});
    getAIStatus().then((s) => setConfigured(s.hasApiKey)).catch(() => setConfigured(false));
  }, []);

  const patient = patients.find((p) => p.id === patientId);

  const generate = () => {
    if (!rough.trim() || loading) return;
    setSaved(false);
    setSaveMsg('');
    reset();
    run(() => aiScribe(patientId, rough.trim()));
  };

  const saveToRecord = async () => {
    if (!result) return;
    try {
      await api(`/patients/${patientId}/notes`, {
        method: 'POST',
        body: { note: `[AI-assisted draft, clinician-approved]\n${result}` },
      });
      setSaved(true);
      setSaveMsg('Approved draft saved to the patient record and audit-logged.');
    } catch (e) {
      setSaveMsg(e.message);
    }
  };

  return (
    <div>
      <h2>AI scribe</h2>
      <p className="muted">
        Dictate or type rough notes — the AI drafts a SOAP note. <strong>You review and approve</strong> before
        anything touches the record.
      </p>

      {configured === false && (
        <div className="panel restricted">
          <strong>No AI provider configured.</strong>
          <p className="muted">An administrator needs to add an API key in <Link to="/settings/ai">Settings → AI</Link> first.</p>
        </div>
      )}

      <div className="panel" style={{ maxWidth: 720 }}>
        <label>Patient
          <select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            {patients.map((p) => (
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
            <p><strong>✓ {saveMsg || 'Saved.'}</strong> <Link to={`/patients/${patientId}`}>View patient record →</Link></p>
          )}
          {saveMsg && !saved && <p className="error">{saveMsg}</p>}
        </div>
      )}
    </div>
  );
}
