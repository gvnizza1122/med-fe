import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReferensiKlaimCard } from '@/components/ReferensiKlaimCard';
const t={id:'TK-25-09',nama:'Sepsis anak dan dewasa',status:'bukti_belum_cukup',catatan:'Telaah SOFA dan PELOD-2 sesuai usia.',
  keterbatasan:['Tanggal cetak bukan tanggal berlaku. Kultur negatif tidak sendiri membatalkan sepsis.'],
  jenis_ketentuan:'rekomendasi_tkmkb',kode_diagnosis:['A41.9'],kode_prosedur:[],
  bukti:[{id:'skor_sepsis',nama:'Skor dan dasar organ',status:'bukti_belum_cukup',bukti:[]}],
  sumber:{judul:'Rekomendasi TKMKB Tingkat Pusat',nomor:null,url:'',halaman:'51-55 (buku 33-37)',versi:'2025',
    catatan:'Buku rekomendasi audit dengan masa berlaku yang perlu dikonfirmasi.',butir:'2.9',teks_asli:'Hasil penilaian SOFA dan PELOD-2 pada resume.'}};
test('TKMKB tampil sebagai rekomendasi audit dengan locator dan batasan, terpisah dari BA/PNPK',()=>{
  const html=renderToStaticMarkup(React.createElement(ReferensiKlaimCard,{hasil:{temuan:[t]}}));
  expect(html).toContain('Rekomendasi audit · TKMKB');expect(html).not.toContain('Verifikasi klaim BPJS');expect(html).not.toContain('Dukungan diagnosis · PNPK');
  expect(html).toContain('Tanggal cetak bukan tanggal berlaku');expect(html).toContain('51-55 (buku 33-37)');expect(html).toContain('Teks dokumen sumber');
  expect(html).not.toContain('href=""');
});
test('BA matriks membedakan bukti dokumen dari kebutuhan pemeriksaan manual',()=>{
  const html=renderToStaticMarkup(React.createElement(ReferensiKlaimCard,{hasil:{temuan:[{...t,id:'RK-16',jenis_ketentuan:'verifikasi_klaim_bpjs',
    bukti:[{id:'durasi_igd',nama:'Waktu pelayanan IGD',status:'perlu_cek_manual',bukti:[]}]}]}}));
  expect(html).toContain('Verifikasi klaim BPJS');expect(html).toContain('Perlu pemeriksaan manual');expect(html).toContain('Ini tidak membuktikan pemeriksaan tidak dilakukan');
});
