// Phase 1 (v2) verification: data entry, appointments, clinical records,
// vitals history, tasks, user admin + RBAC. Run against a fresh test DB.
const BASE = 'http://localhost:3001/api';
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};
const login = async (u, p) => {
  const r = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) });
  const d = await r.json();
  return { status: r.status, token: d.token, user: d.user, error: d.error };
};
const call = async (token, path, method = 'GET', body = null) => {
  const r = await fetch(`${BASE}${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : null,
  });
  const d = await r.json().catch(() => ({}));
  return { status: r.status, ...d };
};
const today = new Date().toISOString().slice(0, 10);

const admin = await login('admin', 'admin123');
ok('admin login', admin.status === 200, JSON.stringify(admin));
const doctor = await login('doctor', 'doctor123');
ok('doctor login', doctor.status === 200);
const nurse = await login('nurse', 'nurse123');
ok('nurse login', nurse.status === 200);
const recep = await login('reception', 'reception123');
ok('receptionist login', recep.status === 200);

// Seed data
const pats = await call(admin.token, '/patients');
ok('5 demo patients', pats.patients?.length === 5, `got ${pats.patients?.length}`);
const appts = await call(admin.token, `/appointments?date=${today}`);
ok('3 appointments today (seed)', appts.appointments?.length === 3, `got ${appts.appointments?.length}`);
const tasks = await call(admin.token, '/tasks?status=open');
ok('3 open nursing tasks (seed)', tasks.tasks?.length === 3, `got ${tasks.tasks?.length}`);
const vitals = await call(admin.token, '/patients/p-1001/vitals');
ok('2 vitals history rows for p-1001 (seed)', vitals.vitals?.length === 2, `got ${vitals.vitals?.length}`);
const cons = await call(admin.token, '/patients/p-1001/consultations');
ok('1 consultation for p-1001 (seed)', cons.consultations?.length === 1, `got ${cons.consultations?.length}`);
const rx = await call(admin.token, '/patients/p-1001/prescriptions');
ok('2 prescriptions for p-1001 (seed)', rx.prescriptions?.length === 2, `got ${rx.prescriptions?.length}`);
const labs = await call(admin.token, '/patients/p-1001/lab-orders');
ok('1 lab order for p-1001 (seed)', labs.labOrders?.length === 1, `got ${labs.labOrders?.length}`);

// Patient CRUD
const created = await call(recep.token, '/patients', 'POST', { name: 'Test Patient', dob: '1990-05-05', gender: 'Female', phone: '+1 555 000 0000', bloodType: 'A+', allergies: 'None', conditions: '' });
ok('receptionist registers patient (201, p-1006)', created.status === 201 && created.patient?.id === 'p-1006', `status ${created.status} id ${created.patient?.id}`);
const edited = await call(admin.token, '/patients/p-1006', 'PATCH', { phone: '+1 555 000 0001' });
ok('admin edits patient phone', edited.status === 200 && edited.patient?.phone === '+1 555 000 0001', `status ${edited.status}`);
const nurseCreate = await call(nurse.token, '/patients', 'POST', { name: 'Nope', dob: '1990-01-01', gender: 'Male', phone: 'x', bloodType: 'O+' });
ok('nurse cannot register patient (403)', nurseCreate.status === 403, `status ${nurseCreate.status}`);

// Appointments
const booked = await call(recep.token, '/appointments', 'POST', { patientId: 'p-1006', doctorId: 'u-doc-1', date: today, time: '15:00', reason: 'New patient intake' });
ok('receptionist books appointment (201)', booked.status === 201 && booked.appointment?.patientName === 'Test Patient', `status ${booked.status}`);
const checkedIn = await call(recep.token, `/appointments/${booked.appointment.id}`, 'PATCH', { status: 'checked_in' });
ok('check-in works', checkedIn.status === 200 && checkedIn.appointment?.status === 'checked_in', `status ${checkedIn.status}`);
const badStatus = await call(recep.token, `/appointments/${booked.appointment.id}`, 'PATCH', { status: 'banana' });
ok('invalid appointment status rejected (400)', badStatus.status === 400, `status ${badStatus.status}`);

// Clinical (doctor)
const newCons = await call(doctor.token, '/patients/p-1006/consultations', 'POST', { diagnosis: 'New patient intake — healthy', plan: 'Annual physical next year.' });
ok('doctor adds consultation (201)', newCons.status === 201 && newCons.consultations?.length === 1, `status ${newCons.status}`);
const newRx = await call(doctor.token, '/patients/p-1006/prescriptions', 'POST', { medication: 'Vitamin D', dosage: '1000 IU', frequency: 'Once daily', duration: '30 days' });
ok('doctor prescribes (201)', newRx.status === 201 && newRx.prescriptions?.length === 1, `status ${newRx.status}`);
const newLab = await call(doctor.token, '/patients/p-1006/lab-orders', 'POST', { testName: 'CBC', notes: 'Baseline' });
ok('doctor orders lab test (201)', newLab.status === 201 && newLab.labOrders?.length === 1, `status ${newLab.status}`);
const recepCons = await call(recep.token, '/patients/p-1001/consultations', 'POST', { diagnosis: 'x' });
ok('receptionist cannot consult (403)', recepCons.status === 403, `status ${recepCons.status}`);
const nurseRx = await call(nurse.token, '/patients/p-1001/prescriptions', 'POST', { medication: 'x', dosage: 'x', frequency: 'x' });
ok('nurse cannot prescribe (403)', nurseRx.status === 403, `status ${nurseRx.status}`);
const rxDone = await call(doctor.token, `/prescriptions/${newRx.prescriptions[0].id}`, 'PATCH', { status: 'completed' });
ok('prescription status update', rxDone.status === 200 && rxDone.prescription?.status === 'completed', `status ${rxDone.status}`);

// Vitals (nurse)
const vit = await call(nurse.token, '/patients/p-1006/vitals', 'POST', { bp: '120/80', hr: 70, temp: '98.6°F', spo2: '99%' });
ok('nurse records vitals (201)', vit.status === 201 && vit.patient?.vitals?.bp === '120/80', `status ${vit.status}`);
const vitHist = await call(nurse.token, '/patients/p-1006/vitals');
ok('vitals history shows new row', vitHist.vitals?.length === 1, `got ${vitHist.vitals?.length}`);
const recepVit = await call(recep.token, '/patients/p-1001/vitals', 'POST', { bp: '1' });
ok('receptionist cannot record vitals (403)', recepVit.status === 403, `status ${recepVit.status}`);

// Tasks
const newTask = await call(nurse.token, '/tasks', 'POST', { patientId: 'p-1006', task: 'Welcome pack + wristband', due: 'Today, 16:00' });
ok('nurse adds task (201)', newTask.status === 201 && newTask.task?.task === 'Welcome pack + wristband', `status ${newTask.status}`);
const doneTask = await call(nurse.token, `/tasks/${newTask.task.id}`, 'PATCH', { status: 'done' });
ok('task marked done', doneTask.status === 200 && doneTask.task?.status === 'done', `status ${doneTask.status}`);
const recepTask = await call(recep.token, '/tasks', 'POST', { patientId: 'p-1001', task: 'x' });
ok('receptionist cannot add tasks (403)', recepTask.status === 403, `status ${recepTask.status}`);

// Users (admin)
const docs = await call(recep.token, '/users/doctors');
ok('doctors directory readable by receptionist', docs.status === 200 && docs.doctors?.length === 2, `status ${docs.status}`);
const users = await call(admin.token, '/users');
ok('admin lists 5 users', users.users?.length === 5, `got ${users.users?.length}`);
const recepUsers = await call(recep.token, '/users');
ok('receptionist cannot list users (403)', recepUsers.status === 403, `status ${recepUsers.status}`);
const newUser = await call(admin.token, '/users', 'POST', { username: 'pharm1', password: 'pharm123', name: 'Pat Pharmacist', role: 'nurse' });
ok('admin creates user (201)', newUser.status === 201 && newUser.user?.username === 'pharm1', `status ${newUser.status}`);
const dupUser = await call(admin.token, '/users', 'POST', { username: 'pharm1', password: 'pharm123', name: 'Dup', role: 'nurse' });
ok('duplicate username rejected (409)', dupUser.status === 409, `status ${dupUser.status}`);
const deact = await call(admin.token, `/users/${newUser.user.id}`, 'PATCH', { active: false });
ok('admin deactivates user', deact.status === 200 && deact.user?.active === 0, `status ${deact.status}`);
const blockedLogin = await login('pharm1', 'pharm123');
ok('deactivated user cannot log in (403)', blockedLogin.status === 403, `status ${blockedLogin.status}`);
const selfDeact = await call(admin.token, '/users/u-admin-1', 'PATCH', { active: false });
ok('cannot deactivate own account (400)', selfDeact.status === 400, `status ${selfDeact.status}`);

// Audit still appends
const auditLog = await call(admin.token, '/audit?limit=5');
ok('audit log readable', auditLog.status === 200 || auditLog.audit !== undefined || Array.isArray(auditLog.entries), `status ${auditLog.status}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
