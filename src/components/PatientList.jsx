import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PATIENTS } from '../data/mockData';
import { logAudit } from '../utils/auditLogger';

export default function PatientList() {
  const [q, setQ] = useState('');
  const { user, can } = useAuth();
  const fullAccess = can('view_patients');

  const results = PATIENTS.filter((p) =>
    p.name.toLowerCase().includes(q.toLowerCase()) || p.id.includes(q)
  );

  const openRecord = (p) => {
    logAudit({
      actorId: user.id, actorName: user.name, role: user.role,
      action: 'VIEW_PATIENT_LIST_ITEM', patientId: p.id,
      details: `Opened patient ${p.name} (${p.id}) from list`,
    });
  };

  return (
    <div>
      <h2>Patients</h2>
      <input
        className="search"
        placeholder="Search by name or ID…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th><th>ID</th><th>DOB</th>
              {fullAccess && <th>Conditions</th>}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {results.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td className="mono">{p.id}</td>
                <td>{p.dob}</td>
                {fullAccess && <td>{p.conditions.join(', ') || '—'}</td>}
                <td><Link to={`/patients/${p.id}`} onClick={() => openRecord(p)}>Open</Link></td>
              </tr>
            ))}
            {results.length === 0 && (
              <tr><td colSpan={5} className="muted">No patients match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {!fullAccess && (
        <p className="muted">Your role shows basic demographics only. Sensitive clinical data is hidden.</p>
      )}
    </div>
  );
}
