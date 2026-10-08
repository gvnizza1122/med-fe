import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReferensiKlaimCard } from '@/components/ReferensiKlaimCard';

const temuan = {
  id: 'BDD-13', nama: 'ISK dan leukosit urine', status: 'perlu_telaah_koding',
  catatan: 'Nilai 5–7 Leu/uL tidak melebihi 10; diagnosis tetap ditelaah DPJP.',
  keterbatasan: ['Pengesah dan masa berlaku ketentuan belum tersedia.'],
  jenis_ketentuan: 'catatan_casemix', kode_diagnosis: ['N39.0'], kode_prosedur: [],
  bukti: [{ id: 'leukosit_urine', nama: 'Leukosit urine numerik', status: 'ambang_tidak_terpenuhi',
    bukti: [{ page_number: 3, kutipan: 'Lekosit 5 - 7 * < 15:Negatif Leu/uL Microscopic' }] }],
  sumber: { judul: 'BPJS DO AND DON’T', nomor: null, url: '', halaman: '1', versi: '8 Oktober 2026',
    catatan: 'Catatan pengguna belum diverifikasi sebagai ketentuan BPJS nasional.', butir: 13,
    teks_asli: 'dx ISK (N39.0), nilai leukosit urine wajib > 10 Leu/uL, opsi N39.8' },
};
test('catatan pengguna diberi label sumber dan peringatan numerik tanpa diklaim sebagai verifikasi BPJS', () => {
  const html = renderToStaticMarkup(React.createElement(ReferensiKlaimCard, { hasil: { temuan: [temuan] } }));
  expect(html).toContain('Catatan casemix · perlu konfirmasi');
  expect(html).toContain('Ambang catatan belum terpenuhi');
  expect(html).toContain('hal. 3');
  expect(html).toContain('Leu/uL');
  expect(html).toContain('belum diverifikasi');
  expect(html).not.toContain('Verifikasi klaim BPJS');
});
test('sumber pedoman klinis tetap diberi label PNPK', () => {
  const html = renderToStaticMarkup(React.createElement(ReferensiKlaimCard, { hasil: { temuan: [{ ...temuan, jenis_ketentuan: 'pedoman_klinis' }] } }));
  expect(html).toContain('Dukungan diagnosis · PNPK');
});
