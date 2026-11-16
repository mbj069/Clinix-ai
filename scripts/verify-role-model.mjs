// Role-model verification: the approved access model.
// Who can do what, doctor own-patient scoping, 3-tier patient redaction,
// role-aware stats. Run against a fresh test DB (seeded demo data).
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
const dow = new Date(`${today}T12:00:00Z`).getUTCDay(); // 1 = Monday

const admin = await login('admin', 'admin123');
ok('admin login', admin.status === 200);
const reed = await login('doctor', 'doctor123');
ok('Dr Reed login', reed.status === 200);
const chen = await login('doctor2', 'doctor123');
ok('Dr Chen login', chen.status === 200);
const nurse = await login('nurse', 'nurse123');
ok('nurse login', nurse.status === 200);
const recep = await login('reception', 'reception123');
ok('receptionist login', recep.status === 200);

// --- Booking is reception's job, not the doctor's or nurse's -------------
const docBook = await call(reed.token, '/appointments', 'POST', { patientId: 'p-1001', doctorId: 'u-doc-1', date: today, time: '15:00', reason: 'x' });
ok('doctor cannot book appointments (403)', docBook.status === 403, `status ${docBook.status}`);
const nurseBook = await call(nurse.token, '/appointments', 'POST', { patientId: 'p-1001', doctorId: 'u-doc-1', date: today, time: '15:00', reason: 'x' });
ok('nurse cannot book appointments (403)', nurseBook.status === 403, `status ${nurseBook.status}`);
const nurseQueue = await call(nurse.token, '/appointments');
ok('nurse cannot read the booking queue (403)', nurseQueue.status === 403, `status ${nurseQueue.status}`);
const recepQueue = await call(recep.token, `/appointments?date=${today}`);
ok('receptionist reads the queue (3 today)', recepQueue.status === 200 && recepQueue.appointments?.length === 3, `status ${recepQueue.status} got ${recepQueue.appointments?.length}`);

// --- Doctor sees only their own patients ----------------------------------
const reedPats = await call(reed.token, '/patients');
ok('Reed sees his 5 patients', reedPats.patients?.length === 5, `got ${reedPats.patients?.length}`);
const chenPats = await call(chen.token, '/patients');
ok('Chen sees 0 patients (none booked to her yet)', chenPats.patients?.length === 0, `got ${chenPats.patients?.length}`);
const chenDetail = await call(chen.token, '/patients/p-1001');
ok('Chen cannot open Reed’s patient (403)', chenDetail.status === 403, `status ${chenDetail.status}`);
const reedDetail = await call(reed.token, '/patients/p-1001');
ok('Reed opens his own patient (200)', reedDetail.status === 200 && reedDetail.patient?.name === 'Elena Marsh', `status ${reedDetail.status}`);
const chenCons = await call(chen.token, '/patients/p-1001/consultations', 'POST', { diagnosis: 'x', plan: 'y' });
ok('Chen cannot consult Reed’s patient (403)', chenCons.status === 403, `status ${chenCons.status}`);
const chenNote = await call(chen.token, '/patients/p-1001/notes', 'POST', { note: 'x' });
ok('Chen cannot add a note to Reed’s patient (403)', chenNote.status === 403, `status ${chenNote.status}`);
const chenHist = await call(chen.token, '/patients/p-1001/consultations');
ok('Chen cannot read Reed’s patient history (403)', chenHist.status === 403, `status ${chenHist.status}`);
const reedHist = await call(reed.token, '/patients/p-1001/consultations');
ok('Reed reads his own patient history (200)', reedHist.status === 200 && reedHist.consultations?.length === 1, `status ${reedHist.status}`);
const chenAppts = await call(chen.token, '/appointments?doctor=u-doc-1');
ok('Chen asking for Reed’s appointments gets only her own (0)', chenAppts.status === 200 && chenAppts.appointments?.length === 0, `status ${chenAppts.status} got ${chenAppts.appointments?.length}`);
const reedAppts = await call(reed.token, '/appointments?doctor=u-doc-2');
ok('Reed asking for Chen’s appointments gets only his own', reedAppts.status === 200 && reedAppts.appointments?.length === 5 && reedAppts.appointments.every((a) => a.doctorId === 'u-doc-1'), `got ${reedAppts.appointments?.length}`);

// --- Three-tier patient visibility -----------------------------------------
const recepPat = await call(recep.token, '/patients/p-1001');
ok('receptionist sees demographics only (redacted, no conditions/ssn/vitals)',
  recepPat.status === 200 && recepPat.patient?._redacted === true && recepPat.patient?.conditions === undefined && recepPat.patient?.ssn === undefined && recepPat.patient?.vitals === undefined,
  JSON.stringify(recepPat.patient));
const recepHist = await call(recep.token, '/patients/p-1001/consultations');
ok('receptionist cannot read clinical history (403)', recepHist.status === 403, `status ${recepHist.status}`);
const recepVit = await call(recep.token, '/patients/p-1001/vitals');
ok('receptionist cannot read vitals history (403)', recepVit.status === 403, `status ${recepVit.status}`);
const nursePat = await call(nurse.token, '/patients/p-1001');
ok('nurse sees clinical data (conditions) but no SSN',
  nursePat.status === 200 && Array.isArray(nursePat.patient?.conditions) && nursePat.patient.conditions.length > 0 && nursePat.patient?.ssn === undefined,
  JSON.stringify(nursePat.patient));
const nurseHist = await call(nurse.token, '/patients/p-1001/consultations');
ok('nurse reads clinical history (200)', nurseHist.status === 200 && nurseHist.consultations?.length === 1, `status ${nurseHist.status}`);

// --- Demographics editing is reception's job -------------------------------
const recepPatch = await call(recep.token, '/patients/p-1001', 'PATCH', { phone: '+92 300 0000000' });
ok('receptionist edits demographics (200, phone updated)', recepPatch.status === 200 && recepPatch.patient?.phone === '+92 300 0000000', `status ${recepPatch.status} phone ${recepPatch.patient?.phone}`);
const recepClinPatch = await call(recep.token, '/patients/p-1001', 'PATCH', { conditions: ['Invented'] });
ok('receptionist cannot change clinical fields via PATCH (conditions untouched)',
  recepClinPatch.status === 200 && !(recepClinPatch.patient?.conditions || []).includes('Invented'),
  JSON.stringify(recepClinPatch.patient?.conditions));
const docPatch = await call(reed.token, '/patients/p-1001', 'PATCH', { phone: '+1 555 999 9999' });
ok('doctor cannot edit demographics (403)', docPatch.status === 403, `status ${docPatch.status}`);
const recepNote = await call(recep.token, '/patients/p-1001/notes', 'POST', { note: 'x' });
ok('receptionist cannot add clinical notes (403)', recepNote.status === 403, `status ${recepNote.status}`);

// --- Vitals are nursing's job ----------------------------------------------
const docVit = await call(reed.token, '/patients/p-1001/vitals', 'POST', { bp: '120/80', hr: 70 });
ok('doctor cannot record vitals (403)', docVit.status === 403, `status ${docVit.status}`);
const nurseVit = await call(nurse.token, '/patients/p-1001/vitals', 'POST', { bp: '120/80', hr: 70, temp: '98.6°F', spo2: '99%' });
ok('nurse records vitals (201)', nurseVit.status === 201, `status ${nurseVit.status}`);
const reedVitHist = await call(reed.token, '/patients/p-1001/vitals');
ok('Reed views his own patient vitals (200)', reedVitHist.status === 200 && reedVitHist.vitals?.length >= 2, `status ${reedVitHist.status} got ${reedVitHist.vitals?.length}`);
const chenVitHist = await call(chen.token, '/patients/p-1001/vitals');
ok('Chen cannot view Reed’s patient vitals (403)', chenVitHist.status === 403, `status ${chenVitHist.status}`);

// --- Role-aware stats --------------------------------------------------------
const adminStats = await call(admin.token, `/stats/dashboard?date=${today}&dayOfWeek=${dow}`);
ok('admin stats: 2 doctors, 5 patients, 3 appts today, 1 checked in, 3 open tasks',
  adminStats.totals?.doctors === 2 && adminStats.totals?.patients === 5 && adminStats.totals?.appointmentsToday === 3 && adminStats.totals?.checkedInToday === 1 && adminStats.totals?.openTasks === 3,
  JSON.stringify(adminStats.totals));
ok('admin sees per-doctor counts for both doctors',
  adminStats.doctors?.length === 2 && adminStats.doctors.every((d) => d.appointmentsToday !== undefined && d.consultationsTotal !== undefined),
  JSON.stringify(adminStats.doctors));
const reedStats = await call(reed.token, `/stats/dashboard?date=${today}&dayOfWeek=${dow}`);
ok('Reed stats: my 5 patients, my 3 appts, my 3 consultations total',
  reedStats.totals?.myPatients === 5 && reedStats.totals?.myAppointmentsToday === 3 && reedStats.totals?.myConsultationsTotal === 3 && reedStats.totals?.patients === undefined,
  JSON.stringify(reedStats.totals));
ok('Reed sees only his own row in the doctors list (with counts)',
  reedStats.doctors?.length === 1 && reedStats.doctors[0].id === 'u-doc-1' && reedStats.doctors[0].appointmentsToday === 3,
  JSON.stringify(reedStats.doctors));
const chenStats = await call(chen.token, `/stats/dashboard?date=${today}&dayOfWeek=${dow}`);
ok('Chen stats: my 0 patients, my 0 appts',
  chenStats.totals?.myPatients === 0 && chenStats.totals?.myAppointmentsToday === 0,
  JSON.stringify(chenStats.totals));
const nurseStats = await call(nurse.token, `/stats/dashboard?date=${today}&dayOfWeek=${dow}`);
ok('nurse stats: ward numbers, no doctor totals, no per-doctor counts',
  nurseStats.totals?.patients === 5 && nurseStats.totals?.openTasks === 3 && nurseStats.totals?.doctors === undefined && nurseStats.doctors?.length === 2 && nurseStats.doctors.every((d) => d.appointmentsToday === undefined),
  JSON.stringify(nurseStats.totals));
const recepStats = await call(recep.token, `/stats/dashboard?date=${today}&dayOfWeek=${dow}`);
ok('reception stats: queue numbers, no open tasks, no per-doctor counts',
  recepStats.totals?.appointmentsToday === 3 && recepStats.totals?.checkedInToday === 1 && recepStats.totals?.openTasks === undefined && recepStats.doctors?.length === 2 && recepStats.doctors.every((d) => d.appointmentsToday === undefined),
  JSON.stringify(recepStats.totals));

// --- Schedules: admin sets, everyone reads ----------------------------------
const sched = await call(recep.token, '/schedules');
ok('reception reads 8 seeded schedules', sched.status === 200 && sched.schedules?.length === 8, `status ${sched.status} got ${sched.schedules?.length}`);
const schedPost = await call(recep.token, '/schedules', 'POST', { doctorId: 'u-doc-2', dayOfWeek: 0, startTime: '10:00', endTime: '12:00' });
ok('reception cannot set schedules (403)', schedPost.status === 403, `status ${schedPost.status}`);
const schedAdmin = await call(admin.token, '/schedules', 'POST', { doctorId: 'u-doc-2', dayOfWeek: 0, startTime: '10:00', endTime: '12:00' });
ok('admin sets a schedule (200/201)', [200, 201].includes(schedAdmin.status), `status ${schedAdmin.status}`);
const newRow = (schedAdmin.schedules || []).find((s) => s.doctorId === 'u-doc-2' && s.dayOfWeek === 0);
const schedDel = await call(admin.token, `/schedules/${newRow?.id}`, 'DELETE');
ok('admin deletes a schedule (200)', schedDel.status === 200, `status ${schedDel.status} row ${JSON.stringify(newRow)}`);

// --- AI search follows the same scoping --------------------------------------
const recepAI = await call(recep.token, '/ai/search', 'POST', { question: 'Who has diabetes?' });
ok('receptionist has no AI search (403)', recepAI.status === 403, `status ${recepAI.status}`);
const docAI = await call(reed.token, '/ai/search', 'POST', { question: 'Who has diabetes?' });
ok('doctor passes the AI search gate (503 = no API key configured, not a permission error)', docAI.status === 503, `status ${docAI.status} ${docAI.error || ''}`);

// --- A patient becomes the doctor's when reception books them ---------------
const bookedChen = await call(recep.token, '/appointments', 'POST', { patientId: 'p-1003', doctorId: 'u-doc-2', date: today, time: '15:00', reason: 'Migraine follow-up with Dr. Chen' });
ok('reception books p-1003 with Chen (201)', bookedChen.status === 201, `status ${bookedChen.status}`);
const chenPats2 = await call(chen.token, '/patients');
ok('Chen now sees p-1003 as her patient', chenPats2.patients?.length === 1 && chenPats2.patients[0].id === 'p-1003', `got ${JSON.stringify(chenPats2.patients?.map((p) => p.id))}`);
const chenCons2 = await call(chen.token, '/patients/p-1003/consultations', 'POST', { diagnosis: 'Migraine — stable', plan: 'Continue as needed.' });
ok('Chen can now consult p-1003 (201)', chenCons2.status === 201, `status ${chenCons2.status}`);
// A cancelled appointment is not a link: book p-1002 with Chen, cancel
// it, and she must lose p-1002 — while p-1003 stays hers via the real
// consultation she gave.
const bookedChen2 = await call(recep.token, '/appointments', 'POST', { patientId: 'p-1002', doctorId: 'u-doc-2', date: today, time: '17:00', reason: 'Asthma review with Dr. Chen' });
ok('reception books p-1002 with Chen (201)', bookedChen2.status === 201, `status ${bookedChen2.status}`);
const chenPats3 = await call(chen.token, '/patients');
ok('Chen sees p-1002 while the booking stands', chenPats3.patients?.some((p) => p.id === 'p-1002'), `got ${JSON.stringify(chenPats3.patients?.map((p) => p.id))}`);
const cancelChen2 = await call(recep.token, `/appointments/${bookedChen2.appointment?.id}`, 'PATCH', { status: 'cancelled' });
ok('reception cancels Chen’s p-1002 booking (200)', cancelChen2.status === 200, `status ${cancelChen2.status}`);
const chenPats4 = await call(chen.token, '/patients');
ok('Chen loses p-1002 after cancellation, keeps p-1003 (consultation)',
  chenPats4.patients?.length === 1 && chenPats4.patients[0].id === 'p-1003', `got ${JSON.stringify(chenPats4.patients?.map((p) => p.id))}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
