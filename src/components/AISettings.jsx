import { useState, useEffect } from 'react';
import { getAIConfig, saveAIConfig, testConnection, AIError } from '../ai/providers/openaiCompatible';
import { logAudit } from '../utils/auditLogger';
import { useAuth } from '../context/AuthContext';

export default function AISettings() {
  const { user } = useAuth();
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [status, setStatus] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const c = getAIConfig();
    setBaseUrl(c.baseUrl);
    setApiKey(c.apiKey);
    setModel(c.model);
  }, []);

  const save = () => {
    saveAIConfig({ baseUrl: baseUrl.trim().replace(/\/$/, ''), apiKey: apiKey.trim(), model: model.trim() });
    logAudit({ actorId: user.id, actorName: user.name, role: user.role, action: 'AI_CONFIG_UPDATE', details: `AI provider config updated (model: ${model.trim()})` });
    setStatus('Settings saved.');
  };

  const test = async () => {
    setTesting(true);
    setStatus('');
    try {
      saveAIConfig({ baseUrl: baseUrl.trim().replace(/\/$/, ''), apiKey: apiKey.trim(), model: model.trim() });
      const r = await testConnection();
      setStatus(`Connection OK — model "${r.model}" responded.`);
      logAudit({ actorId: user.id, actorName: user.name, role: user.role, action: 'AI_CONFIG_TEST', details: 'AI provider connection test succeeded' });
    } catch (e) {
      setStatus(e instanceof AIError ? e.message : 'Connection test failed.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <h2>AI provider settings</h2>
      <p className="muted">
        Connect Clinix AI to any OpenAI-compatible provider (OpenAI, Azure OpenAI, Ollama, vLLM, OpenRouter, …).
        The API key is stored in this browser only in the prototype — production must keep keys server-side.
      </p>

      <div className="panel" style={{ maxWidth: 560 }}>
        <label>Base URL
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" />
        </label>
        <label>API key
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-…" autoComplete="off" />
        </label>
        <label>Model
          <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="gpt-4o-mini" />
        </label>
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button className="btn primary" onClick={save}>Save</button>
          <button className="btn" onClick={test} disabled={testing}>{testing ? 'Testing…' : 'Save & test connection'}</button>
        </div>
        {status && <p className={status.startsWith('Connection OK') || status === 'Settings saved.' ? '' : 'error'} style={{ marginTop: 12 }}>{status}</p>}
      </div>

      <div className="panel" style={{ maxWidth: 560 }}>
        <h3>How it works</h3>
        <ul className="muted" style={{ fontSize: 14, lineHeight: 1.7 }}>
          <li>The app sends OpenAI-style <span className="mono">chat/completions</span> requests to your base URL.</li>
          <li>Patient data sent to the provider is filtered to the signed-in user's role permissions first.</li>
          <li>Every AI request is written to the audit log.</li>
        </ul>
      </div>
    </div>
  );
}
