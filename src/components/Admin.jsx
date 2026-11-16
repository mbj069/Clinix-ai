import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { DAYS } from '../utils/schedule';

const ROLES = ['admin', 'doctor', 'nurse', 'receptionist'];

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [patientCount, setPatientCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ username: '', password: '', name: '', role: 'nurse' });
  const [doctors, setDoctors] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [schedForm, setSchedForm] = useState({ doctorId: '', dayOfWeek: '1', startTime: '09:00', endTime: '13:00' });

  useEffect(() => {
    Promise.all([api('/users'), api('/patients'), api('/users/doctors'), api('/schedules')])
      .then(([u, p, d, s]) => {
        setUsers(u.users);
        setPatientCount(p.patients.length);
        setDoctors(d.doctors);
        setSchedules(s.schedules);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const createUser = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const { user } = await api('/users', { method: 'POST', body: form });
      setUsers((list) => [...list, user].sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name)));
      setForm({ username: '', password: '', name: '', role: 'nurse' });
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleActive = async (u) => {
    try {
      const { user } = await api(`/users/${u.id}`, { method: 'PATCH', body: { active: !u.active } });
      setUsers((list) => list.map((x) => (x.id === u.id ? user : x)));
    } catch (err) {
      alert(err.message);
    }
  };

  const saveSchedule = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const { schedules: updated } = await api('/schedules', {
        method: 'POST',
        body: { ...schedForm, dayOfWeek: Number(schedForm.dayOfWeek) },
      });
      setSchedules(updated);
    } catch (err) {
      setError(err.message);
    }
  };

  const removeSchedule = async (s) => {
    try {
      await api(`/schedules/${s.id}`, { method: 'DELETE' });
      setSchedules((list) => list.filter((x) => x.id !== s.id));
    } catch (err) {
      alert(err.message);
    }
  };

  const byRole = (role) => users.filter((u) => u.role === role).length;

  return (
    <div>
      <h2>Admin</h2>
      <p className="muted">Staff accounts, roles and the system at a glance.</p>
      {error && <div className="error">{error}</div>}

      <div className="cards">
        <div className="card">
          <div className="card-num">{users.length}</div>
          <div className="card-label">Staff accounts</div>
        </div>
        <div className="card">
          <div className="card-num">{patientCount}</div>
          <div className="card-label">Patients</div>
        </div>
        <div className="card">
          <div className="card-num">{byRole('doctor')}</div>
          <div className="card-label">Doctors</div>
        </div>
        <div className="card">
          <div className="card-num">{byRole('nurse')}</div>
          <div className="card-label">Nurses</div>
        </div>
      </div>

      <section className="panel">
        <h3>Add staff account</h3>
        <form onSubmit={createUser}>
          <div className="form-grid">
            <label>Username
              <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
            </label>
            <label>Full name
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label>Password
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
            </label>
            <label>Role
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
          </div>
          <button type="submit" className="btn primary">Create account</button>
        </form>
      </section>

      <h3>Staff</h3>
      {loading ? <p className="muted">Loading…</p> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td className="mono">{u.username}</td>
                  <td><span className="role-badge">{u.role}</span></td>
                  <td>{u.active === 0 ? <span className="chip cancelled">deactivated</span> : <span className="chip active">active</span>}</td>
                  <td>
                    <button className="btn small" onClick={() => toggleActive(u)}>
                      {u.active === 0 ? 'Activate' : 'Deactivate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="panel">
        <h3>Doctor sitting hours</h3>
        <p className="muted">Set each doctor's weekly hours. The dashboard and reception show who's sitting when, and booking warns about slots outside sitting hours.</p>
        <form onSubmit={saveSchedule}>
          <div className="form-grid">
            <label>Doctor
              <select value={schedForm.doctorId} onChange={(e) => setSchedForm({ ...schedForm, doctorId: e.target.value })} required>
                <option value="">Select doctor…</option>
                {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
            <label>Day
              <select value={schedForm.dayOfWeek} onChange={(e) => setSchedForm({ ...schedForm, dayOfWeek: e.target.value })}>
                {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
            </label>
            <label>Starts
              <input type="time" value={schedForm.startTime} onChange={(e) => setSchedForm({ ...schedForm, startTime: e.target.value })} required />
            </label>
            <label>Ends
              <input type="time" value={schedForm.endTime} onChange={(e) => setSchedForm({ ...schedForm, endTime: e.target.value })} required />
            </label>
          </div>
          <button type="submit" className="btn primary">Save sitting hours</button>
        </form>
        {schedules.length === 0 ? <p className="muted">No sitting hours set yet.</p> : (
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table>
              <thead><tr><th>Doctor</th><th>Day</th><th>Hours</th><th></th></tr></thead>
              <tbody>
                {schedules.map((s) => (
                  <tr key={s.id}>
                    <td>{s.doctorName}</td>
                    <td>{DAYS[s.dayOfWeek]}</td>
                    <td>{s.startTime} – {s.endTime}</td>
                    <td><button className="btn small danger" onClick={() => removeSchedule(s)}>Remove</button></td>
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
