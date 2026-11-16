import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';

const today = () => new Date().toISOString().slice(0, 10);

export default function Appointments() {
  const [date, setDate] = useState(today());
  const [status, setStatus] = useState('');
  const [list, setList] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ patientId: '', doctorId: '', date: today(), time: '09:00', reason: '' });

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (status) params.set('status', status);
    api(`/appointments?${params.toString()}`)
      .then((d) => setList(d.appointments))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [date, status]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api('/patients').then((d) => setPatients(d.patients)).catch(() => {});
    api('/users/doctors').then((d) => setDoctors(d.doctors)).catch(() => {});
  }, []);

  const setStatusOf = async (appt, next) => {
    try {
      await api(`/appointments/${appt.id}`, { method: 'PATCH', body: { status: next } });
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const book = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api('/appointments', { method: 'POST', body: form });
      setForm({ ...form, reason: '' });
      setDate(form.date);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h2>Appointments</h2>

      <section className="panel">
        <h3>Book an appointment</h3>
        {error && <div className="error">{error}</div>}
        <form onSubmit={book}>
          <div className="form-grid">
            <label>Patient
              <select value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })} required>
                <option value="">Select patient…</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
              </select>
            </label>
            <label>Doctor
              <select value={form.doctorId} onChange={(e) => setForm({ ...form, doctorId: e.target.value })}>
                <option value="">Any doctor</option>
                {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
            <label>Date
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </label>
            <label>Time
              <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required />
            </label>
          </div>
          <label>Reason for visit
            <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Diabetes follow-up" />
          </label>
          <button type="submit" className="btn primary">Book appointment</button>
        </form>
      </section>

      <div className="filter-bar">
        <label>Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="scheduled">Scheduled</option>
            <option value="checked_in">Checked in</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No-show</option>
          </select>
        </label>
        <button className="btn small" onClick={() => { setDate(''); setStatus(''); }}>Clear</button>
      </div>

      {loading ? <p className="muted">Loading…</p> : list.length === 0 ? (
        <p className="muted">No appointments for this day.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Time</th><th>Patient</th><th>Doctor</th><th>Reason</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id}>
                  <td>{a.date} · {a.time}</td>
                  <td><Link to={`/patients/${a.patientId}`}>{a.patientName || a.patientId}</Link></td>
                  <td>{a.doctorName || '—'}</td>
                  <td>{a.reason || '—'}</td>
                  <td><span className={`chip ${a.status}`}>{a.status.replace('_', ' ')}</span></td>
                  <td className="row-actions">
                    {a.status === 'scheduled' && (
                      <button className="btn small" onClick={() => setStatusOf(a, 'checked_in')}>Check in</button>
                    )}
                    {a.status === 'checked_in' && (
                      <button className="btn small" onClick={() => setStatusOf(a, 'completed')}>Complete</button>
                    )}
                    {(a.status === 'scheduled' || a.status === 'checked_in') && (
                      <button className="btn small danger" onClick={() => setStatusOf(a, 'cancelled')}>Cancel</button>
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
