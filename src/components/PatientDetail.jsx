import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PATIENTS } from '../data/mockData';
import { logAudit } from '../utils/auditLogger';
import { isConfigured } from '../ai/providers/openaiCompatible';
import { summarizePatient } from '../ai/aiService';
import { useAI } from '../ai/useAI';

export default function PatientDetail() {
  const { id } = useParams();
  const { user, can } = useAuth();
  const [patient, setPatient] = useState(() => PATIENTS.find((p) => p.id === id));
  const [editingVitals, setEditingVitals] = useState(false);
  const [vitalsDraft, setVitalsDraft] = useState(patient?.vitals || {});
  const [note, setNote] = useState('');

  const canViewSensitive = can('view_sensitive');
  const canEdit = can('edit_patients');
  const canEditVitals = can('edit_vitals') || canEdit;
  const ai = useAI();
  const aiConfigured = isConfigured();

  useEffect(() => {
    if (patient) {
      logAudit({
        actorId: user.id, actorName: user.name, role: user.role,
        action: 'VIEW_PATIENT_RECORD', patientId: patient.id,
        details: `Viewed full record of ${patient.name} (${patient.id})${canViewSensitive ? '' : ' (sensitive fields redacted)'}`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!patient) {
    return (
      <div>
        <h2>Patient not found</h2>
        <Link to="/patients">← Back to patients</Link>
      </div>
    );
  }

  const saveVitals = () => {
    setPatient({ ...patient, vitals: vitalsDraft });
    setEditingVitals(false);
    logAudit({
      actorId: user.id, actorName: user.name, role: user.role,
      action: 'UPDATE_VITALS', patientId: patient.id,
      details: `Updated vitals for ${patient.name}: BP ${vitalsDraft.bp}, HR ${vitalsDraft.hr}`,
    });
  };

  const addNote = () => {
    if (!note.trim()) return;
    setPatient({ ...patient, notes: `${patient.notes}\n[${new Date().toLocaleDateString()}] ${note.trim()}` });
    logAudit({
      actorId: user.id, actorName: user.name, role: user.role,
      action: 'ADD_CLINICAL_NOTE', patientId: patient.id,
      details: `Added clinical note for ${patient.name}`,
    });
    setNote('');
  };

  return (
    <div>
      <Link to="/patients">← Back to patients</Link>
      <h2>{patient.name} <span className="mono muted">{patient.id}</span></h2>

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
        <>
          <section className="panel">
            <h3>Clinical information
              {aiConfigured && (
                <button
                  className="btn small"
                  disabled={ai.loading}
                  onClick={() => ai.run(({ user, can }) => summarizePatient({ user, can, patient }))}
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
        </>
      ) : (
        <section className="panel restricted">
          <h3>Clinical information</h3>
          <p>🔒 Restricted — your role (<strong>{user.role}</strong>) does not have permission to view sensitive clinical data. This access attempt has been logged.</p>
        </section>
      )}
    </div>
  );
}
