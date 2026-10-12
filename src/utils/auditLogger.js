// ------------------------------------------------------------------
// Audit log — now server-side and append-only.
// The backend writes entries; this module only reads them (admin).
// ------------------------------------------------------------------

import { api } from './api';

export async function getAuditLog({ q = '', limit = 100 } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (q) params.set('q', q);
  const { entries } = await api(`/audit?${params}`);
  return entries;
}
