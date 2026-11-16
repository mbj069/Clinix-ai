import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { getAIStatus, aiSummarize } from '../ai/aiClient';
import { useAI } from '../ai/useAI';

export default function PatientDetail() {
  const { id } = useParams();
  const { user, can } = useAuth();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editingVitals, setEditingVitals] = useState(false);
  const [vitalsDraft, setVitalsDraft] = useState({});
  const [note, setNote] = useState('');
  const [aiReady, setAiReady] = useState(false);
  const [history, setHistory] = useState({ appointments: [], consultations: [], prescriptions: [], labOrders: [], vitals: [] });
  const ai = useAI();

  const canViewSensitive = can('view_sensitive');
  const canEdit = can('edit_patients');
  const canEditVitals = can('edit_vitals') || canEdit;

  useEffect(() => {
    setLoading(true);
    api(`/patients/${id}`)
      .then((d) => {
        setPatient(d.patient);
        setVitalsDraft(d.patient.vitals || {});
      })
      .catch((e) => {
        if (e.status === 404) setNotFound(true);
      })
      .finally(() => setLoading(false));
    getAIStatus().then((s) => setAiReady(s.hasApiKey)).catch(() => setAiReady(false));
    Promise.all([
      api(`/appointments?patient=${id}`).catch(() => ({ appointments: [] })),
      api(`/patients/${id}/consultations`).catch(() => ({ consultations: [] })),
      api(`/patients/${id}/prescriptions`).catch(() => ({ prescriptions: [] })),
      api(`/patients/${id}/lab-orders`).catch(() => ({ labOrders: [] })),
      api(`/patients/${id}/vitals`).catch(() => ({ vitals: [] })),
    ])
      .then(([a, c, r, l, v]) => setHistory({
        appointments: a.appointments || [],
        consultations: c.consultations || [],
        prescriptions: r.prescriptions || [],
        labOrders: l.labOrders || [],
        vitals: v.vitals || [],
      }))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <p className="muted">Loading…</p>;
  if (notFound || !patient) {
    return (
      <div>
        <h2>Patient not found</h2>
        <Link to="/patients">← Back to patients</Link>
      </div>
    );
  }

  const saveVitals = async () => {
    try {
      const { patient: updated } = await api(`/patients/${id}/vitals`, {
        method: 'PATCH',
        body: vitalsDraft,
      });
      setPatient(updated);
      setEditingVitals(false);
    } catch (e) {
      alert(e.message);
    }
  };

  const addNote = async () => {
    if (!note.trim()) return;
    try {
      const { patient: updated } = await api(`/patients/${id}/notes`, {
        method: 'POST',
        body: { note: note.trim() },
      });
      setPatient(updated);
      setNote('');
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div>
      <Link to="/patients">← Back to patients</Link>
      <h2>{patient.name} <span className="mono muted">{patient.id}</span></h2>
      {canEdit && (
        <p><Link to={`/patients/${patient.id}/edit`} className="btn small">Edit patient</Link></p>
      )}

      <div className="grid2">
        <section className="panel">
          <h3>Demographics</h3>
          <dl>
            <dt>Date of birth</dt><dd>{patient.dob}</dd>
            <dt>Gender</dt><dd>{patient.gender}</dd>
            <dt>Phone</dt><dd>{patient.phone}</dd>
            <dt>Blood type</dt><dd>{patient.bloodType}</dd>
          </dl>
        </section>

        <section className="panel">
          <h3>Vitals {canEditVitals && !editingVitals && (
            <button className="btn small" onClick={() => setEditingVitals(true)}>Edit</button>
          )}</h3>
          {editingVitals ? (
            <div className="vitals-form">
              {['bp', 'hr', 'temp', 'spo2'].map((k) => (
                <label key={k}>{k.toUpperCase()}
                  <input value={vitalsDraft[k] ?? ''} onChange={(e) => setVitalsDraft({ ...vitalsDraft, [k]: e.target.value })} />
                </label>
              ))}
              <div>
                <button className="btn primary small" onClick={saveVitals}>Save</button>{' '}
                <button className="btn small" onClick={() => { setEditingVitals(false); setVitalsDraft(patient.vitals); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <dl>
              <dt>BP</dt><dd>{patient.vitals.bp}</dd>
              <dt>Heart rate</dt><dd>{patient.vitals.hr} bpm</dd>
              <dt>Temp</dt><dd>{patient.vitals.temp}</dd>
              <dt>SpO₂</dt><dd>{patient.vitals.spo2}</dd>
            </dl>
          )}
        </section>
      </div>

      {canViewSensitive ? (
        <section className="panel">
          <h3>Clinical information
            {aiReady && (
              <button
                className="btn small"
                disabled={ai.loading}
                onClick={() => ai.run(() => aiSummarize(patient.id))}
              >
                {ai.loading ? 'Summarizing…' : '✨ AI summary'}
              </button>
            )}
          </h3>
          {ai.error && <div className="error">{ai.error}</div>}
          {ai.result && (
            <div className="panel" style={{ background: 'var(--bg)' }}>
              <h4>AI clinical summary <span className="role-badge">AI draft — verify</span></h4>
              <p className="notes">{ai.result}</p>
            </div>
          )}
          <dl>
            <dt>Allergies</dt><dd>{patient.allergies.join(', ') || 'None known'}</dd>
            <dt>Conditions</dt><dd>{patient.conditions.join(', ') || '—'}</dd>
            <dt>SSN</dt><dd className="mono">{patient.ssn}</dd>
          </dl>
          <h4>Medications</h4>
          {patient.medications.length === 0 ? <p className="muted">No active medications.</p> : (
            <ul>{patient.medications.map((m, i) => (
              <li key={i}><strong>{m.name}</strong> — {m.dosage}, {m.frequency}</li>
            ))}</ul>
          )}
          <h4>Notes</h4>
          <p className="notes">{patient.notes}</p>
          {canEdit && (
            <div className="note-add">
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a clinical note…" rows={2} />
              <button className="btn primary small" onClick={addNote}>Add note</button>
            </div>
          )}
        </section>
      ) : (
        <section className="panel restricted">
          <h3>Clinical information</h3>
          <p>🔒 Restricted — your role (<strong>{user.role}</strong>) does not have permission to view sensitive clinical data. This access attempt has been logged.</p>
        </section>
      )}

      <div className="grid2">
        <section className="panel">
          <h3>Appointments</h3>
          {history.appointments.length === 0 ? <p className="muted">No appointments.</p> : (
            <ul>{history.appointments.map((a) => (
              <li key={a.id}>{a.date} · {a.time} — {a.reason || 'Visit'} ({a.doctorName || '—'}) <span className={`chip ${a.status}`}>{a.status.replace('_', ' ')}</span></li>
            ))}</ul>
          )}
        </section>

        <section className="panel">
          <h3>Consultations</h3>
          {history.consultations.length === 0 ? <p className="muted">No consultations yet.</p> : (
            <ul>{history.consultations.map((c) => (
              <li key={c.id}><strong>{c.date}</strong> — {c.diagnosis}<br /><span className="muted">{c.plan}</span> <span className="muted">({c.doctorName})</span></li>
            ))}</ul>
          )}
        </section>

        <section className="panel">
          <h3>Prescriptions</h3>
          {history.prescriptions.length === 0 ? <p className="muted">No prescriptions.</p> : (
            <ul>{history.prescriptions.map((p) => (
              <li key={p.id}><strong>{p.medication}</strong> {p.dosage}, {p.frequency} <span className={`chip ${p.status}`}>{p.status}</span></li>
            ))}</ul>
          )}
        </section>

        <section className="panel">
          <h3>Lab orders</h3>
          {history.labOrders.length === 0 ? <p className="muted">No lab orders.</p> : (
            <ul>{history.labOrders.map((l) => (
              <li key={l.id}><strong>{l.testName}</strong> <span className={`chip ${l.status}`}>{l.status}</span></li>
            ))}</ul>
          )}
        </section>
      </div>

      <section className="panel">
        <h3>Vitals history</h3>
        {history.vitals.length === 0 ? <p className="muted">No recorded vitals yet.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Recorded</th><th>BP</th><th>HR</th><th>Temp</th><th>SpO₂</th><th>By</th></tr></thead>
              <tbody>
                {history.vitals.map((v) => (
                  <tr key={v.id}>
                    <td>{new Date(v.recordedAt).toLocaleString()}</td>
                    <td>{v.bp || '—'}</td>
                    <td>{v.hr || '—'}</td>
                    <td>{v.temp || '—'}</td>
                    <td>{v.spo2 || '—'}</td>
                    <td>{v.recordedByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
