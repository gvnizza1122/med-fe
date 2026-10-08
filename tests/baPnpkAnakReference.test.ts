import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ReferensiKlaimCard} from '@/components/ReferensiKlaimCard';
import {SyaratPenunjangCard} from '@/components/SyaratPenunjangCard';
const base={id:'RK-19',nama:'Pneumonia anak',kelompok_usia:'anak',status:'belum_dapat_dinilai',catatan:'RR dan SpO2 belum terbaca.',keterbatasan:['Tidak memilih dewasa.'],jenis_ketentuan:'pedoman_klinis',kode_diagnosis:['J18.9'],kode_prosedur:[],bukti:[],sumber:{judul:'PNPK Anak IDAI',nomor:null,url:'',halaman:'7',versi:'salinan',catatan:'Awal berlaku belum terkonfirmasi.',status_verifikasi:'salinan_sumber_ditelaah',sha256:'abc'}};
test('jalur anak, sumber dan bukti belum dinilai tampil tanpa valid palsu',()=>{
 const h=renderToStaticMarkup(React.createElement(ReferensiKlaimCard,{hasil:{kelompok_usia:'anak',temuan:[base]}}));expect(h).toContain('Kasus anak');expect(h).toContain('Dukungan diagnosis · PNPK');expect(h).toContain('Bukti belum dapat dinilai');expect(h).toContain('Salinan sumber telah ditelaah');expect(h).not.toContain('href=""');
});
test('usia belum pasti memakai label konfirmasi',()=>{
 const h=renderToStaticMarkup(React.createElement(ReferensiKlaimCard,{hasil:{kelompok_usia:'belum_terkonfirmasi',temuan:[{...base,id:'RK-USIA',jenis_ketentuan:'cakupan_usia',status:'perlu_konfirmasi_usia'}]}}));expect(h).toContain('Usia perlu dikonfirmasi');expect(h).toContain('Pemilihan kriteria sesuai usia');expect(h).not.toContain('Verifikasi klaim BPJS');
});
test('syarat lokal anak menjelaskan pengecualian dan konfirmasi cakupan',()=>{
 const h=renderToStaticMarkup(React.createElement(SyaratPenunjangCard,{temuan:[{id:'SP-01',kode_diagnosis:'J18.9',kode_aturan:'J18',nama_diagnosis:'Pneumonia',diverifikasi:true,sumber_aturan:'Rekap pending RS',perlu_konfirmasi_cakupan:true,syarat_dilewati_usia:[{nama:'Pemeriksaan gram sputum',alasan:'Tidak disyaratkan pada anak.'}],syarat:[{nama:'Rontgen toraks',tingkat_risiko:'wajib',tindakan_ada:false,kode_prosedur_ditemukan:[],nilai:null,kutipan:null,page_number:null,status:'perlu_cek_manual'}],ringkasan:{terpenuhi:0,hasil_belum_terbaca:0,tidak_ada:0,perlu_cek_manual:1}}]}));expect(h).toContain('Cakupan usia perlu ditelaah');expect(h).toContain('Tidak disyaratkan pada anak');expect(h).toContain('Perlu penilaian bukti');expect(h).not.toContain('Bukti memenuhi syarat');
});
