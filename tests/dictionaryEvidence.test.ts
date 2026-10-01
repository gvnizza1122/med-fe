import { generateCodingExplanation } from '../src/lib/generateCodingExplanation';

test.each([
  ['not_found', 'Tercantum di dokumen; perlu verifikasi kode'],
  ['unavailable', 'Validasi kamus belum tersedia'],
] as const)('bukti tercetak dengan status kamus %s tidak disebut Valid', (dictionary_status, label) => {
  const result = generateCodingExplanation('J45.9', 'diagnosis', 'valid', {}, undefined, [{
    code: 'J45.9', found: true, quotation: 'Diagnosis: asma', page_number: 2,
    dictionary_status,
  }]);
  expect(JSON.stringify(result)).toContain(label);
  expect(result.codes[0].explanationBullets).not.toContain('Status: Valid');
});

test('kode dengan bukti dan kamus sah tetap Valid', () => {
  const result = generateCodingExplanation('J45.9', 'diagnosis', 'valid', {}, undefined, [{
    code: 'J45.9', found: true, dictionary_status: 'valid', quotation: 'Diagnosis: asma', page_number: 2,
  }]);
  expect(JSON.stringify(result)).toContain('Status: Valid');
});
