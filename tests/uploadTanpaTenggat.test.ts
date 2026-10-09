import { api } from '@/lib/api';

afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });
test('unggah lambat tidak dibatalkan setelah dua jam', async () => {
  jest.useFakeTimers();
  let selesai!: (value: unknown) => void;
  const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(() => new Promise(resolve => { selesai = resolve; }) as Promise<Response>);
  const upload = api.uploadPdfAntre([], ['RAWAT_INAP']);
  const signal = fetchMock.mock.calls[0][1]?.signal;
  jest.advanceTimersByTime(3 * 60 * 60 * 1000);
  expect(signal?.aborted).toBe(false);
  selesai({ ok: true, status: 202, headers: { get: () => 'application/json' }, json: async () => ({ batch_id: 'tersimpan' }) });
  await expect(upload).resolves.toEqual({ batch_id: 'tersimpan' });
});
