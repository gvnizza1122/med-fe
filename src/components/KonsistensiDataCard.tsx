'use client';
// Konsistensi antar data — "kalau Data A ada, Data B harus ada".
//
// Backend yang menilai (konsistensiAntarDataService.js); kartu ini hanya
// menampilkan dan tidak punya tombol yang mengubah data.
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface BuktiKonsistensi {
  page_number: number | null;
  kutipan?: string;
  kata?: string;
  sumber?: string;
}

export interface TemuanKonsistensi {
  id: string;
  nama: string;
  keparahan: string;
  pesan: string;
  yang_ditemukan: BuktiKonsistensi | null;
  yang_dicari: string | null;
  sumber_aturan: string | null;
  diverifikasi: boolean;
}

const GAYA: Record<string, { kelas: string; label: string }> = {
  tinggi: { kelas: 'border-red-300 bg-red-50', label: 'Risiko tinggi' },
  sedang: { kelas: 'border-amber-300 bg-amber-50', label: 'Perlu dicek' },
  rendah: { kelas: 'border-gray-200 bg-gray-50', label: 'Catatan' },
};

const URUTAN: Record<string, number> = { tinggi: 0, sedang: 1, rendah: 2 };

export function KonsistensiDataCard({ temuan }: { temuan?: TemuanKonsistensi[] }) {
  // Tidak dirender kalau semua data sudah saling mendukung.
  if (!temuan || temuan.length === 0) return null;

  const urut = [...temuan].sort(
    (a, b) => (URUTAN[a.keparahan] ?? 9) - (URUTAN[b.keparahan] ?? 9),
  );

  // Hanya aturan yang sudah ditelaah koder yang boleh dihitung sebagai
  // peringatan. Aturan yang belum disahkan tetap ditampilkan lengkap dengan
  // tandanya, tapi tidak ikut di lencana — satu dugaan tidak boleh terlihat
  // seperti temuan yang sudah pasti.
  const perluDicek = urut.filter((t) => t.diverifikasi).length;

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-900">Konsistensi Antar Data</h3>
        {perluDicek > 0 && (
          <Badge className="bg-red-100 text-red-700">{perluDicek} perlu dicek</Badge>
        )}
      </div>
      <p className="mb-3 text-xs leading-snug text-gray-500">
        Memeriksa apakah data yang diklaim punya pendukungnya di berkas — tindakan
        dengan obatnya, prosedur dengan hasilnya, klaim dengan SEP-nya.
      </p>

      <div className="space-y-2">
        {urut.map((t) => {
          const gaya = GAYA[t.keparahan] || GAYA.rendah;
          return (
            <div key={t.id} className={cn('rounded-md border p-3', gaya.kelas)}>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-gray-900">{t.nama}</span>
                <Badge variant="outline" className="text-[10px]">{gaya.label}</Badge>
                {!t.diverifikasi && (
                  <Badge variant="outline" className="text-[10px]">Belum diverifikasi koder</Badge>
                )}
              </div>

              <p className="text-xs leading-snug text-gray-700">{t.pesan}</p>

              {t.yang_dicari && (
                <div className="mt-1 text-[11px] text-gray-600">
                  <span className="text-gray-400">Yang dicari:</span> {t.yang_dicari}
                </div>
              )}

              {t.yang_ditemukan?.kutipan && (
                <div className="mt-0.5 text-[11px] italic text-gray-500">
                  &ldquo;{t.yang_ditemukan.kutipan}&rdquo;
                  {t.yang_ditemukan.page_number && (
                    <span className="not-italic"> (hal. {t.yang_ditemukan.page_number})</span>
                  )}
                </div>
              )}

              {t.sumber_aturan && (
                <div className="mt-1.5 border-t border-gray-200 pt-1.5 text-[10px] leading-snug text-gray-400">
                  Dasar aturan: {t.sumber_aturan}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
