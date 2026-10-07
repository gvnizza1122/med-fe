'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Lokal { id:string; sumber_aturan:string; disahkan_oleh:string; berlaku_mulai:string|null; berlaku_sampai:string|null; url?:string|null }
interface Profil { hospital_code:string; layanan:{rehabilitasi_medis:boolean|null}; referensi_dinonaktifkan:string[]; ketentuan_lokal:Lokal[]; konfigurasi_belum_terbaca?:boolean }
interface Sumber { id:string; judul:string; nomor:string|null; versi:string; jenis:string; url:string; status_verifikasi:string; berlaku_mulai:string|null; catatan:string }
interface Katalog { versi:string; diperiksa_pada:string; sumber:Sumber[]; aturan:{id:string; nama:string; sumber_id:string; catatan:string}[] }
export function ProfilKlaimRsCard() {
  const [profil,setProfil]=useState<Profil|null>(null);
  const [katalog,setKatalog]=useState<Katalog|null>(null);
  const [template,setTemplate]=useState<{id:string;nama:string;kode_diagnosis:string}[]>([]);
  const [saving,setSaving]=useState(false);
  const [pesan,setPesan]=useState('');
  const [gagal,setGagal]=useState(false);
  useEffect(()=>{ let aktif=true;
    api.getClaimProfile().then(d=>{if(!aktif)return;setProfil(d.profil);setKatalog(d.katalog);setTemplate(d.template_lokal);
      if(d.profil.konfigurasi_belum_terbaca){setGagal(true);setPesan('Pengaturan RS belum berhasil dimuat. Muat ulang sebelum mengubah profil.');}}
    ).catch(()=>{if(aktif){setGagal(true);setPesan('Profil ketentuan klaim belum berhasil dimuat.');}});
    return()=>{aktif=false;};
  },[]);
  const ubahLokal=(id:string,update:Partial<Lokal>)=>setProfil(p=>p?{...p,ketentuan_lokal:p.ketentuan_lokal.map(a=>a.id===id?{...a,...update}:a)}:p);
  const simpan=async()=>{
    if(!profil || gagal)return;setSaving(true);setPesan('');
    try {const d=await api.updateClaimProfile({layanan:profil.layanan,referensi_dinonaktifkan:profil.referensi_dinonaktifkan,ketentuan_lokal:profil.ketentuan_lokal});setProfil(d.profil);setPesan('Profil tersimpan untuk RS ini. Hasil berikutnya mengikuti pengaturan ini.');}
    catch(e){setPesan(e instanceof Error?e.message:'Profil belum berhasil disimpan.');}finally{setSaving(false);}
  };
  return <Card className="mb-6"><CardContent className="space-y-4 pt-6">
    <div><h2 className="text-base font-semibold">Ketentuan Klaim dan Layanan RS</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Referensi umum tersedia untuk semua RS. Ketentuan verifikasi setempat serta ketersediaan layanan disimpan khusus untuk RS akun ini.</p></div>
    {!profil && !pesan && <p className="text-sm text-muted-foreground">Memuat profil…</p>}
    {profil && <>
      <p className="text-xs text-muted-foreground">Kode RS: <span className="font-mono">{profil.hospital_code}</span></p>
      <div className="space-y-2"><Label htmlFor="rehab-rs">Ketersediaan rehabilitasi medis</Label>
        <select id="rehab-rs" className="block w-full max-w-sm rounded-md border border-input bg-background p-2 text-sm" value={profil.layanan.rehabilitasi_medis===null?'belum':profil.layanan.rehabilitasi_medis?'ya':'tidak'}
          onChange={e=>setProfil({...profil,layanan:{rehabilitasi_medis:e.target.value==='belum'?null:e.target.value==='ya'}})}>
          <option value="belum">Belum ditentukan</option><option value="ya">Tersedia</option><option value="tidak">Tidak tersedia</option>
        </select><p className="text-xs text-muted-foreground">Adaptasi layanan memengaruhi rekomendasi/rujukan; tidak menghapus persyaratan klaim.</p>
      </div>
      <details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-sm font-medium">Ketentuan verifikasi setempat</summary>
        <p className="my-3 text-xs leading-relaxed text-muted-foreground">Aktifkan hanya template yang didukung ketentuan untuk RS ini. Sumber dan pengesah wajib diisi; ambang tidak dipindahkan otomatis dari RS lain.</p>
        <div className="space-y-3">{template.map(t=>{const a=profil.ketentuan_lokal.find(a=>a.id===t.id);return <div key={t.id} className="rounded-md border border-border p-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!a} onChange={e=>setProfil({...profil,ketentuan_lokal:e.target.checked?[...profil.ketentuan_lokal,{id:t.id,sumber_aturan:'',disahkan_oleh:'',berlaku_mulai:null,berlaku_sampai:null}]:profil.ketentuan_lokal.filter(x=>x.id!==t.id)})} />{t.kode_diagnosis} · {t.nama}</label>
          {a && <div className="mt-3 space-y-2">
            <Label htmlFor={`sumber-${t.id}`}>Sumber ketentuan untuk RS ini</Label><textarea id={`sumber-${t.id}`} className="w-full rounded-md border border-input bg-background p-2 text-xs" rows={3} value={a.sumber_aturan} onChange={e=>ubahLokal(t.id,{sumber_aturan:e.target.value})} />
            <Label htmlFor={`pengesah-${t.id}`}>Ditelaah/disahkan oleh</Label><Input id={`pengesah-${t.id}`} value={a.disahkan_oleh} onChange={e=>ubahLokal(t.id,{disahkan_oleh:e.target.value})} />
            <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor={`mulai-${t.id}`}>Berlaku mulai (jika diketahui)</Label><Input id={`mulai-${t.id}`} type="date" value={a.berlaku_mulai || ''} onChange={e=>ubahLokal(t.id,{berlaku_mulai:e.target.value || null})} /></div>
              <div><Label htmlFor={`akhir-${t.id}`}>Berlaku sampai</Label><Input id={`akhir-${t.id}`} type="date" value={a.berlaku_sampai || ''} onChange={e=>ubahLokal(t.id,{berlaku_sampai:e.target.value || null})} /></div></div>
            <Label htmlFor={`url-${t.id}`}>Tautan dokumen (opsional)</Label><Input id={`url-${t.id}`} type="url" value={a.url || ''} onChange={e=>ubahLokal(t.id,{url:e.target.value || null})} />
          </div>}
        </div>;})}</div>
      </details>
      <Button disabled={saving || gagal} onClick={simpan}>{saving?'Menyimpan…':'Simpan profil klaim RS'}</Button>
    </>}
    {pesan && <p role="status" className="text-sm text-muted-foreground">{pesan}</p>}
    {katalog && <details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-sm font-medium">{katalog.aturan.length} referensi · diperiksa {katalog.diperiksa_pada}</summary>
      <div className="mt-3 space-y-3">{katalog.aturan.map(a=>{const s=katalog.sumber.find(s=>s.id===a.sumber_id);return <div key={a.id} className="border-b border-border pb-3 text-xs last:border-0"><p className="font-medium">{a.nama} · {s?.jenis==='pedoman_klinis'?'Pedoman klinis':'Verifikasi klaim BPJS'}</p><p className="mt-1 leading-relaxed text-muted-foreground">{a.catatan}</p>
        {s && <><p className="mt-1 text-muted-foreground">{s.nomor || s.judul} · {s.status_verifikasi==='terverifikasi'?'Sumber ditelaah':'Versi/tanggal perlu dikonfirmasi'}{s.berlaku_mulai?` · mulai ${s.berlaku_mulai}`:''}</p><a href={s.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-primary underline underline-offset-4">Dokumen sumber</a></>}
      </div>;})}</div>
    </details>}
  </CardContent></Card>;
}
