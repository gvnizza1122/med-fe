import { api } from '@/lib/api';

test.each(['tinjau', 'tanya'])('pemeriksaan %s tidak diputus frontend sebelum penalaran tinggi selesai', async jenis => {
  const asli = global.fetch;
  jest.useFakeTimers();
  let selesai!: (value: Response) => void;
  const f = jest.fn((_url: string, _options?: RequestInit) => new Promise<Response>(resolve => { selesai = resolve; }));
  global.fetch = f as unknown as typeof fetch;
  try {
    const hasil = jenis === 'tinjau' ? api.tinjauDiagnosis('record-simulasi') : api.tanyaAgenCasemix('record-simulasi', 'Pertanyaan fiktif');
    const signal = f.mock.calls[0][1]?.signal;
    await jest.advanceTimersByTimeAsync(121000);
    expect(signal?.aborted).toBe(false);
    expect(f).toHaveBeenCalledTimes(1);
    selesai(new Response(JSON.stringify({ selesai: true }), { status: 200, headers: { 'content-type': 'application/json' } }));
    await expect(hasil).resolves.toEqual({ selesai: true });
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    global.fetch = asli;
    jest.useRealTimers();
  }
});
