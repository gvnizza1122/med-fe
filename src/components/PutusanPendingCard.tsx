'use client';
// Putusan pending — jawaban atas pertanyaan yang sebenarnya ditanyakan koder:
// "klaim ini akan dipending atau tidak, dan kalau iya karena apa?"
//
// Ditaruh paling atas karena itu yang pertama ingin dilihat. Kartu-kartu rinci
// di bawahnya tetap ada untuk yang ingin menelusuri.
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface AlasanPending {
  sumber_pemeriksaan: string;
  kode: string | null;
  ringkas: string;
  penjelasan?: string;
  poin?: { label: string; isi: string }[];
  keparahan: string;
  bukti: string | null;
  tindakan: string | null;
  diverifikasi: boolean;
  dari_rekap_pending: boolean;
}

export interface PutusanPending {
  status: string;
  ringkasan: string;
  catatan_keandalan: string;
  alasan: AlasanPending[];
  jumlah: {
    total: number;
    berat: number;
    sudah_disahkan: number;
    belum_disahkan: number;
    dari_rekap_pending: number;
  };
}

const GAYA_STATUS: Record<string, { kelas: string; judul: string }> = {
  berisiko_pending: {
    kelas: 'border-red-300 bg-red-50',
    judul: 'Berisiko dipending',
  },
  perlu_dicek: {
    kelas: 'border-amber-300 bg-amber-50',
    judul: 'Sebaiknya dicek dulu',
  },
  tidak_ditemukan_alasan: {
    kelas: 'border-emerald-300 bg-emerald-50',
    judul: 'Tidak ditemukan alasan pending',
  },
};

const GAYA_ALASAN: Record<string, string> = {
  tinggi: 'text-red-700',
  sedang: 'text-amber-700',
  rendah: 'text-gray-600',
};

export function PutusanPendingCard({ putusan }: { putusan?: PutusanPending | null }) {
  if (!putusan) return null;

  const gaya = GAYA_STATUS[putusan.status] || GAYA_STATUS.perlu_dicek;

  return (
    <div className={cn('mb-4 rounded-lg border p-4', gaya.kelas)}>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-gray-900">{gaya.judul}</h3>
        {putusan.jumlah.dari_rekap_pending > 0 && (
          <Badge className="bg-red-100 text-red-700">
            {putusan.jumlah.dari_rekap_pending} pernah bikin klaim ditolak
          </Badge>
        )}
      </div>
      <p className="text-sm text-gray-800">{putusan.ringkasan}</p>

      {putusan.alasan.length > 0 && (
        <ol className="mt-3 space-y-2">
          {putusan.alasan.map((a, i) => (
            <li key={`${a.kode}-${i}`} className="rounded-md border border-gray-200 bg-white p-3">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-400">{i + 1}.</span>
                <span className={cn('text-xs font-semibold', GAYA_ALASAN[a.keparahan] || 'text-gray-700')}>
                  {a.ringkas}
                </span>
                {/* Aturan yang lahir dari klaim yang benar-benar pernah ditolak
                    di RS ini punya bobot berbeda dari dugaan kelengkapan. */}
                {a.dari_rekap_pending && (
                  <Badge variant="outline" className="text-[10px]">Pernah jadi alasan penolakan</Badge>
                )}
                {!a.diverifikasi && (
                  <Badge variant="outline" className="text-[10px]">Belum disahkan koder</Badge>
                )}
              </div>

              {a.penjelasan && (
                <p className="text-[11px] leading-snug text-gray-600">{a.penjelasan}</p>
              )}

              {a.bukti && (
                <div className="mt-1 text-[11px] italic text-gray-500">{a.bukti}</div>
              )}

              {a.tindakan && (
                <div className="mt-1 text-[11px] text-gray-700">
                  <span className="text-gray-400">Yang perlu dilakukan:</span> {a.tindakan}
                </div>
              )}

              <div className="mt-1 font-mono text-[10px] text-gray-400">
                {a.sumber_pemeriksaan}
                {a.kode ? ` · ${a.kode}` : ''}
              </div>
            </li>
          ))}
        </ol>
      )}

      {/* Dinyatakan terbuka supaya putusan ini tidak dibaca sebagai keputusan
          BPJS. Ketepatannya memang belum pernah terukur. */}
      <p className="mt-3 border-t border-gray-300 pt-2 text-[10px] leading-snug text-gray-500">
        {putusan.catatan_keandalan}
      </p>
    </div>
  );
}
