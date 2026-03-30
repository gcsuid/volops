const API_BASE = '/api';

interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

export const api = {
  volunteer: {
    signup: async (data: { name: string; email: string; age: string; gender: string; password: string }) => {
      const res = await fetch(`${API_BASE}/volunteer/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse<{ vol_id: string; token: string; name: string }>(res);
    },
    login: async (data: { vol_id: string; password: string }) => {
      const res = await fetch(`${API_BASE}/volunteer/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse<{ token: string; vol_id: string; name: string }>(res);
    },
  },
  manager: {
    signup: async (data: { name: string; email: string; org_id: string }) => {
      const res = await fetch(`${API_BASE}/manager/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse<{ mgr_id: string; password: string; token: string; name: string }>(res);
    },
    login: async (data: { mgr_id: string; password: string }) => {
      const res = await fetch(`${API_BASE}/manager/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse<{ token: string; mgr_id: string; name: string }>(res);
    },
  },
  organization: {
    signup: async (data: { name: string; email: string; location: string; password: string }) => {
      const res = await fetch(`${API_BASE}/organization/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse<{ org_id: string; token: string; name: string }>(res);
    },
    login: async (data: { org_id: string; email: string }) => {
      const res = await fetch(`${API_BASE}/organization/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse<{ token: string; org_id: string; name: string }>(res);
    },
  },
};

export type { ApiResponse };
