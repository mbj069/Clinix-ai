// ------------------------------------------------------------------
// OpenAI-compatible provider adapter.
// Speaks the standard POST {baseUrl}/chat/completions API, which covers
// OpenAI, Azure OpenAI, and most self-hosted / third-party gateways
// (Ollama, vLLM, LiteLLM, OpenRouter, …). Swap `baseUrl` to change vendor
// with no code changes.
// ------------------------------------------------------------------

const CONFIG_KEY = 'clinix_ai_config';

export function getAIConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini' };
}

export function saveAIConfig(config) {
  // Prototype: browser storage. Production must keep keys server-side
  // (e.g. a secrets manager) and never expose them to the client.
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function isConfigured() {
  return !!getAIConfig().apiKey;
}

export class AIError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * Single chat-completions call.
 * @param {object} opts
 * @param {Array}  opts.messages  OpenAI-style messages
 * @param {Array}  [opts.tools]   OpenAI-style function tools
 * @param {number} [opts.temperature]
 */
export async function chatCompletions({ messages, tools = null, temperature = 0.3 }) {
  const { baseUrl, apiKey, model } = getAIConfig();
  if (!apiKey) {
    throw new AIError('NO_API_KEY', 'No AI provider API key configured. Ask an administrator to configure one in Settings → AI.');
  }

  const body = { model, messages, temperature };
  if (tools) body.tools = tools;

  let res;
  try {
    res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AIError('NETWORK_ERROR', 'Could not reach the AI provider. Check the base URL and your network connection.');
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 401 || res.status === 403) {
      throw new AIError('AUTH_ERROR', 'The AI provider rejected the API key (401/403). Check the key in Settings → AI.');
    }
    throw new AIError('PROVIDER_ERROR', `AI provider error (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  if (!choice) throw new AIError('PROVIDER_ERROR', 'The AI provider returned an empty response.');
  return { message: choice.message, usage: data.usage || null };
}

/** Lightweight connectivity check used by the settings page. */
export async function testConnection() {
  const { model } = getAIConfig();
  const { message } = await chatCompletions({
    messages: [
      { role: 'system', content: 'You are a connectivity probe. Reply with exactly: OK' },
      { role: 'user', content: 'ping' },
    ],
    temperature: 0,
  });
  return { ok: true, model, reply: message.content?.slice(0, 50) };
}
