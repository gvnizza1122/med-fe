'use client';
// Satu kartu untuk seluruh temuan, ditaruh di kepala halaman.
//
// Sebelumnya tersebar di enam kartu terpisah di bawah tabel — koder harus
// menggulir dan membaca satu per satu untuk menjawab satu pertanyaan sederhana:
// klaim ini akan dipending atau tidak, dan kalau iya karena apa. Semuanya
// dirangkum jadi butir-butir pendek di sini.
//
// Kartu ini MELAPORKAN, tidak memutuskan — tidak ada tombol yang mengubah data.
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { PutusanPending } from '@/components/PutusanPendingCard';
import type { TemuanTindakan } from '@/components/TemuanTindakanCard';

const GAYA_STATUS: Record<string, { kelas: string; judul: string }> = {
  berisiko_pending: { kelas: 'bg-red-500/10 border-red-500/30', judul: 'Berisiko dipending' },
  perlu_dicek: { kelas: 'bg-amber-500/10 border-amber-500/30', judul: 'Sebaiknya dicek dulu' },
  tidak_ditemukan_alasan: { kelas: 'bg-emerald-500/10 border-emerald-500/30', judul: 'Tidak ditemukan alasan pending' },
};

const WARNA_JUDUL: Record<string, string> = {
  berisiko_pending: 'text-red-700 dark:text-red-400',
  perlu_dicek: 'text-amber-700 dark:text-amber-400',
  tidak_ditemukan_alasan: 'text-emerald-700 dark:text-emerald-400',
};

const TITIK: Record<string, string> = {
  tinggi: 'text-red-600',
  sedang: 'text-amber-600',
  rendah: 'text-muted-foreground',
};

export function RingkasanTemuanCard({
  putusan,
  tindakan,
  validationStatus,
}: {
  putusan?: PutusanPending | null;
  tindakan?: TemuanTindakan[];
  validationStatus?: string | null;
}) {
  // Kartu hijau "Tidak ditemukan alasan pending" hanya mengulang status
  // valid dan membuat seolah ada masalah yang perlu ditangani.
  if (!putusan || (
    validationStatus?.toLowerCase() === 'valid' &&
    putusan.status === 'tidak_ditemukan_alasan'
  )) return null;

  const gaya = GAYA_STATUS[putusan.status] || GAYA_STATUS.perlu_dicek;
  const adaTindakan = tindakan && tindakan.length > 0;

  return (
    <div className={cn('px-3 py-2.5 rounded-lg border text-xs space-y-2', gaya.kelas)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('font-display text-sm font-semibold', WARNA_JUDUL[putusan.status])}>
          {gaya.judul}
        </span>
        {putusan.jumlah.dari_rekap_pending > 0 && (
          <Badge variant="outline" className="text-[11px]">
            {putusan.jumlah.dari_rekap_pending} pernah jadi alasan penolakan
          </Badge>
        )}
      </div>

      {putusan.alasan.length > 0 && (
        <ul className="space-y-1">
          {putusan.alasan.map((a, i) => (
            <li key={`${a.kode}-${i}`} className="flex gap-1.5 leading-snug">
              <span className={cn('font-bold', TITIK[a.keparahan] || 'text-muted-foreground')}>•</span>
              <span className="min-w-0 flex-1 text-muted-foreground">
                <strong className="text-foreground">{a.ringkas}</strong>
                {a.bukti && <span className="italic"> — {a.bukti}</span>}
                {a.tindakan && (
                  <span className="block text-xs">
                    <span className="text-muted-foreground">Lakukan:</span> {a.tindakan}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Tindakan yang terbaca bukan masalah — ia justru bukti bahwa pasien
          ditangani. Ditampilkan sebaris supaya tidak menenggelamkan alasan
          pending di atasnya. */}
      {adaTindakan && (
        <div className="border-t border-current/10 pt-1.5 text-xs text-muted-foreground">
          <span className="text-muted-foreground">Tindakan terbaca:</span>{' '}
          {tindakan!.map((t, i) => (
            <span key={t.id}>
              {i > 0 && ' · '}
              {t.nama}
              {t.kode_usulan && <span className="font-mono-data"> ({t.kode_usulan})</span>}
            </span>
          ))}
        </div>
      )}

      <p className="border-t border-current/10 pt-1.5 text-xs leading-snug text-muted-foreground">
        {putusan.catatan_keandalan}
      </p>
    </div>
  );
}
