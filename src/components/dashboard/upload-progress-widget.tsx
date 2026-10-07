'use client';
// Widget kecil di sidebar yang menampilkan progress upload/audit PDF yang
// sedang/baru selesai berjalan — supaya verifikator tetap tahu progressnya
// walau sudah pindah ke halaman lain (Dashboard, Riwayat Upload, dst),
// tidak perlu terpaku di halaman Extract PDF sampai selesai.
import Link from 'next/link';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, X } from 'lucide-react';
import { useUploadJob } from '@/contexts/UploadJobContext';
import { cn } from '@/lib/utils';
import { formatSisa } from '@/lib/upload-progress';

export function UploadProgressWidget({ compact = false }: { compact?: boolean }) {
  const { job, dismissJob } = useUploadJob();
  if (!job) return null;

  const processed = job.doneCount + job.failedCount + (job.reviewCount || 0);
  const aktifSekarang = job.statuses.find(s => s.status === 'processing');
  const sisa = job.sisaDetik != null && job.sisaDetik > 0 ? formatSisa(job.sisaDetik) : null;
  // Unggahan berantrean: persen berjalan halus dari server; lainnya per berkas selesai.
  const pct = job.server && job.persen != null ? job.persen : job.total > 0 ? Math.round((processed / job.total) * 100) : 0;
  const label = job.testing ? `Testing Batch (${job.total} file)` : job.type === 'batch' ? `Upload Batch (${job.total} file)` : 'Upload PDF';

  if (compact) {
    const status = job.active ? `Memproses ${processed}/${job.total} file` : job.error ? 'Unggahan gagal' : job.failedCount > 0 ? `${job.failedCount} unggahan gagal` : job.reviewCount ? `${job.reviewCount} analisis belum lengkap` : `${job.doneCount} analisis selesai`;
    return (
      <Link
        href={job.type === 'single' && job.resultFileId ? `/results/${job.resultFileId}` : job.testing ? (job.active ? '/testing-pending/upload' : '/testing-pending') : '/history'}
        aria-label={`${label}: ${status}`}
        title={`${label}: ${status}`}
        className="mb-3 flex h-10 items-center justify-center rounded-lg border border-border bg-secondary/40 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {job.active ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : job.error || job.failedCount > 0 ? <XCircle className="h-4 w-4 text-destructive" aria-hidden="true" /> : job.reviewCount ? <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />}
      </Link>
    );
  }

  return (
    <div className="mb-3 rounded-lg border border-border bg-secondary/40 p-2.5 text-xs">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 font-medium text-foreground min-w-0">
          {job.active ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
          ) : job.error || job.failedCount > 0 ? (
            <XCircle className="size-3.5 shrink-0 text-destructive" />
          ) : job.reviewCount ? (
            <AlertTriangle className="size-3.5 shrink-0 text-amber-600" />
          ) : (
            <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
          )}
          <span className="truncate">{label}</span>
        </div>
        {!job.active && (
          <button
            onClick={dismissJob}
            aria-label="Tutup"
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {job.active ? (
        <>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            <span className="font-semibold text-foreground">{job.server ? 'Estimasi ' : ''}{pct}%</span> · Diproses {processed}/{job.total} file{sisa ? ` · sisa ±${sisa}` : job.server ? ' · waktu belum dapat diperkirakan' : ''}{aktifSekarang?.tahapLabel ? ` · ${aktifSekarang.tahapLabel}` : ''}
          </p>
          {job.server && <p className="text-[10px] text-muted-foreground">Aman di-refresh — proses tetap berjalan di server.</p>}
        </>
      ) : job.error ? (
        <p className="text-[10px] text-destructive">{job.error}</p>
      ) : (
        <div className="space-y-1">
          <p className={cn('text-[10px]', job.failedCount > 0 || job.reviewCount ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
            {job.doneCount} analisis selesai{job.reviewCount ? `, ${job.reviewCount} belum lengkap` : ''}{job.failedCount > 0 ? `, ${job.failedCount} gagal` : ''}.
          </p>
          {job.type === 'single' && job.resultFileId ? (
            <Link href={`/results/${job.resultFileId}`} className="text-[10px] font-medium text-primary hover:underline">
              Lihat Hasil →
            </Link>
          ) : job.type === 'batch' ? (
            <Link href={job.testing ? "/testing-pending" : "/history"} className="text-[10px] font-medium text-primary hover:underline">
              {job.testing ? "Lihat hasil testing →" : "Lihat di Riwayat Upload →"}
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
