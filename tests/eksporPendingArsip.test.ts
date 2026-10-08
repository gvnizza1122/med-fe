import { api } from '@/lib/api';

test.each([false, true])('ekspor pending mengirim pilihan arsip %s ke backend', async arsip => {
  const original = global.fetch;
  const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(async () => ({ ok: true } as Response));
  global.fetch = fetchMock as unknown as typeof fetch;
  try {
    await api.exportPendingBulanan('2026-09', arsip);
    const url = new URL(String(fetchMock.mock.calls[0][0]), 'http://localhost');
    expect(url.searchParams.get('periode')).toBe('2026-09');
    expect(url.searchParams.get('arsip')).toBe(arsip ? '1' : '0');
  } finally { global.fetch = original; }
});

test('ekspor pending default tetap mengambil berkas aktif', async () => {
  const original = global.fetch;
  const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(async () => ({ ok: true } as Response));
  global.fetch = fetchMock as unknown as typeof fetch;
  try {
    await api.exportPendingBulanan('2026-09');
    const url = new URL(String(fetchMock.mock.calls[0][0]), 'http://localhost');
    expect(url.searchParams.get('arsip')).toBe('0');
  } finally { global.fetch = original; }
});
