// ------------------------------------------------------------------
// AI tools + RBAC-filtered patient context.
//
// The golden rule: the AI NEVER sees more than the requesting user may see.
// patientContextFor() strips sensitive fields unless can('view_sensitive').
// Every tool execution is resolved locally against mock data — the provider
// only ever receives what we explicitly put in the prompt/tool results.
// ------------------------------------------------------------------

import { PATIENTS } from '../data/mockData';

/** Fields every authenticated role may see. */
function basicFields(p) {
  return {
    id: p.id,
    name: p.name,
    dob: p.dob,
    gender: p.gender,
    phone: p.phone,
    bloodType: p.bloodType,
    vitals: p.vitals,
  };
}

/** Full record, gated behind the view_sensitive permission. */
export function patientContextFor(can, patient) {
  const base = basicFields(patient);
  if (!can('view_sensitive')) return { ...base, _redacted: true };
  return {
    ...base,
    allergies: patient.allergies,
    conditions: patient.conditions,
    medications: patient.medications,
    notes: patient.notes,
    ssn: patient.ssn,
  };
}

/** Format one patient as compact text for prompts. */
export function formatPatient(can, patient) {
  const c = patientContextFor(can, patient);
  const lines = [
    `${c.name} (${c.id}) — DOB ${c.dob}, ${c.gender}, blood ${c.bloodType}`,
    `Vitals: BP ${c.vitals.bp}, HR ${c.vitals.hr}, Temp ${c.vitals.temp}, SpO2 ${c.vitals.spo2}`,
  ];
  if (c._redacted) {
    lines.push('(Sensitive clinical data redacted for this role.)');
  } else {
    lines.push(`Allergies: ${c.allergies.join(', ') || 'none known'}`);
    lines.push(`Conditions: ${c.conditions.join(', ') || 'none'}`);
    lines.push(`Medications: ${c.medications.map((m) => `${m.name} ${m.dosage} (${m.frequency})`).join('; ') || 'none'}`);
    lines.push(`Notes: ${c.notes}`);
  }
  return lines.join('\n');
}

// --- Tool definitions (OpenAI function-calling format) ---------------------

export const SEARCH_PATIENTS_TOOL = {
  type: 'function',
  function: {
    name: 'search_patients',
    description: 'Search the patient roster by name fragment, condition, or medication.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Name fragment, condition, or medication to search for.' },
      },
      required: ['query'],
    },
  },
};

/** Execute search_patients locally, RBAC-filtered. */
export function runSearchPatients(can, query) {
  const q = query.toLowerCase();
  const hits = PATIENTS.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.conditions.some((c) => c.toLowerCase().includes(q)) ||
      p.medications.some((m) => m.name.toLowerCase().includes(q))
  );
  return hits.map((p) => patientContextFor(can, p));
}
