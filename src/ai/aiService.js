// ------------------------------------------------------------------
// AI orchestration service.
//
// Responsibilities:
//  1. Enforce RBAC — patient data is filtered to the caller's permissions
//     BEFORE it ever reaches the provider.
//  2. Audit-log every AI interaction (feature, actor, patient, tokens).
//  3. Run the agentic loop for tool-calling features (bounded iterations).
// ------------------------------------------------------------------

import { chatCompletions, AIError } from './providers/openaiCompatible';
import { PROMPTS } from './prompts';
import { formatPatient, SEARCH_PATIENTS_TOOL, runSearchPatients } from './tools';
import { logAudit } from '../utils/auditLogger';

function auditBase(user, feature, patientId, extra = {}) {
  logAudit({
    actorId: user.id,
    actorName: user.name,
    role: user.role,
    action: `AI_${feature}`,
    patientId,
    details: extra.details || '',
  });
}

/** 1. Clinical summarizer — one patient record → concise summary. */
export async function summarizePatient({ user, can, patient }) {
  const record = formatPatient(can, patient);
  const { message, usage } = await chatCompletions({
    messages: [
      { role: 'system', content: PROMPTS.summarizer },
      { role: 'user', content: `Patient record:\n${record}\n\nWrite the clinical summary.` },
    ],
  });
  auditBase(user, 'SUMMARY', patient.id, {
    details: `AI summary generated for ${patient.name} (${patient.id})${usage ? ` — ${usage.total_tokens} tokens` : ''}`,
  });
  return message.content;
}

/** 2. AI scribe — rough notes → SOAP note draft (clinician reviews). */
export async function scribeNotes({ user, patient, roughNotes }) {
  const { message, usage } = await chatCompletions({
    messages: [
      { role: 'system', content: PROMPTS.scribe },
      {
        role: 'user',
        content: `Patient: ${patient.name} (${patient.id})\nRough notes:\n${roughNotes}\n\nWrite the SOAP note.`,
      },
    ],
    temperature: 0.2,
  });
  auditBase(user, 'SCRIBE', patient.id, {
    details: `AI SOAP draft generated for ${patient.name} (${patient.id})${usage ? ` — ${usage.total_tokens} tokens` : ''}`,
  });
  return message.content;
}

/**
 * 3. Natural-language search — agentic loop with the search_patients tool.
 * The model may call the tool up to MAX_STEPS times; results are RBAC-filtered
 * locally before being returned to the model.
 */
const MAX_STEPS = 4;

export async function aiSearch({ user, can, question }) {
  const messages = [
    { role: 'system', content: PROMPTS.search },
    { role: 'user', content: question },
  ];
  let steps = 0;
  let usage = null;

  while (steps < MAX_STEPS) {
    steps += 1;
    const { message, usage: u } = await chatCompletions({
      messages,
      tools: [SEARCH_PATIENTS_TOOL],
    });
    usage = u;
    messages.push(message);

    const toolCalls = message.tool_calls || [];
    if (toolCalls.length === 0) {
      auditBase(user, 'SEARCH', null, {
        details: `AI search: "${question.slice(0, 80)}"${usage ? ` — ${usage.total_tokens} tokens` : ''}`,
      });
      return message.content;
    }

    for (const tc of toolCalls) {
      let result;
      if (tc.function.name === 'search_patients') {
        const args = JSON.parse(tc.function.arguments || '{}');
        result = runSearchPatients(can, args.query || '');
      } else {
        result = { error: `Unknown tool: ${tc.function.name}` };
      }
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      });
    }
  }

  // Bounded loop exhausted — ask the model to answer from what it has.
  const { message } = await chatCompletions({
    messages: [
      ...messages,
      { role: 'user', content: 'Answer the original question now with the information gathered so far.' },
    ],
  });
  auditBase(user, 'SEARCH', null, { details: `AI search (multi-step): "${question.slice(0, 80)}"` });
  return message.content;
}

export { AIError };
