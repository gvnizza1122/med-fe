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
    const err = new Error(
      data.error ||
      cadangan[res.status] ||
      'Terjadi gangguan pada sistem. Silakan coba lagi. Bila terus berulang, hubungi petugas IT rumah sakit.'
    ) as Error & { kode?: string; status?: number };
    // `kode` mesin (mis. 'perlu_pengakuan', 'bukti_gugur') dipakai alur Pending
    // Jawaban BPJS untuk membedakan penolakan yang butuh tindakan spesifik dari
    // error generik — lihat src/lib/api.ts bagian pending-jawaban & halaman item.
    if (data.kode) err.kode = data.kode;
    err.status = res.status;
    throw err;
  }

  const contentType = res.headers.get('content-type');
  if (contentType?.includes('application/json')) return res.json();
  return res;
}

// ── Alur Menjawab Pending BPJS (backend: /api/v1/pending-jawaban, repo
// eclaim-pro-be src/routes/jawabPending.js). Beda dari "Rekap Pending BPJS"
// (import Excel manual) di atas — alur ini otomatis: tautkan SEP -> petakan
// kategori alasan -> hitung triase kotak A/B/C/D -> generate draf jawaban
// dengan bukti berkutipan -> koder setujui/tolak. Per 1 Okt 2026 backend
// sudah selesai tapi tabel rekap pending KOSONG di produksi (belum pernah
// ada data yang lewat alur baru ini) — semua fungsi di bawah belum bisa
// diverifikasi visual dengan data asli, hanya terhadap kontrak API.
// Aturan produk: TIDAK PERNAH menampilkan persentase/keyakinan di UI manapun.
export interface PendingJawabanStatistikPeriode {
  periode: string;
  total: number;
  cocok: number;
  klaim_tidak_ada: number;
  format: string;
  klaim_di_periode_ini: number;
}

export interface PendingJawabanStatistik {
  total: number;
  cocok: number;
  cocok_persis: number;
  cocok_normalisasi: number;
  klaim_tidak_ada: number;
  format: string;
  per_periode: PendingJawabanStatistikPeriode[];
  penjelasan?: string;
  rincian?: unknown[];
}

export interface PendingJawabanKategoriRingkasan {
  kategori: string;
  total: number;
  rawat_jalan: number;
  rawat_inap: number;
  // `pangsa` sengaja TIDAK ditampilkan di UI manapun — aturan produk melarang
  // menampilkan persentase/keyakinan. Disimpan di tipe ini hanya supaya sesuai
  // kontrak backend, bukan untuk dirender.
  pangsa?: number;
}

export interface PendingJawabanAlasanRingkasan {
  total: number;
  per_jenis: Record<string, number>;
  per_kategori: PendingJawabanKategoriRingkasan[];
  alasan_teratas: { alasan: string; jumlah: number }[];
}

export type KotakTriase = 'A' | 'B' | 'C' | 'D';

export interface PendingJawabanTriaseRingkasan {
  kotak: { kode: KotakTriase; label: string; jumlah: number }[];
  belum_diklasifikasi: number;
  per_jenis: Record<string, number>;
  per_kategori: Record<string, number>;
}

export interface PendingJawabanItemRingkas {
  id: string;
  sep?: string | null;
  nama_peserta?: string | null;
  kategori: string | null;
  jenis_rawat: 'RJ' | 'RI' | string | null;
  kotak: KotakTriase | null;
  draft_id: string | null;
  status_draft: 'draft' | 'siap' | 'ditolak' | 'belum_ada' | string;
  [key: string]: unknown;
}

export interface PendingJawabanDaftarResponse {
  total: number;
  page: number;
  limit: number;
  items: PendingJawabanItemRingkas[];
}

export interface PendingJawabanBukti {
  topik: string;
  halaman: number | string;
  kutipan: string;
  terverifikasi: boolean;
}

export interface PendingJawabanDraftPoin {
  teks?: string;
  isi?: string;
  bukti?: PendingJawabanBukti[];
  tanpa_bukti?: boolean;
  [key: string]: unknown;
}

export interface PendingJawabanDraftVersi {
  id: string;
  versi?: number;
  status?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface PendingJawabanItemDetail {
  pending: {
    id: string;
    sep?: string | null;
    nama_peserta?: string | null;
    kategori?: string | null;
    jenis_rawat?: string | null;
    jawaban_rs_manual?: string | null;
    [key: string]: unknown;
  };
  triase: {
    kotak: KotakTriase | null;
    label?: string;
    alasan_kotak?: string;
    kriteria?: string[];
    dokumen_dibutuhkan?: string[];
  } | null;
  draft: {
    id?: string;
    status?: string;
    poin?: PendingJawabanDraftPoin[];
    [key: string]: unknown;
  } | null;
  kolom: {
    alasan_pending: string;
    jawaban: string;
    bukti: PendingJawabanBukti[];
  };
  riwayat_versi: PendingJawabanDraftVersi[];
}

export const api = {
  getVitalReferences: () => request('/api/v1/claim-files/reference/vital-ranges'),
  // Auth
  login: (username: string, password: string) =>
    request('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  getMe: () => request('/api/v1/auth/me'),
  lookupCodeDescriptions: (diagnosis: string[], procedure: string[]): Promise<{ diagnosis: Record<string, string>; procedure: Record<string, string> }> =>
    request('/api/v1/code-descriptions/lookup', { method: 'POST', body: JSON.stringify({ diagnosis, procedure }) }),
  // Tab "Saran AI": diagnosis, prosedur, INA-CBG & tarif yang disusun dari isi
  // berkas. Hanya dibaca, tidak mengubah data klaim.
  getSaranKoding: (recordId: string) =>
    request(`/api/v1/claim-files/records/${recordId}/saran-koding`),

  tinjauDiagnosis: (recordId: string, paksaSol = false) =>
    request(`/api/v1/claim-files/records/${recordId}/tinjauan-diagnosis`, { method: 'POST', body: JSON.stringify({ paksa_sol: paksaSol }) }),

  getTestingPending: (jenisKlaim: string, page = 1, search = '', includeArsip = false) =>
    request(`/api/v1/testing-pending?${new URLSearchParams({ jenis_klaim: jenisKlaim, page: String(page), search, include_arsip: includeArsip ? '1' : '0' })}`),
  saveTestingPending: (recordId: string, data: { actual_result: string; reference_source: string; actual_reason: string; reason_match: string; notes: string }) =>
    request(`/api/v1/testing-pending/${encodeURIComponent(recordId)}`, { method: 'PUT', body: JSON.stringify(data) }),

  getAiUsage: (month: string) => request(`/api/v1/ai-usage?month=${encodeURIComponent(month)}`),

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
  getFiles: (page = 1, limit = 20, jenisKlaim?: string, fromDate?: string, toDate?: string, search?: string, arsip = false, periode?: string, tampilan?: string) => {
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (jenisKlaim) qs.set('jenis_klaim', jenisKlaim);
    if (fromDate) qs.set('from_date', fromDate);
    if (toDate) qs.set('to_date', toDate);
    if (search) qs.set('search', search);
    // Tanpa penanda ini daftar menampilkan yang aktif saja; dengan arsip=1
    // justru hanya yang terarsip, supaya ada tempat untuk mengembalikannya.
    if (arsip) qs.set('arsip', '1');
    // Kelompok Periode & Kategori: hanya berkas pada periode itu. "tanpa" = periode
    // belum bisa ditentukan. Tampilan = perlu | siap | bulan_ini | semua.
    if (periode) qs.set('periode', periode);
    if (tampilan) qs.set('tampilan', tampilan);
    return request(`/api/v1/claim-files?${qs.toString()}`);
  },

  // Ringkasan pengelompokan Periode & Kategori: satu baris per kelompok beserta
  // jumlah klaim, yang perlu dikerjakan, dan yang siap. Baris klaimnya dimuat
  // terpisah saat kelompok dibuka, lewat getFiles dengan filter periode.
  getKelompok: (arsip = false, jenisKlaim?: string) => {
    const qs = new URLSearchParams();
    if (arsip) qs.set('arsip', '1');
    if (jenisKlaim) qs.set('jenis_klaim', jenisKlaim);
    const s = qs.toString();
    return request(`/api/v1/claim-files/kelompok${s ? `?${s}` : ''}`);
  },

  // Arsip menggantikan hapus untuk merapikan daftar: datanya tetap utuh dan
  // bisa dikembalikan. Penting karena pengukuran recall bergantung pada klaim
  // lama yang masih ada saat rekap pending BPJS datang ~3 bulan kemudian.
  bulkArchive: (ids: string[]) =>
    request('/api/v1/claim-files/bulk-archive', { method: 'POST', body: JSON.stringify({ ids }) }),
  bulkRestore: (ids: string[]) =>
    request('/api/v1/claim-files/bulk-restore', { method: 'POST', body: JSON.stringify({ ids }) }),
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
  // Daftar Kerja — lembar kerja harian koder. Cakupannya mengikuti filter yang
  // sedang aktif di layar, bukan seluruh basis data.
  exportDaftarKerja: (params: { periode?: string; kategori?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.periode) q.set('periode', params.periode);
    if (params.kategori) q.set('kategori', params.kategori);
    const qs = q.toString();
    return fetch(`${API_BASE}/api/v1/claim-files/export/daftar-kerja${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
    });
  },
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
  uploadTestingBatch: (files: File[], allowedCategories: string[]) => {
    const fd = new FormData();
    files.forEach(file => fd.append('files', file));
    fd.append('allowed_jenis_klaim', JSON.stringify(allowedCategories));
    return request('/api/v1/testing-pending/upload-batch', { method: 'POST', body: fd, timeout: 7200000 });
  },
  getTestingJob: (jobId: string) => request(`/api/v1/testing-pending/jobs/${encodeURIComponent(jobId)}`),
  exportTesting: () => request('/api/v1/testing-pending/export', { timeout: 120000 }),

  uploadTestingPdf: (file: File, jenisKlaim: string, label: { actual_result: string; reference_source: string; actual_reason: string; notes: string }) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('jenis_klaim', jenisKlaim);
    Object.entries(label).forEach(([key, value]) => fd.append(key, value));
    return request('/api/v1/testing-pending/upload', { method: 'POST', body: fd, timeout: 900000 });
  },

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
  // error yang dicurigai sebenarnya ada di dokumen). Pekerjaannya SAMA
  // beratnya dengan upload-pdf (OCR + beberapa panggilan AI berurutan:
  // review utama, kegawatdaruratan, kamus WHO, tindakan, dan sejak malam
  // ini juga INA-CBG & kamus penunjang) -- timeout default 30 detik (dari
  // `request()`) jauh lebih pendek dari waktu nyatanya (pernah >7 menit di
  // produksi), jadi fetch di-abort dan tampil "gagal" padahal backend tetap
  // memproses di belakang layar (ditemukan 2026-10-01, "baca ulang ga
  // bisa"). nginx proxy_read_timeout sudah 600s, bukan itu sumbernya.
  // Disamakan dengan timeout upload-pdf.
  rereadRecord: (recordId: string) =>
    request(`/api/v1/claim-files/records/${recordId}/reread`, { method: 'POST', timeout: 600000 }),

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

  // Saran Koding — Bukti-Dulu Design (5 langkah)
  // Step 1: Extract & Cite
  extractClinicalFacts: (recordId: string, diagnosisSentence: string, procedureSentence: string, jenisKlaim: string) =>
    request('/api/v1/coding/extract-facts', {
      method: 'POST',
      body: JSON.stringify({ record_id: recordId, diagnosis_sentence: diagnosisSentence, procedure_sentence: procedureSentence, jenis_klaim: jenisKlaim })
    }),

  // Step 2: Suggest codes with citations
  suggestCodesWithCitations: (clinicalExtract: Record<string, unknown>) =>
    request('/api/v1/coding/suggest-codes', {
      method: 'POST',
      body: JSON.stringify({ clinical_extract: clinicalExtract })
    }),

  // Step 3: Group codes to INA-CBG (blind to tariff)
  groupCodesToInaCBG: (diagnosisCodes: string[], procedureCodes: string[], jenisKlaim: string) =>
    request('/api/v1/coding/group-codes', {
      method: 'POST',
      body: JSON.stringify({ diagnosis_codes: diagnosisCodes, procedure_codes: procedureCodes, jenis_klaim: jenisKlaim })
    }),

  // Step 4: Lookup tariff from PMK 3/2023
  lookupTariff: (inacbgCode: string, region: string, kelasRs: string) =>
    request('/api/v1/coding/tariff-lookup', {
      method: 'POST',
      body: JSON.stringify({ inacbg_code: inacbgCode, region, kelas_rs: kelasRs })
    }),

  // Step 5: Generate alternatives with reasoning
  generateAlternatives: (diagnosisCodes: Record<string, unknown>[], procedureCodes: Record<string, unknown>[], selectedInaCbg: string, clinicalExtract: Record<string, unknown>) =>
    request('/api/v1/coding/alternatives', {
      method: 'POST',
      body: JSON.stringify({ diagnosis_codes: diagnosisCodes, procedure_codes: procedureCodes, selected_inacbg: selectedInaCbg, clinical_extract: clinicalExtract })
    }),

  // ── Alur Menjawab Pending BPJS (/api/v1/pending-jawaban) ──
  // Urutan pemakaian di frontend: tautkanUlangSepPending -> petakanAlasanPending
  // -> hitungTriasePending -> getDaftarPendingJawaban -> getItemPendingJawaban
  // -> buatDraftPendingJawaban -> setujuiDraftPendingJawaban/tolakDraftPendingJawaban.
  getPendingJawabanStatistik: (params: { pending_file_id?: string; periode?: string; rincian?: boolean } = {}) => {
    const qs = new URLSearchParams();
    if (params.pending_file_id) qs.set('pending_file_id', params.pending_file_id);
    if (params.periode) qs.set('periode', params.periode);
    if (params.rincian) qs.set('rincian', '1');
    const q = qs.toString();
    return request(`/api/v1/pending-jawaban/sep/statistik${q ? `?${q}` : ''}`) as Promise<PendingJawabanStatistik>;
  },

  tautkanUlangSepPending: (pendingFileId?: string) =>
    request('/api/v1/pending-jawaban/sep/tautkan-ulang', {
      method: 'POST',
      body: JSON.stringify(pendingFileId ? { pending_file_id: pendingFileId } : {}),
      timeout: 60000,
    }) as Promise<{ diperiksa: number; tertaut: number }>,

  petakanAlasanPending: (params: { pending_file_id?: string; ulang?: boolean; pakai_ai?: boolean } = {}) =>
    request('/api/v1/pending-jawaban/alasan/petakan', {
      method: 'POST',
      body: JSON.stringify(params),
      // Pemetaan pakai AI bisa memproses banyak baris sekaligus — beri waktu
      // lebih longgar, konsisten dengan endpoint AI lain di file ini.
      timeout: 120000,
    }),

  getRingkasanAlasanPending: (params: { pending_file_id?: string; periode?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.pending_file_id) qs.set('pending_file_id', params.pending_file_id);
    if (params.periode) qs.set('periode', params.periode);
    const q = qs.toString();
    return request(`/api/v1/pending-jawaban/alasan/ringkasan${q ? `?${q}` : ''}`) as Promise<PendingJawabanAlasanRingkasan>;
  },

  // Koreksi manual kategori alasan — sekali dikoreksi manusia, backend tidak
  // pernah menimpanya lagi otomatis (lihat kontrak API).
  koreksiKategoriAlasanPending: (pendingId: string, kategori: string) =>
    request(`/api/v1/pending-jawaban/alasan/${pendingId}`, { method: 'PATCH', body: JSON.stringify({ kategori }) }),

  hitungTriasePending: (params: { pending_file_id?: string; pending_id?: string; ulang?: boolean } = {}) =>
    request('/api/v1/pending-jawaban/triase/hitung', { method: 'POST', body: JSON.stringify(params), timeout: 120000 }),

  getRingkasanTriasePending: (pendingFileId?: string) =>
    request(`/api/v1/pending-jawaban/triase/ringkasan${pendingFileId ? `?pending_file_id=${pendingFileId}` : ''}`) as Promise<PendingJawabanTriaseRingkasan>,

  // Putusan kotak manual koder — menimpa hasil hitung otomatis untuk 1 klaim.
  updateTriasePending: (pendingId: string, data: { kotak: KotakTriase | null; catatan?: string }) =>
    request(`/api/v1/pending-jawaban/triase/${pendingId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  getDaftarPendingJawaban: (params: {
    pending_file_id?: string;
    kotak?: string;
    kategori?: string;
    jenis_rawat?: string;
    status_draft?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    const q = qs.toString();
    return request(`/api/v1/pending-jawaban/daftar${q ? `?${q}` : ''}`) as Promise<PendingJawabanDaftarResponse>;
  },

  getItemPendingJawaban: (pendingId: string) =>
    request(`/api/v1/pending-jawaban/item/${pendingId}`) as Promise<PendingJawabanItemDetail>,

  // pakaiAi=true (bawaan): draf disusun AI dengan kutipan berkas. pakaiAi=false
  // menghasilkan draf kosong/template untuk diisi manual koder.
  buatDraftPendingJawaban: (pendingId: string, pakaiAi = true) =>
    request(`/api/v1/pending-jawaban/item/${pendingId}/draft`, {
      method: 'POST',
      body: JSON.stringify({ pakai_ai: pakaiAi }),
      timeout: 90000,
    }),

  getRiwayatDraftPendingJawaban: (pendingId: string) =>
    request(`/api/v1/pending-jawaban/item/${pendingId}/draft`) as Promise<{ riwayat: PendingJawabanDraftVersi[] } | PendingJawabanDraftVersi[]>,

  // akuiPoinTanpaBukti: perlu true kalau backend menolak dengan 409
  // kode='perlu_pengakuan' (ada poin draf tanpa bukti berkas yang koder minta
  // tetap disetujui secara sadar).
  setujuiDraftPendingJawaban: (draftId: string, data: { catatan?: string; akui_poin_tanpa_bukti?: boolean } = {}) =>
    request(`/api/v1/pending-jawaban/draft/${draftId}/setujui`, { method: 'POST', body: JSON.stringify(data) }),

  tolakDraftPendingJawaban: (draftId: string, alasan?: string) =>
    request(`/api/v1/pending-jawaban/draft/${draftId}/tolak`, { method: 'POST', body: JSON.stringify({ alasan }) }),
};
