// ------------------------------------------------------------------
// AI client — talks to the Clinix AI backend (/api/ai/*), which holds the
// provider API key server-side and enforces RBAC + audit logging there.
// The browser never sees any provider credentials.
// ------------------------------------------------------------------

import { api, ApiError } from '../utils/api';

export class AIError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function toAIError(e) {
  if (e instanceof ApiError) return new AIError(e.status === 503 ? 'NO_API_KEY' : 'AI_ERROR', e.message);
  return new AIError('NETWORK_ERROR', 'Could not reach the Clinix AI server.');
}

/** { baseUrl, model, hasApiKey } — key itself is never exposed. */
export async function getAIStatus() {
  try {
    return await api('/ai/config');
  } catch (e) {
    throw toAIError(e);
  }
}

export async function aiSummarize(patientId) {
  try {
    const { summary } = await api('/ai/summary', { method: 'POST', body: { patientId } });
    return summary;
  } catch (e) {
    throw toAIError(e);
  }
}

export async function aiScribe(patientId, roughNotes) {
  try {
    const { draft } = await api('/ai/scribe', { method: 'POST', body: { patientId, roughNotes } });
    return draft;
  } catch (e) {
    throw toAIError(e);
  }
}

export async function aiSearch(question) {
  try {
    const { answer } = await api('/ai/search', { method: 'POST', body: { question } });
    return answer;
  } catch (e) {
    throw toAIError(e);
  }
}

export async function saveAIConfig({ baseUrl, apiKey, model }) {
  try {
    await api('/ai/config', { method: 'PUT', body: { baseUrl, apiKey, model } });
  } catch (e) {
    throw toAIError(e);
  }
}

export async function testAIConnection() {
  try {
    await api('/ai/test', { method: 'POST' });
    return true;
  } catch (e) {
    throw toAIError(e);
  }
}
