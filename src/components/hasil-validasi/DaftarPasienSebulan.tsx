'use client';
// Daftar pasien di samping halaman Hasil Validasi: semua klaim dengan bulan
// pelayanan (periode SEP) yang sama dengan pasien yang sedang dibuka, dengan
// filter Semua / Pending / Valid. Pending tampil lebih dulu karena itu yang
// dikerjakan casemix. Memilih pasien diserahkan ke induk (navigasi URL).
import { useEffect, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

export interface PasienSebulan {
  record_id: string;
  file_id: string;
  nama_pasien: string | null;
  mrn: string | null;
  sep: string | null;
  validation_status: string;
  jenis_klaim: string | null;
}

interface HasilSebulan {
  periode: string | null;
  ringkasan: { semua: number; pending: number; valid: number };
  items: PasienSebulan[];
  page: number;
  limit: number;
}

export type Filter = 'semua' | 'pending' | 'valid';

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
function labelPeriode(periode: string | null): string {
  const m = /^(\d{4})-(\d{2})$/.exec(periode || '');
  return m ? `${BULAN[Number(m[2]) - 1]} ${m[1]}` : 'Periode belum diketahui';
}

const JENIS: Record<string, string> = { RAWAT_JALAN: 'RJ', RAWAT_INAP: 'RI', GAWAT_DARURAT: 'IGD' };
const KUNCI_TERTUTUP = 'eclaim:daftar-pasien-tertutup';

function bacaTertutup(): boolean {
  try {
    const simpan = localStorage.getItem(KUNCI_TERTUTUP);
    if (simpan !== null) return simpan === '1';
    return window.matchMedia('(max-width: 767px)').matches;
  } catch { return false; }
}

function LencanaStatus({ status }: { status: string }) {
  const pending = status === 'pending' || status === 'error';
  return (
    <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold',
      pending ? 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300')}>
      {pending ? 'PENDING' : 'VALID'}
    </span>
  );
}

export function DaftarPasienSebulan({ recordId, filterAwal = 'semua', onPilih }: {
  recordId: string;
  // Filter dibawa lewat URL saat pindah pasien, supaya casemix yang sedang
  // menelusuri klaim pending tidak perlu memilih filter lagi tiap pasien.
  filterAwal?: string | null;
  onPilih: (pasien: PasienSebulan, filter: Filter) => void;
}) {
  const [tertutup, setTertutup] = useState<boolean>(() => (typeof window === 'undefined' ? false : bacaTertutup()));
  const [filter, setFilter] = useState<Filter>(() => (filterAwal === 'pending' || filterAwal === 'valid' ? filterAwal : 'semua'));
  const [ketikan, setKetikan] = useState('');
  const [cari, setCari] = useState('');
  const kunci = `${recordId}|${filter}|${cari}`;
  const [hasil, setHasil] = useState<{ kunci: string; data?: HasilSebulan; gagal?: string } | null>(null);
  const [memuatLagi, setMemuatLagi] = useState(false);
  const [percobaan, setPercobaan] = useState(0);

  // Ketikan pencarian ditunda sebentar supaya tidak memanggil API per huruf.
  useEffect(() => {
    const t = setTimeout(() => setCari(ketikan.trim()), 300);
    return () => clearTimeout(t);
  }, [ketikan]);

  useEffect(() => {
    let batal = false;
    const p: Record<string, string> = { status: filter, page: '1' };
    if (cari) p.cari = cari;
    api.getPasienSebulan<HasilSebulan>(recordId, p)
      .then(data => { if (!batal) setHasil({ kunci, data }); })
      .catch(err => { if (!batal) setHasil({ kunci, gagal: err instanceof Error ? err.message : 'Daftar pasien gagal dimuat.' }); });
    return () => { batal = true; };
  }, [recordId, filter, cari, kunci, percobaan]);

  const aktif = hasil?.kunci === kunci ? hasil : null;
  // Selama data baru dimuat, daftar lama tetap terlihat (tidak berkedip).
  const data = aktif?.data ?? hasil?.data;
  const memuat = !aktif;
  const masihAda = data ? data.items.length < (filter === 'semua' ? data.ringkasan.semua : data.ringkasan[filter]) : false;

  const muatLagi = async () => {
    if (!data) return;
    setMemuatLagi(true);
    try {
      const p: Record<string, string> = { status: filter, page: String(data.page + 1) };
      if (cari) p.cari = cari;
      const lanjut = await api.getPasienSebulan<HasilSebulan>(recordId, p);
      setHasil(prev => (prev?.kunci === kunci && prev.data
        ? { kunci, data: { ...lanjut, items: [...prev.data.items, ...lanjut.items] } }
        : prev));
    } catch { /* tombol tetap ada untuk dicoba lagi */ }
    finally { setMemuatLagi(false); }
  };

  const ubahTertutup = (nilai: boolean) => {
    setTertutup(nilai);
    try { localStorage.setItem(KUNCI_TERTUTUP, nilai ? '1' : '0'); } catch { /* preferensi opsional */ }
  };

  const judul = `Pasien ${labelPeriode(data?.periode ?? null)}`;

  if (tertutup) {
    return (
      <button
        type="button"
        onClick={() => ubahTertutup(false)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground md:sticky md:top-4 md:h-[420px] md:w-12 md:flex-col md:px-0"
        aria-label={`Tampilkan daftar ${judul.toLowerCase()}`}
      >
        <PanelLeftOpen aria-hidden="true" className="size-4 shrink-0" />
        <span className="text-xs font-medium md:[writing-mode:vertical-rl]">
          {judul}{data ? ` (${data.ringkasan.semua})` : ''}
        </span>
      </button>
    );
  }

  const tombolFilter: { nilai: Filter; label: string; jumlah?: number }[] = [
    { nilai: 'semua', label: 'Semua', jumlah: data?.ringkasan.semua },
    { nilai: 'pending', label: 'Pending', jumlah: data?.ringkasan.pending },
    { nilai: 'valid', label: 'Valid', jumlah: data?.ringkasan.valid },
  ];

  return (
    <aside aria-label={judul} className="w-full overflow-hidden rounded-xl border border-border bg-card md:sticky md:top-4 md:w-80">
      <div className="space-y-2.5 border-b border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">{judul}</h2>
          <button type="button" onClick={() => ubahTertutup(true)} aria-label="Sembunyikan daftar pasien"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <PanelLeftClose aria-hidden="true" className="size-4" />
          </button>
        </div>
        <div role="group" aria-label="Filter status" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
          {tombolFilter.map(f => (
            <button
              key={f.nilai}
              type="button"
              aria-pressed={filter === f.nilai}
              onClick={() => setFilter(f.nilai)}
              className={cn('rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                filter === f.nilai ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              {f.label}{f.jumlah !== undefined && <span className="ml-1 text-muted-foreground">{f.jumlah}</span>}
            </button>
          ))}
        </div>
        <label className="relative block">
          <span className="sr-only">Cari nama, SEP, atau No. RM</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={ketikan}
            onChange={e => setKetikan(e.target.value)}
            placeholder="Nama, SEP, atau No. RM"
            className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-2 text-sm"
          />
        </label>
      </div>

      <div className={cn('max-h-[calc(100vh-15rem)] overflow-y-auto', memuat && data && 'opacity-60')} aria-busy={memuat}>
        {aktif?.gagal ? (
          <div className="space-y-2 p-4 text-sm">
            <p className="text-red-700 dark:text-red-400">{aktif.gagal}</p>
            <button type="button" className="text-primary underline underline-offset-2" onClick={() => setPercobaan(n => n + 1)}>Coba lagi</button>
          </div>
        ) : !data ? (
          <p className="p-4 text-sm text-muted-foreground">Memuat daftar pasien…</p>
        ) : data.items.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">{cari ? 'Tidak ada pasien yang cocok.' : filter === 'pending' ? 'Tidak ada klaim pending bulan ini.' : 'Tidak ada klaim pada filter ini.'}</p>
        ) : (
          <ul>
            {data.items.map(p => {
              const kini = p.record_id === recordId;
              return (
                <li key={p.record_id}>
                  <button
                    type="button"
                    onClick={() => { if (!kini) onPilih(p, filter); }}
                    aria-current={kini ? 'true' : undefined}
                    className={cn('flex w-full items-start justify-between gap-2 border-b border-border px-3 py-2.5 text-left last:border-0 hover:bg-muted/50',
                      kini && 'bg-primary/10 hover:bg-primary/10')}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-foreground">{p.nama_pasien || '(nama kosong)'}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {p.jenis_klaim && JENIS[p.jenis_klaim] ? `${JENIS[p.jenis_klaim]} · ` : ''}RM {p.mrn || '-'} · <span className="font-mono">{p.sep || '-'}</span>
                      </span>
                    </span>
                    <LencanaStatus status={p.validation_status} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {masihAda && !aktif?.gagal && (
          <div className="p-3">
            <button type="button" disabled={memuatLagi} onClick={muatLagi}
              className="w-full rounded-md border border-border py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60">
              {memuatLagi ? 'Memuat…' : 'Muat lebih banyak'}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
