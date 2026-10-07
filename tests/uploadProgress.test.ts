import { formatSisa, gabungFileUnik, jobDariServer, persenKeseluruhan, type ProsesUnggah } from '../src/lib/upload-progress';

function process(id: string, batch: string, status: ProsesUnggah['status'], percent = 0): ProsesUnggah {
  return { id, batch_id: batch, file_name: `${id}.pdf`, status, tahap: 'review_ai', tahap_label: 'Review AI',
    jumlah_halaman: 10, sisa_detik: 50, persen: percent, file_id: null, pesan: null };
}

test('total, processed and progress all exclude completed historical batches', () => {
  const job = jobDariServer([process('old', 'old', 'selesai', 100),
    process('new1', 'new', 'selesai', 100), process('new2', 'new', 'berjalan', 60)]);
  expect(job).toMatchObject({ total: 2, doneCount: 1, failedCount: 0, persen: 80, active: true });
});

test('a selected batch never includes other uploads, even when they are still active', () => {
  const job = jobDariServer([process('a', 'first', 'berjalan', 80), process('b', 'second', 'antre')], 'second');
  expect(job).toMatchObject({ total: 1, doneCount: 0, persen: 0, batchId: 'second' });
  expect(job?.statuses.map(s => s.prosesId)).toEqual(['b']);
});

test('finished batch retains its whole result and rejects repeated process IDs', () => {
  const rows = [process('a', 'batch', 'selesai', 100), process('b', 'batch', 'gagal', 30)];
  expect(jobDariServer([...rows, rows[0]], 'batch')).toMatchObject({ total: 2, doneCount: 1, failedCount: 1,
    persen: 100, active: false, sisaDetik: 0 });
});

test('file order uses upload index rather than order of server response or duplicate name', () => {
  const a = { ...process('a', 'batch', 'antre'), file_name: 'same.pdf', urutan_file: 0 };
  const b = { ...process('b', 'batch', 'berjalan'), file_name: 'same.pdf', urutan_file: 1 };
  expect(jobDariServer([b, a], 'batch')?.statuses.map(s => s.prosesId)).toEqual(['a', 'b']);
});

test('active progress cannot round up to 100 and invalid values cannot corrupt it', () => {
  expect(persenKeseluruhan([{ fileName: 'a', status: 'processing', persen: NaN }])).toBe(0);
  const done = Array.from({ length: 299 }, () => ({ fileName: 'a', status: 'done' as const }));
  expect(persenKeseluruhan([...done, { fileName: 'b', status: 'processing', persen: 99 }])).toBe(99);
});

test('unknown ETA stays unknown, rather than becoming zero or the ETA of another file', () => {
  const b = { ...process('b', 'batch', 'berjalan', 70), sisa_detik: null };
  expect(jobDariServer([process('a', 'batch', 'antre'), b], 'batch')?.sisaDetik).toBeNull();
  expect(formatSisa(null)).toBe('waktu belum dapat diperkirakan');
  expect(formatSisa(3600)).toBe('1 jam');
});

test('progress never mutates server objects and preserves displayed progress between polls', () => {
  const highest = new Map<string, number>();
  jobDariServer([process('a', 'batch', 'berjalan', 80)], 'batch', highest);
  const row = process('a', 'batch', 'berjalan', 60);
  expect(jobDariServer([row], 'batch', highest)?.persen).toBe(80);
  expect(row.persen).toBe(60);
});

test('duplicate files in the same selection or repeated selections count only once', () => {
  const a = { name: 'a.pdf', size: 10, lastModified: 1 } as File;
  const b = { name: 'b.pdf', size: 20, lastModified: 2 } as File;
  expect(gabungFileUnik([a], [a, b, b])).toEqual([a, b]);
});


test('restored concurrent batches keep one denominator as each batch finishes', () => {
  const tracked = new Set<string>(); const highest = new Map<string, number>();
  const first = [process('a', 'first', 'berjalan', 60), process('b', 'second', 'berjalan', 60)];
  expect(jobDariServer(first, null, highest, tracked)?.total).toBe(2);
  const next = [process('a', 'first', 'selesai', 100), process('b', 'second', 'berjalan', 80)];
  expect(jobDariServer(next, null, highest, tracked)).toMatchObject({ total: 2, doneCount: 1, persen: 90 });
  expect(jobDariServer(next.map(p => ({ ...p, status: 'selesai' as const })), null, highest, tracked))
    .toMatchObject({ total: 2, doneCount: 2, persen: 100 });
});

test('expired stored batch does not hide current processing after refresh', () => {
  expect(jobDariServer([process('new', 'new', 'berjalan', 60)], 'expired')).toMatchObject({ total: 1, active: true, batchId: null });
});

test('stored file with incomplete analysis is terminal but not a successful analysis', () => {
  const row = { ...process('partial','batch','perlu_dicek'), file_id:'stored-file', pesan:'Analisis belum lengkap.' };
  const job = jobDariServer([row],'batch');
  expect(job).toMatchObject({total:1,doneCount:0,failedCount:0,reviewCount:1,active:false,persen:100,sisaDetik:0,resultFileId:'stored-file'});
  expect(job?.statuses[0]).toMatchObject({status:'needs_review',error:'Analisis belum lengkap.',fileId:'stored-file'});
});
test('mixed complete, incomplete and active files retain the same progress denominator',()=>{
  expect(jobDariServer([process('done','b','selesai'),process('partial','b','perlu_dicek'),process('active','b','berjalan',70)],'b'))
    .toMatchObject({total:3,doneCount:1,reviewCount:1,failedCount:0,active:true,persen:90});
});

test('300 mixed results retain every ID, correct totals and progress until the last active file finishes', () => {
  const highest = new Map<string, number>();
  const rows = Array.from({ length: 300 }, (_, i) => ({
    ...process(`bulk-${i}`, 'bulk', i < 200 ? 'selesai' : i < 240 ? 'perlu_dicek' : i < 250 ? 'gagal' : 'berjalan', 60),
    urutan_file: i, file_id: i < 240 ? `stored-${i}` : null,
  }));
  const input = [process('old', 'old', 'selesai'), ...[...rows].reverse(), rows[0]];
  const job = jobDariServer(input, 'bulk', highest);
  expect(job).toMatchObject({ total: 300, doneCount: 200, reviewCount: 40, failedCount: 10, active: true, persen: 93 });
  expect(new Set(job?.statuses.map(s => s.prosesId)).size).toBe(300);
  expect(job?.statuses.map(s => s.prosesId)).toEqual(rows.map(p => p.id));
  expect(job?.statuses.filter(s => s.status === 'processing')).toHaveLength(50);
  expect(job?.statuses.filter(s => s.status === 'needs_review').every(s => s.fileId)).toBe(true);
  const completed = rows.map(p => p.status === 'berjalan' ? { ...p, status: 'selesai' as const, file_id: `stored-${p.id}` } : p);
  const final = jobDariServer(completed, 'bulk', highest);
  expect(final).toMatchObject({ total: 300, doneCount: 250, reviewCount: 40, failedCount: 10, active: false, persen: 100, sisaDetik: 0 });
  expect(final!.doneCount + final!.failedCount + final!.reviewCount!).toBe(final!.total);
});
