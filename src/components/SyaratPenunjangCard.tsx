'use client';
// Syarat Penunjang Diagnosis — Tipe 2 (tindakan ada) & Tipe 1 (hasil mendukung).
//
// Backend yang menilai (syaratPenunjangService.js); kartu ini hanya
// menampilkan. Tidak ada tombol yang mengubah data — penetapan kode tetap
// wewenang koder.
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
  memenuhi_ambang?: boolean;
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
  syarat: SyaratItem[];
  ringkasan: {
    terpenuhi: number;
    hasil_belum_terbaca: number;
    tidak_ada: number;
    perlu_cek_manual: number;
  };
}

// Empat keadaan, bukan dua. "Tindakan ada tapi hasil belum terbaca" sengaja
// TIDAK ditampilkan sebagai centang hijau: yang diperiksa verifikator BPJS
// adalah hasilnya, dan menyamakan keduanya membuat sistem menyatakan "aman"
// untuk klaim yang justru rawan ditanya.
const GAYA: Record<string, { ikon: string; kelas: string; label: string }> = {
  terpenuhi: {
    ikon: '✓', kelas: 'text-emerald-600', label: 'Terpenuhi',
  },
  tindakan_ada_hasil_belum_terbaca: {
    ikon: '⚠', kelas: 'text-amber-600', label: 'Tindakan ada, hasil belum terbaca',
  },
  tidak_ada: {
    ikon: '✕', kelas: 'text-red-600', label: 'Tidak ada',
  },
  perlu_cek_manual: {
    ikon: '?', kelas: 'text-gray-500', label: 'Perlu dicek manual',
  },
};

export function SyaratPenunjangCard({ temuan }: { temuan?: TemuanSyaratPenunjang[] }) {
  // Panel tidak dirender sama sekali kalau tidak ada diagnosis pemicu.
  // Sebagian besar klaim tidak memuat diagnosis bersyarat; menampilkan panel
  // kosong bertuliskan "tidak ada syarat" di setiap klaim hanya menambah
  // panjang halaman.
  if (!temuan || temuan.length === 0) return null;

  const perluDicek = temuan.reduce(
    (n, t) => n + t.ringkasan.tidak_ada + t.ringkasan.hasil_belum_terbaca, 0,
  );
  const totalSyarat = temuan.reduce((n, t) => n + t.syarat.length, 0);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-900">Syarat Penunjang Diagnosis</h3>
        {perluDicek > 0 && (
          <Badge className="bg-amber-100 text-amber-800">
            {perluDicek} dari {totalSyarat} perlu dicek
          </Badge>
        )}
      </div>
      <p className="mb-3 text-xs leading-snug text-gray-500">
        Sebagian diagnosis hanya dapat dikoding bila pemeriksaan penunjangnya ada dan
        hasilnya mendukung. Yang diperiksa verifikator BPJS adalah hasilnya, bukan
        ada-tidaknya tindakan.
      </p>

      <div className="space-y-3">
        {temuan.map((t) => (
          <div key={`${t.id}-${t.kode_diagnosis}`} className="rounded-md border border-gray-200 p-3">
            <div className="mb-2 flex flex-wrap items-baseline gap-2">
              <span className="font-mono text-xs font-bold text-teal-700">{t.kode_diagnosis}</span>
              <span className="text-xs text-gray-500">{t.nama_diagnosis}</span>
              {!t.diverifikasi && (
                <Badge variant="outline" className="text-[10px]">Belum diverifikasi koder</Badge>
              )}
            </div>

            <div className="space-y-1.5">
              {t.syarat.map((s, i) => {
                const gaya = GAYA[s.status] || GAYA.perlu_cek_manual;
                return (
                  <div key={`${s.nama}-${i}`} className="flex gap-2 text-xs">
                    <span className={cn('font-bold leading-relaxed', gaya.kelas)}>{gaya.ikon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-gray-800">
                        <span className="font-medium">{s.nama}</span>
                        <span className="text-gray-400"> — </span>
                        <span className={gaya.kelas}>{gaya.label}</span>
                      </div>

                      {s.nilai !== null && s.nilai !== undefined && (
                        <div className="mt-0.5 text-[11px] text-gray-600">
                          Nilai terbaca: <span className="font-mono">{s.nilai}</span>
                          {s.ambang && <span className="text-gray-400"> · syarat {s.ambang}</span>}
                        </div>
                      )}

                      {s.kutipan && (
                        <div className="mt-0.5 text-[11px] italic text-gray-500">
                          &ldquo;{s.kutipan}&rdquo;
                          {s.page_number && <span className="not-italic"> (hal. {s.page_number})</span>}
                        </div>
                      )}

                      {s.kode_prosedur_ditemukan?.length > 0 && (
                        <div className="mt-0.5 font-mono text-[10px] text-gray-400">
                          {s.kode_prosedur_ditemukan.join(', ')} · PROCLIST
                        </div>
                      )}

                      {/* Batasan dinyatakan terbuka, bukan disamarkan jadi kesimpulan. */}
                      {s.catatan_batasan && (
                        <div className="mt-1 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] leading-snug text-gray-600">
                          {s.catatan_batasan}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Kalimat asli verifikator membuat aturan bisa dipertanggungjawabkan:
                jawabannya bukan "karena aturannya begitu" melainkan kutipan nyata
                dari klaim yang dulu ditolak. */}
            <div className="mt-2 border-t border-gray-100 pt-2 text-[10px] leading-snug text-gray-400">
              Dasar aturan: {t.sumber_aturan}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
