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

const GAYA_STATUS: Record<string, { kelas: string; judul: string; warna: string }> = {
  berisiko_pending: {
    kelas: 'border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/5',
    judul: 'Berisiko pending · belum siap upload',
    warna: 'text-red-700 dark:text-red-300',
  },
  perlu_dicek: {
    kelas: 'border-amber-600/25 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/5',
    judul: 'Ada hal yang perlu dicek',
    warna: 'text-amber-800 dark:text-amber-300',
  },
  tidak_ditemukan_alasan: {
    kelas: 'border-border bg-secondary/30',
    judul: 'Belum ada temuan risiko tambahan',
    warna: 'text-foreground',
  },
};

const TITIK: Record<string, string> = {
  tinggi: 'text-red-600',
  sedang: 'text-amber-600',
  rendah: 'text-muted-foreground',
};

export function RingkasanTemuanCard({
  putusan,
  tindakan: tindakanMentah,
  currentValidationIssues = 0,
}: {
  putusan?: PutusanPending | null;
  tindakan?: TemuanTindakan[];
  currentValidationIssues?: number;
}) {
  if (!putusan) return null;
  // Satu baris per kode: tindakan yang sama tertulis berkali-kali (injeksi
  // 99.29) cukup tampil sekali.
  const tindakan = tindakanMentah?.filter((t, i, semua) =>
    !t.kode_usulan || semua.findIndex(x => x.kode_usulan === t.kode_usulan) === i);

  const belumSelaras = currentValidationIssues > 0 && putusan.status === 'tidak_ditemukan_alasan';
  const gaya = GAYA_STATUS[putusan.status] || GAYA_STATUS.perlu_dicek;
  const adaTindakan = tindakan && tindakan.length > 0;

  if (belumSelaras) {
    return (
      <aside aria-label="Keterbatasan ringkasan risiko" className="rounded-lg border border-amber-600/25 bg-amber-50 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/5">
        <strong className="block text-sm font-semibold text-amber-900 dark:text-amber-300">Ringkasan risiko belum selaras</strong>
        <p className="mt-1 max-w-3xl break-words text-sm leading-relaxed text-foreground/85">
          Pemeriksaan data saat ini menemukan {currentValidationIssues} masalah di atas. Gunakan daftar validasi tersebut sebelum klaim dikirim; penilaian aplikasi bukan keputusan BPJS.
        </p>
        {adaTindakan && (
          <p className="mt-2 text-xs text-muted-foreground">
            Tindakan terbaca: {tindakan!.map(t => t.nama).join(' · ')}
          </p>
        )}
      </aside>
    );
  }

  return (
    <section aria-label="Ringkasan analisis risiko" className={cn('space-y-3 rounded-lg border p-4', gaya.kelas)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Analisis risiko aplikasi</p>
          <h4 className={cn('font-display text-base font-semibold', gaya.warna)}>
            {gaya.judul}
          </h4>
        </div>
        {putusan.jumlah.dari_rekap_pending > 0 && (
          <Badge variant="outline" className="text-xs">
            {putusan.jumlah.dari_rekap_pending} pernah jadi alasan penolakan
          </Badge>
        )}
      </div>

      {putusan.status !== 'tidak_ditemukan_alasan' ? (
        <p className="max-w-3xl break-words text-sm leading-relaxed text-foreground/85">{putusan.ringkasan}</p>
      ) : (
        <p className="max-w-3xl break-words text-sm leading-relaxed text-foreground/85">
          Analisis risiko belum menemukan temuan tambahan. Tetap cocokkan data dengan dokumen asli sebelum klaim dikirim.
        </p>
      )}

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
            // id bisa kembar (AI menulis temuan yang sama dua kali, mis. ai_99.29).
            <span key={`${t.id}-${i}`}>
              {i > 0 && ' · '}
              {t.nama}
              {t.kode_usulan && <span className="font-mono-data"> ({t.kode_usulan})</span>}
            </span>
          ))}
        </div>
      )}

      <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
        Perkiraan aplikasi, bukan keputusan BPJS. Ketepatan prediksi belum terukur.
      </p>
    </section>
  );
}
