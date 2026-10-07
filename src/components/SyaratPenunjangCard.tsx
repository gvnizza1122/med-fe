'use client';
import { AlertCircle, CheckCircle2, ChevronDown, CircleHelp, FlaskConical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface SyaratItem {
  nama: string;
  tingkat_risiko: string;
  tindakan_ada: boolean;
  kode_prosedur_ditemukan: string[];
  nilai: number | null;
  kutipan: string | null;
  page_number: number | null;
  status: string;
  ambang?: string;
  memenuhi_ambang?: boolean | null;
  catatan_batasan?: string;
  dapat_diperiksa_sistem?: boolean;
  kata_kunci_cocok?: string;
}
export interface TemuanSyaratPenunjang {
  id: string;
  kode_diagnosis: string;
  kode_aturan: string;
  nama_diagnosis: string;
  diverifikasi: boolean;
  sumber_aturan: string;
  sumber_ketentuan?: string;
  jenis_ketentuan?: string;
  rujukan_id?: string;
  hospital_code?: string;
  cakupan?: string;
  perlu_konfirmasi_tanggal?: boolean;
  syarat: SyaratItem[];
  ringkasan: { terpenuhi: number; hasil_belum_terbaca: number; tidak_ada: number; perlu_cek_manual: number };
}
const GAYA = {
  terpenuhi: { Icon: CheckCircle2, kelas: 'text-emerald-700 dark:text-emerald-400', label: 'Bukti memenuhi syarat' },
  tindakan_ada_hasil_belum_terbaca: { Icon: AlertCircle, kelas: 'text-amber-700 dark:text-amber-400', label: 'Hasil belum terkonfirmasi' },
  tidak_ada: { Icon: AlertCircle, kelas: 'text-rose-700 dark:text-rose-400', label: 'Bukti belum memenuhi syarat' },
  perlu_cek_manual: { Icon: CircleHelp, kelas: 'text-amber-700 dark:text-amber-400', label: 'Perlu penilaian bukti' },
};

export function SyaratPenunjangCard({ temuan }: { temuan?: TemuanSyaratPenunjang[] }) {
  if (!temuan?.length) return null;
  const syaratAktif = temuan.filter(t => t.diverifikasi).flatMap(t => t.syarat);
  // Hitung dari item aktual agar ringkasan lama tidak memberikan status hijau keliru.
  const perluDicek = syaratAktif.filter(s => s.status !== 'terpenuhi').length;
  return (
    <section aria-label="Persyaratan penunjang klaim BPJS" className="rounded-xl border border-border bg-card p-4 text-card-foreground sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <FlaskConical className="h-4 w-4 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-semibold">Persyaratan Penunjang Klaim BPJS</h3>
        <Badge variant="outline" className={cn('text-xs', perluDicek ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'border-emerald-500/30 text-emerald-700 dark:text-emerald-400')}>
          {perluDicek ? `${perluDicek} dari ${syaratAktif.length} perlu ditinjau` : `${syaratAktif.length} bukti memenuhi syarat`}
        </Badge>
      </div>
      <p className="mt-2 max-w-4xl text-xs leading-relaxed text-muted-foreground">
        Kelengkapan penunjang untuk klaim BPJS dinilai dari bukti dalam berkas. Sumber persyaratan ditampilkan pada setiap diagnosis.
      </p>
      <div className="mt-4 space-y-3">
        {temuan.map(t => (
          <article key={`${t.id}-${t.kode_diagnosis}`} className="overflow-hidden rounded-lg border border-border">
            <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-4 py-3">
              <span className="font-mono text-xs font-semibold text-primary">{t.kode_diagnosis}</span>
              <h4 className="text-sm font-medium">{t.nama_diagnosis}</h4>
              {t.cakupan === 'rs' && <Badge variant="outline" className="text-xs">Verifikasi setempat · RS {t.hospital_code}</Badge>}
              {t.perlu_konfirmasi_tanggal && <Badge variant="outline" className="text-xs">Tanggal perlu dikonfirmasi</Badge>}
              {!t.diverifikasi && <Badge variant="outline" className="text-xs">Sumber belum diverifikasi</Badge>}
            </div>
            <div className="divide-y divide-border px-4">
              {t.syarat.map((s, i) => {
                const gaya = GAYA[s.status as keyof typeof GAYA] || GAYA.perlu_cek_manual;
                const Icon = gaya.Icon;
                return (
                  <div key={`${s.nama}-${i}`} className="flex gap-3 py-3">
                    <Icon aria-hidden="true" className={cn('mt-0.5 h-4 w-4 shrink-0', gaya.kelas)} />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <span className="text-sm font-medium">{s.nama}</span>
                        <span className={cn('text-xs font-medium', gaya.kelas)}>{gaya.label}</span>
                      </div>
                      {s.nilai != null && <p className="text-xs text-muted-foreground">Nilai ditemukan: <span className="font-mono text-foreground">{s.nilai}</span>{s.ambang && ` · syarat ${s.ambang}`}</p>}
                      {s.catatan_batasan && <p className="text-xs leading-relaxed text-muted-foreground">{s.catatan_batasan}</p>}
                      {(s.kutipan || s.kode_prosedur_ditemukan?.length > 0) && (
                        <details className="group text-xs">
                          <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded py-1 text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            Lihat bukti{s.page_number ? ` · halaman ${s.page_number}` : ''}<ChevronDown aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                          </summary>
                          <div className="mt-1 space-y-2 rounded-md border border-border bg-muted/30 p-3">
                            {s.kutipan && <blockquote className="break-words leading-relaxed text-muted-foreground">&ldquo;{s.kutipan}&rdquo;</blockquote>}
                            {s.kode_prosedur_ditemukan?.length > 0 && <p className="text-muted-foreground">Kode prosedur klaim: <span className="font-mono">{s.kode_prosedur_ditemukan.join(', ')}</span></p>}
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <details className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer rounded py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring">Sumber persyaratan BPJS</summary>
              <p className="pb-2 pt-1 leading-relaxed">{t.sumber_ketentuan || t.sumber_aturan}</p>
            </details>
          </article>
        ))}
      </div>
    </section>
  );
}
