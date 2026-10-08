import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {LaporanOperasiIsi,type DataLaporanOperasi} from '@/components/LaporanOperasiPanel';
const u=(ukuran:number[],sumber:string,page_number:number)=>({nilai_tertulis:ukuran.join('x')+' cm',ukuran,satuan:'cm',terbesar_cm:Math.max(...ukuran),page_number,kutipan:'massa tumor berada di antara otot',sumber,catatan:'Cocokkan lokasi setiap lesi.'});
const data:DataLaporanOperasi={versi:'1',hash_bukti:'hash',laporan:[{page_number:14,tanggal:'01-10-2026',tindakan:'Eksisi dan PA',ukuran:[u([3,2],'temuan_operasi',14),u([5,4],'temuan_operasi',14)],teks:'LAPORAN OPERASI',status_ukuran:'terbaca'}],
  patologi:[{page_number:16,ukuran_spesimen:[u([3,2.5,1.5],'spesimen_pa',16)],kesimpulan:'Benign mesenchymal neoplasm jenis adipocytic',teks:'HASIL PA'}],
  kriteria_stt:[],catatan:[],catatan_keandalan:'Ringkasan bukti, kode tidak berubah.',
  cakupan:{halaman_dipindai:[14,16],halaman_belum_terbaca:[],analisis_berkas_berubah:false,analisis_ai_sesuai_bukti:null},ringkasan:{jumlah_laporan:1,jumlah_pa:1,jumlah_ukuran_operasi:2}};
test('ukuran operasi dan spesimen PA muncul terpisah dengan kutipan dan akses halaman',()=>{
  const html=renderToStaticMarkup(React.createElement(LaporanOperasiIsi,{data,onOpenPdf:()=>{}}));
  for(const text of ['3 × 2','5 × 4','3 × 2.5 × 1.5','Temuan pada laporan operasi','Ukuran spesimen pada hasil PA','Lihat halaman 14','Lihat halaman 16'])expect(html).toContain(text);
  expect(html).toContain('label masing-masing lesi');expect(html).toContain('Benign mesenchymal');
});
test('berkas baru/belum terbaca ditampilkan tanpa menyatakan bukti operasi tidak ada',()=>{
  const html=renderToStaticMarkup(React.createElement(LaporanOperasiIsi,{data:{...data,cakupan:{...data.cakupan,halaman_belum_terbaca:[19],analisis_berkas_berubah:true}}}));
  expect(html).toContain('Berkas berubah setelah analisis terakhir');expect(html).toContain('Halaman 19 belum terbaca');expect(html).not.toContain('operasi tidak dilakukan');
});
test('pengesahan operasi tampil sebagai halaman lanjutan tanpa peringatan ukuran belum terbaca',()=>{
  const html=renderToStaticMarkup(React.createElement(LaporanOperasiIsi,{data:{...data,laporan:[...data.laporan,{page_number:15,tanggal:null,tindakan:null,ukuran:[],teks:'LAPORAN OPERASI\nDokter operator',status_ukuran:'halaman_pengesahan'}]}}));
  expect(html).toContain('Pengesahan laporan operasi');expect(html).not.toContain('Ukuran tumor belum terbaca');
});
test('telaah lokal dibedakan dari pembaruan analisis AI',()=>{
  const html=renderToStaticMarkup(React.createElement(LaporanOperasiIsi,{data:{...data,cakupan:{...data.cakupan,telaah_lokal_tersedia:true}}}));
  expect(html).toContain('Bukti operasi sudah ditelaah lokal');expect(html).toContain('Analisis AI sebelumnya belum diperbarui');
});
