'use client';
// Kartu gelap INA-CBG di bawah panel kode. Angka tarif diambil dari data
// klaim (lembar grouper) bila ada, kalau tidak dari hasil lookup PMK yang
// disimpan backend. Skor keyakinan grouping tidak ditampilkan.
export function formatRupiah(nilai: number | null | undefined): string | null {
  if (nilai === null || nilai === undefined || !Number.isFinite(nilai) || nilai <= 0) return null;
  return `Rp ${new Intl.NumberFormat('id-ID').format(nilai)}`;
}

export function InaCbgRingkasCard({ kode, deskripsi, tarif, sumber, jenisLayanan, catatan, rentang, labelTarif }: {
  kode?: string | null; deskripsi?: string | null; tarif?: number | null; sumber?: string | null; jenisLayanan?: string | null; catatan?: string | null;
  rentang?: string | null; labelTarif?: string;
}) {
  const rupiah = formatRupiah(tarif);
  return (
    <section aria-label="INA-CBG dan tarif" className="rounded-xl bg-slate-900 p-4 text-white shadow-sm dark:bg-slate-800 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-300">Kode INA-CBG</p>
          <p className="mt-1 font-mono-data text-xl font-semibold">
            {kode || 'Belum ada'}
            {kode && jenisLayanan && <span className="ml-2 font-sans text-sm font-normal text-slate-300">· {jenisLayanan}</span>}
          </p>
          {deskripsi && <p className="mt-1 text-sm text-slate-300">{deskripsi}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs font-medium text-slate-300">{labelTarif || 'Tarif INA-CBG'}</p>
          <p className="mt-1 font-mono-data text-xl font-semibold text-emerald-300">{rentang || rupiah || '—'}</p>
        </div>
      </div>
      {(sumber || catatan || !kode) && (
        <p className="mt-3 border-t border-white/10 pt-3 text-xs leading-relaxed text-slate-300">
          {!kode ? 'Tarif dihitung setelah kode diagnosis dan prosedur lengkap. Lihat tab Tarif untuk detail.' : catatan || `Sumber: ${sumber}`}
        </p>
      )}
    </section>
  );
}
