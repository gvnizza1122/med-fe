import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {EvaluasiCasemixForm, type EvaluasiCasemix} from '@/components/EvaluasiCasemixForm';
import {AlasanPendingCard,judulDanRincianAlasan} from '@/components/hasil-validasi/AlasanPendingCard';
import type {PutusanPending} from '@/components/PutusanPendingCard';
import {api} from '@/lib/api';

test('pendapat petugas dan kebutuhan evaluasi ulang tampil, form meminta alasan dan bukti tanpa memilih valid terlebih dahulu',()=>{
 const evaluasi:EvaluasiCasemix={terakhir:{id:'eval',status:'pending',alasan:'Indikasi admisi perlu dikonfirmasi.',bukti:[{halaman:3,kutipan:'NRS: 7'}],dibuat_pada:'2026-10-09T10:00:00Z',nama_petugas:'Petugas Uji',perlu_evaluasi_ulang:true,perbedaan_dengan_aplikasi:true},riwayat:[]};
 const h=renderToStaticMarkup(React.createElement(EvaluasiCasemixForm,{recordId:'record',evaluasi,onTersimpan:()=>{}}));
 expect(h).toContain('Penilaian petugas: Pending');expect(h).toContain('Petugas Uji');expect(h).toContain('Indikasi admisi');expect(h).toContain('Evaluasi ulang diperlukan');expect(h).toContain('Alasan penilaian (wajib)');expect(h).toContain('Halaman bukti');
 expect(h).toContain('value="" selected=""');expect(h).not.toContain('value="valid" selected');
 expect(h).toContain('Simpan evaluasi petugas');expect(h).toContain('disabled=""');
});
test('alasan terstruktur menjadi poin; kutipan tidak tergabung ke paragraf tebal panjang',()=>{
 const putusan:PutusanPending={status:'berisiko_pending',ringkasan:'Periksa lesi dalam.',catatan_keandalan:'Penilaian aplikasi.',jumlah:{total:1,berat:1,sudah_disahkan:0,belum_disahkan:1,dari_rekap_pending:0},alasan:[{sumber_pemeriksaan:'Kesesuaian STT (BA 2024)',kode:'BA-STT-KODE',ringkas:'Ringkasan panjang lama',poin:[{label:'Alasan',isi:'Lesi dalam tidak tercermin di kode.'},{label:'Bukti',isi:'Massa di antara otot (hal. 14).'},{label:'Perbaikan',isi:'Konfirmasi kepada operator.'}],keparahan:'tinggi',bukti:null,tindakan:null,diverifikasi:true,dari_rekap_pending:false}]};
 const {judul,rincian}=judulDanRincianAlasan(putusan.alasan[0]);
 const h=renderToStaticMarkup(React.createElement(AlasanPendingCard,{items:[{id:'stt',judul,rincian,sumber:'Kesesuaian STT (BA 2024)',keparahan:'berat'}],analisisTersedia:true,catatanKelengkapan:[],tindakanTerbaca:[],onBuka:()=>{}}));
 expect(h).toContain('Lesi dalam tidak tercermin di kode.');expect(h).toContain('Bukti: Massa');expect(h).toContain('Perbaikan: Konfirmasi');expect(h).not.toContain('Ringkasan panjang lama');expect(h.match(/<li /g)?.length).toBe(3);
});
test('API mengirim pendapat petugas, alasan dan rujukan halaman ke endpoint evaluasi',async()=>{
 const fetchMock=jest.fn().mockResolvedValue({ok:true,status:200,headers:{get:()=> 'application/json'},json:async()=>({tersimpan:true})});
 global.fetch=fetchMock as unknown as typeof fetch;
 const data={status:'valid' as const,alasan:'Bukti mendukung setelah telaah.',bukti:[{halaman:3,kutipan:'NRS: 7'}]};
 await api.simpanEvaluasiCasemix('record',data);
 const [url,options]=fetchMock.mock.calls[0];expect(url).toContain('/claim-files/records/record/evaluasi-casemix');expect(options.method).toBe('POST');expect(JSON.parse(options.body)).toEqual(data);
});
