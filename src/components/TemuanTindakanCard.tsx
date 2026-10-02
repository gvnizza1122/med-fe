'use client';
// Tindakan yang terbaca dari berkas — terpisah dari Daftar Prosedur.
//
// Daftar Prosedur (PROCLIST) memuat kode ICD-9-CM final dari koder. Kartu ini
// menampilkan apa yang TERTULIS di berkas, lengkap dengan kutipannya. Kode di
// sini adalah usulan; memasukkannya ke Daftar Prosedur tetap wewenang koder
// casemix, jadi kartu ini tidak punya tombol yang mengubah data.
import { Badge } from '@/components/ui/badge';

export interface BuktiTindakan {
  page_number: number | null;
  sumber: string;
  kutipan: string;
}

export interface TemuanTindakan {
  id: string;
  nama: string;
  kode_usulan: string | null;
  catatan_kode?: string;
  bukti: BuktiTindakan[];
}

export interface SilangTindakan {
  id: string;
  nama: string;
  jenis: string;
  keparahan: string;
  pesan: string;
  bukti: BuktiTindakan[];
}

const LABEL_SUMBER: Record<string, string> = {
  resume_medis: 'Resume medis',
  triase_igd: 'Triase IGD',
  resep: 'Resep',
};

export function TemuanTindakanCard({
  temuan,
  silang,
}: {
  temuan?: TemuanTindakan[];
  silang?: SilangTindakan[];
}) {
  // Tidak dirender sama sekali kalau tidak ada tindakan yang terbaca.
  if (!temuan || temuan.length === 0) return null;

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-900">Tindakan Terbaca di Berkas</h3>
        <Badge variant="outline" className="text-[10px]">{temuan.length} tindakan</Badge>
      </div>
      <p className="mb-3 text-xs leading-snug text-gray-500">
        Apa yang tertulis di berkas, lengkap dengan kutipannya. Kode di bawah adalah{' '}
        <span className="font-medium">usulan</span> — memasukkannya ke Daftar Prosedur
        tetap keputusan koder.
      </p>

      <div className="space-y-2">
        {temuan.map((t, i) => (
          // id bisa kembar (AI menulis temuan yang sama dua kali, mis. ai_99.29).
          <div key={`${t.id}-${i}`} className="rounded-md border border-gray-200 p-3">
            <div className="mb-1.5 flex flex-wrap items-baseline gap-2">
              <span className="text-xs font-semibold text-gray-900">{t.nama}</span>
              {t.kode_usulan ? (
                <span className="font-mono text-[11px] font-bold text-teal-700">
                  usulan {t.kode_usulan}
                </span>
              ) : (
                // Kode yang belum dipastikan koder sengaja dibiarkan kosong —
                // kode karangan jauh lebih berbahaya daripada kolom kosong.
                <span className="text-[11px] text-gray-400">kode belum ditentukan</span>
              )}
            </div>

            <div className="space-y-0.5">
              {t.bukti.map((b, i) => (
                <div key={`${b.page_number}-${i}`} className="text-[11px] leading-snug text-gray-600">
                  <span className="text-gray-400">
                    {LABEL_SUMBER[b.sumber] || b.sumber}
                    {b.page_number ? ` · hal. ${b.page_number}` : ''}:
                  </span>{' '}
                  <span className="italic">&ldquo;{b.kutipan}&rdquo;</span>
                </div>
              ))}
            </div>

            {t.catatan_kode && (
              <div className="mt-1.5 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] leading-snug text-gray-600">
                {t.catatan_kode}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Peringatan, bukan kesimpulan: tidak ada tindakan yang ditambahkan
          sendiri oleh sistem. Yang tidak tertulis tidak boleh dikodekan. */}
      {silang && silang.length > 0 && (
        <div className="mt-3 space-y-2">
          {silang.map((s) => (
            <div key={s.id} className="rounded-md border border-amber-300 bg-amber-50 p-3">
              <div className="mb-0.5 text-xs font-semibold text-amber-900">
                Perlu diperiksa: {s.nama}
              </div>
              <p className="text-[11px] leading-snug text-gray-700">{s.pesan}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
