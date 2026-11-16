import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';

const today = () => new Date().toISOString().slice(0, 10);

export default function Reception() {
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState({ patients: 0, today: 0, checkedIn: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api(`/appointments?date=${today()}`),
      api('/patients'),
    ])
      .then(([a, p]) => {
        setQueue(a.appointments);
        setStats({
          patients: p.patients.length,
          today: a.appointments.length,
          checkedIn: a.appointments.filter((x) => x.status === 'checked_in').length,
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const checkIn = async (appt) => {
    try {
      await api(`/appointments/${appt.id}`, { method: 'PATCH', body: { status: 'checked_in' } });
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const complete = async (appt) => {
    try {
      await api(`/appointments/${appt.id}`, { method: 'PATCH', body: { status: 'completed' } });
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div>
      <h2>Reception</h2>
      <p className="muted">Today's front desk — check patients in and keep the queue moving.</p>

      <div className="cards">
        <div className="card">
          <div className="card-num">{stats.today}</div>
          <div className="card-label">Appointments today</div>
          <Link to="/appointments" className="card-link">View all →</Link>
        </div>
        <div className="card">
          <div className="card-num">{stats.checkedIn}</div>
          <div className="card-label">Checked in</div>
        </div>
        <div className="card">
          <div className="card-num">{stats.patients}</div>
          <div className="card-label">Registered patients</div>
          <Link to="/patients" className="card-link">View patients →</Link>
        </div>
      </div>

      <div className="panel">
        <h3>Quick actions</h3>
        <Link to="/patients/new" className="btn primary">Register new patient</Link>{' '}
        <Link to="/appointments" className="btn">Book appointment</Link>
      </div>

      {error && <div className="error">{error}</div>}
      <h3>Today's queue</h3>
      {loading ? <p className="muted">Loading…</p> : queue.length === 0 ? (
        <p className="muted">No appointments scheduled for today.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Time</th><th>Patient</th><th>Doctor</th><th>Reason</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {queue.map((a) => (
                <tr key={a.id}>
                  <td>{a.time}</td>
                  <td><Link to={`/patients/${a.patientId}`}>{a.patientName || a.patientId}</Link></td>
                  <td>{a.doctorName || '—'}</td>
                  <td>{a.reason || '—'}</td>
                  <td><span className={`chip ${a.status}`}>{a.status.replace('_', ' ')}</span></td>
                  <td className="row-actions">
                    {a.status === 'scheduled' && (
                      <button className="btn small primary" onClick={() => checkIn(a)}>Check in</button>
                    )}
                    {a.status === 'checked_in' && (
                      <button className="btn small" onClick={() => complete(a)}>Complete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
