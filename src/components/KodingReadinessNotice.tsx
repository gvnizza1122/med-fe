import { AlertTriangle } from 'lucide-react';

export interface KesiapanKoding {
  status: string;
  judul: string;
  alasan: { kode: string; nama: string; pesan: string; kode_asal: string[]; kode_saran: string | null }[];
}

export function KodingReadinessNotice({ kesiapan }: { kesiapan?: KesiapanKoding }) {
  if (!kesiapan || kesiapan.status !== 'berisiko_pending') return null;
  return (
    <aside aria-label="Kesiapan koding klaim" className="rounded-lg border border-red-500/40 bg-red-500/10 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-red-700 dark:text-red-300" />
        <div className="min-w-0">
          <p className="text-base font-semibold text-red-800 dark:text-red-200">Berisiko pending · belum siap upload</p>
          {kesiapan.alasan.map(a => (
            <div key={a.kode} className="mt-2 text-sm leading-relaxed text-foreground">
              <p><code className="font-semibold">{a.kode_asal.join(' + ')}</code>{a.kode_saran ? <> perlu ditinjau untuk kombinasi <code className="font-semibold">{a.kode_saran}</code>.</> : <> perlu ditinjau: {a.nama}.</>}</p>
              <details className="mt-1 text-foreground/85"><summary className="cursor-pointer">Alasan perlu ditinjau</summary><p className="mt-1">{a.pesan}</p></details>
            </div>
          ))}
          <p className="mt-2 text-sm text-foreground/85">Kode klaim belum diubah.</p>
        </div>
      </div>
    </aside>
  );
}
