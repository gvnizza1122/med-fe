'use client';
// Satu kartu untuk seluruh temuan, ditaruh di kepala halaman.
//
// Sebelumnya tersebar di enam kartu terpisah di bawah tabel — koder harus
// menggulir dan membaca satu per satu untuk menjawab satu pertanyaan sederhana:
// klaim ini akan dipending atau tidak, dan kalau iya karena apa. Semuanya
// dirangkum jadi butir-butir pendek di sini.
//
// Kartu ini MELAPORKAN, tidak memutuskan — tidak ada tombol yang mengubah data.
//
// 2026-10-01: digabung dari dua pekerjaan paralel (punya sendiri + redesain
// teman) yang sama-sama menyentuh file ini tanpa saling pull dulu. Tampilan
// (section lega, judul lebih besar, paragraf ringkasan) dari redesain teman.
// Tiga perilaku dari sini TETAP dipertahankan karena bukan soal tampilan:
//   1. prosedurKosong — penjelasan saat PROCLIST kosong (ai_review.proclist_kosong).
//   2. putusan boleh null tapi kartu tetap tampil kalau prosedurKosong perlu
//      dijelaskan -- makanya field dari putusan di bawah dibaca pakai `?.`.
//   3. catatan_keandalan dibaca dari backend (putusanPendingService.js),
//      BUKAN kalimat tetap -- disederhanakan semalam atas keluhan casemix;
//      menuliskannya ulang statis di sini akan membuat perbaikan itu basi
//      begitu backend-nya berubah lagi.
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

// Gaya tambahan saat kartu tampil HANYA untuk menjelaskan PROCLIST kosong
// (putusan bisa jadi null/"tidak_ditemukan_alasan" di kasus ini).
const GAYA_PROSEDUR_KOSONG = {
  kelas: 'bg-amber-500/10 border-amber-500/30',
  judul: 'Klaim perlu dilengkapi',
  warna: 'text-amber-800 dark:text-amber-300',
};

const TITIK: Record<string, string> = {
  tinggi: 'text-red-600',
  sedang: 'text-amber-600',
  rendah: 'text-muted-foreground',
};

export function RingkasanTemuanCard({
  putusan,
  tindakan: tindakanMentah,
  validationStatus,
  prosedurKosong = false,
  currentValidationIssues = 0,
}: {
  putusan?: PutusanPending | null;
  tindakan?: TemuanTindakan[];
  validationStatus?: string | null;
  prosedurKosong?: boolean;
  currentValidationIssues?: number;
}) {
  // Satu baris per kode: tindakan yang sama tertulis berkali-kali (injeksi
  // 99.29) cukup tampil sekali.
  const tindakan = tindakanMentah?.filter((t, i, semua) =>
    !t.kode_usulan || semua.findIndex(x => x.kode_usulan === t.kode_usulan) === i);
  const statusPending = ['pending', 'error'].includes(validationStatus?.toLowerCase() || '');
  const tampilkanProsedurKosong = statusPending && prosedurKosong;
  // Kartu hijau "Tidak ditemukan alasan pending" hanya mengulang status
  // valid dan membuat seolah ada masalah yang perlu ditangani — KECUALI
  // masih ada penjelasan PROCLIST kosong yang perlu tampil.
  if (!putusan || (
    validationStatus?.toLowerCase() === 'valid' &&
    putusan.status === 'tidak_ditemukan_alasan'
  )) {
    if (!tampilkanProsedurKosong) return null;
  }

  const adaTindakan = tindakan && tindakan.length > 0;

  // Ringkasan risiko AI bilang "tidak ada temuan" padahal pemeriksaan field
  // di tabel lain masih menunjukkan masalah -- dua pemeriksaan ini jalan
  // terpisah dan bisa tidak selaras. Daripada diam-diam membingungkan,
  // tampilkan peringatan tersendiri.
  const belumSelaras = currentValidationIssues > 0 && putusan?.status === 'tidak_ditemukan_alasan';
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

  const gaya = tampilkanProsedurKosong && putusan?.status === 'tidak_ditemukan_alasan'
    ? GAYA_PROSEDUR_KOSONG
    : GAYA_STATUS[putusan?.status || ''] || GAYA_STATUS.perlu_dicek;

  return (
    <section aria-label="Ringkasan analisis risiko" className={cn('space-y-3 rounded-lg border p-4', gaya.kelas)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Analisis risiko aplikasi</p>
          <h4 className={cn('font-display text-base font-semibold', gaya.warna)}>
            {gaya.judul}
          </h4>
        </div>
        {(putusan?.jumlah?.dari_rekap_pending || 0) > 0 && (
          <Badge variant="outline" className="text-xs">
            {putusan?.jumlah?.dari_rekap_pending} pernah jadi alasan penolakan
          </Badge>
        )}
      </div>

      {tampilkanProsedurKosong && (
        <p className="max-w-3xl break-words text-sm leading-relaxed text-foreground/85">
          <strong className="text-foreground">Masalah kelengkapan: Daftar Prosedur (PROCLIST) masih kosong.</strong>{' '}
          Berkas ini belum menunjukkan prosedur yang bisa dikodekan. Periksa dan lengkapi hanya jika
          ada prosedur yang benar-benar tertulis; jangan menambahkan tindakan atau kode berdasarkan dugaan.
        </p>
      )}

      {putusan && (
        <>
          {putusan.status !== 'tidak_ditemukan_alasan' ? (
            <p className="max-w-3xl break-words text-sm leading-relaxed text-foreground/85">{putusan.ringkasan}</p>
          ) : !tampilkanProsedurKosong ? (
            <p className="max-w-3xl break-words text-sm leading-relaxed text-foreground/85">
              Analisis risiko belum menemukan temuan tambahan. Tetap cocokkan data dengan dokumen asli sebelum klaim dikirim.
            </p>
          ) : null}

          {(putusan.alasan?.length || 0) > 0 && (
            <ul className="space-y-1">
              {putusan.alasan.map((a, i) => (
                <li key={`${a.kode}-${i}`} className="flex gap-1.5 leading-snug">
                  <span className={cn('font-bold', TITIK[a.keparahan] || 'text-muted-foreground')}>•</span>
                  <div className="min-w-0 flex-1 text-muted-foreground">
                    <strong className="text-foreground">{a.sumber_pemeriksaan}</strong>
                    <ul className="mt-1.5 list-disc space-y-1.5 pl-4 text-sm leading-relaxed">
                      {(a.poin?.length ? a.poin : [
                        { label: 'Alasan', isi: a.ringkas },
                        ...(a.bukti ? [{ label: 'Bukti / sumber', isi: a.bukti }] : []),
                        ...(a.penjelasan ? [{ label: 'Dasar pemeriksaan', isi: a.penjelasan }] : []),
                        ...(a.tindakan ? [{ label: 'Perbaikan', isi: a.tindakan }] : []),
                      ]).map((p, j) => <li key={j} className="break-words"><span className="font-medium text-foreground">{p.label}:</span> {p.isi}</li>)}
                    </ul>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
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

      {putusan?.catatan_keandalan && (
        <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
          {putusan.catatan_keandalan}
        </p>
      )}
    </section>
  );
}
