// ------------------------------------------------------------------
// API client — all requests go to the Clinix AI backend.
// JWT is attached automatically; 401s sign the user out.
// In dev, Vite proxies /api to the backend (see vite.config.js).
// ------------------------------------------------------------------

const TOKEN_KEY = 'clinix_jwt';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body = null } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  if (res.status === 401) {
    setToken(null);
    // Let the auth context react; do a hard redirect only if we're not on login.
    if (!window.location.pathname.startsWith('/login')) window.location.assign('/login');
    throw new ApiError(401, 'Session expired. Please sign in again.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || `Request failed (${res.status}).`);
  return data;
}
