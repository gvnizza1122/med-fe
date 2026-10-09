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

async function request<T = unknown>(endpoint: string, options: RequestInit & { timeout?: number } = {}, _isRetry = false): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  const headers: Record<string, string> = { ...options.headers as Record<string, string> };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';

  // Pesan untuk pengguna akhir (perawat/verifikator) — tanpa istilah teknis.
  let res: Response;
  try {
    const timeoutMs = options.timeout ?? 30000; // default 30 detik
    const controller = new AbortController();
    const timeoutId = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : undefined;

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
      if (refreshed) return request<T>(endpoint, options, true);
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
  return res as T;
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
  getKatalogPedoman: <T = unknown>(params: Record<string, string> = {}) => request<T>('/api/v1/katalog-pedoman?' + new URLSearchParams(params)),
  getPedoman: <T = unknown>(id: string, q = '') => request<T>(`/api/v1/katalog-pedoman/${encodeURIComponent(id)}?q=${encodeURIComponent(q)}`),
  getPdfPedoman: (id: string, varian = 0): Promise<Response> => request<Response>(`/api/v1/katalog-pedoman/${encodeURIComponent(id)}/pdf?varian=${varian}`, { timeout: 120000 }),
  getVitalReferences: <T = unknown>() => request<T>('/api/v1/claim-files/reference/vital-ranges'),
  // Auth
  login: <T = unknown>(username: string, password: string) =>
    request<T>('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  getMe: <T = unknown>() => request<T>('/api/v1/auth/me'),
  lookupCodeDescriptions: (diagnosis: string[], procedure: string[]): Promise<{ diagnosis: Record<string, string>; procedure: Record<string, string> }> =>
    request<{ diagnosis: Record<string, string>; procedure: Record<string, string> }>('/api/v1/code-descriptions/lookup', { method: 'POST', body: JSON.stringify({ diagnosis, procedure }) }),
  // Tab "Saran AI": diagnosis, prosedur, INA-CBG & tarif yang disusun dari isi
  // berkas. Hanya dibaca, tidak mengubah data klaim.
  // Daftar pasien di samping Hasil Validasi: klaim dengan periode (bulan
  // pelayanan) yang sama dengan record ini. status: semua | pending | valid.
  getPasienSebulan: <T = unknown>(recordId: string, params: Record<string, string> = {}) =>
    request<T>(`/api/v1/claim-files/records/${recordId}/sebulan?${new URLSearchParams(params).toString()}`),
  getSaranKoding: <T = unknown>(recordId: string) =>
    request<T>(`/api/v1/claim-files/records/${recordId}/saran-koding`),

  // Tarif INA-CBG dan iDRG berdampingan + koding versi iDRG. Hanya dibaca.
  getTarifGanda: <T = unknown>(recordId: string) =>
    request<T>(`/api/v1/claim-files/records/${recordId}/tarif-ganda`),

  getPemeriksaanPenunjang: <T = unknown>(recordId: string) =>
    request<T>(`/api/v1/claim-files/records/${recordId}/pemeriksaan-penunjang`),

  getLaporanOperasi: <T = unknown>(recordId: string) =>
    request<T>(`/api/v1/claim-files/records/${recordId}/laporan-operasi`,{cache:'no-store'}),

  getLaporanCasemix: <T = unknown>(recordId: string) =>
    request<T>(`/api/v1/claim-files/records/${recordId}/laporan-casemix`),

  tanyaAgenCasemix: <T = unknown>(recordId: string, pertanyaan: string, riwayat: { peran: 'koder' | 'agen'; isi: string }[] = []) =>
    request<T>(`/api/v1/claim-files/records/${recordId}/agen-casemix/tanya`, { method: 'POST', body: JSON.stringify({ pertanyaan, riwayat }), timeout: 600000 }),

  simpanKeputusanCasemix: <T = unknown>(recordId: string, data: { diagnosis: string; prosedur: string; catatan: string }) =>
    request<T>(`/api/v1/claim-files/records/${recordId}/keputusan-casemix`, { method: 'POST', body: JSON.stringify(data) }),

  simpanEvaluasiCasemix: <T = unknown>(recordId: string, data: { status: 'pending' | 'valid' | 'perlu_klarifikasi'; alasan: string; bukti: { halaman: number; kutipan: string }[] }) =>
    request<T>(`/api/v1/claim-files/records/${recordId}/evaluasi-casemix`, { method: 'POST', body: JSON.stringify(data) }),

  tinjauDiagnosis: <T = unknown>(recordId: string, paksaSol = false) =>
    request<T>(`/api/v1/claim-files/records/${recordId}/tinjauan-diagnosis`, { method: 'POST', body: JSON.stringify({ paksa_sol: paksaSol }), timeout: 600000 }),

  getTestingPending: <T = unknown>(jenisKlaim: string, page = 1, search = '', includeArsip = false) =>
    request<T>(`/api/v1/testing-pending?${new URLSearchParams({ jenis_klaim: jenisKlaim, page: String(page), search, include_arsip: includeArsip ? '1' : '0' })}`),
  saveTestingPending: <T = unknown>(recordId: string, data: { actual_result: string; reference_source: string; actual_reason: string; reason_match: string; notes: string }) =>
    request<T>(`/api/v1/testing-pending/${encodeURIComponent(recordId)}`, { method: 'PUT', body: JSON.stringify(data) }),

  getAiFileCosts: <T = unknown>(month: string, page = 1) => request<T>(`/api/v1/ai-usage/files?month=${encodeURIComponent(month)}&page=${page}`),
  getAiUsage: <T = unknown>(month: string) => request<T>(`/api/v1/ai-usage?month=${encodeURIComponent(month)}`),

  // Dashboard
  getDashboard: <T = unknown>(period?: string) =>
    request<T>(`/api/v1/dashboard/summary${period ? `?period=${period}` : ''}`),
  getErrorTrends: <T = unknown>() => request<T>('/api/v1/dashboard/error-trends'),

  // Claim Files
  uploadFile: <T = unknown>(file: File, period?: string, fileId?: string) => {
    const fd = new FormData();
    fd.append('file', file);
    if (period) fd.append('period', period);
    if (fileId) fd.append('fileId', fileId);
    return request<T>('/api/v1/claim-files/upload', { method: 'POST', body: fd });
  },
  getFiles: <T = unknown>(page = 1, limit = 20, jenisKlaim?: string, fromDate?: string, toDate?: string, search?: string, arsip = false, periode?: string, tampilan?: string) => {
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
    return request<T>(`/api/v1/claim-files?${qs.toString()}`);
  },

  // Ringkasan pengelompokan Periode & Kategori: satu baris per kelompok beserta
  // jumlah klaim, yang perlu dikerjakan, dan yang siap. Baris klaimnya dimuat
  // terpisah saat kelompok dibuka, lewat getFiles dengan filter periode.
  getKelompok: <T = unknown>(arsip = false, jenisKlaim?: string) => {
    const qs = new URLSearchParams();
    if (arsip) qs.set('arsip', '1');
    if (jenisKlaim) qs.set('jenis_klaim', jenisKlaim);
    const s = qs.toString();
    return request<T>(`/api/v1/claim-files/kelompok${s ? `?${s}` : ''}`);
  },

  // Arsip menggantikan hapus untuk merapikan daftar: datanya tetap utuh dan
  // bisa dikembalikan. Penting karena pengukuran recall bergantung pada klaim
  // lama yang masih ada saat rekap pending BPJS datang ~3 bulan kemudian.
  bulkArchive: <T = unknown>(ids: string[]) =>
    request<T>('/api/v1/claim-files/bulk-archive', { method: 'POST', body: JSON.stringify({ ids }) }),
  bulkRestore: <T = unknown>(ids: string[]) =>
    request<T>('/api/v1/claim-files/bulk-restore', { method: 'POST', body: JSON.stringify({ ids }) }),
  getFile: <T = unknown>(id: string) => request<T>(`/api/v1/claim-files/${id}`),
  getRecords: <T = unknown>(fileId: string, params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<T>(`/api/v1/claim-files/${fileId}/records?${qs}`);
  },
  approveFile: <T = unknown>(id: string) =>
    request<T>(`/api/v1/claim-files/${id}/approve`, { method: 'POST' }),
  deleteFile: <T = unknown>(id: string) =>
    request<T>(`/api/v1/claim-files/${id}`, { method: 'DELETE' }),
  exportFile: (id: string, filter = 'error') =>
    fetch(`${API_BASE}/api/v1/claim-files/${id}/export?filter=${filter}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
    }),
  // Daftar Kerja — lembar kerja harian koder. Cakupannya mengikuti filter yang
  // sedang aktif di layar, bukan seluruh basis data.
  exportDaftarKerja: (params: { periode?: string; kategori?: string; from_date?: string; to_date?: string; search?: string; arsip?: boolean; samarkan_nama?: boolean } = {}) => {
    const q = new URLSearchParams();
    if (params.periode) q.set('periode', params.periode);
    if (params.kategori) q.set('kategori', params.kategori);
    if (params.from_date) q.set('from_date', params.from_date);
    if (params.to_date) q.set('to_date', params.to_date);
    if (params.search) q.set('search', params.search);
    if (params.arsip) q.set('arsip', '1');
    if (params.samarkan_nama) q.set('samarkan_nama', '1');
    const qs = q.toString();
    return fetch(`${API_BASE}/api/v1/claim-files/export/daftar-kerja${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
    });
  },
  exportSiapSubmit: (params: { periode?: string; kategori?: string; from_date?: string; to_date?: string; search?: string; arsip?: boolean } = {}) => {
    const q = new URLSearchParams();
    if (params.periode) q.set('periode', params.periode);
    if (params.kategori) q.set('kategori', params.kategori);
    if (params.from_date) q.set('from_date', params.from_date);
    if (params.to_date) q.set('to_date', params.to_date);
    if (params.search) q.set('search', params.search);
    if (params.arsip) q.set('arsip', '1');
    if (params.from_date) q.set('from_date', params.from_date);
    if (params.to_date) q.set('to_date', params.to_date);
    if (params.search) q.set('search', params.search);
    if (params.arsip) q.set('arsip', '1');
    const qs = q.toString();
    return fetch(`${API_BASE}/api/v1/claim-files/export/siap-submit${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
    });
  },
  // Klaim pending satu bulan: tabel alasan pending & saran dengan kolom
  // Jawaban Rumah Sakit (diisi casemix).
  exportPendingBulanan: (periode: string, arsip = false) =>
    fetch(`${API_BASE}/api/v1/claim-files/export/pending-bulanan?periode=${encodeURIComponent(periode)}&arsip=${arsip ? '1' : '0'}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
    }),
  runAiAudit: <T = unknown>(id: string) =>
    request<T>(`/api/v1/claim-files/${id}/ai-audit`, { method: 'POST' }),
  auditRecordFields: <T = unknown>(recordId: string, fields: string[] = [], style = 'ponytail') =>
    request<T>(`/api/v1/records/${recordId}/audit`, { method: 'POST', body: JSON.stringify({ fields, style }) }),
  sendAuditFeedback: <T = unknown>(auditId: string, nurse_action: 'accepted' | 'rejected' | 'unsure') =>
    request<T>(`/api/v1/records/audit/${auditId}/feedback`, { method: 'POST', body: JSON.stringify({ nurse_action }) }),

  // Validation Rules
  getRules: <T = unknown>() => request<T>('/api/v1/validation-rules'),
  updateRule: <T = unknown>(id: string, data: Record<string, unknown>) =>
    request<T>(`/api/v1/validation-rules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Hospital Settings (Profil RS — Kode RS & Kelas RS, dipakai auto-fill saat upload PDF)
  getHospitalSettings: <T = unknown>() => request<T>('/api/v1/hospital-settings'),
  getClaimProfile: <T = unknown>() => request<T>('/api/v1/hospital-settings/claim-profile'),
  updateClaimProfile: <T = unknown>(data: Record<string, unknown>) =>
    request<T>('/api/v1/hospital-settings/claim-profile', { method: 'PUT', body: JSON.stringify(data) }),
  updateHospitalSettings: <T = unknown>(data: { kelas_rs: string }) =>
    request<T>('/api/v1/hospital-settings', { method: 'PUT', body: JSON.stringify(data) }),

  // Users
  getUsers: <T = unknown>() => request<T>('/api/v1/users'),
  createUser: <T = unknown>(data: Record<string, string>) =>
    request<T>('/api/v1/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: <T = unknown>(id: string, data: Record<string, unknown>) =>
    request<T>(`/api/v1/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: <T = unknown>(id: string) =>
    request<T>(`/api/v1/users/${id}`, { method: 'DELETE' }),

  // Audit Log
  getAuditLogs: <T = unknown>(page = 1, limit = 30, filters?: { user_email?: string; action?: string; resource_type?: string; from_date?: string; to_date?: string }) => {
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (filters?.user_email) qs.set('user_email', filters.user_email);
    if (filters?.action) qs.set('action', filters.action);
    if (filters?.resource_type) qs.set('resource_type', filters.resource_type);
    if (filters?.from_date) qs.set('from_date', filters.from_date);
    if (filters?.to_date) qs.set('to_date', filters.to_date);
    return request<T>(`/api/v1/audit-logs?${qs.toString()}`);
  },

  // PDF Upload
  uploadTestingBatch: <T = unknown>(files: File[], allowedCategories: string[]) => {
    const fd = new FormData();
    files.forEach(file => fd.append('files', file));
    fd.append('allowed_jenis_klaim', JSON.stringify(allowedCategories));
    return request<T>('/api/v1/testing-pending/upload-batch', { method: 'POST', body: fd, timeout: 7200000 });
  },
  getTestingJob: <T = unknown>(jobId: string) => request<T>(`/api/v1/testing-pending/jobs/${encodeURIComponent(jobId)}`),
  exportTesting: <T = unknown>() => request<T>('/api/v1/testing-pending/export', { timeout: 120000 }),

  uploadTestingPdf: <T = unknown>(file: File, jenisKlaim: string, label: { actual_result: string; reference_source: string; actual_reason: string; notes: string }) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('jenis_klaim', jenisKlaim);
    Object.entries(label).forEach(([key, value]) => fd.append(key, value));
    return request<T>('/api/v1/testing-pending/upload', { method: 'POST', body: fd, timeout: 900000 });
  },

  uploadPdf: <T = unknown>(file: File, jenisKlaim: string) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('jenis_klaim', jenisKlaim);
    // Ekstraksi AI biasanya 10-20 detik, tapi berkas RAWAT_INAP (banyak
    // halaman/catatan multi-hari -> OCR + AI review lebih lama) bisa jauh
    // Menunggu hingga server selesai; file besar tidak diputus oleh durasi.
    return request<T>('/api/v1/claim-files/upload-pdf', { method: 'POST', body: fd, timeout: 0 });
  },

  // PDF Upload — batch (banyak file, 1 kategori pelayanan untuk semua file).
  // Maksimal 300 file; penerimaan dan pemrosesan tidak dibatasi durasi di klien.
  // allowedJenisKlaim: kategori yang MUNGKIN ada di batch ini (verifikator
  // toggle 1/2/3 kategori sebelum drag file) — BUKAN kategori pasti per file.
  // Backend mendeteksi kategori tiap file dari isi dokumennya sendiri,
  // dibatasi ke daftar ini (lihat /upload-pdf-batch, allowed_jenis_klaim).
  // Unggah berantrean: server membalas 202 + id proses; pembacaan berjalan di
  // latar belakang dan dipantau lewat getProsesUnggah (tahan refresh).
  uploadPdfAntre: <T = unknown>(files: File[], allowedJenisKlaim: string[]) => {
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    fd.append('allowed_jenis_klaim', JSON.stringify(allowedJenisKlaim));
    return request<T>('/api/v1/claim-files/upload-pdf-antre', { method: 'POST', body: fd, timeout: 0 });
  },
  getProsesUnggah: <T = unknown>() => request<T>('/api/v1/claim-files/proses-unggah'),
  tutupProsesUnggah: <T = unknown>(ids: string[]) =>
    request<T>('/api/v1/claim-files/proses-unggah/tutup', { method: 'POST', body: JSON.stringify({ ids }) }),

  uploadPdfBatch: <T = unknown>(files: File[], allowedJenisKlaim: string[]) => {
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    fd.append('allowed_jenis_klaim', JSON.stringify(allowedJenisKlaim));
    return request<T>('/api/v1/claim-files/upload-pdf-batch', { method: 'POST', body: fd, timeout: 0 });
  },

  // Batch Audit (Phase 2)
  batchAuditRecords: <T = unknown>(recordIds: string[], style: 'ponytail' | 'caveman' | 'neutral') =>
    request<T>('/api/v1/records/batch-audit', {
      method: 'POST',
      body: JSON.stringify({ record_ids: recordIds, style }),
    }),

  // SIMRS Ingestion (Phase 2)
  ingestSimrsJson: <T = unknown>(data: Record<string, unknown>) =>
    request<T>('/api/v1/simrs/ingest', {
      method: 'POST',
      body: JSON.stringify({ data }),
    }),

  ingestSimrsPdf: <T = unknown>(file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<T>('/api/v1/simrs/ingest', { method: 'POST', body: fd });
  },

  // Record Verification (Phase 2)
  updateRecordValues: <T = unknown>(recordId: string, updates: Record<string, unknown>) =>
    request<T>(`/api/v1/claim-files/${recordId}/update-values`, {
      method: 'POST',
      body: JSON.stringify({ updates }),
    }),

  getRecordValidationErrors: <T = unknown>(recordId: string) =>
    request<T>(`/api/v1/claim-files/${recordId}/validation-errors`),

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
  rereadRecord: <T = unknown>(recordId: string) =>
    request<T>(`/api/v1/claim-files/records/${recordId}/reread`, { method: 'POST', timeout: 0 }),

  // RV-20 (kriteria kegawatan IGD) — audit trail konfirmasi manual checklist.
  getRv20Confirmation: <T = unknown>(recordId: string) => request<T>(`/api/v1/records/${recordId}/rv20-confirm`),
  confirmRv20: <T = unknown>(recordId: string, checklistItems: Record<string, boolean>) =>
    request<T>(`/api/v1/records/${recordId}/rv20-confirm`, { method: 'POST', body: JSON.stringify({ checklist_items: checklistItems }) }),

  // Exempt PRB (RV-15) — daftar pasien kronis yang sengaja tidak dialihkan
  // ke Program Rujuk Balik walau sudah stabil >=3 bulan berturut, dikelola
  // admin. Dicek otomatis oleh detectAndFlagPRB() di backend.
  getPrbExemptions: <T = unknown>() => request<T>('/api/v1/prb-exempt'),
  createPrbExemption: <T = unknown>(data: Record<string, string>) =>
    request<T>('/api/v1/prb-exempt', { method: 'POST', body: JSON.stringify(data) }),
  updatePrbExemption: <T = unknown>(id: string, data: Record<string, string>) =>
    request<T>(`/api/v1/prb-exempt/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePrbExemption: <T = unknown>(id: string) =>
    request<T>(`/api/v1/prb-exempt/${id}`, { method: 'DELETE' }),

  // Scan ulang RV-13/15/16 untuk 1 periode bulan ("MM/YYYY") — perlu karena
  // deteksi lintas-record cuma otomatis nyala saat file BARU diupload.
  scanEpisodes: <T = unknown>(periodeBulan: string) =>
    request<T>('/api/v1/claim-files/scan-episodes', { method: 'POST', body: JSON.stringify({ periode_bulan: periodeBulan }) }),

  // PDF asli yang diunggah — via helper request supaya dapat timeout + refresh
  // token otomatis; untuk konten non-JSON helper mengembalikan Response mentah
  // yang bisa diubah jadi blob lalu ditampilkan via <iframe>.
  getPdfFile: (fileId: string): Promise<Response> =>
    request<Response>(`/api/v1/claim-files/${fileId}/file`),

  // Jawaban Pending BPJS — upload PDF surat pending, AI ekstrak alasan +
  // generate draft klarifikasi (dengan few-shot dari kasus sukses sebelumnya).
  uploadBpjsPending: <T = unknown>(recordId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<T>(`/api/v1/records/${recordId}/pending-upload`, { method: 'POST', body: fd, timeout: 120000 });
  },
  getBpjsPending: <T = unknown>(recordId: string) => request<T>(`/api/v1/records/${recordId}/pending`),
  updateBpjsPendingStatus: <T = unknown>(pendingId: string, data: { status?: string; outcome?: string; poin_kunci?: string; draft_klarifikasi?: string }) =>
    request<T>(`/api/v1/records/pending/${pendingId}/status`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Rekap Pending BPJS berformat Excel (2 sheet "Pending RJ"/"Pending RI",
  // 1 baris = 1 klaim pending) — import massal, bukan surat PDF per-klaim.
  importPendingXlsx: <T = unknown>(file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<T>('/api/v1/records/pending-import-xlsx', { method: 'POST', body: fd, timeout: 60000 });
  },
  getPendingList: <T = unknown>(params: { status?: string; outcome?: string; jenis_klaim?: string; search?: string; pending_file_id?: string; page?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    const q = qs.toString();
    return request<T>(`/api/v1/records/pending${q ? `?${q}` : ''}`);
  },
  generatePendingDraft: <T = unknown>(id: string) =>
    request<T>(`/api/v1/records/pending/${id}/generate-draft`, { method: 'POST', timeout: 90000 }),

  // Daftar file Excel rekap pending yang sudah diimpor (tampilan per-file,
  // seperti Riwayat Upload) — lihat pending-bpjs/page.tsx dan [fileId]/page.tsx.
  getPendingFiles: <T = unknown>(params: { page?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined) qs.set(k, String(v)); });
    const q = qs.toString();
    return request<T>(`/api/v1/records/pending-files${q ? `?${q}` : ''}`);
  },

  // Saran Koding — Bukti-Dulu Design (5 langkah)
  // Step 1: Extract & Cite
  extractClinicalFacts: <T = unknown>(recordId: string, diagnosisSentence: string, procedureSentence: string, jenisKlaim: string) =>
    request<T>('/api/v1/coding/extract-facts', {
      method: 'POST',
      body: JSON.stringify({ record_id: recordId, diagnosis_sentence: diagnosisSentence, procedure_sentence: procedureSentence, jenis_klaim: jenisKlaim })
    }),

  // Step 2: Suggest codes with citations
  suggestCodesWithCitations: <T = unknown>(clinicalExtract: Record<string, unknown>) =>
    request<T>('/api/v1/coding/suggest-codes', {
      method: 'POST',
      body: JSON.stringify({ clinical_extract: clinicalExtract })
    }),

  // Step 3: Group codes to INA-CBG (blind to tariff)
  groupCodesToInaCBG: <T = unknown>(diagnosisCodes: string[], procedureCodes: string[], jenisKlaim: string) =>
    request<T>('/api/v1/coding/group-codes', {
      method: 'POST',
      body: JSON.stringify({ diagnosis_codes: diagnosisCodes, procedure_codes: procedureCodes, jenis_klaim: jenisKlaim })
    }),

  // Step 4: Lookup tariff from PMK 3/2023
  lookupTariff: <T = unknown>(inacbgCode: string, region: string, kelasRs: string) =>
    request<T>('/api/v1/coding/tariff-lookup', {
      method: 'POST',
      body: JSON.stringify({ inacbg_code: inacbgCode, region, kelas_rs: kelasRs })
    }),

  // Step 5: Generate alternatives with reasoning
  generateAlternatives: <T = unknown>(diagnosisCodes: Record<string, unknown>[], procedureCodes: Record<string, unknown>[], selectedInaCbg: string, clinicalExtract: Record<string, unknown>) =>
    request<T>('/api/v1/coding/alternatives', {
      method: 'POST',
      body: JSON.stringify({ diagnosis_codes: diagnosisCodes, procedure_codes: procedureCodes, selected_inacbg: selectedInaCbg, clinical_extract: clinicalExtract })
    }),

  // ── Alur Menjawab Pending BPJS (/api/v1/pending-jawaban) ──
  // Urutan pemakaian di frontend: tautkanUlangSepPending -> petakanAlasanPending
  // -> hitungTriasePending -> getDaftarPendingJawaban -> getItemPendingJawaban
  // -> buatDraftPendingJawaban -> setujuiDraftPendingJawaban/tolakDraftPendingJawaban.
  getPendingJawabanStatistik: <T = unknown>(params: { pending_file_id?: string; periode?: string; rincian?: boolean } = {}) => {
    const qs = new URLSearchParams();
    if (params.pending_file_id) qs.set('pending_file_id', params.pending_file_id);
    if (params.periode) qs.set('periode', params.periode);
    if (params.rincian) qs.set('rincian', '1');
    const q = qs.toString();
    return request<T>(`/api/v1/pending-jawaban/sep/statistik${q ? `?${q}` : ''}`) as Promise<PendingJawabanStatistik>;
  },

  tautkanUlangSepPending: <T = unknown>(pendingFileId?: string) =>
    request<T>('/api/v1/pending-jawaban/sep/tautkan-ulang', {
      method: 'POST',
      body: JSON.stringify(pendingFileId ? { pending_file_id: pendingFileId } : {}),
      timeout: 60000,
    }) as Promise<{ diperiksa: number; tertaut: number }>,

  petakanAlasanPending: <T = unknown>(params: { pending_file_id?: string; ulang?: boolean; pakai_ai?: boolean } = {}) =>
    request<T>('/api/v1/pending-jawaban/alasan/petakan', {
      method: 'POST',
      body: JSON.stringify(params),
      // Pemetaan pakai AI bisa memproses banyak baris sekaligus — beri waktu
      // lebih longgar, konsisten dengan endpoint AI lain di file ini.
      timeout: 120000,
    }),

  getRingkasanAlasanPending: <T = unknown>(params: { pending_file_id?: string; periode?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.pending_file_id) qs.set('pending_file_id', params.pending_file_id);
    if (params.periode) qs.set('periode', params.periode);
    const q = qs.toString();
    return request<T>(`/api/v1/pending-jawaban/alasan/ringkasan${q ? `?${q}` : ''}`) as Promise<PendingJawabanAlasanRingkasan>;
  },

  // Koreksi manual kategori alasan — sekali dikoreksi manusia, backend tidak
  // pernah menimpanya lagi otomatis (lihat kontrak API).
  koreksiKategoriAlasanPending: <T = unknown>(pendingId: string, kategori: string) =>
    request<T>(`/api/v1/pending-jawaban/alasan/${pendingId}`, { method: 'PATCH', body: JSON.stringify({ kategori }) }),

  hitungTriasePending: <T = unknown>(params: { pending_file_id?: string; pending_id?: string; ulang?: boolean } = {}) =>
    request<T>('/api/v1/pending-jawaban/triase/hitung', { method: 'POST', body: JSON.stringify(params), timeout: 120000 }),

  getRingkasanTriasePending: <T = unknown>(pendingFileId?: string) =>
    request<T>(`/api/v1/pending-jawaban/triase/ringkasan${pendingFileId ? `?pending_file_id=${pendingFileId}` : ''}`) as Promise<PendingJawabanTriaseRingkasan>,

  // Putusan kotak manual koder — menimpa hasil hitung otomatis untuk 1 klaim.
  updateTriasePending: <T = unknown>(pendingId: string, data: { kotak: KotakTriase | null; catatan?: string }) =>
    request<T>(`/api/v1/pending-jawaban/triase/${pendingId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  getDaftarPendingJawaban: <T = unknown>(params: {
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
    return request<T>(`/api/v1/pending-jawaban/daftar${q ? `?${q}` : ''}`) as Promise<PendingJawabanDaftarResponse>;
  },

  getItemPendingJawaban: <T = unknown>(pendingId: string) =>
    request<T>(`/api/v1/pending-jawaban/item/${pendingId}`) as Promise<PendingJawabanItemDetail>,

  // pakaiAi=true (bawaan): draf disusun AI dengan kutipan berkas. pakaiAi=false
  // menghasilkan draf kosong/template untuk diisi manual koder.
  buatDraftPendingJawaban: <T = unknown>(pendingId: string, pakaiAi = true) =>
    request<T>(`/api/v1/pending-jawaban/item/${pendingId}/draft`, {
      method: 'POST',
      body: JSON.stringify({ pakai_ai: pakaiAi }),
      timeout: 90000,
    }),

  getRiwayatDraftPendingJawaban: <T = unknown>(pendingId: string) =>
    request<T>(`/api/v1/pending-jawaban/item/${pendingId}/draft`) as Promise<{ riwayat: PendingJawabanDraftVersi[] } | PendingJawabanDraftVersi[]>,

  // akuiPoinTanpaBukti: perlu true kalau backend menolak dengan 409
  // kode='perlu_pengakuan' (ada poin draf tanpa bukti berkas yang koder minta
  // tetap disetujui secara sadar).
  setujuiDraftPendingJawaban: <T = unknown>(draftId: string, data: { catatan?: string; akui_poin_tanpa_bukti?: boolean } = {}) =>
    request<T>(`/api/v1/pending-jawaban/draft/${draftId}/setujui`, { method: 'POST', body: JSON.stringify(data) }),

  tolakDraftPendingJawaban: <T = unknown>(draftId: string, alasan?: string) =>
    request<T>(`/api/v1/pending-jawaban/draft/${draftId}/tolak`, { method: 'POST', body: JSON.stringify({ alasan }) }),
};
