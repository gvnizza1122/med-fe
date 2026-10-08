'use client';
import {useEffect,useState} from 'react';
import {api} from '@/lib/api';
import {Button} from '@/components/ui/button';

export interface UkuranOperasi {
  nilai_tertulis:string;ukuran:number[];satuan:string;terbesar_cm:number;page_number:number;kutipan:string;sumber:string;catatan:string;
}
export interface DataLaporanOperasi {
  versi:string;hash_bukti:string;
  laporan:{page_number:number;tanggal:string|null;tindakan:string|null;ukuran:UkuranOperasi[];teks:string;status_ukuran:string}[];
  patologi:{page_number:number;ukuran_spesimen:UkuranOperasi[];kesimpulan:string|null;teks:string}[];
  kriteria_stt:{id:string;nama:string;status:string;bukti:{page_number:number;kutipan:string}[];catatan:string}[];
  catatan:string[];catatan_keandalan:string;
  cakupan:{halaman_dipindai:number[];halaman_belum_terbaca:number[];analisis_berkas_berubah:boolean;analisis_ai_sesuai_bukti:boolean|null;telaah_lokal_tersedia?:boolean};
  ringkasan:{jumlah_laporan:number;jumlah_pa:number;jumlah_ukuran_operasi:number};
}
function Halaman({nomor,onOpenPdf}:{nomor:number;onOpenPdf?:(page:number)=>void}) {
  return onOpenPdf?<Button type="button" size="sm" variant="outline" className="min-h-9" onClick={()=>onOpenPdf(nomor)}>Lihat halaman {nomor}</Button>:<span className="text-xs text-muted-foreground">Halaman {nomor}</span>;
}
function DaftarUkuran({ukuran}:{ukuran:UkuranOperasi[]}) {
  return <ul className="space-y-3">{ukuran.map((u,i)=><li key={`${u.page_number}-${i}`} className="rounded-lg border border-border bg-muted/15 p-3">
    <p className="text-base font-semibold">{u.ukuran.join(' × ')} {u.satuan}</p>
    <blockquote className="mt-2 whitespace-pre-wrap break-words border-l-2 border-border pl-3 text-sm leading-relaxed text-muted-foreground">{u.kutipan}</blockquote>
    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{u.catatan}</p>
  </li>)}</ul>;
}
export function LaporanOperasiIsi({data,onOpenPdf}:{data:DataLaporanOperasi;onOpenPdf?:(page:number)=>void}) {
  return <div className="space-y-5">
    <p className="text-sm text-muted-foreground">{data.cakupan.halaman_dipindai.length} halaman berkas ditelaah · {data.ringkasan.jumlah_laporan} halaman laporan operasi · {data.ringkasan.jumlah_pa} halaman hasil PA</p>
    {data.cakupan.analisis_berkas_berubah&&<p role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">Berkas berubah setelah analisis terakhir. Gunakan Baca Ulang untuk memperbarui analisis dari seluruh halaman terbaru.</p>}
    {!data.cakupan.analisis_berkas_berubah&&data.cakupan.telaah_lokal_tersedia&&data.cakupan.analisis_ai_sesuai_bukti!==true&&<p className="rounded-lg border border-border bg-muted/15 p-3 text-sm">Bukti operasi sudah ditelaah lokal. Analisis AI sebelumnya belum diperbarui dari telaah dokumen ini.</p>}
    {data.cakupan.halaman_belum_terbaca.length>0&&<p role="alert" className="text-sm text-amber-700 dark:text-amber-300">Halaman {data.cakupan.halaman_belum_terbaca.join(', ')} belum terbaca. Periksa PDF asli sebelum menyimpulkan bukti tidak ada.</p>}
    {!data.laporan.length&&<p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">Laporan operasi belum teridentifikasi dari teks berkas. Periksa PDF asli atau tambahkan laporan pada berkas klaim dan baca ulang.</p>}
    {data.laporan.map(r=><section key={r.page_number} className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-base font-semibold">{r.status_ukuran==='halaman_pengesahan'?'Pengesahan laporan operasi':'Temuan pada laporan operasi'}</h4>{r.tindakan&&<p className="mt-1 text-sm">{r.tindakan}</p>}{r.tanggal&&<p className="mt-1 text-xs text-muted-foreground">Tanggal operasi: {r.tanggal}</p>}</div><Halaman nomor={r.page_number} onOpenPdf={onOpenPdf}/></div>
      {r.ukuran.length?<DaftarUkuran ukuran={r.ukuran}/>:r.status_ukuran==='halaman_pengesahan'?<p className="text-sm text-muted-foreground">Halaman lanjutan/pengesahan; lihat temuan ukuran pada bagian laporan di atas.</p>:<p className="text-sm text-amber-700 dark:text-amber-300">Ukuran tumor belum terbaca. Periksa narasi/tulisan tangan pada laporan asli.</p>}
      <details><summary className="cursor-pointer text-sm font-medium">Teks laporan operasi</summary><pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-muted-foreground">{r.teks}</pre></details>
    </section>)}
    {data.patologi.map(p=><section key={p.page_number} className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h4 className="text-base font-semibold">Ukuran spesimen pada hasil PA</h4><Halaman nomor={p.page_number} onOpenPdf={onOpenPdf}/></div>
      <p className="text-sm text-muted-foreground">Ukuran sampel PA ditampilkan terpisah dari ukuran temuan saat operasi. Cocokkan label masing-masing lesi.</p>
      {p.kesimpulan&&<p className="whitespace-pre-wrap text-sm leading-relaxed">{p.kesimpulan}</p>}
      {p.ukuran_spesimen.length?<DaftarUkuran ukuran={p.ukuran_spesimen}/>:<p className="text-sm text-muted-foreground">Ukuran spesimen belum terbaca.</p>}
    </section>)}
    {!!data.laporan.length&&<section aria-label="Telaah kriteria tumor jaringan lunak" className="space-y-3"><h4 className="text-sm font-semibold">Telaah kriteria tumor jaringan lunak</h4>
      <p className="text-sm text-muted-foreground">BA 2024 menggunakan salah satu kondisi berikut. Ukuran &gt;4 cm saja belum membuktikan perluasan ke struktur vital.</p>
      <ul className="space-y-3">{data.kriteria_stt.map(k=><li key={k.id} className="rounded-lg bg-muted/25 p-3"><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-medium">{k.nama}</p><span className="text-xs text-muted-foreground">{k.status==='bukti_pendukung'?'Bukti pendukung tercatat':'Perlu konfirmasi'}</span></div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{k.catatan}</p>{k.bukti.map((b,i)=><blockquote key={i} className="mt-2 border-l-2 border-border pl-3 text-xs leading-relaxed text-muted-foreground">Hal. {b.page_number}: {b.kutipan}</blockquote>)}</li>)}</ul>
    </section>}
    {!!data.catatan.length&&<ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">{data.catatan.map(c=><li key={c}>{c}</li>)}</ul>}
    <p className="text-xs leading-relaxed text-muted-foreground">{data.catatan_keandalan}</p>
  </div>;
}
export function LaporanOperasiPanel({recordId,hashBukti,onOpenPdf}:{recordId:string;hashBukti?:string;onOpenPdf?:(page:number)=>void}) {
  const [hasil,setHasil]=useState<{id:string;hash?:string;data:DataLaporanOperasi|null;gagal:boolean}|null>(null);
  const [percobaan,setPercobaan]=useState(0);
  useEffect(()=>{let aktif=true;
    api.getLaporanOperasi<DataLaporanOperasi>(recordId).then((data:DataLaporanOperasi)=>{if(aktif)setHasil({id:recordId,hash:hashBukti,data,gagal:false});})
      .catch(()=>{if(aktif)setHasil({id:recordId,hash:hashBukti,data:null,gagal:true});});
    return()=>{aktif=false;};
  },[recordId,hashBukti,percobaan]);
  const siap=hasil?.id===recordId&&hasil.hash===hashBukti;
  return <div className="space-y-4 p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-base font-semibold">Laporan operasi dan ukuran tumor</h3><Button type="button" size="sm" variant="outline" onClick={()=>{setHasil(null);setPercobaan(n=>n+1);}}>Periksa bukti terbaru</Button></div>
    {!siap?<p role="status" className="text-sm text-muted-foreground">Membaca laporan dari seluruh halaman berkas…</p>:hasil.gagal||!hasil.data?<p role="alert" className="text-sm text-destructive">Laporan belum dapat dimuat. Tekan Periksa bukti terbaru untuk mencoba lagi.</p>:<LaporanOperasiIsi data={hasil.data} onOpenPdf={onOpenPdf}/>}
  </div>;
}
