'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BookOpen, Search, Download, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { useRequireRole } from '@/lib/useRequireRole';
import { Header } from '@/components/dashboard/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
interface Source {url:string; id_daftar:string}
interface FileInfo {sha256:string; jumlah_halaman:number; status_ekstraksi:string}
interface Doc {id:string; judul:string; nomor:string|null; tahun:number|null; jenis:string; cakupan_usia:string; berlaku_mulai:string|null; status_unduh:string; status_telaah:string; catatan:string[]; berkas:FileInfo[]; sumber:Source[]; menggantikan:string[]; digantikan_oleh:string[]; cuplikan?:{halaman:number;kutipan:string}[]}
interface Data { total:number; cakupan:string; diperiksa_pada:string; ringkasan:{entri:number;pdf_unik:number;halaman_pdf:number;belum_terunduh:number}; dokumen:Doc[] }
const ages:Record<string,string>={dewasa:'Dewasa',anak:'Anak',anak_remaja:'Anak dan remaja',remaja:'Remaja',bayi:'Bayi',per_butir:'Usia mengikuti butir',perlu_telaah:'Cakupan usia perlu telaah'};
const kinds:Record<string,string>={pnpk:'PNPK Kemenkes',pnpk_profesi:'Pedoman profesi',ba:'BA kesepakatan',tkmkb:'TKMKB',manual_bpjs:'Manual BPJS',pedoman_lain:'Pedoman lain',koleksi:'Koleksi tautan'};
function DocumentCard({d}:{d:Doc}) {
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  async function download(variant:number) {
    setBusy(true);setError('');
    try {const r=await api.getPdfPedoman(d.id,variant);const url=URL.createObjectURL(await r.blob());const a=document.createElement('a');a.href=url;a.download=d.id+'.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
    catch(e){setError(e instanceof Error?e.message:'Berkas belum dapat dibuka.');}finally{setBusy(false);}
  }
  return <Card id={d.id}><CardContent className="space-y-3 p-5">
    <div className="flex flex-wrap gap-2"><Badge variant="outline">{kinds[d.jenis] || d.jenis}</Badge><Badge variant="outline">{ages[d.cakupan_usia] || d.cakupan_usia}</Badge><Badge variant="outline">{d.status_unduh==='terunduh'?'PDF tersedia':d.status_unduh==='koleksi_tautan'?'Koleksi sumber':'PDF belum diperoleh'}</Badge></div>
    <h2 className="text-base font-semibold leading-relaxed">{d.judul}</h2>
    <p className="text-sm text-muted-foreground">{d.nomor || 'Nomor pengesahan belum terkonfirmasi'}{d.tahun?` · ${d.tahun}`:''}</p>
    <p className="text-xs text-muted-foreground">{d.berlaku_mulai?`Awal berlaku tercatat: ${d.berlaku_mulai}`:'Awal berlaku perlu konfirmasi dari sumber'} · {d.berkas[0]?.jumlah_halaman || 0} halaman PDF</p>
    {d.menggantikan.length>0 && <p className="text-xs">Mencabut dokumen: {d.menggantikan.join(', ')}</p>}
    {d.digantikan_oleh.length>0 && <p className="text-xs text-amber-700 dark:text-amber-400">Memiliki pengganti: {d.digantikan_oleh.join(', ')}. Sesuaikan dengan tanggal episode.</p>}
    <p className="text-xs text-muted-foreground">{d.status_telaah==='memiliki_aturan_ditelaah'?'Sebagian butir telah ditelaah dan digunakan aplikasi; cakupan mengikuti aturan terkait.':'Rujukan katalog; kriteria belum dijadikan aturan otomatis.'}</p>
    {d.catatan.map((c,i)=><p key={i} className="text-xs leading-relaxed text-muted-foreground">{c}</p>)}
    {d.cuplikan?.map((c,i)=><blockquote key={i} className="border-l-2 border-primary/30 pl-3 text-xs leading-relaxed"><span className="font-medium">Halaman PDF {c.halaman}</span> · {c.kutipan}</blockquote>)}
    <div className="flex flex-wrap items-center gap-2">{d.berkas.map((f,i)=><Button key={f.sha256} variant="outline" size="sm" disabled={busy} onClick={()=>download(i)}><Download className="h-4 w-4"/>{busy?'Menyiapkan...':i?`PDF salinan ${i+1}`:'Unduh PDF'}</Button>)}
      {[...new Set(d.sumber.map(s=>s.url).filter(u=>/^https:\/\//.test(u)))].map((url,i)=><a key={url} className="inline-flex items-center gap-1 rounded-md p-2 text-xs text-primary underline underline-offset-4 focus-visible:ring-2" target="_blank" rel="noopener noreferrer" href={url}><ExternalLink className="h-3 w-3"/>Sumber {i+1}</a>)}
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Identitas salinan dan kelengkapan teks</summary>{d.berkas.map(f=><p key={f.sha256} className="mt-2 break-all">SHA-256 {f.sha256} · {f.status_ekstraksi.replaceAll('_',' ')}</p>)}<p className="mt-2">Pencarian isi mengikuti teks yang berhasil diekstrak. Halaman tanpa teks tetap perlu dibaca pada PDF.</p></details>
  </CardContent></Card>;
}
function Catalogue() {
  const {checking,allowed}=useRequireRole(['superadmin','admin','supervisor','verifikator']);
  const params=useSearchParams();const selected=params.get('dokumen');
  const [q,setQ]=useState('');const [age,setAge]=useState('');const [kind,setKind]=useState('');const [year,setYear]=useState('');const [status,setStatus]=useState('');const [inside,setInside]=useState(false);const [offset,setOffset]=useState(0);const [data,setData]=useState<Data|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
  useEffect(()=>{if(!allowed)return;let cancelled=false;const timer=setTimeout(async()=>{setLoading(true);setError('');try{const all=await api.getKatalogPedoman<Data>({q,usia:age,jenis:kind,tahun:year,status,isi:inside?'1':'0',offset:String(offset),limit:'20'});if(selected){const chosen=await api.getPedoman<{dokumen: Doc;cuplikan: NonNullable<Doc['cuplikan']>}>(selected,q);all.dokumen=[{...chosen.dokumen,cuplikan:chosen.cuplikan}];all.total=1;}if(!cancelled)setData(all);}catch(e){if(!cancelled){setData(null);setError(e instanceof Error?e.message:'Katalog belum dapat dimuat.');}}finally{if(!cancelled)setLoading(false);}},300);return()=>{cancelled=true;clearTimeout(timer);};},[allowed,q,age,kind,year,status,inside,offset,selected]);
  function change(setter:(v:string)=>void,value:string){setter(value);setOffset(0);}
  if(checking)return <p className="p-6">Memuat katalog...</p>;if(!allowed)return null;
  return <><Header title="Katalog Pedoman" description="Telusuri PNPK, BA kesepakatan, dan pedoman pendukung klaim"/><main className="space-y-5 p-4 md:p-6">
    <div className="rounded-xl border border-border bg-card p-5"><div className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary"/><p className="font-semibold">Sumber untuk menelaah persyaratan kasus</p></div><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Dokumen anak dan dewasa memiliki cakupan sendiri. Gunakan usia, tanggal episode, dan versi sumber saat menilai kasus. Rujukan baru belum otomatis menambah alasan pending atau menyatakan klaim valid.</p>{data && <p className="mt-3 text-sm">{data.ringkasan.entri} entri · {data.ringkasan.pdf_unik} salinan PDF unik · {data.ringkasan.halaman_pdf.toLocaleString('id-ID')} halaman · {data.ringkasan.belum_terunduh} BA belum diperoleh</p>}<p className="mt-2 text-xs text-muted-foreground">{data?.cakupan} Diperiksa {data?.diperiksa_pada || '2026-10-08'}.</p></div>
    {selected ? <a href="/katalog-pedoman" className="text-sm text-primary underline">Kembali ke seluruh katalog</a> : <div className="space-y-3 rounded-xl border border-border bg-card p-4"><label htmlFor="pencarian-pedoman" className="text-sm font-medium">Cari judul, nomor KMK/BA, atau isi dokumen</label><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input id="pencarian-pedoman" className="pl-9" placeholder="Contoh: pneumonia, 1168, sepsis anak" value={q} onChange={e=>change(setQ,e.target.value)}/></div><div className="grid gap-3 sm:grid-cols-4">{[
      {label:'Cakupan usia',value:age,set:setAge,options:ages}, {label:'Jenis dokumen',value:kind,set:setKind,options:kinds}, {label:'Tahun',value:year,set:setYear,options:Object.fromEntries(Array.from({length:13},(_,i)=>String(2026-i)).map(y=>[y,y]))}, {label:'Kelengkapan',value:status,set:setStatus,options:{terunduh:'PDF tersedia',belum_terunduh:'Belum diperoleh',koleksi_tautan:'Koleksi tautan'}}
    ].map(f=><label key={f.label} className="space-y-1 text-xs">{f.label}<select aria-label={f.label} className="block h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.value} onChange={e=>change(f.set,e.target.value)}><option value="">Semua</option>{Object.entries(f.options).map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>)}</div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={inside} onChange={e=>{setInside(e.target.checked);setOffset(0);}}/>Cari juga di isi PDF (termasuk versi lama)</label></div>}
    {error && <p role="alert" className="rounded-lg border border-destructive p-4 text-sm text-destructive">{error}</p>}
    {loading?<p role="status" className="text-sm text-muted-foreground">Mencari pedoman...</p>:<><p role="status" className="text-sm text-muted-foreground">{data?.total || 0} entri ditemukan</p><div className="space-y-4">{data?.dokumen.map(d=><DocumentCard key={d.id} d={d}/>)}</div>{!data?.dokumen.length && !error && <p className="text-sm">Tidak ditemukan. Coba istilah atau filter lain.</p>}{!selected && <div className="flex items-center justify-between"><Button variant="outline" disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-20))}>Sebelumnya</Button><span className="text-xs">Halaman {Math.floor(offset/20)+1}</span><Button variant="outline" disabled={offset+20>=(data?.total || 0)} onClick={()=>setOffset(offset+20)}>Berikutnya</Button></div>}</>}
  </main></>;
}
export default function Page(){return <Suspense fallback={<p className="p-6">Memuat katalog...</p>}><Catalogue/></Suspense>;}
