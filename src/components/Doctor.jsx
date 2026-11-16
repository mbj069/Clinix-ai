import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { DAYS } from '../utils/schedule';

const today = () => new Date().toISOString().slice(0, 10);

export default function Doctor() {
  const { user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [selected, setSelected] = useState('');
  const [myAppts, setMyAppts] = useState([]);
  const [myHours, setMyHours] = useState([]);
  const [history, setHistory] = useState({ consultations: [], prescriptions: [], labOrders: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cons, setCons] = useState({ diagnosis: '', plan: '' });
  const [rx, setRx] = useState({ medication: '', dosage: '', frequency: '', duration: '', notes: '' });
  const [lab, setLab] = useState({ testName: '', notes: '' });

  useEffect(() => {
    api('/patients').then((d) => setPatients(d.patients)).catch(() => {});
    api(`/appointments?date=${today()}&doctor=${user.id}`)
      .then((d) => setMyAppts(d.appointments))
      .catch(() => {})
      .finally(() => setLoading(false));
    api('/schedules')
      .then((d) => setMyHours((d.schedules || []).filter((s) => s.doctorId === user.id)))
      .catch(() => {});
  }, [user.id]);

  const loadHistory = (patientId) => {
    if (!patientId) { setHistory({ consultations: [], prescriptions: [], labOrders: [] }); return; }
    Promise.all([
      api(`/patients/${patientId}/consultations`),
      api(`/patients/${patientId}/prescriptions`),
      api(`/patients/${patientId}/lab-orders`),
    ])
      .then(([c, r, l]) => setHistory({ consultations: c.consultations, prescriptions: r.prescriptions, labOrders: l.labOrders }))
      .catch((e) => setError(e.message));
  };

  const pick = (patientId) => {
    setSelected(patientId);
    loadHistory(patientId);
  };

  const submitCons = async (e) => {
    e.preventDefault();
    if (!selected) return setError('Select a patient first.');
    try {
      const { consultations } = await api(`/patients/${selected}/consultations`, { method: 'POST', body: cons });
      setHistory((h) => ({ ...h, consultations }));
      setCons({ diagnosis: '', plan: '' });
    } catch (err) { setError(err.message); }
  };

  const submitRx = async (e) => {
    e.preventDefault();
    if (!selected) return setError('Select a patient first.');
    try {
      const { prescriptions } = await api(`/patients/${selected}/prescriptions`, { method: 'POST', body: rx });
      setHistory((h) => ({ ...h, prescriptions }));
      setRx({ medication: '', dosage: '', frequency: '', duration: '', notes: '' });
    } catch (err) { setError(err.message); }
  };

  const submitLab = async (e) => {
    e.preventDefault();
    if (!selected) return setError('Select a patient first.');
    try {
      const { labOrders } = await api(`/patients/${selected}/lab-orders`, { method: 'POST', body: lab });
      setHistory((h) => ({ ...h, labOrders }));
      setLab({ testName: '', notes: '' });
    } catch (err) { setError(err.message); }
  };

  const selectedPatient = patients.find((p) => p.id === selected);

  return (
    <div>
      <h2>Doctor panel</h2>
      <p className="muted">Your clinic day — consultations, prescriptions and lab orders.</p>
      {error && <div className="error">{error}</div>}

      {myHours.length > 0 && (
        <section className="panel">
          <h3>My sitting hours this week</h3>
          <p className="muted">
            {myHours.map((s) => `${DAYS[s.dayOfWeek]} ${s.startTime}–${s.endTime}`).join(' · ')}
          </p>
        </section>
      )}

      <h3>My appointments today</h3>
      {loading ? <p className="muted">Loading…</p> : myAppts.length === 0 ? (
        <p className="muted">No appointments for you today.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Time</th><th>Patient</th><th>Reason</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {myAppts.map((a) => (
                <tr key={a.id}>
                  <td>{a.time}</td>
                  <td><Link to={`/patients/${a.patientId}`}>{a.patientName || a.patientId}</Link></td>
                  <td>{a.reason || '—'}</td>
                  <td><span className={`chip ${a.status}`}>{a.status.replace('_', ' ')}</span></td>
                  <td><button className="btn small" onClick={() => pick(a.patientId)}>Consult</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="panel">
        <h3>Select patient</h3>
        <select value={selected} onChange={(e) => pick(e.target.value)}>
          <option value="">Select patient…</option>
          {patients.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
        </select>
        {selectedPatient && <p className="muted">Working with <strong>{selectedPatient.name}</strong> — <Link to={`/patients/${selected}`}>open full record →</Link></p>}
      </section>

      {selected && (
        <div className="grid2">
          <section className="panel">
            <h3>New consultation</h3>
            <form onSubmit={submitCons}>
              <label>Diagnosis
                <input value={cons.diagnosis} onChange={(e) => setCons({ ...cons, diagnosis: e.target.value })} required />
              </label>
              <label>Plan / advice
                <textarea value={cons.plan} onChange={(e) => setCons({ ...cons, plan: e.target.value })} rows={3} />
              </label>
              <button type="submit" className="btn primary">Save consultation</button>
            </form>
            <h4>Past consultations</h4>
            {history.consultations.length === 0 ? <p className="muted">None yet.</p> : (
              <ul>{history.consultations.map((c) => (
                <li key={c.id}><strong>{c.date}</strong> — {c.diagnosis}<br /><span className="muted">{c.plan}</span></li>
              ))}</ul>
            )}
          </section>

          <section className="panel">
            <h3>New prescription</h3>
            <form onSubmit={submitRx}>
              <div className="form-grid">
                <label>Medication
                  <input value={rx.medication} onChange={(e) => setRx({ ...rx, medication: e.target.value })} required />
                </label>
                <label>Dosage
                  <input value={rx.dosage} onChange={(e) => setRx({ ...rx, dosage: e.target.value })} placeholder="500mg" required />
                </label>
                <label>Frequency
                  <input value={rx.frequency} onChange={(e) => setRx({ ...rx, frequency: e.target.value })} placeholder="Twice daily" required />
                </label>
                <label>Duration
                  <input value={rx.duration} onChange={(e) => setRx({ ...rx, duration: e.target.value })} placeholder="90 days" />
                </label>
              </div>
              <label>Notes
                <input value={rx.notes} onChange={(e) => setRx({ ...rx, notes: e.target.value })} />
              </label>
              <button type="submit" className="btn primary">Prescribe</button>
            </form>
            <h4>Prescriptions</h4>
            {history.prescriptions.length === 0 ? <p className="muted">None yet.</p> : (
              <ul>{history.prescriptions.map((p) => (
                <li key={p.id}><strong>{p.medication}</strong> {p.dosage}, {p.frequency} — <span className={`chip ${p.status}`}>{p.status}</span></li>
              ))}</ul>
            )}
          </section>

          <section className="panel">
            <h3>Order lab test</h3>
            <form onSubmit={submitLab}>
              <label>Test name
                <input value={lab.testName} onChange={(e) => setLab({ ...lab, testName: e.target.value })} placeholder="HbA1c, Lipid panel, CBC…" required />
              </label>
              <label>Notes
                <input value={lab.notes} onChange={(e) => setLab({ ...lab, notes: e.target.value })} />
              </label>
              <button type="submit" className="btn primary">Order test</button>
            </form>
            <h4>Lab orders</h4>
            {history.labOrders.length === 0 ? <p className="muted">None yet.</p> : (
              <ul>{history.labOrders.map((l) => (
                <li key={l.id}><strong>{l.testName}</strong> — <span className={`chip ${l.status}`}>{l.status}</span></li>
              ))}</ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
