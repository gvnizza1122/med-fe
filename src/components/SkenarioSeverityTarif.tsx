import { cn } from '@/lib/utils';

export interface SkenarioTarif { code: string; severity: string; amount: number | null }
const rupiah = (n: number) => `Rp${n.toLocaleString('id-ID')}`;
export function rentangTarif(skenario: SkenarioTarif[] = []): string | null {
  const nilai = skenario.map(s => s.amount).filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0);
  if (!nilai.length) return null;
  const min = Math.min(...nilai), max = Math.max(...nilai);
  return min === max ? rupiah(min) : `${rupiah(min)} – ${rupiah(max)}`;
}

/** Semua tingkat tampil sejajar; pembanding menandai kode yang sama, bukan memilih severity. */
export function SkenarioSeverityTarif({ skenario, kodePembanding }: { skenario?: SkenarioTarif[]; kodePembanding?: string | null }) {
  if (!skenario?.length) return null;
  return <div className="@container"><div className="grid gap-2 @md:grid-cols-3" aria-label="Skenario tarif severity I, II dan III">
    {skenario.map(s => <div key={s.code} className={cn('min-w-0 rounded-lg border border-border p-3', s.code === kodePembanding ? 'border-emerald-600/40 bg-emerald-500/10' : 'bg-muted/20')}>
      <p className="text-xs font-medium">Severity {s.severity}</p>
      <p className="mt-1 break-words font-mono-data text-sm font-semibold">{s.amount != null ? rupiah(s.amount) : 'Tarif belum tersedia'}</p>
      {s.code === kodePembanding && <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">Sama dengan kode E-Klaim</p>}
    </div>)}
  </div></div>;
}
