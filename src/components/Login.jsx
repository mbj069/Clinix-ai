import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DEMO_ACCOUNTS = [
  { username: 'admin', password: 'admin123', role: 'Administrator — full access' },
  { username: 'doctor', password: 'doctor123', role: 'Doctor — records + sensitive data' },
  { username: 'nurse', password: 'nurse123', role: 'Nurse — records + vitals' },
  { username: 'reception', password: 'reception123', role: 'Receptionist — basic info only' },
];

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const res = await login(username.trim(), password);
    if (res.ok) navigate(from, { replace: true });
    else setError(res.error);
  };

  const fill = (u, p) => {
    setUsername(u);
    setPassword(p);
    setError('');
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="brand">
          <div className="brand-mark">C+</div>
          <div>
            <h1>Clinix AI</h1>
            <p>by Nexus-Tech Solutions</p>
          </div>
        </div>
        <h2>Sign in</h2>
        <p className="muted">Patient-record prototype — demo credentials below.</p>
        <form onSubmit={submit}>
          <label>
            Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </label>
          {error && <div className="error">{error}</div>}
          <button type="submit" className="btn primary">Sign in</button>
        </form>
        <div className="demo-accounts">
          <h3>Demo accounts</h3>
          {DEMO_ACCOUNTS.map((a) => (
            <button key={a.username} className="demo-btn" onClick={() => fill(a.username, a.password)}>
              <strong>{a.username}</strong> <span className="muted">/ {a.password}</span>
              <small>{a.role}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
