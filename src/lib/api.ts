const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

async function request(endpoint: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  const headers: Record<string, string> = { ...options.headers as Record<string, string> };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';

  // Pesan untuk pengguna akhir (perawat/verifikator) — tanpa istilah teknis.
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  } catch {
    // Gagal menghubungi server (jaringan putus / server mati).
    throw new Error('Tidak dapat terhubung ke server. Periksa koneksi internet Anda, lalu coba lagi.');
  }

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    throw new Error('Sesi Anda telah berakhir. Silakan masuk kembali.');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    // Backend sudah mengirim pesan berbahasa awam; ini jaring pengaman bila tidak ada.
    const cadangan: Record<number, string> = {
      400: 'Data yang dikirim belum sesuai. Periksa kembali isian Anda.',
      403: 'Anda tidak memiliki akses untuk tindakan ini.',
      404: 'Data yang dicari tidak ditemukan.',
      413: 'Ukuran berkas terlalu besar. Gunakan berkas yang lebih kecil.',
      429: 'Permintaan terlalu sering. Mohon tunggu sebentar, lalu coba lagi.',
    };
    throw new Error(
      data.error ||
      cadangan[res.status] ||
      'Terjadi gangguan pada sistem. Silakan coba lagi. Bila terus berulang, hubungi petugas IT rumah sakit.'
    );
  }

  const contentType = res.headers.get('content-type');
  if (contentType?.includes('application/json')) return res.json();
  return res;
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  getMe: () => request('/api/v1/auth/me'),

  // Dashboard
  getDashboard: (period?: string) =>
    request(`/api/v1/dashboard/summary${period ? `?period=${period}` : ''}`),
  getErrorTrends: () => request('/api/v1/dashboard/error-trends'),

  // Claim Files
  uploadFile: (file: File, period?: string, fileId?: string) => {
    const fd = new FormData();
    fd.append('file', file);
    if (period) fd.append('period', period);
    if (fileId) fd.append('fileId', fileId);
    return request('/api/v1/claim-files/upload', { method: 'POST', body: fd });
  },
  getFiles: (page = 1, limit = 20) =>
    request(`/api/v1/claim-files?page=${page}&limit=${limit}`),
  getFile: (id: string) => request(`/api/v1/claim-files/${id}`),
  getRecords: (fileId: string, params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/v1/claim-files/${fileId}/records?${qs}`);
  },
  approveFile: (id: string) =>
    request(`/api/v1/claim-files/${id}/approve`, { method: 'POST' }),
  deleteFile: (id: string) =>
    request(`/api/v1/claim-files/${id}`, { method: 'DELETE' }),
  exportFile: (id: string, filter = 'error') =>
    fetch(`${API_BASE}/api/v1/claim-files/${id}/export?filter=${filter}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
    }),
  autoFixFile: (id: string) =>
    request(`/api/v1/claim-files/${id}/auto-fix`, { method: 'POST' }),
  downloadFixedFile: (id: string) =>
    fetch(`${API_BASE}/api/v1/claim-files/${id}/download-fixed`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
    }),
  getComparison: (id: string) =>
    request(`/api/v1/claim-files/${id}/comparison`),
  runAiAudit: (id: string) =>
    request(`/api/v1/claim-files/${id}/ai-audit`, { method: 'POST' }),
  auditRecordFields: (recordId: string, fields: string[] = [], style = 'ponytail') =>
    request(`/api/v1/records/${recordId}/audit`, { method: 'POST', body: JSON.stringify({ fields, style }) }),
  sendAuditFeedback: (auditId: string, nurse_action: 'accepted' | 'rejected' | 'unsure') =>
    request(`/api/v1/records/audit/${auditId}/feedback`, { method: 'POST', body: JSON.stringify({ nurse_action }) }),

  // Validation Rules
  getRules: () => request('/api/v1/validation-rules'),
  updateRule: (id: string, data: Record<string, unknown>) =>
    request(`/api/v1/validation-rules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Users
  getUsers: () => request('/api/v1/users'),
  createUser: (data: Record<string, string>) =>
    request('/api/v1/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: Record<string, unknown>) =>
    request(`/api/v1/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id: string) =>
    request(`/api/v1/users/${id}`, { method: 'DELETE' }),

  // PDF Upload
  uploadPdf: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request('/api/v1/claim-files/upload-pdf', { method: 'POST', body: fd });
  },
  validatePdf: (data: Record<string, unknown>) =>
    request('/api/v1/claim-files/validate-pdf', { method: 'POST', body: JSON.stringify(data) }),

  // Audit Logs
  getAuditLogs: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/v1/audit-logs?${qs}`);
  },

  // Batch Audit (Phase 2)
  batchAuditRecords: (recordIds: string[], style: 'ponytail' | 'caveman' | 'neutral') =>
    request('/api/v1/records/batch-audit', {
      method: 'POST',
      body: JSON.stringify({ record_ids: recordIds, style }),
    }),

  // SIMRS Ingestion (Phase 2)
  ingestSimrsJson: (data: Record<string, unknown>) =>
    request('/api/v1/simrs/ingest', {
      method: 'POST',
      body: JSON.stringify({ data }),
    }),

  ingestSimrsPdf: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request('/api/v1/simrs/ingest', { method: 'POST', body: fd });
  },
};
