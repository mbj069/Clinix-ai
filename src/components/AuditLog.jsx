import { useState } from 'react';
import { getAuditLog, clearAuditLog } from '../utils/auditLogger';
import { useAuth } from '../context/AuthContext';
import { logAudit } from '../utils/auditLogger';

const ACTION_LABEL = {
  LOGIN: 'Sign in',
  LOGOUT: 'Sign out',
  VIEW_PATIENT_LIST_ITEM: 'Opened patient from list',
  VIEW_PATIENT_RECORD: 'Viewed patient record',
  UPDATE_VITALS: 'Updated vitals',
  ADD_CLINICAL_NOTE: 'Added clinical note',
};

export default function AuditLog() {
  const [entries, setEntries] = useState(() => getAuditLog());
  const [filter, setFilter] = useState('');
  const { user } = useAuth();

  const refresh = () => setEntries(getAuditLog());

  const clear = () => {
    if (!window.confirm('Clear the audit log? This is only possible in the prototype.')) return;
    logAudit({ actorId: user.id, actorName: user.name, role: user.role, action: 'CLEAR_AUDIT_LOG', details: 'Admin cleared the audit log' });
    clearAuditLog();
    setEntries([]);
  };

  const filtered = entries.filter((e) =>
    !filter ||
    e.actorName.toLowerCase().includes(filter.toLowerCase()) ||
    (e.patientId || '').toLowerCase().includes(filter.toLowerCase()) ||
    e.action.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div>
      <h2>Audit log</h2>
      <p className="muted">Every access to sensitive health data is recorded. Prototype stores entries locally.</p>
      <div className="audit-bar">
        <input className="search" placeholder="Filter by user, patient ID, or action…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <button className="btn small" onClick={refresh}>Refresh</button>
        <button className="btn small danger" onClick={clear}>Clear log</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Time</th><th>Actor</th><th>Role</th><th>Action</th><th>Patient</th><th>Details</th></tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id}>
                <td className="mono small">{new Date(e.timestamp).toLocaleString()}</td>
                <td>{e.actorName}</td>
                <td><span className="role-badge">{e.role}</span></td>
                <td>{ACTION_LABEL[e.action] || e.action}</td>
                <td className="mono">{e.patientId || '—'}</td>
                <td className="muted">{e.details}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="muted">No audit entries yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
