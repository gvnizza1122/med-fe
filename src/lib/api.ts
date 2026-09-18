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
  getFiles: (page = 1, limit = 20, jenisKlaim?: string, fromDate?: string, toDate?: string, search?: string) => {
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (jenisKlaim) qs.set('jenis_klaim', jenisKlaim);
    if (fromDate) qs.set('from_date', fromDate);
    if (toDate) qs.set('to_date', toDate);
    if (search) qs.set('search', search);
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

  // Hospital Settings (Profil RS — Kode RS & Kelas RS, dipakai auto-fill saat upload PDF)
  getHospitalSettings: () => request('/api/v1/hospital-settings'),
  updateHospitalSettings: (data: { kelas_rs: string }) =>
    request('/api/v1/hospital-settings', { method: 'PUT', body: JSON.stringify(data) }),

  // Users
  getUsers: () => request('/api/v1/users'),
  createUser: (data: Record<string, string>) =>
    request('/api/v1/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: Record<string, unknown>) =>
    request(`/api/v1/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id: string) =>
    request(`/api/v1/users/${id}`, { method: 'DELETE' }),

  // Audit Log
  getAuditLogs: (page = 1, limit = 30, filters?: { user_email?: string; action?: string; resource_type?: string; from_date?: string; to_date?: string }) => {
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (filters?.user_email) qs.set('user_email', filters.user_email);
    if (filters?.action) qs.set('action', filters.action);
    if (filters?.resource_type) qs.set('resource_type', filters.resource_type);
    if (filters?.from_date) qs.set('from_date', filters.from_date);
    if (filters?.to_date) qs.set('to_date', filters.to_date);
    return request(`/api/v1/audit-logs?${qs.toString()}`);
  },

  // PDF Upload
  uploadPdf: (file: File, jenisKlaim: string) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('jenis_klaim', jenisKlaim);
    // Ekstraksi AI biasanya 10-20 detik, tapi berkas RAWAT_INAP (banyak
    // halaman/catatan multi-hari -> OCR + AI review lebih lama) bisa jauh
    // melebihi itu. 90 detik sebelumnya sering keburu timeout padahal
    // prosesnya tetap lanjut & berhasil di server (browser bilang gagal,
    // tapi file tetap muncul di Riwayat Upload) — samakan dengan timeout
    // upload batch (10 menit) supaya cukup untuk berkas terberat sekalipun.
    return request('/api/v1/claim-files/upload-pdf', { method: 'POST', body: fd, timeout: 600000 });
  },

  // PDF Upload — batch (banyak file, 1 kategori pelayanan untuk semua file).
  // Maks 300 file/batch (26 Aug 2026, permintaan klien) — estimasi ~90 menit
  // untuk 300 file (konsisten dengan hasil testing 50 file = ~15,5 menit dgn
  // BATCH_AI_CONCURRENCY=20 di server) — timeout digenerosikan ke 2 jam supaya
  // batch besar tidak keburu di-abort padahal masih diproses server-side.
  // Progress real-time tetap masuk lewat socket event 'pdf-batch:*' walau
  // request fetch ini sendiri akhirnya timeout/gagal (lihat UploadJobContext:
  // status per-file yang sudah dilaporkan via socket TIDAK ditimpa jadi error).
  // allowedJenisKlaim: kategori yang MUNGKIN ada di batch ini (verifikator
  // toggle 1/2/3 kategori sebelum drag file) — BUKAN kategori pasti per file.
  // Backend mendeteksi kategori tiap file dari isi dokumennya sendiri,
  // dibatasi ke daftar ini (lihat /upload-pdf-batch, allowed_jenis_klaim).
  uploadPdfBatch: (files: File[], allowedJenisKlaim: string[]) => {
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    fd.append('allowed_jenis_klaim', JSON.stringify(allowedJenisKlaim));
    return request('/api/v1/claim-files/upload-pdf-batch', { method: 'POST', body: fd, timeout: 7200000 });
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

  // "Baca Ulang" — jalankan ulang ekstraksi + validasi + AI review untuk 1
  // record dari PDF asli yang sudah tersimpan (dipakai saat ada field kosong/
  // error yang dicurigai sebenarnya ada di dokumen).
  rereadRecord: (recordId: string) =>
    request(`/api/v1/claim-files/records/${recordId}/reread`, { method: 'POST' }),

  // RV-20 (kriteria kegawatan IGD) — audit trail konfirmasi manual checklist.
  getRv20Confirmation: (recordId: string) => request(`/api/v1/records/${recordId}/rv20-confirm`),
  confirmRv20: (recordId: string, checklistItems: Record<string, boolean>) =>
    request(`/api/v1/records/${recordId}/rv20-confirm`, { method: 'POST', body: JSON.stringify({ checklist_items: checklistItems }) }),

  // Exempt PRB (RV-15) — daftar pasien kronis yang sengaja tidak dialihkan
  // ke Program Rujuk Balik walau sudah stabil >=3 bulan berturut, dikelola
  // admin. Dicek otomatis oleh detectAndFlagPRB() di backend.
  getPrbExemptions: () => request('/api/v1/prb-exempt'),
  createPrbExemption: (data: Record<string, string>) =>
    request('/api/v1/prb-exempt', { method: 'POST', body: JSON.stringify(data) }),
  updatePrbExemption: (id: string, data: Record<string, string>) =>
    request(`/api/v1/prb-exempt/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePrbExemption: (id: string) =>
    request(`/api/v1/prb-exempt/${id}`, { method: 'DELETE' }),

  // Scan ulang RV-13/15/16 untuk 1 periode bulan ("MM/YYYY") — perlu karena
  // deteksi lintas-record cuma otomatis nyala saat file BARU diupload.
  scanEpisodes: (periodeBulan: string) =>
    request('/api/v1/claim-files/scan-episodes', { method: 'POST', body: JSON.stringify({ periode_bulan: periodeBulan }) }),

  // PDF asli yang diunggah — via helper request supaya dapat timeout + refresh
  // token otomatis; untuk konten non-JSON helper mengembalikan Response mentah
  // yang bisa diubah jadi blob lalu ditampilkan via <iframe>.
  getPdfFile: (fileId: string): Promise<Response> =>
    request(`/api/v1/claim-files/${fileId}/file`),

  // Jawaban Pending BPJS — upload PDF surat pending, AI ekstrak alasan +
  // generate draft klarifikasi (dengan few-shot dari kasus sukses sebelumnya).
  uploadBpjsPending: (recordId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request(`/api/v1/records/${recordId}/pending-upload`, { method: 'POST', body: fd, timeout: 120000 });
  },
  getBpjsPending: (recordId: string) => request(`/api/v1/records/${recordId}/pending`),
  updateBpjsPendingStatus: (pendingId: string, data: { status?: string; outcome?: string; poin_kunci?: string; draft_klarifikasi?: string }) =>
    request(`/api/v1/records/pending/${pendingId}/status`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Rekap Pending BPJS berformat Excel (2 sheet "Pending RJ"/"Pending RI",
  // 1 baris = 1 klaim pending) — import massal, bukan surat PDF per-klaim.
  importPendingXlsx: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request('/api/v1/records/pending-import-xlsx', { method: 'POST', body: fd, timeout: 60000 });
  },
  getPendingList: (params: { status?: string; outcome?: string; jenis_klaim?: string; search?: string; pending_file_id?: string; page?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    const q = qs.toString();
    return request(`/api/v1/records/pending${q ? `?${q}` : ''}`);
  },
  generatePendingDraft: (id: string) =>
    request(`/api/v1/records/pending/${id}/generate-draft`, { method: 'POST', timeout: 90000 }),

  // Daftar file Excel rekap pending yang sudah diimpor (tampilan per-file,
  // seperti Riwayat Upload) — lihat pending-bpjs/page.tsx dan [fileId]/page.tsx.
  getPendingFiles: (params: { page?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined) qs.set(k, String(v)); });
    const q = qs.toString();
    return request(`/api/v1/records/pending-files${q ? `?${q}` : ''}`);
  },
};
