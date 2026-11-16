import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';

export default function Nursing() {
  const [patients, setPatients] = useState([]);
  const [selected, setSelected] = useState('');
  const [vitals, setVitals] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ bp: '', hr: '', temp: '', spo2: '' });
  const [taskForm, setTaskForm] = useState({ patientId: '', task: '', due: '' });

  useEffect(() => {
    api('/patients').then((d) => setPatients(d.patients)).catch(() => {});
    api('/tasks?status=open').then((d) => setTasks(d.tasks)).catch(() => {});
  }, []);

  const loadVitals = (patientId) => {
    if (!patientId) { setVitals([]); return; }
    api(`/patients/${patientId}/vitals`).then((d) => setVitals(d.vitals)).catch((e) => setError(e.message));
  };

  const pick = (patientId) => {
    setSelected(patientId);
    loadVitals(patientId);
  };

  const recordVitals = async (e) => {
    e.preventDefault();
    if (!selected) return setError('Select a patient first.');
    try {
      await api(`/patients/${selected}/vitals`, { method: 'POST', body: form });
      setForm({ bp: '', hr: '', temp: '', spo2: '' });
      loadVitals(selected);
    } catch (err) { setError(err.message); }
  };

  const addTask = async (e) => {
    e.preventDefault();
    try {
      const { task } = await api('/tasks', { method: 'POST', body: taskForm });
      setTasks((t) => [task, ...t]);
      setTaskForm({ patientId: '', task: '', due: '' });
    } catch (err) { setError(err.message); }
  };

  const completeTask = async (t) => {
    try {
      await api(`/tasks/${t.id}`, { method: 'PATCH', body: { status: 'done' } });
      setTasks((list) => list.filter((x) => x.id !== t.id));
    } catch (err) { alert(err.message); }
  };

  return (
    <div>
      <h2>Nursing</h2>
      <p className="muted">Ward work — record vitals and keep the task list moving.</p>
      {error && <div className="error">{error}</div>}

      <div className="grid2">
        <section className="panel">
          <h3>Record vitals</h3>
          <label>Patient
            <select value={selected} onChange={(e) => pick(e.target.value)}>
              <option value="">Select patient…</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
            </select>
          </label>
          {selected && (
            <form onSubmit={recordVitals}>
              <div className="form-grid">
                <label>Blood pressure
                  <input value={form.bp} onChange={(e) => setForm({ ...form, bp: e.target.value })} placeholder="120/80" />
                </label>
                <label>Heart rate (bpm)
                  <input type="number" value={form.hr} onChange={(e) => setForm({ ...form, hr: e.target.value })} placeholder="72" />
                </label>
                <label>Temperature
                  <input value={form.temp} onChange={(e) => setForm({ ...form, temp: e.target.value })} placeholder="98.6°F" />
                </label>
                <label>SpO₂
                  <input value={form.spo2} onChange={(e) => setForm({ ...form, spo2: e.target.value })} placeholder="98%" />
                </label>
              </div>
              <button type="submit" className="btn primary">Record vitals</button>
            </form>
          )}
          {selected && vitals.length > 0 && (
            <>
              <h4>Vitals history</h4>
              <ul>
                {vitals.slice(0, 5).map((v) => (
                  <li key={v.id}>
                    {new Date(v.recordedAt).toLocaleString()} — BP {v.bp || '—'}, HR {v.hr || '—'}, Temp {v.temp || '—'}, SpO₂ {v.spo2 || '—'}
                    <span className="muted"> ({v.recordedByName})</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="panel">
          <h3>Ward tasks — open ({tasks.length})</h3>
          {tasks.length === 0 ? <p className="muted">No open tasks. Nice work.</p> : (
            <ul>
              {tasks.map((t) => (
                <li key={t.id}>
                  <strong>{t.task}</strong> — <Link to={`/patients/${t.patientId}`}>{t.patientName || t.patientId}</Link>
                  {t.due && <span className="muted"> · due {t.due}</span>}{' '}
                  <button className="btn small" onClick={() => completeTask(t)}>Done</button>
                </li>
              ))}
            </ul>
          )}
          <h4>Add a task</h4>
          <form onSubmit={addTask}>
            <label>Patient
              <select value={taskForm.patientId} onChange={(e) => setTaskForm({ ...taskForm, patientId: e.target.value })} required>
                <option value="">Select patient…</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
              </select>
            </label>
            <label>Task
              <input value={taskForm.task} onChange={(e) => setTaskForm({ ...taskForm, task: e.target.value })} placeholder="e.g. Check blood sugar before breakfast" required />
            </label>
            <label>Due
              <input value={taskForm.due} onChange={(e) => setTaskForm({ ...taskForm, due: e.target.value })} placeholder="Today, 07:00" />
            </label>
            <button type="submit" className="btn primary">Add task</button>
          </form>
        </section>
      </div>
    </div>
  );
}
