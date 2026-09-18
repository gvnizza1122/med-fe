/**
 * @fileoverview Unit tests untuk Clinical Coherence Validator
 * (src/services/clinicalCoherenceValidator.ts)
 */

import {
  validateClinicalCoherence,
  type ClinicalCoherenceInput,
} from '@/services/clinicalCoherenceValidator';

function baseRecord(overrides: Partial<ClinicalCoherenceInput> = {}): ClinicalCoherenceInput {
  return {
    diagnosis_utama: 'Hipertensi esensial',
    diagnosis_sekunder: '',
    prosedur: '-',
    alasan_masuk: 'Kontrol rutin karena riwayat hipertensi',
    vital_signs: { hr: 78, rr: 18, bp: '120/80', temp: 36.5, spo2: 98 },
    clinical_findings: 'Pasien tampak sehat, tidak ada keluhan tambahan.',
    ...overrides,
  };
}

describe('validateClinicalCoherence', () => {
  it('should mark a fully consistent outpatient record as coherent', () => {
    const result = validateClinicalCoherence(baseRecord());
    expect(result.isCoherent).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.severity).toBe('low');
  });

  describe('Diagnosis <-> Vital Signs', () => {
    it('should flag severe diagnosis with normal vitals', () => {
      const record = baseRecord({
        diagnosis_utama: 'Syok sepsis',
        alasan_masuk: 'Demam tinggi dan penurunan kesadaran',
        vital_signs: { hr: 80, rr: 18, bp: '120/80', temp: 37, spo2: 98 },
        clinical_findings: 'Pasien sepsis dengan infeksi berat.',
      });

      const result = validateClinicalCoherence(record);
      expect(result.isCoherent).toBe(false);
      expect(result.severity).toBe('high');
      expect(result.issues.some((i) => i.toLowerCase().includes('syok') || i.toLowerCase().includes('berat'))).toBe(true);
    });

    it('should NOT flag severe diagnosis when vitals corroborate it', () => {
      const record = baseRecord({
        diagnosis_utama: 'Syok sepsis',
        alasan_masuk: 'Demam tinggi dan penurunan kesadaran akibat infeksi',
        prosedur: 'Pemasangan infus dan resusitasi cairan',
        vital_signs: { hr: 145, rr: 34, bp: '80/50', temp: 39.5, spo2: 88 },
        clinical_findings: 'Pasien sepsis dengan infeksi berat, tanda distres napas.',
      });

      const result = validateClinicalCoherence(record);
      expect(result.isCoherent).toBe(true);
    });
  });

  describe('Diagnosis <-> Procedures', () => {
    it('should flag surgical diagnosis without any procedure', () => {
      const record = baseRecord({
        diagnosis_utama: 'Apendisitis akut',
        alasan_masuk: 'Nyeri perut kanan bawah',
        prosedur: '-',
        vital_signs: { hr: 90, rr: 20, bp: '110/70', temp: 37.8, spo2: 97 },
        clinical_findings: 'Nyeri tekan McBurney positif.',
      });

      const result = validateClinicalCoherence(record);
      expect(result.isCoherent).toBe(false);
      expect(result.issues.join(' ')).toMatch(/bedah|invasif/i);
    });

    it('should flag surgical procedure recorded against a purely medical diagnosis', () => {
      const record = baseRecord({
        diagnosis_utama: 'ISPA (infeksi saluran pernapasan akut)',
        alasan_masuk: 'Batuk dan pilek',
        prosedur: 'Laparotomi eksplorasi',
        vital_signs: { hr: 88, rr: 20, bp: '110/70', temp: 37.2, spo2: 98 },
        clinical_findings: 'Batuk berdahak, tidak ada tanda infeksi berat.',
      });

      const result = validateClinicalCoherence(record);
      expect(result.isCoherent).toBe(false);
      expect(result.issues.join(' ')).toMatch(/bedah|invasif/i);
    });

    it('should NOT flag surgical diagnosis that has a matching procedure', () => {
      const record = baseRecord({
        diagnosis_utama: 'Apendisitis akut',
        alasan_masuk: 'Nyeri perut kanan bawah',
        prosedur: 'Apendektomi',
        vital_signs: { hr: 90, rr: 20, bp: '110/70', temp: 37.8, spo2: 97 },
        clinical_findings: 'Nyeri tekan McBurney positif, tanda infeksi lokal.',
      });

      const result = validateClinicalCoherence(record);
      expect(result.isCoherent).toBe(true);
    });
  });

  describe('Vital Signs <-> Clinical Findings', () => {
    it('should flag fever without any infection-related finding', () => {
      const record = baseRecord({
        diagnosis_utama: 'Demam tifoid',
        alasan_masuk: 'Demam sejak 3 hari',
        vital_signs: { hr: 92, rr: 20, bp: '110/70', temp: 38.6, spo2: 97 },
        clinical_findings: 'Pasien tampak lemas, pemeriksaan fisik lain dalam batas normal.',
      });

      const result = validateClinicalCoherence(record);
      expect(result.isCoherent).toBe(false);
      expect(result.issues.join(' ')).toMatch(/demam/i);
    });

    it('should flag abnormal vitals contradicted by "normal" findings note', () => {
      const record = baseRecord({
        diagnosis_utama: 'Observasi febris',
        alasan_masuk: 'Demam tinggi',
        vital_signs: { hr: 130, rr: 28, bp: '85/55', temp: 39.2, spo2: 93 },
        clinical_findings: 'Pemeriksaan fisik dalam batas normal, tidak ada keluhan.',
      });

      const result = validateClinicalCoherence(record);
      expect(result.isCoherent).toBe(false);
    });
  });

  describe('Alasan Masuk <-> Diagnosis', () => {
    it('should flag chief complaint unrelated to primary diagnosis', () => {
      const record = baseRecord({
        diagnosis_utama: 'Fraktur femur tertutup',
        prosedur: 'Pemasangan gips',
        alasan_masuk: 'Kontrol rutin diabetes melitus',
        vital_signs: { hr: 82, rr: 18, bp: '120/80', temp: 36.7, spo2: 98 },
        clinical_findings: 'Nyeri dan bengkak pada paha kanan.',
      });

      const result = validateClinicalCoherence(record);
      expect(result.isCoherent).toBe(false);
      expect(result.issues.join(' ')).toMatch(/alasan masuk/i);
    });

    it('should NOT flag chief complaint that maps to diagnosis via clinical synonym', () => {
      const record = baseRecord({
        diagnosis_utama: 'Asma bronkial',
        alasan_masuk: 'Sesak napas sejak semalam',
        vital_signs: { hr: 95, rr: 22, bp: '118/76', temp: 36.8, spo2: 96 },
        clinical_findings: 'Wheezing bilateral.',
      });

      const result = validateClinicalCoherence(record);
      expect(result.isCoherent).toBe(true);
    });
  });

  describe('Severity Match', () => {
    it('should flag mild diagnosis contradicted by severe vitals', () => {
      const record = baseRecord({
        diagnosis_utama: 'Hipertensi esensial',
        alasan_masuk: 'Kontrol tekanan darah rutin',
        vital_signs: { hr: 150, rr: 32, bp: '78/48', temp: 36.5, spo2: 87 },
        clinical_findings: 'Pasien tampak lemas dan sesak.',
      });

      const result = validateClinicalCoherence(record);
      expect(result.isCoherent).toBe(false);
      expect(result.severity).toBe('high');
    });
  });

  describe('Edge cases: missing vital signs / clinical findings', () => {
    it('should not throw and remain coherent when vital_signs is entirely empty', () => {
      const record = baseRecord({
        vital_signs: {},
      });

      const result = validateClinicalCoherence(record);
      expect(result).toBeDefined();
      expect(result.isCoherent).toBe(true);
    });

    it('should not throw and remain coherent when clinical_findings is empty string', () => {
      const record = baseRecord({
        clinical_findings: '',
      });

      const result = validateClinicalCoherence(record);
      expect(result).toBeDefined();
      expect(result.isCoherent).toBe(true);
    });

    it('should not flag anything when diagnosis_utama and alasan_masuk are both empty', () => {
      const record = baseRecord({
        diagnosis_utama: '',
        alasan_masuk: '',
      });

      const result = validateClinicalCoherence(record);
      expect(result.issues.some((i) => i.toLowerCase().includes('alasan masuk'))).toBe(false);
    });
  });
});
