/**
 * @fileoverview Unit tests untuk fungsi api.ts alur "Menjawab Pending BPJS"
 * (backend /api/v1/pending-jawaban, src/lib/api.ts).
 *
 * Rekap pending masih KOSONG di produksi per 1 Okt 2026, jadi tes ini hanya
 * memverifikasi bahwa api.ts membangun URL/method/body sesuai kontrak API
 * yang disepakati (lihat HANDOFF.md backend), dan bahwa error dengan `kode`
 * mesin (409 perlu_pengakuan/bukti_gugur, dst.) diteruskan ke pemanggil —
 * BUKAN pengujian terhadap data pending yang asli.
 */
import { api } from '@/lib/api';

type FetchCall = [string, RequestInit | undefined];

function mockFetchOnce(body: unknown, opts: { status?: number; ok?: boolean } = {}) {
  const status = opts.status ?? 200;
  const ok = opts.ok ?? (status >= 200 && status < 300);
  const fetchMock = jest.fn().mockResolvedValue({
    ok,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
  });
  (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function lastCall(fetchMock: jest.Mock): FetchCall {
  return fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as FetchCall;
}

describe('api.ts — alur pending-jawaban', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('getPendingJawabanStatistik menyertakan pending_file_id, periode, dan rincian di query string', async () => {
    const fetchMock = mockFetchOnce({ total: 0, cocok: 0, cocok_persis: 0, cocok_normalisasi: 0, klaim_tidak_ada: 0, format: 'xlsx', per_periode: [] });
    await api.getPendingJawabanStatistik({ pending_file_id: 'file-1', periode: '2026-08', rincian: true });

    const [url] = lastCall(fetchMock);
    expect(url).toContain('/api/v1/pending-jawaban/sep/statistik');
    expect(url).toContain('pending_file_id=file-1');
    expect(url).toContain('periode=2026-08');
    expect(url).toContain('rincian=1');
  });

  it('getPendingJawabanStatistik tanpa parameter tidak menambah query string', async () => {
    const fetchMock = mockFetchOnce({ total: 0 });
    await api.getPendingJawabanStatistik();
    const [url] = lastCall(fetchMock);
    expect(url).toBe('http://localhost:5000/api/v1/pending-jawaban/sep/statistik');
  });

  it('tautkanUlangSepPending mengirim POST dengan body kosong kalau tanpa file id', async () => {
    const fetchMock = mockFetchOnce({ diperiksa: 0, tertaut: 0 });
    await api.tautkanUlangSepPending();
    const [url, options] = lastCall(fetchMock);
    expect(url).toBe('http://localhost:5000/api/v1/pending-jawaban/sep/tautkan-ulang');
    expect(options?.method).toBe('POST');
    expect(JSON.parse(options?.body as string)).toEqual({});
  });

  it('tautkanUlangSepPending menyertakan pending_file_id di body kalau diisi', async () => {
    const fetchMock = mockFetchOnce({ diperiksa: 1, tertaut: 1 });
    await api.tautkanUlangSepPending('file-9');
    const [, options] = lastCall(fetchMock);
    expect(JSON.parse(options?.body as string)).toEqual({ pending_file_id: 'file-9' });
  });

  it('petakanAlasanPending mengirim pending_file_id, ulang, dan pakai_ai apa adanya', async () => {
    const fetchMock = mockFetchOnce({ oleh_aturan: 0, oleh_ai: 0, tidak_terpetakan: 0, dilewati_manual: 0, konflik_jenis: 0 });
    await api.petakanAlasanPending({ pending_file_id: 'file-1', ulang: true, pakai_ai: false });
    const [url, options] = lastCall(fetchMock);
    expect(url).toBe('http://localhost:5000/api/v1/pending-jawaban/alasan/petakan');
    expect(options?.method).toBe('POST');
    expect(JSON.parse(options?.body as string)).toEqual({ pending_file_id: 'file-1', ulang: true, pakai_ai: false });
  });

  it('koreksiKategoriAlasanPending mengirim PATCH ke /alasan/:pendingId dengan kategori', async () => {
    const fetchMock = mockFetchOnce({ id: 'p-1', kategori: 'Berkas Kurang' });
    await api.koreksiKategoriAlasanPending('p-1', 'Berkas Kurang');
    const [url, options] = lastCall(fetchMock);
    expect(url).toBe('http://localhost:5000/api/v1/pending-jawaban/alasan/p-1');
    expect(options?.method).toBe('PATCH');
    expect(JSON.parse(options?.body as string)).toEqual({ kategori: 'Berkas Kurang' });
  });

  it('updateTriasePending mengizinkan kotak null untuk mengosongkan putusan manual', async () => {
    const fetchMock = mockFetchOnce({ id: 'p-1', kotak: null });
    await api.updateTriasePending('p-1', { kotak: null, catatan: 'batal' });
    const [url, options] = lastCall(fetchMock);
    expect(url).toBe('http://localhost:5000/api/v1/pending-jawaban/triase/p-1');
    expect(options?.method).toBe('PATCH');
    expect(JSON.parse(options?.body as string)).toEqual({ kotak: null, catatan: 'batal' });
  });

  it('getDaftarPendingJawaban membuang parameter kosong/undefined dari query string', async () => {
    const fetchMock = mockFetchOnce({ total: 0, page: 1, limit: 20, items: [] });
    await api.getDaftarPendingJawaban({ kotak: 'A', kategori: '', jenis_rawat: undefined, page: 2, limit: 20 });
    const [url] = lastCall(fetchMock);
    expect(url).toContain('kotak=A');
    expect(url).toContain('page=2');
    expect(url).toContain('limit=20');
    expect(url).not.toContain('kategori=');
    expect(url).not.toContain('jenis_rawat=');
  });

  it('getItemPendingJawaban memanggil GET ke /item/:pendingId', async () => {
    const fetchMock = mockFetchOnce({
      pending: { id: 'p-1' }, triase: null, draft: null,
      kolom: { alasan_pending: '', jawaban: '', bukti: [] }, riwayat_versi: [],
    });
    await api.getItemPendingJawaban('p-1');
    const [url, options] = lastCall(fetchMock);
    expect(url).toBe('http://localhost:5000/api/v1/pending-jawaban/item/p-1');
    expect(options?.method ?? 'GET').toBe('GET');
  });

  it('buatDraftPendingJawaban mengirim pakai_ai=true secara bawaan', async () => {
    const fetchMock = mockFetchOnce({ id: 'draft-1' }, { status: 201 });
    await api.buatDraftPendingJawaban('p-1');
    const [url, options] = lastCall(fetchMock);
    expect(url).toBe('http://localhost:5000/api/v1/pending-jawaban/item/p-1/draft');
    expect(options?.method).toBe('POST');
    expect(JSON.parse(options?.body as string)).toEqual({ pakai_ai: true });
  });

  it('setujuiDraftPendingJawaban mengirim akui_poin_tanpa_bukti saat diminta', async () => {
    const fetchMock = mockFetchOnce({ id: 'draft-1', status: 'siap' });
    await api.setujuiDraftPendingJawaban('draft-1', { catatan: 'ok', akui_poin_tanpa_bukti: true });
    const [url, options] = lastCall(fetchMock);
    expect(url).toBe('http://localhost:5000/api/v1/pending-jawaban/draft/draft-1/setujui');
    expect(JSON.parse(options?.body as string)).toEqual({ catatan: 'ok', akui_poin_tanpa_bukti: true });
  });

  it('tolakDraftPendingJawaban mengirim alasan ke /draft/:draftId/tolak', async () => {
    const fetchMock = mockFetchOnce({ id: 'draft-1', status: 'ditolak' });
    await api.tolakDraftPendingJawaban('draft-1', 'tidak relevan');
    const [url, options] = lastCall(fetchMock);
    expect(url).toBe('http://localhost:5000/api/v1/pending-jawaban/draft/draft-1/tolak');
    expect(JSON.parse(options?.body as string)).toEqual({ alasan: 'tidak relevan' });
  });

  it('meneruskan `kode` dari error 409 (mis. perlu_pengakuan) supaya UI bisa membedakan penolakan spesifik', async () => {
    mockFetchOnce({ error: 'Ada poin tanpa bukti', kode: 'perlu_pengakuan' }, { status: 409, ok: false });
    await expect(api.setujuiDraftPendingJawaban('draft-1')).rejects.toMatchObject({
      message: 'Ada poin tanpa bukti',
      kode: 'perlu_pengakuan',
      status: 409,
    });
  });

  it('meneruskan `kode` 422 belum_dipetakan dari hitungTriasePending', async () => {
    mockFetchOnce({ error: 'Alasan belum dipetakan', kode: 'belum_dipetakan' }, { status: 422, ok: false });
    await expect(api.hitungTriasePending({ pending_id: 'p-1' })).rejects.toMatchObject({
      kode: 'belum_dipetakan',
      status: 422,
    });
  });

  it('error tanpa field `kode` tetap melempar Error biasa tanpa properti kode', async () => {
    mockFetchOnce({ error: 'Server bermasalah' }, { status: 500, ok: false });
    await expect(api.getPendingJawabanStatistik()).rejects.toMatchObject({ message: 'Server bermasalah' });
  });
});
