import { useState, useEffect } from 'react';
import { getAIStatus, saveAIConfig, testAIConnection } from '../ai/aiClient';

export default function AISettings() {
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [keySource, setKeySource] = useState('none');
  const [status, setStatus] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    getAIStatus()
      .then((s) => {
        setBaseUrl(s.baseUrl);
        setModel(s.model);
        setKeySource(s.keySource);
      })
      .catch(() => setStatus('Could not load AI configuration.'));
  }, []);

  const save = async () => {
    try {
      await saveAIConfig({
        baseUrl: baseUrl.trim().replace(/\/$/, ''),
        // Only send the key if the admin typed a new one — never overwrite with blank.
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        model: model.trim(),
      });
      setApiKey('');
      const s = await getAIStatus();
      setKeySource(s.keySource);
      setStatus('Settings saved. The API key stays on the server and is never sent to browsers.');
    } catch (e) {
      setStatus(e.message);
    }
  };

  const test = async () => {
    setTesting(true);
    setStatus('');
    try {
      await save();
      await testAIConnection();
      setStatus('Connection OK — the provider responded.');
    } catch (e) {
      setStatus(e.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <h2>AI provider settings</h2>
      <p className="muted">
        Connect Clinix AI to any OpenAI-compatible provider. The API key is stored
        <strong> on the server only</strong> — it is never sent to browsers.
        {keySource !== 'none' && (
          <> Current key source: <span className="role-badge">{keySource}</span></>
        )}
      </p>

      <div className="panel" style={{ maxWidth: 560 }}>
        <label>Base URL
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" />
        </label>
        <label>API key <span className="muted small">(leave blank to keep the current key)</span>
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={keySource === 'none' ? 'sk-…' : '•••••••• (key set)'} autoComplete="off" />
        </label>
        <label>Model
          <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="gpt-4o-mini" />
        </label>
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button className="btn primary" onClick={save}>Save</button>
          <button className="btn" onClick={test} disabled={testing}>{testing ? 'Testing…' : 'Save & test connection'}</button>
        </div>
        {status && <p style={{ marginTop: 12 }} className={status.startsWith('Connection OK') || status.startsWith('Settings saved') ? '' : 'error'}>{status}</p>}
      </div>

      <div className="panel" style={{ maxWidth: 560 }}>
        <h3>How it works</h3>
        <ul className="muted" style={{ fontSize: 14, lineHeight: 1.7 }}>
          <li>The browser calls this server (<span className="mono">/api/ai/*</span>); the server calls the provider.</li>
          <li>Patient data is filtered to the signed-in user's role on the server before any AI call.</li>
          <li>Every AI request is written to the server-side audit log.</li>
        </ul>
      </div>
    </div>
  );
}
