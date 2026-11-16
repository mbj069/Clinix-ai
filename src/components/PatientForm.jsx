import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../utils/api';

const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
const GENDERS = ['Female', 'Male', 'Other'];

const empty = {
  name: '', dob: '', gender: 'Female', phone: '', bloodType: 'O+',
  allergies: '', conditions: '', notes: '', ssnLast4: '',
};

export default function PatientForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit) return;
    api(`/patients/${id}`)
      .then((d) => {
        const p = d.patient;
        setForm({
          name: p.name, dob: p.dob, gender: p.gender, phone: p.phone,
          bloodType: p.bloodType, allergies: (p.allergies || []).join(', '),
          conditions: (p.conditions || []).join(', '),
          notes: p._redacted ? '' : (p.notes || ''),
          ssnLast4: p._redacted ? '' : (p.ssn || '').slice(-4),
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const body = {
        name: form.name, dob: form.dob, gender: form.gender, phone: form.phone,
        bloodType: form.bloodType, allergies: form.allergies, conditions: form.conditions,
        notes: form.notes, ssnLast4: form.ssnLast4,
      };
      if (isEdit) {
        const { patient } = await api(`/patients/${id}`, { method: 'PATCH', body });
        navigate(`/patients/${patient.id}`);
      } else {
        const { patient } = await api('/patients', { method: 'POST', body });
        navigate(`/patients/${patient.id}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <div>
      <Link to={isEdit ? `/patients/${id}` : '/patients'}>← Back</Link>
      <h2>{isEdit ? 'Edit patient' : 'Register patient'}</h2>
      {error && <div className="error">{error}</div>}
      <form onSubmit={submit} className="panel">
        <div className="form-grid">
          <label>Full name
            <input value={form.name} onChange={set('name')} required />
          </label>
          <label>Date of birth
            <input type="date" value={form.dob} onChange={set('dob')} required />
          </label>
          <label>Gender
            <select value={form.gender} onChange={set('gender')}>
              {GENDERS.map((g) => <option key={g}>{g}</option>)}
            </select>
          </label>
          <label>Phone
            <input value={form.phone} onChange={set('phone')} required />
          </label>
          <label>Blood type
            <select value={form.bloodType} onChange={set('bloodType')}>
              {BLOOD_TYPES.map((b) => <option key={b}>{b}</option>)}
            </select>
          </label>
          <label>SSN last 4 digits
            <input value={form.ssnLast4} onChange={set('ssnLast4')} maxLength={4} placeholder="e.g. 4401" />
          </label>
          <label>Allergies (comma separated)
            <input value={form.allergies} onChange={set('allergies')} placeholder="Penicillin, Latex" />
          </label>
          <label>Conditions (comma separated)
            <input value={form.conditions} onChange={set('conditions')} placeholder="Type 2 Diabetes, Hypertension" />
          </label>
        </div>
        <label>Notes
          <textarea value={form.notes} onChange={set('notes')} rows={3} />
        </label>
        <button type="submit" className="btn primary" disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Register patient'}
        </button>
      </form>
    </div>
  );
}
