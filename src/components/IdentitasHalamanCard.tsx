'use client';
// Verifikasi identitas lintas halaman.
//
// Menampilkan halaman yang identitasnya tidak sejalan dengan pasien yang
// diklaim. Backend yang menilai (identitasLintasHalamanService.js); kartu ini
// hanya menampilkan.
//
// Kartu ini MELAPORKAN, tidak memutuskan. Keputusan apakah sebuah halaman
// benar-benar salah tempat ada pada petugas yang memegang berkas fisiknya,
// jadi tidak ada tombol yang mengubah data di sini.
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface TemuanIdentitasHalaman {
  page_number: number;
  jenis: string;
  keparahan: 'tinggi' | 'sedang' | 'rendah' | 'info' | string;
  pesan: string;
  ditemukan: string | null;
  diharapkan: string | null;
}

// Keparahan sengaja dibedakan tegas secara visual. Sebagian besar selisih
// identitas di berkas nyata berasal dari salah baca OCR, bukan halaman pasien
// lain — kalau semuanya ditampilkan semerah-merahnya, petugas akan berhenti
// membacanya justru saat ada yang sungguhan.
const GAYA: Record<string, { kelas: string; label: string }> = {
  tinggi: { kelas: 'border-red-300 bg-red-50', label: 'Perlu diperiksa' },
  sedang: { kelas: 'border-amber-300 bg-amber-50', label: 'Belum pasti' },
  rendah: { kelas: 'border-gray-200 bg-gray-50', label: 'Kemungkinan OCR' },
  info: { kelas: 'border-blue-200 bg-blue-50', label: 'Catatan' },
};

const URUTAN: Record<string, number> = { tinggi: 0, sedang: 1, rendah: 2, info: 3 };

export function IdentitasHalamanCard({ temuan }: { temuan: TemuanIdentitasHalaman[] }) {
  if (!temuan || temuan.length === 0) return null;

  const urut = [...temuan].sort(
    (a, b) => (URUTAN[a.keparahan] ?? 9) - (URUTAN[b.keparahan] ?? 9) || a.page_number - b.page_number,
  );
  const adaBerat = urut.some((t) => t.keparahan === 'tinggi');

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-1 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-900">Identitas Antar Halaman</h3>
        {adaBerat && <Badge className="bg-red-100 text-red-700">Perlu diperiksa</Badge>}
      </div>
      <p className="mb-3 text-xs text-gray-500">
        Memeriksa apakah setiap halaman benar milik pasien yang diklaim, berdasarkan nama
        dan No RM yang tercetak di halaman itu.
      </p>

      <div className="space-y-2">
        {urut.map((t, i) => {
          const gaya = GAYA[t.keparahan] || GAYA.info;
          return (
            <div key={`${t.page_number}-${t.jenis}-${i}`} className={cn('rounded-md border p-3', gaya.kelas)}>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-gray-900">Halaman {t.page_number}</span>
                <Badge variant="outline" className="text-[10px]">{gaya.label}</Badge>
              </div>
              <p className="text-xs leading-snug text-gray-700">{t.pesan}</p>
              {(t.ditemukan || t.diharapkan) && (
                <div className="mt-2 space-y-0.5 text-[11px] text-gray-600">
                  <div>
                    <span className="text-gray-400">Di halaman:</span>{' '}
                    <span className="font-mono">{t.ditemukan || '—'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Di klaim:</span>{' '}
                    <span className="font-mono">{t.diharapkan || '—'}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
