import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PedomanKasusCard} from '../src/components/PedomanKasusCard';
const d={id:'PNPK-PNEUMONIA-ANAK-IDAI',judul:'Pneumonia Anak',nomor:null,cakupan_usia:'anak',berlaku_mulai:null};
test('rujukan anak menyebut ketidakpastian tanggal dan membuka katalog',()=>{
 const h=renderToStaticMarkup(React.createElement(PedomanKasusCard,{hasil:{kelompok_usia:'anak',catatan:'Tidak menambah alasan pending.',topik:[{topik:'pneumonia',status:'perlu_konfirmasi',alasan:'Awal berlaku perlu konfirmasi.',terpilih:null,kandidat:[d]}]}}));
 expect(h).toContain('katalog-pedoman?dokumen=PNPK-PNEUMONIA-ANAK-IDAI');expect(h).toContain('awal berlaku perlu konfirmasi');expect(h).not.toContain('Dewasa');
});
test('umur belum pasti menampilkan satu topik dengan calon berscope jelas',()=>{
 const h=renderToStaticMarkup(React.createElement(PedomanKasusCard,{hasil:{kelompok_usia:'belum_terkonfirmasi',catatan:'Katalog untuk telaah.',topik:[{topik:'pneumonia',status:'perlu_konfirmasi',alasan:'Konfirmasi usia.',terpilih:null,kandidat:[d,{...d,id:'KMK-2025-1168',judul:'Pneumonia Dewasa',cakupan_usia:'dewasa'}]}]}}));
 expect(h).toContain('1 topik');expect(h).toContain('Konfirmasi usia.');expect(h).toContain('Pneumonia Anak');expect(h).toContain('Pneumonia Dewasa');
});
test('tidak menampilkan panel kosong',()=>expect(renderToStaticMarkup(React.createElement(PedomanKasusCard,{}))).toBe(''));
