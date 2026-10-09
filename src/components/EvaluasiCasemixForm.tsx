'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type Status = 'pending' | 'valid' | 'perlu_klarifikasi';
interface Evaluasi { id: string; status: Status; alasan: string; bukti: { halaman: number; kutipan: string }[]; dibuat_pada: string; nama_petugas?: string; perlu_evaluasi_ulang: boolean; perbedaan_dengan_aplikasi: boolean | null }
export interface EvaluasiCasemix { terakhir: Evaluasi | null; riwayat: Evaluasi[] }
const label: Record<Status, string> = { pending: 'Pending', valid: 'Valid', perlu_klarifikasi: 'Perlu klarifikasi' };

export function EvaluasiCasemixForm({ recordId, evaluasi, onTersimpan, onOpenPdf }: {
  recordId: string; evaluasi?: EvaluasiCasemix; onTersimpan: () => void; onOpenPdf?: (halaman: number) => void;
}) {
  const [status, setStatus] = useState<Status | ''>('');
  const [alasan, setAlasan] = useState('');
  const [halaman, setHalaman] = useState('');
  const [kutipan, setKutipan] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState('');
  const [galat, setGalat] = useState('');
  const terakhir = evaluasi?.terakhir;
  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    if (!status) return;
    setSibuk(true); setGalat(''); setPesan('');
    try {
      await api.simpanEvaluasiCasemix(recordId, { status, alasan, bukti: [{ halaman: Number(halaman), kutipan }] });
      setPesan('Evaluasi tersimpan beserta alasan dan bukti.');
      setStatus(''); setAlasan(''); setHalaman(''); setKutipan(''); onTersimpan();
    } catch (err) { setGalat(err instanceof Error ? err.message : 'Evaluasi belum dapat disimpan.'); }
    finally { setSibuk(false); }
  }
  return <div className="space-y-3">
    <p className="text-xs text-muted-foreground">Catat pendapat petugas setelah menelaah berkas. Alasan dan bukti wajib untuk pending maupun valid. Evaluasi ini disimpan terpisah dari penilaian aplikasi dan hasil BPJS.</p>
    {terakhir ? <div className="space-y-1 rounded-md border border-border bg-background/60 p-3 text-sm">
      <strong>Penilaian petugas: {label[terakhir.status]}</strong>
      {terakhir.nama_petugas && <p className="text-xs">Petugas: {terakhir.nama_petugas}</p>}
      <p className="whitespace-pre-line break-words">{terakhir.alasan}</p>
      <ul className="list-disc space-y-1 pl-4 text-xs">{terakhir.bukti.map((b, i) => <li key={i}>{b.kutipan} <Button variant="outline" size="sm" type="button" disabled={!onOpenPdf} onClick={() => onOpenPdf?.(b.halaman)}>Hal. {b.halaman}</Button></li>)}</ul>
      <p className="text-xs text-muted-foreground">Dicatat {new Date(terakhir.dibuat_pada).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB</p>
      {terakhir.perbedaan_dengan_aplikasi && <p className="text-xs text-amber-800 dark:text-amber-300">Penilaian petugas berbeda dari aplikasi; alasan ini perlu dipakai untuk menelaah perbedaannya.</p>}
      {terakhir.perlu_evaluasi_ulang && <p role="alert" className="text-xs text-amber-800 dark:text-amber-300">Berkas, kode, atau pemeriksaan aplikasi berubah. Evaluasi ulang diperlukan.</p>}
    </div> : <p className="text-sm">Belum ada evaluasi petugas casemix.</p>}
    <form onSubmit={simpan} className="space-y-2">
      <label className="block space-y-1 text-xs">Penilaian baru
        <select value={status} onChange={e => setStatus(e.target.value as Status | '')} required className="block min-h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="">Pilih penilaian</option><option value="pending">Pending</option><option value="valid">Valid</option><option value="perlu_klarifikasi">Perlu klarifikasi</option>
        </select>
      </label>
      <label className="block space-y-1 text-xs">Alasan penilaian (wajib)
        <Textarea value={alasan} onChange={e => setAlasan(e.target.value)} required maxLength={4000} rows={3} placeholder="Mengapa pending atau valid? Jelaskan syarat, bukti, dan tanggapan atas temuan aplikasi." />
      </label>
      <div className="grid gap-2 sm:grid-cols-[8rem_1fr]">
        <label className="space-y-1 text-xs">Halaman bukti
          <Input type="number" min={1} step={1} value={halaman} onChange={e => setHalaman(e.target.value)} required />
        </label>
        <label className="space-y-1 text-xs">Kutipan dari teks hasil baca berkas
          <Textarea value={kutipan} onChange={e => setKutipan(e.target.value)} required maxLength={1000} rows={2} />
        </label>
      </div>
      <Button type="submit" size="sm" disabled={sibuk || !status || !alasan.trim() || !kutipan.trim() || Number(halaman) < 1}>{sibuk ? 'Menyimpan…' : 'Simpan evaluasi petugas'}</Button>
      {galat && <p role="alert" className="text-sm text-destructive">{galat}</p>}
      {pesan && <p role="status" className="text-sm">{pesan}</p>}
    </form>
    {(evaluasi?.riwayat.length || 0) > 1 && <details className="text-xs"><summary className="cursor-pointer">Riwayat evaluasi ({evaluasi!.riwayat.length})</summary>
      <ol className="mt-2 list-decimal space-y-2 pl-4">{evaluasi!.riwayat.map(r => <li key={r.id}><strong>{label[r.status]}</strong> · {new Date(r.dibuat_pada).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB<p className="whitespace-pre-line">{r.alasan}</p></li>)}</ol>
    </details>}
  </div>;
}
