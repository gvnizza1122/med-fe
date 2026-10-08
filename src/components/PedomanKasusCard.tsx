'use client';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
export interface PedomanRingkas { id:string; judul:string; nomor:string|null; cakupan_usia:string; berlaku_mulai:string|null }
export interface PedomanKasus { kelompok_usia:string; catatan:string; topik:{topik:string; status:string; alasan:string|null; terpilih:PedomanRingkas|null; kandidat:PedomanRingkas[]}[] }
export function PedomanKasusCard({hasil}:{hasil?:PedomanKasus}) {
  if (!hasil?.topik?.length) return null;
  return <details className="mt-4 rounded-lg border border-border p-3 text-xs">
    <summary className="cursor-pointer font-medium"><BookOpen aria-hidden="true" className="mr-2 inline h-4 w-4"/>Pedoman terkait kasus · {hasil.topik.length} topik</summary>
    <p className="mt-2 leading-relaxed text-muted-foreground">{hasil.catatan}</p>
    <div className="mt-3 space-y-3">{hasil.topik.map(p=><div key={p.topik} className="rounded-md bg-muted/30 p-3">
      <p className="font-medium capitalize">{p.topik}</p>
      <p className="mt-1 text-muted-foreground">{p.alasan || 'Rujukan sesuai usia dan tanggal awal episode; persyaratan klinis perlu ditelaah.'}</p>
      {(p.terpilih ? [p.terpilih] : p.kandidat).map(d=><Link key={d.id} href={`/katalog-pedoman?dokumen=${encodeURIComponent(d.id)}`} className="mt-2 block text-primary underline underline-offset-4">{d.judul} · {d.nomor || d.id} · {d.cakupan_usia.replaceAll('_',' ')}{d.berlaku_mulai ? ` · mulai ${d.berlaku_mulai}` : ' · awal berlaku perlu konfirmasi'}</Link>)}
    </div>)}</div>
    <Link href="/katalog-pedoman" className="mt-3 inline-block text-primary underline underline-offset-4">Telusuri seluruh katalog</Link>
  </details>;
}
