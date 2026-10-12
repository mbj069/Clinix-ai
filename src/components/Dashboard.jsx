import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PATIENTS } from '../data/mockData';

export default function Dashboard() {
  const { user, can } = useAuth();
  const recent = PATIENTS.slice(0, 3);

  return (
    <div>
      <h2>Welcome, {user.name}</h2>
      <p className="muted">Signed in as <strong>{user.role}</strong>. Here's your overview.</p>

      <div className="cards">
        <div className="card">
          <div className="card-num">{PATIENTS.length}</div>
          <div className="card-label">Patients</div>
          <Link to="/patients" className="card-link">View all →</Link>
        </div>
        {can('view_audit_log') && (
          <div className="card">
            <div className="card-num">◈</div>
            <div className="card-label">Audit log</div>
            <Link to="/audit" className="card-link">Review activity →</Link>
          </div>
        )}
        {can('manage_users') && (
          <div className="card">
            <div className="card-num">⚙</div>
            <div className="card-label">Administration</div>
            <span className="muted">User management (prototype)</span>
          </div>
        )}
      </div>

      <h3>Recently accessed patients</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Name</th><th>DOB</th><th>Blood type</th><th></th></tr>
          </thead>
          <tbody>
            {recent.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.dob}</td>
                <td>{p.bloodType}</td>
                <td><Link to={`/patients/${p.id}`}>Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
