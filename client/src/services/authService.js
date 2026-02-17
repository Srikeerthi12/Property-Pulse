import { api } from './api.js';

const ACCESS_TOKEN_KEY = 'pp_access_token';

export function setAccessToken(token) {
  try {
    if (!token) sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    else sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  } catch {
    // ignore (e.g. storage disabled)
  }
}

export function getAccessToken() {
  try {
    return sessionStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function login({ email, password }) {
  const { data } = await api.post('/api/auth/login', { email, password });
  if (data?.accessToken) setAccessToken(data.accessToken);
  return data;
}

export async function reactivate({ email, password }) {
  const { data } = await api.post('/api/auth/reactivate', { email, password });
  if (data?.accessToken) setAccessToken(data.accessToken);
  return data;
}

export async function register(payload) {
  const { data } = await api.post('/api/auth/register', payload);
  if (data?.accessToken) setAccessToken(data.accessToken);
  return data;
}

export async function logout() {
  // Clear locally first so logout always ends the session client-side.
  setAccessToken(null);
  try {
    const { data } = await api.post('/api/auth/logout');
    return data;
  } catch {
    // JWT logout is client-side unless implementing server-side blacklist.
    return { ok: true };
  }
}

export async function getMe() {
  const { data } = await api.get('/api/auth/me');
  return data;
}
