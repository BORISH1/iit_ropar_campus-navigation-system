const API_URL = 'https://backend-final-green.vercel.app/api';

function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const auth = localStorage.getItem('adminAuth');
  if (auth) headers['Authorization'] = `Basic ${auth}`;
  return headers;
}

export const api = {
  login: async (username, password) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) throw new Error('Invalid credentials');
    localStorage.setItem('adminAuth', btoa(`${username}:${password}`));
    return res.json();
  },
  
  getLocations: async () => {
    const res = await fetch(`${API_URL}/locations`);
    return res.json();
  },
  
  getEdges: async () => {
    const res = await fetch(`${API_URL}/edges`);
    return res.json();
  },
  
  getRoute: async (from, to) => {
    const res = await fetch(`${API_URL}/route?from=${from}&to=${to}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to find route');
    }
    return res.json();
  },

  getStats: async () => {
    const res = await fetch(`${API_URL}/stats`, { headers: getHeaders() });
    return res.json();
  },

  createLocation: async (data) => {
    const res = await fetch(`${API_URL}/locations`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return res.json();
  },

  // NEW: Update an existing location
  updateLocation: async (id, data) => {
    const res = await fetch(`${API_URL}/locations/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return res.json();
  },

  createEdge: async (data) => {
    const res = await fetch(`${API_URL}/edges`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return res.json();
  },
  
  deleteLocation: async (id) => {
    await fetch(`${API_URL}/locations/${id}`, { method: 'DELETE', headers: getHeaders() });
  },

  deleteEdge: async (id) => {
    await fetch(`${API_URL}/edges/${id}`, { method: 'DELETE', headers: getHeaders() });
  }
};