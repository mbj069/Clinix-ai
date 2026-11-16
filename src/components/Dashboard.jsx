import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { localToday, availabilityStatus, DAYS } from '../utils/schedule';

// Role-aware dashboard. The stats endpoint only returns the numbers each
// role is allowed to see — this component just renders what it gets:
//   admin      — everything, incl. per-doctor counts
//   doctor     — MY appointments / consultations / patients, MY hours
//   nurse      — ward numbers + doctors on duty (hours, no counts)
//   reception  — today's queue + doctors on duty (hours, no counts)

export default function Dashboard() {
  const { user, can } = useAuth();
  const [patients, setPatients] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { date, dayOfWeek, now } = localToday();

  useEffect(() => {
    api('/patients')
      .then((d) => setPatients(d.patients))
      .catch(() => setPatients([]))
      .finally(() => setLoading(false));
    api(`/stats/dashboard?date=${date}&dayOfWeek=${dayOfWeek}`)
      .then((d) => setStats(d))
      .catch(() => setStats(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const t = stats?.totals;
  const isDoctor = user.role === 'doctor';
  const showCounts = stats?.doctors?.length > 0 && stats.doctors[0].appointmentsToday !== undefined;
  const myRow = isDoctor ? stats?.doctors?.[0] : null;

  return (
    <div>
      <h2>Welcome, {user.name}</h2>
      <p className="muted">Signed in as <strong>{user.role}</strong>. Here's your overview for {DAYS[dayOfWeek]}, {date}.</p>

      <div className="cards">
        {isDoctor ? (
          <>
            <div className="card">
              <div className="card-num">{loading ? '…' : patients.length}</div>
              <div className="card-label">My patients</div>
              <Link to="/patients" className="card-link">View my patients →</Link>
            </div>
            <div className="card">
              <div className="card-num">{t === undefined ? '…' : t.myAppointmentsToday}</div>
              <div className="card-label">My appointments today</div>
              <Link to="/doctor" className="card-link">Doctor panel →</Link>
            </div>
            <div className="card">
              <div className="card-num">{t === undefined ? '…' : t.myConsultationsToday}</div>
              <div className="card-label">My consultations today</div>
              <span className="card-link">{t === undefined ? '' : `${t.myConsultationsTotal} total`}</span>
            </div>
            <div className="card">
              <div className="card-num">{myRow?.scheduleToday ? `${myRow.scheduleToday.startTime}–${myRow.scheduleToday.endTime}` : '—'}</div>
              <div className="card-label">My sitting hours today</div>
              <Link to="/doctor" className="card-link">My week →</Link>
            </div>
          </>
        ) : (
          <>
            <div className="card">
              <div className="card-num">{loading ? '…' : patients.length}</div>
              <div className="card-label">Patients</div>
              <Link to="/patients" className="card-link">View all →</Link>
            </div>
            {can('manage_users') && (
              <div className="card">
                <div className="card-num">{t === undefined ? '…' : t.doctors}</div>
                <div className="card-label">Doctors</div>
                <Link to="/admin" className="card-link">Manage staff →</Link>
              </div>
            )}
            <div className="card">
              <div className="card-num">{t === undefined ? '…' : t.appointmentsToday}</div>
              <div className="card-label">Appointments today</div>
              {can('schedule') && <Link to="/appointments" className="card-link">View schedule →</Link>}
            </div>
            {can('schedule') && (
              <div className="card">
                <div className="card-num">{t === undefined ? '…' : t.checkedInToday}</div>
                <div className="card-label">Checked in</div>
                <Link to="/reception" className="card-link">Reception →</Link>
              </div>
            )}
            <div className="card">
              <div className="card-num">{t === undefined ? '…' : t.consultationsToday}</div>
              <div className="card-label">Consultations today</div>
              {can('consult') && <Link to="/doctor" className="card-link">Doctor panel →</Link>}
            </div>
            {can('manage_tasks') && (
              <div className="card">
                <div className="card-num">{t === undefined ? '…' : t.openTasks}</div>
                <div className="card-label">Open nursing tasks</div>
                <Link to="/nursing" className="card-link">Open nursing →</Link>
              </div>
            )}
          </>
        )}
        {can('ai_search') && (
          <div className="card">
            <div className="card-num">✨</div>
            <div className="card-label">AI search</div>
            <Link to="/ai-search" className="card-link">Ask in plain language →</Link>
          </div>
        )}
        {can('view_audit_log') && (
          <div className="card">
            <div className="card-num">◈</div>
            <div className="card-label">Audit log</div>
            <Link to="/audit" className="card-link">Review activity →</Link>
          </div>
        )}
      </div>

      {stats && stats.doctors.length > 0 && (
        <>
          <h3>{isDoctor ? 'My sitting today' : 'Doctors today'}</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Doctor</th><th>Sitting hours</th>{showCounts && <><th>Appointments</th><th>Consultations</th></>}<th>Status</th></tr></thead>
              <tbody>
                {stats.doctors.map((d) => {
                  const st = availabilityStatus(d.scheduleToday, now);
                  return (
                    <tr key={d.id}>
                      <td>{d.name}</td>
                      <td>{d.scheduleToday ? `${d.scheduleToday.startTime} – ${d.scheduleToday.endTime}` : '—'}</td>
                      {showCounts && (
                        <>
                          <td>{d.appointmentsToday}</td>
                          <td>{d.consultationsToday} today · {d.consultationsTotal} total</td>
                        </>
                      )}
                      <td><span className={`chip ${st.cls}`}>{st.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h3>{isDoctor ? 'My patients' : 'Patients'}</h3>
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
