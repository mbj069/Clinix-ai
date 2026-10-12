// ------------------------------------------------------------------
// AI gateway. The provider API key NEVER leaves the server — the frontend
// calls these endpoints, and the backend calls the provider.
//
// RBAC is enforced here: patient data is filtered to the caller's role
// before it is placed in any prompt, and every AI call is audit-logged.
// ------------------------------------------------------------------

import { Router } from 'express';
import { db, mapPatient } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission, can, filterPatientFor } from '../middleware/rbac.js';
import { audit } from '../audit.js';

const router = Router();
router.use(requireAuth);

// --- Provider config (DB row, env fallback) --------------------------------

function getAIConfig() {
  const row = db.prepare('SELECT * FROM ai_config WHERE id = 1').get();
  return {
    baseUrl: row?.base_url || process.env.AI_PROVIDER_URL || 'https://api.openai.com/v1',
    // Admin-set key wins; otherwise env var. Never sent to the client.
    apiKey: row?.api_key || process.env.AI_API_KEY || '',
    model: row?.model || process.env.AI_MODEL || 'gpt-4o-mini',
  };
}

async function providerChat({ messages, tools = null, temperature = 0.3 }) {
  const { baseUrl, apiKey, model } = getAIConfig();
  if (!apiKey) {
    const err = new Error('No AI provider API key configured.');
    err.code = 'NO_API_KEY';
    throw err;
  }
  const body = { model, messages, temperature };
  if (tools) body.tools = tools;

  let res;
  try {
    res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
  } catch {
    const err = new Error('Could not reach the AI provider.');
    err.code = 'NETWORK_ERROR';
    throw err;
  }
  if (!res.ok) {
    const err = new Error(
      res.status === 401 || res.status === 403
        ? 'The AI provider rejected the API key.'
        : `AI provider error (${res.status}).`
    );
    err.code = res.status === 401 || res.status === 403 ? 'AUTH_ERROR' : 'PROVIDER_ERROR';
    throw err;
  }
  const data = await res.json();
  const choice = data.choices?.[0];
  if (!choice) {
    const err = new Error('The AI provider returned an empty response.');
    err.code = 'PROVIDER_ERROR';
    throw err;
  }
  return { message: choice.message, usage: data.usage || null };
}

// --- RBAC-filtered patient context ------------------------------------------

function patientText(patient) {
  const lines = [
    `${patient.name} (${patient.id}) — DOB ${patient.dob}, ${patient.gender}, blood ${patient.bloodType}`,
    `Vitals: BP ${patient.vitals.bp}, HR ${patient.vitals.hr}, Temp ${patient.vitals.temp}, SpO2 ${patient.vitals.spo2}`,
  ];
  if (patient._redacted) {
    lines.push('(Sensitive clinical data redacted for this role.)');
  } else {
    lines.push(`Allergies: ${patient.allergies.join(', ') || 'none known'}`);
    lines.push(`Conditions: ${patient.conditions.join(', ') || 'none'}`);
    lines.push(`Medications: ${patient.medications.map((m) => `${m.name} ${m.dosage} (${m.frequency})`).join('; ') || 'none'}`);
    lines.push(`Notes: ${patient.notes}`);
  }
  return lines.join('\n');
}

function getFilteredPatient(role, id) {
  const row = db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
  if (!row) return null;
  return filterPatientFor(role, mapPatient(row));
}

// --- Prompts -----------------------------------------------------------------

const PROMPTS = {
  summarizer: `You are Clinix AI, a clinical documentation assistant. Given a patient's record, write a concise clinical summary for the care team.

Rules:
- Use clear headings: Overview, Active conditions, Medications, Recent notes.
- Be factual and brief. Do not invent data that is not in the record.
- Flag anything that looks outdated or missing (e.g. "no vitals recorded").
- End with one line starting with "Suggested next step:".
- This is an assistive draft for a licensed clinician to review — never present it as a diagnosis or final decision.`,

  scribe: `You are Clinix AI, a clinical scribe. Convert the clinician's rough notes into a clean SOAP note (Subjective, Objective, Assessment, Plan).

Rules:
- Preserve all clinical facts from the input; do not invent findings.
- Use professional clinical language, concise bullet points where appropriate.
- If the input is ambiguous, note it explicitly (e.g. "[unclear — confirm]") rather than guessing.
- Output ONLY the SOAP note, no preamble.
- This draft must be reviewed by the clinician before it becomes part of the record.`,

  search: `You are Clinix AI, a patient-record search assistant. The user asks questions in natural language; you have tools to search the patient roster.

Rules:
- Always use the search_patients tool when the user asks about patients — never guess from memory.
- You only receive the fields the requesting user's role is allowed to see. Never claim to have data you were not given.
- Answer concisely. List matching patients by name and ID with one line of relevant detail each.
- If no patients match, say so plainly.
- This is an assistive tool for staff, not a diagnostic system.`,
};

const SEARCH_TOOL = {
  type: 'function',
  function: {
    name: 'search_patients',
    description: 'Search the patient roster by name fragment, condition, or medication.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Name fragment, condition, or medication.' } },
      required: ['query'],
    },
  },
};

function runSearch(role, query) {
  const q = query.toLowerCase();
  const rows = db.prepare('SELECT * FROM patients ORDER BY name').all();
  return rows
    .map(mapPatient)
    .filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.conditions.some((c) => c.toLowerCase().includes(q)) ||
        p.medications.some((m) => m.name.toLowerCase().includes(q))
    )
    .map((p) => filterPatientFor(role, p));
}

const aiError = (res, e) => {
  const status = e.code === 'NO_API_KEY' ? 503 : e.code === 'AUTH_ERROR' ? 502 : 500;
  res.status(status).json({ error: e.message, code: e.code || 'AI_ERROR' });
};

// --- Endpoints ----------------------------------------------------------------

// POST /api/ai/summary { patientId }
router.post('/summary', requirePermission('view_sensitive'), async (req, res) => {
  try {
    const patient = getFilteredPatient(req.user.role, req.body?.patientId);
    if (!patient) return res.status(404).json({ error: 'Patient not found.' });
    const { message, usage } = await providerChat({
      messages: [
        { role: 'system', content: PROMPTS.summarizer },
        { role: 'user', content: `Patient record:\n${patientText(patient)}\n\nWrite the clinical summary.` },
      ],
    });
    audit({
      actorId: req.user.sub, actorName: req.user.name, role: req.user.role,
      action: 'AI_SUMMARY', patientId: patient.id,
      details: `AI summary generated for ${patient.name} (${patient.id})${usage ? ` — ${usage.total_tokens} tokens` : ''}`,
    });
    res.json({ summary: message.content, usage });
  } catch (e) {
    aiError(res, e);
  }
});

// POST /api/ai/scribe { patientId, roughNotes }
router.post('/scribe', requirePermission('edit_patients'), async (req, res) => {
  try {
    const { patientId, roughNotes } = req.body || {};
    if (!roughNotes?.trim()) return res.status(400).json({ error: 'Rough notes are required.' });
    const patient = getFilteredPatient(req.user.role, patientId);
    if (!patient) return res.status(404).json({ error: 'Patient not found.' });
    const { message, usage } = await providerChat({
      messages: [
        { role: 'system', content: PROMPTS.scribe },
        { role: 'user', content: `Patient: ${patient.name} (${patient.id})\nRough notes:\n${roughNotes.trim()}\n\nWrite the SOAP note.` },
      ],
      temperature: 0.2,
    });
    audit({
      actorId: req.user.sub, actorName: req.user.name, role: req.user.role,
      action: 'AI_SCRIBE', patientId: patient.id,
      details: `AI SOAP draft generated for ${patient.name} (${patient.id})${usage ? ` — ${usage.total_tokens} tokens` : ''}`,
    });
    res.json({ draft: message.content, usage });
  } catch (e) {
    aiError(res, e);
  }
});

// POST /api/ai/search { question } — agentic tool loop, RBAC-filtered
router.post('/search', async (req, res) => {
  try {
    const { question } = req.body || {};
    if (!question?.trim()) return res.status(400).json({ error: 'A question is required.' });
    const messages = [
      { role: 'system', content: PROMPTS.search },
      { role: 'user', content: question.trim() },
    ];
    let usage = null;
    for (let step = 0; step < 4; step++) {
      const out = await providerChat({ messages, tools: [SEARCH_TOOL] });
      usage = out.usage;
      messages.push(out.message);
      const calls = out.message.tool_calls || [];
      if (calls.length === 0) break;
      for (const tc of calls) {
        let result;
        if (tc.function.name === 'search_patients') {
          const args = JSON.parse(tc.function.arguments || '{}');
          result = runSearch(req.user.role, args.query || '');
        } else {
          result = { error: `Unknown tool: ${tc.function.name}` };
        }
        messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
      }
    }
    const last = messages[messages.length - 1];
    const answer = last.role === 'assistant' ? last.content : 'No answer produced.';
    audit({
      actorId: req.user.sub, actorName: req.user.name, role: req.user.role,
      action: 'AI_SEARCH', details: `AI search: "${question.trim().slice(0, 80)}"${usage ? ` — ${usage.total_tokens} tokens` : ''}`,
    });
    res.json({ answer, usage });
  } catch (e) {
    aiError(res, e);
  }
});

// GET /api/ai/config — admin; key presence only, never the key itself
router.get('/config', requirePermission('ai_config'), (req, res) => {
  const c = getAIConfig();
  res.json({ baseUrl: c.baseUrl, model: c.model, hasApiKey: !!c.apiKey, keySource: c.apiKey ? (db.prepare('SELECT api_key FROM ai_config WHERE id = 1').get()?.api_key ? 'database' : 'environment') : 'none' });
});

// PUT /api/ai/config { baseUrl, apiKey, model } — admin
router.put('/config', requirePermission('ai_config'), (req, res) => {
  const { baseUrl, apiKey, model } = req.body || {};
  db.prepare('UPDATE ai_config SET base_url = COALESCE(?, base_url), api_key = COALESCE(?, api_key), model = COALESCE(?, model), updated_at = datetime(\'now\') WHERE id = 1')
    .run(baseUrl || null, apiKey || null, model || null);
  audit({
    actorId: req.user.sub, actorName: req.user.name, role: req.user.role,
    action: 'AI_CONFIG_UPDATE', details: `AI provider config updated (model: ${model || '(unchanged)'})`,
  });
  res.json({ ok: true });
});

// POST /api/ai/test — admin connectivity check
router.post('/test', requirePermission('ai_config'), async (req, res) => {
  try {
    const { message } = await providerChat({
      messages: [
        { role: 'system', content: 'You are a connectivity probe. Reply with exactly: OK' },
        { role: 'user', content: 'ping' },
      ],
      temperature: 0,
    });
    audit({ actorId: req.user.sub, actorName: req.user.name, role: req.user.role, action: 'AI_CONFIG_TEST', details: 'AI provider connection test succeeded' });
    res.json({ ok: true, reply: message.content?.slice(0, 50) });
  } catch (e) {
    aiError(res, e);
  }
});

export default router;
