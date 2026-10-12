import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';

export default function PatientList() {
  const [q, setQ] = useState('');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const { can } = useAuth();
  const fullAccess = can('view_patients');

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      const params = q ? `?q=${encodeURIComponent(q)}` : '';
      api(`/patients${params}`)
        .then((d) => setPatients(d.patients))
        .catch(() => setPatients([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div>
      <h2>Patients</h2>
      <input
        className="search"
        placeholder="Search by name, ID, or condition…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
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
              {patients.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className="mono">{p.id}</td>
                  <td>{p.dob}</td>
                  {fullAccess && <td>{p.conditions.join(', ') || '—'}</td>}
                  <td><Link to={`/patients/${p.id}`}>Open</Link></td>
                </tr>
              ))}
              {patients.length === 0 && (
                <tr><td colSpan={5} className="muted">No patients match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {!fullAccess && (
        <p className="muted">Your role shows basic demographics only. Sensitive clinical data is hidden.</p>
      )}
    </div>
  );
}
