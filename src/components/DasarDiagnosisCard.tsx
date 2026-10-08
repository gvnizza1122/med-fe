'use client';
interface Bukti { page_number: number; kutipan: string; }
export interface DasarDiagnosis {
  diagnosis_dokter: (Bukti & { peran: string })[];
  patologi: { page_number: number; bahan: string; kesimpulan: string; sifat: string; kategori: string }[];
  catatan: string;
}
export interface TindakanBelumDikode {
  nama: string; kode: string; pesan: string; bukti: Bukti[];
}
const KATEGORI: Record<string, string> = {
  normal: 'Hasil normal', peradangan: 'Temuan peradangan', neoplasma_jinak: 'Neoplasma jinak',
  tidak_ganas: 'Tidak menunjukkan keganasan', ganas: 'Temuan keganasan',
  belum_pasti: 'Perlu klarifikasi', belum_terbaca: 'Hasil belum terbaca',
};

export function DasarDiagnosisCard({ dasar, tindakan = [], onOpenPdf }: {
  dasar?: DasarDiagnosis; tindakan?: TindakanBelumDikode[]; onOpenPdf?: (page: number) => void;
}) {
  if (!dasar && !tindakan.length) return null;
  const halaman = (p: number) => onOpenPdf
    ? <button type="button" className="ml-2 text-xs text-primary underline underline-offset-2" onClick={() => onOpenPdf(p)}>Lihat hal. {p}</button>
    : <span className="ml-2 text-xs text-muted-foreground">Hal. {p}</span>;
  return (
    <div className="rounded-lg border border-border bg-card p-4 text-sm">
      <h3 className="font-semibold">Dasar diagnosis dan kelengkapan tindakan</h3>
      {dasar && <>
        <div className="mt-3 space-y-2">
          {dasar.diagnosis_dokter.map((d, i) => <div key={`${d.page_number}-${i}`}>
            <p className="text-xs font-medium text-muted-foreground">Diagnosis akhir dokter · {d.peran}{halaman(d.page_number)}</p>
            <p className="mt-1 whitespace-pre-line">{d.kutipan}</p>
          </div>)}
        </div>
        {dasar.patologi.map((p, i) => <div key={`${p.page_number}-${i}`} className="mt-3 rounded-md bg-muted/40 p-3">
          <p className="font-medium">Histopatologi · {KATEGORI[p.kategori] || 'Perlu ditinjau'}{halaman(p.page_number)}</p>
          {p.bahan && <p className="mt-1 text-xs text-muted-foreground">Spesimen: {p.bahan}</p>}
          <p className="mt-1 whitespace-pre-line">{p.kesimpulan}</p>
          {p.sifat && <p className="mt-1 text-xs text-muted-foreground">{p.sifat}</p>}
        </div>)}
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{dasar.catatan}</p>
      </>}
      {tindakan.length > 0 && <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
        <p className="font-medium">Tindakan tercatat, kode perlu dilengkapi</p>
        {tindakan.map(t => <div key={t.kode} className="mt-2">
          <p>{t.nama} · {t.kode}{t.bukti[0] && halaman(t.bukti[0].page_number)}</p>
          {t.bukti[0] && <p className="mt-1 text-xs text-muted-foreground">“{t.bukti[0].kutipan}”</p>}
          <p className="mt-1 text-xs text-muted-foreground">{t.pesan}</p>
        </div>)}
      </div>}
    </div>
  );
}
