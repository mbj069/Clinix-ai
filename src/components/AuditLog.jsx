import { useState, useEffect, useCallback } from 'react';
import { getAuditLog } from '../utils/auditLogger';

const ACTION_LABEL = {
  LOGIN: 'Sign in',
  LOGOUT: 'Sign out',
  VIEW_PATIENT_RECORD: 'Viewed patient record',
  UPDATE_VITALS: 'Updated vitals',
  ADD_CLINICAL_NOTE: 'Added clinical note',
  AI_SUMMARY: 'AI summary',
  AI_SCRIBE: 'AI scribe draft',
  AI_SEARCH: 'AI search',
  SCRIBE_SAVED: 'Approved AI draft',
  AI_CONFIG_UPDATE: 'AI config updated',
  AI_CONFIG_TEST: 'AI config tested',
};

export default function AuditLog() {
  const [entries, setEntries] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    getAuditLog({ limit: 200 })
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = entries.filter((e) =>
    !filter ||
    e.actor_name.toLowerCase().includes(filter.toLowerCase()) ||
    (e.patient_id || '').toLowerCase().includes(filter.toLowerCase()) ||
    e.action.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div>
      <h2>Audit log</h2>
      <p className="muted">Server-side, append-only. Every access to sensitive health data is recorded.</p>
      <div className="audit-bar">
        <input className="search" placeholder="Filter by user, patient ID, or action…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <button className="btn small" onClick={refresh}>Refresh</button>
      </div>
      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Time</th><th>Actor</th><th>Role</th><th>Action</th><th>Patient</th><th>Details</th></tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td className="mono small">{new Date(e.timestamp + 'Z').toLocaleString()}</td>
                  <td>{e.actor_name}</td>
                  <td><span className="role-badge">{e.role}</span></td>
                  <td>{ACTION_LABEL[e.action] || e.action}</td>
                  <td className="mono">{e.patient_id || '—'}</td>
                  <td className="muted">{e.details}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="muted">No audit entries yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
