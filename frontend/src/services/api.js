// frontend/src/services/api.js
export const API_BASE_URL = import.meta.env.VITE_API_URL;

// helper wrapper for JSON POST
export async function postJson(path, body, opts = {}) {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
    body: JSON.stringify(body),
    ...opts.fetchOptions,
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch (e) { return text; }
}

// helper wrapper for GET
export async function getJson(path, opts = {}) {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, { method: 'GET', ...opts });
  const text = await res.text();
  try { return JSON.parse(text); } catch (e) { return text; }
}

// Example API functions
export function login(payload) {
  return postJson('/auth/login', payload);
}

export function fetchProfile() {
  return getJson('/auth/profile');
}
