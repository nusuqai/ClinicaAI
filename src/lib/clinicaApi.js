import { supabase } from './supabase';

const BACKEND_URL = import.meta.env.VITE_CLINICA_BACKEND_URL || '';

/**
 * Send a query to the Clinica MCP backend.
 * @param {string} query - The user's message
 * @param {string|null} sessionId - MCP session ID from previous response
 * @returns {Promise<{sessionId?: string, text: string, toolResults?: Array}>}
 */
export async function sendClinicaQuery(query, sessionId = null) {
  const headers = { 'Content-Type': 'application/json' };

  if (sessionId) {
    headers['mcp-session-id'] = sessionId;
  }

  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {
    // No auth available, continue without token
  }

  const res = await fetch(`${BACKEND_URL}/clinica/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    throw new Error(`Backend error: ${res.status}`);
  }

  return res.json();
}
