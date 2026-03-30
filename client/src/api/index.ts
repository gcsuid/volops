const API_BASE = '/api';

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
    login: async (email: string) => {
      const res = await fetch(`${API_BASE}/volunteer/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      return handleResponse<{ token: string; vol_id: string; name: string; email: string }>(res);
    },
    me: async (token: string) => {
      const res = await fetch(`${API_BASE}/volunteer/me`, {
        headers: { 'x-session-token': token },
      });
      return handleResponse<{ vol_id: string; name: string; email: string }>(res);
    },
    getDrives: async (token: string) => {
      const res = await fetch(`${API_BASE}/volunteer/drives`, {
        headers: { 'x-session-token': token },
      });
      return handleResponse<Array<{
        id: string;
        name: string;
        location: string;
        status: string;
        checked_in_at: string;
        checked_out_at: string;
        duration_minutes: number;
      }>>(res);
    },
    currentDrive: async (token: string) => {
      const res = await fetch(`${API_BASE}/volunteer/current`, {
        headers: { 'x-session-token': token },
      });
      return handleResponse<{
        active: boolean;
        drive?: { id: string; name: string; location: string; status: string };
        checked_in_at?: string;
      }>(res);
    },
    checkin: async (token: string, driveId: string) => {
      const res = await fetch(`${API_BASE}/volunteer/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-token': token },
        body: JSON.stringify({ drive_id: driveId }),
      });
      return handleResponse<{ message: string; checked_in_at: string; drive_name: string }>(res);
    },
    checkout: async (token: string, driveId: string) => {
      const res = await fetch(`${API_BASE}/volunteer/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-token': token },
        body: JSON.stringify({ drive_id: driveId }),
      });
      return handleResponse<{ message: string; checked_out_at: string; duration_minutes: number }>(res);
    },
  },

  manager: {
    signup: async (data: { name: string; email: string; org_id: string; password?: string }) => {
      const res = await fetch(`${API_BASE}/manager/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse<{ mgr_id: string; token: string; name: string }>(res);
    },
    login: async (email: string, org_id: string) => {
      const res = await fetch(`${API_BASE}/manager/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, org_id }),
      });
      return handleResponse<{ token: string; mgr_id: string; name: string; email: string }>(res);
    },
    me: async (token: string) => {
      const res = await fetch(`${API_BASE}/manager/me`, {
        headers: { 'x-session-token': token },
      });
      return handleResponse<{ mgr_id: string; name: string; email: string; org: { id: string; name: string } }>(res);
    },
    getDrives: async (token: string) => {
      const res = await fetch(`${API_BASE}/manager/drives`, {
        headers: { 'x-session-token': token },
      });
      return handleResponse<Array<{
        id: string;
        name: string;
        location: string;
        status: string;
        total_volunteers: number;
        checked_in: number;
        checked_out: number;
        avg_duration_minutes: number | null;
      }>>(res);
    },
    createDrive: async (token: string, data: { name: string; location?: string; description?: string }) => {
      const res = await fetch(`${API_BASE}/manager/drives`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-token': token },
        body: JSON.stringify(data),
      });
      return handleResponse<{ id: string; name: string; status: string }>(res);
    },
    startDrive: async (token: string, driveId: string) => {
      const res = await fetch(`${API_BASE}/manager/drives/${driveId}/start`, {
        method: 'POST',
        headers: { 'x-session-token': token },
      });
      return handleResponse<{ id: string; qr_secret: string }>(res);
    },
    endDrive: async (token: string, driveId: string) => {
      const res = await fetch(`${API_BASE}/manager/drives/${driveId}/end`, {
        method: 'POST',
        headers: { 'x-session-token': token },
      });
      return handleResponse<{ id: string; status: string }>(res);
    },
    getVolunteers: async (token: string, driveId: string) => {
      const res = await fetch(`${API_BASE}/manager/drives/${driveId}/volunteers`, {
        headers: { 'x-session-token': token },
      });
      return handleResponse<Array<{
        id: string;
        vol_id: string;
        name: string;
        email: string;
        checked_in_at: string;
        checked_out_at: string;
        duration_minutes: number;
      }>>(res);
    },
  },

  organization: {
    signup: async (data: { name: string; email: string; location: string; phone?: string; password?: string }) => {
      const res = await fetch(`${API_BASE}/organization/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse<{ org_id: string; token: string; name: string }>(res);
    },
    login: async (org_id: string, email: string) => {
      const res = await fetch(`${API_BASE}/organization/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id, email }),
      });
      return handleResponse<{ token: string; org_id: string; name: string }>(res);
    },
    me: async (token: string) => {
      const res = await fetch(`${API_BASE}/organization/me`, {
        headers: { 'x-session-token': token },
      });
      return handleResponse<{ org_id: string; name: string; email: string }>(res);
    },
    getStats: async (token: string) => {
      const res = await fetch(`${API_BASE}/organization/stats`, {
        headers: { 'x-session-token': token },
      });
      return handleResponse<{
        total_drives: number;
        active_drives: number;
        total_volunteers: number;
        checked_in: number;
        checked_out: number;
        avg_duration_minutes: number;
      }>(res);
    },
    getManagers: async (token: string) => {
      const res = await fetch(`${API_BASE}/organization/managers`, {
        headers: { 'x-session-token': token },
      });
      return handleResponse<Array<{ id: string; mgr_id: string; name: string; email: string }>>(res);
    },
    getDrives: async (token: string) => {
      const res = await fetch(`${API_BASE}/organization/drives`, {
        headers: { 'x-session-token': token },
      });
      return handleResponse<Array<{
        id: string;
        name: string;
        location: string;
        status: string;
        manager_name: string;
        total_volunteers: number;
        checked_out: number;
        avg_duration_minutes: number | null;
      }>>(res);
    },
    getVolunteers: async (token: string, driveId: string) => {
      const res = await fetch(`${API_BASE}/organization/drives/${driveId}/volunteers`, {
        headers: { 'x-session-token': token },
      });
      return handleResponse<Array<{
        id: string;
        vol_id: string;
        name: string;
        email: string;
        checked_in_at: string;
        checked_out_at: string;
        duration_minutes: number;
      }>>(res);
    },
    download: async (token: string) => {
      const res = await fetch(`${API_BASE}/organization/download`, {
        headers: { 'x-session-token': token },
      });
      return res.blob();
    },
  },

  drives: {
    join: async (driveId: string, secret: string) => {
      const res = await fetch(`${API_BASE}/drives/${driveId}/join?secret=${encodeURIComponent(secret)}`);
      return handleResponse<{ id: string; name: string; location: string; status: string }>(res);
    },
    register: async (driveId: string, secret: string, volId: string) => {
      const res = await fetch(`${API_BASE}/drives/${driveId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, vol_id: volId }),
      });
      return handleResponse<{ success: boolean }>(res);
    },
    info: async (driveId: string) => {
      const res = await fetch(`${API_BASE}/drives/${driveId}`);
      return handleResponse<{ id: string; name: string; location: string; status: string }>(res);
    },
  },
};
