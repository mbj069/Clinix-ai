import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';

export default function Dashboard() {
  const { user, can } = useAuth();
  const [patients, setPatients] = useState([]);
  const [todayAppts, setTodayAppts] = useState(null);
  const [openTasks, setOpenTasks] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    api('/patients')
      .then((d) => setPatients(d.patients))
      .catch(() => setPatients([]))
      .finally(() => setLoading(false));
    api(`/appointments?date=${today}`)
      .then((d) => setTodayAppts(d.appointments.length))
      .catch(() => setTodayAppts(null));
    api('/tasks?status=open')
      .then((d) => setOpenTasks(d.tasks.length))
      .catch(() => setOpenTasks(null));
  }, []);

  return (
    <div>
      <h2>Welcome, {user.name}</h2>
      <p className="muted">Signed in as <strong>{user.role}</strong>. Here's your overview.</p>

      <div className="cards">
        <div className="card">
          <div className="card-num">{loading ? '…' : patients.length}</div>
          <div className="card-label">Patients</div>
          <Link to="/patients" className="card-link">View all →</Link>
        </div>
        {can('schedule') && (
          <div className="card">
            <div className="card-num">{todayAppts === null ? '…' : todayAppts}</div>
            <div className="card-label">Appointments today</div>
            <Link to="/appointments" className="card-link">View schedule →</Link>
          </div>
        )}
        {can('manage_tasks') && (
          <div className="card">
            <div className="card-num">{openTasks === null ? '…' : openTasks}</div>
            <div className="card-label">Open nursing tasks</div>
            <Link to="/nursing" className="card-link">Open nursing →</Link>
          </div>
        )}
        <div className="card">
          <div className="card-num">✨</div>
          <div className="card-label">AI search</div>
          <Link to="/ai-search" className="card-link">Ask in plain language →</Link>
        </div>
        {can('view_audit_log') && (
          <div className="card">
            <div className="card-num">◈</div>
            <div className="card-label">Audit log</div>
            <Link to="/audit" className="card-link">Review activity →</Link>
          </div>
        )}
      </div>

      <h3>Patients</h3>
      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>DOB</th><th>Blood type</th><th></th></tr>
            </thead>
            <tbody>
              {patients.slice(0, 5).map((p) => (
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
      )}
    </div>
  );
}
