const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Token akses cuma berlaku 1 jam. Tanpa ini, verifikator yang kerja lama akan
// dilempar ke login mendadak dan kehilangan form yang belum disimpan. Cegah
// beberapa request yang 401 bersamaan memicu beberapa refresh call sekaligus.
let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return false;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        localStorage.setItem('access_token', data.access_token);
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

async function request(endpoint: string, options: RequestInit & { timeout?: number } = {}, _isRetry = false): Promise<any> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  const headers: Record<string, string> = { ...options.headers as Record<string, string> };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';

  // Pesan untuk pengguna akhir (perawat/verifikator) — tanpa istilah teknis.
  let res: Response;
  try {
    const timeoutMs = options.timeout || 30000; // default 30 detik
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Permintaan memakan waktu terlalu lama. Silakan coba lagi.');
    }
    // Gagal menghubungi server (jaringan putus / server mati).
    throw new Error('Tidak dapat terhubung ke server. Periksa koneksi internet Anda, lalu coba lagi.');
  }

  if (res.status === 401) {
    // Token akses kadaluarsa (bukan sesi yang benar-benar berakhir) — coba
    // perpanjang otomatis sekali sebelum memaksa logout, supaya kerjaan yang
    // sedang berjalan (form belum disimpan, dst) tidak hilang mendadak.
    if (!_isRetry && endpoint !== '/api/v1/auth/refresh') {
      const refreshed = await tryRefreshToken();
      if (refreshed) return request(endpoint, options, true);
    }

    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
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
  getFiles: (page = 1, limit = 20, jenisKlaim?: string) => {
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (jenisKlaim) qs.set('jenis_klaim', jenisKlaim);
    return request(`/api/v1/claim-files?${qs.toString()}`);
  },
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
  uploadPdf: (file: File, jenisKlaim: string) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('jenis_klaim', jenisKlaim);
    // Ekstraksi AI biasanya 10-20 detik, tapi bisa lebih lama tergantung jumlah
    // halaman & respons AI provider — default 30 detik terlalu mepet, sempat
    // bikin request timeout padahal prosesnya masih berjalan di server.
    return request('/api/v1/claim-files/upload-pdf', { method: 'POST', body: fd, timeout: 90000 });
  },

  // PDF Upload — batch (banyak file, 1 kategori pelayanan untuk semua file).
  // Diproses server-side dengan concurrency terbatas (~3 file bersamaan), jadi
  // makin banyak file makin lama — timeout digenerosikan (15 menit) supaya
  // batch berukuran wajar (puluhan file) tidak keburu di-abort padahal masih
  // diproses. Progress real-time dikirim lewat socket event 'pdf-batch:*'.
  uploadPdfBatch: (files: File[], jenisKlaim: string) => {
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    fd.append('jenis_klaim', jenisKlaim);
    return request('/api/v1/claim-files/upload-pdf-batch', { method: 'POST', body: fd, timeout: 900000 });
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

  // Record Verification (Phase 2)
  updateRecordValues: (recordId: string, updates: Record<string, any>) =>
    request(`/api/v1/claim-files/${recordId}/update-values`, {
      method: 'POST',
      body: JSON.stringify({ updates }),
    }),

  getRecordValidationErrors: (recordId: string) =>
    request(`/api/v1/claim-files/${recordId}/validation-errors`),

  // PDF asli yang diunggah — via helper request supaya dapat timeout + refresh
  // token otomatis; untuk konten non-JSON helper mengembalikan Response mentah
  // yang bisa diubah jadi blob lalu ditampilkan via <iframe>.
  getPdfFile: (fileId: string): Promise<Response> =>
    request(`/api/v1/claim-files/${fileId}/file`),
};
