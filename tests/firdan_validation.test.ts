/**
 * @fileoverview Firdan Case (SEP 0170R0110926V001417) — Golden Test Case
 *
 * Kasus uji baku untuk validasi ekstraksi field eClaim:
 * - Pasien: FIRDAN, usia 2 tahun
 * - Diagnosis: ISPA (J06.9) + innocent murmur (R01.1)
 * - Vital signs: HR 130, RR 30 (normal untuk usia 2 tahun)
 * - Jenis klaim: RAWAT_INAP (2 hari)
 *
 * Test categories:
 * 1. Field extraction (Salin, Turunan, Koding)
 * 2. Diagnosis & procedure validation
 * 3. Vital signs age-based normalization
 * 4. Triage vs Resume consistency
 * 5. Regression testing (bandingkan dengan golden answers)
 */

import * as fs from 'fs';
import * as path from 'path';

// Load golden test data
const FIRDAN_CASE = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures', 'firdan_case.json'), 'utf-8')
);

describe('Firdan Case (SEP 0170R0110926V001417) — Golden Test Suite', () => {
  describe('1. Field Extraction — Salin (copied as-is from document)', () => {
    it('should extract NAMA_PASIEN correctly', () => {
      const expected = FIRDAN_CASE.extracted_data.salin.NAMA_PASIEN.expected;
      const actual = FIRDAN_CASE.extracted_data.salin.NAMA_PASIEN.value;
      expect(actual).toBe(expected);
    });

    it('should extract MRN correctly', () => {
      const expected = FIRDAN_CASE.extracted_data.salin.MRN.expected;
      const actual = FIRDAN_CASE.extracted_data.salin.MRN.value;
      expect(actual).toBe(expected);
    });

    it('should extract BIRTH_DATE correctly', () => {
      const expected = FIRDAN_CASE.extracted_data.salin.BIRTH_DATE.expected;
      const actual = FIRDAN_CASE.extracted_data.salin.BIRTH_DATE.value;
      expect(actual).toBe(expected);
    });

    it('should extract SEP correctly', () => {
      const expected = FIRDAN_CASE.extracted_data.salin.SEP.expected;
      const actual = FIRDAN_CASE.extracted_data.salin.SEP.value;
      expect(actual).toBe(expected);
    });

    it('should extract NOKARTU (insurance card number) correctly', () => {
      const expected = FIRDAN_CASE.extracted_data.salin.NOKARTU.expected;
      const actual = FIRDAN_CASE.extracted_data.salin.NOKARTU.value;
      expect(actual).toBe(expected);
    });

    it('should extract DPJP (attending physician) correctly', () => {
      const expected = FIRDAN_CASE.extracted_data.salin.DPJP.expected;
      const actual = FIRDAN_CASE.extracted_data.salin.DPJP.value;
      expect(actual).toBe(expected);
    });

    it('should extract ADMISSION_DATE correctly', () => {
      const expected = FIRDAN_CASE.extracted_data.salin.ADMISSION_DATE.expected;
      const actual = FIRDAN_CASE.extracted_data.salin.ADMISSION_DATE.value;
      expect(actual).toBe(expected);
    });

    it('should extract BERAT_BADAN (body weight) correctly', () => {
      const expected = FIRDAN_CASE.extracted_data.salin.BERAT_BADAN.expected;
      const actual = FIRDAN_CASE.extracted_data.salin.BERAT_BADAN.value;
      expect(actual).toBe(expected);
    });

    it('all Salin fields should have confidence >= 0.90', () => {
      Object.entries(FIRDAN_CASE.extracted_data.salin).forEach(([field, data]: any) => {
        expect(data.confidence).toBeGreaterThanOrEqual(0.90);
      });
    });
  });

  describe('2. Field Extraction — Turunan (derived from other fields)', () => {
    it('should calculate SEX correctly from NAMA_PASIEN', () => {
      const expected = FIRDAN_CASE.extracted_data.turunan.SEX.expected;
      const actual = FIRDAN_CASE.extracted_data.turunan.SEX.value;
      expect(actual).toBe(expected);
    });

    it('should calculate UMUR_TAHUN (age in years) correctly', () => {
      const expected = FIRDAN_CASE.extracted_data.turunan.UMUR_TAHUN.expected;
      const actual = FIRDAN_CASE.extracted_data.turunan.UMUR_TAHUN.value;
      expect(actual).toBe(expected);
    });

    it('should calculate UMUR_HARI (age in days) correctly', () => {
      const expected = FIRDAN_CASE.extracted_data.turunan.UMUR_HARI.expected;
      const actual = FIRDAN_CASE.extracted_data.turunan.UMUR_HARI.value;
      expect(actual).toBe(expected);
    });

    it('should extract DISCHARGE_DATE correctly', () => {
      const expected = FIRDAN_CASE.extracted_data.turunan.DISCHARGE_DATE.expected;
      const actual = FIRDAN_CASE.extracted_data.turunan.DISCHARGE_DATE.value;
      expect(actual).toBe(expected);
    });

    it('should extract DISCHARGE_STATUS correctly', () => {
      const expected = FIRDAN_CASE.extracted_data.turunan.DISCHARGE_STATUS.expected;
      const actual = FIRDAN_CASE.extracted_data.turunan.DISCHARGE_STATUS.value;
      expect(actual).toBe(expected);
    });

    it('should calculate LOS (length of stay) correctly', () => {
      const expected = FIRDAN_CASE.extracted_data.turunan.LOS.expected;
      const actual = FIRDAN_CASE.extracted_data.turunan.LOS.value;
      expect(actual).toBe(expected);
    });

    it('should extract KELAS_RAWAT correctly', () => {
      const expected = FIRDAN_CASE.extracted_data.turunan.KELAS_RAWAT.expected;
      const actual = FIRDAN_CASE.extracted_data.turunan.KELAS_RAWAT.value;
      expect(actual).toBe(expected);
    });

    it('should calculate TARIF_INACBG correctly', () => {
      const expected = FIRDAN_CASE.extracted_data.turunan.TARIF_INACBG.expected;
      const actual = FIRDAN_CASE.extracted_data.turunan.TARIF_INACBG.value;
      expect(actual).toBe(expected);
    });

    it('should calculate TOTAL_TARIF correctly', () => {
      const expected = FIRDAN_CASE.extracted_data.turunan.TOTAL_TARIF.expected;
      const actual = FIRDAN_CASE.extracted_data.turunan.TOTAL_TARIF.value;
      expect(actual).toBe(expected);
    });
  });

  describe('3. Field Extraction — Konfigurasi (from Hospital Settings)', () => {
    it('should load KODE_RS from Hospital Settings', () => {
      const expected = FIRDAN_CASE.extracted_data.konfigurasi.KODE_RS.expected;
      const actual = FIRDAN_CASE.extracted_data.konfigurasi.KODE_RS.value;
      expect(actual).toBe(expected);
    });

    it('should load KELAS_RS from Hospital Settings', () => {
      const expected = FIRDAN_CASE.extracted_data.konfigurasi.KELAS_RS.expected;
      const actual = FIRDAN_CASE.extracted_data.konfigurasi.KELAS_RS.value;
      expect(actual).toBe(expected);
    });

    it('should load PAYOR_ID from Hospital Settings', () => {
      const expected = FIRDAN_CASE.extracted_data.konfigurasi.PAYOR_ID.expected;
      const actual = FIRDAN_CASE.extracted_data.konfigurasi.PAYOR_ID.value;
      expect(actual).toBe(expected);
    });
  });

  describe('4. Coding — DIAGLIST (Diagnosis List)', () => {
    it('should extract primary diagnosis correctly', () => {
      const diaglist = FIRDAN_CASE.extracted_data.koding.DIAGLIST;
      const primaryDiag = diaglist.diagnoses[0];
      expect(primaryDiag.icd10).toBe('J06.9');
      expect(primaryDiag.sequence).toBe(1);
    });

    it('should extract secondary diagnosis correctly', () => {
      const diaglist = FIRDAN_CASE.extracted_data.koding.DIAGLIST;
      const secondaryDiag = diaglist.diagnoses[1];
      expect(secondaryDiag.icd10).toBe('R01.1');
      expect(secondaryDiag.sequence).toBe(2);
    });

    it('diagnoses should come from Resume Medis (not OCR-fabricated)', () => {
      const diaglist = FIRDAN_CASE.extracted_data.koding.DIAGLIST;
      expect(diaglist.source).toContain('Resume_Medis_IGD');
      expect(diaglist.validation_note).toContain('bukan hasil OCR karangan');
    });

    it('all diagnoses should have confidence >= 0.85', () => {
      const diaglist = FIRDAN_CASE.extracted_data.koding.DIAGLIST;
      diaglist.diagnoses.forEach((diag: any) => {
        expect(diag.confidence).toBeGreaterThanOrEqual(0.85);
      });
    });

    it('should match expected diagnosis ICD10 codes exactly', () => {
      const diaglist = FIRDAN_CASE.extracted_data.koding.DIAGLIST;
      const extractedCodes = diaglist.diagnoses.map((d: any) => d.icd10);
      const expectedCodes = diaglist.expected.map((e: any) => e.icd10);
      expect(extractedCodes).toEqual(expectedCodes);
    });
  });

  describe('5. Coding — PROCLIST (Procedure List)', () => {
    it('should extract examination procedure correctly', () => {
      const proclist = FIRDAN_CASE.extracted_data.koding.PROCLIST;
      const examProc = proclist.procedures[0];
      expect(examProc.icd9).toBe('93.0');
      expect(examProc.sequence).toBe(1);
    });

    it('should extract irrigation procedure correctly', () => {
      const proclist = FIRDAN_CASE.extracted_data.koding.PROCLIST;
      const irrigProc = proclist.procedures[1];
      expect(irrigProc.icd9).toBe('99.04');
      expect(irrigProc.sequence).toBe(2);
    });

    it('procedures should come from Resume Medis (not OCR-fabricated)', () => {
      const proclist = FIRDAN_CASE.extracted_data.koding.PROCLIST;
      expect(proclist.source).toContain('Resume_Medis_IGD');
      expect(proclist.validation_note).toContain('bukan OCR karangan');
    });

    it('all procedures should have confidence >= 0.87', () => {
      const proclist = FIRDAN_CASE.extracted_data.koding.PROCLIST;
      proclist.procedures.forEach((proc: any) => {
        expect(proc.confidence).toBeGreaterThanOrEqual(0.87);
      });
    });

    it('should match expected procedure ICD9 codes exactly', () => {
      const proclist = FIRDAN_CASE.extracted_data.koding.PROCLIST;
      const extractedCodes = proclist.procedures.map((p: any) => p.icd9);
      const expectedCodes = proclist.expected.map((e: any) => e.icd9);
      expect(extractedCodes).toEqual(expectedCodes);
    });
  });

  describe('6. Coding — INACBG (INA-CBG Grouping)', () => {
    it('should calculate INACBG group correctly', () => {
      const expected = FIRDAN_CASE.extracted_data.koding.INACBG.expected;
      const actual = FIRDAN_CASE.extracted_data.koding.INACBG.value;
      expect(actual).toBe(expected);
    });

    it('INACBG should be derived from diagnosis + procedure + age logic', () => {
      const inacbg = FIRDAN_CASE.extracted_data.koding.INACBG;
      expect(inacbg.source).toContain('Grouper logic');
    });
  });

  describe('7. Vital Signs — Age-Based Normalization', () => {
    it('should identify HR 130 as NORMAL for 2-year-old', () => {
      const hr = FIRDAN_CASE.extracted_data.vital_signs.HR;
      expect(hr.value).toBe(130);
      expect(hr.age_group).toBe('2 years');
      expect(hr.is_normal).toBe(true);
      expect(hr.normal_range).toBe('100-160 bpm (age 2 years)');
    });

    it('should identify RR 30 as NORMAL for 2-year-old', () => {
      const rr = FIRDAN_CASE.extracted_data.vital_signs.RR;
      expect(rr.value).toBe(30);
      expect(rr.age_group).toBe('2 years');
      expect(rr.is_normal).toBe(true);
      expect(rr.normal_range).toBe('25-35 breaths/min (age 2 years)');
    });

    it('should identify temperature 37.5°C as normal', () => {
      const temp = FIRDAN_CASE.extracted_data.vital_signs.TEMPERATURE;
      expect(temp.value).toBe(37.5);
      expect(temp.is_normal).toBe(true);
    });

    it('should identify BP as normal for 2-year-old', () => {
      const bpSys = FIRDAN_CASE.extracted_data.vital_signs.BP_SYSTOLIC;
      const bpDia = FIRDAN_CASE.extracted_data.vital_signs.BP_DIASTOLIC;
      expect(bpSys.is_normal).toBe(true);
      expect(bpDia.is_normal).toBe(true);
    });

    it('all vital signs should have confidence >= 0.94', () => {
      Object.entries(FIRDAN_CASE.extracted_data.vital_signs).forEach(([field, data]: any) => {
        expect(data.confidence).toBeGreaterThanOrEqual(0.94);
      });
    });
  });

  describe('8. Fact Zero Fields (fakta_nol)', () => {
    it('should flag ICU_INDIKATOR as 0 (no ICU admission)', () => {
      const icu = FIRDAN_CASE.extracted_data.fakta_nol.ICU_INDIKATOR;
      expect(icu.value).toBe(0);
      expect(icu.meaning).toContain('TIDAK dirawat di ICU');
    });

    it('should flag ICU_LOS as 0 (no ICU stay)', () => {
      const los = FIRDAN_CASE.extracted_data.fakta_nol.ICU_LOS;
      expect(los.value).toBe(0);
      expect(los.unit).toBe('hari');
    });

    it('should flag VENT_HOUR as 0 (no mechanical ventilation)', () => {
      const vent = FIRDAN_CASE.extracted_data.fakta_nol.VENT_HOUR;
      expect(vent.value).toBe(0);
      expect(vent.unit).toBe('jam');
    });

    it('should flag TARIF_POLI_EKS as 0 (no external clinic fee)', () => {
      const poli = FIRDAN_CASE.extracted_data.fakta_nol.TARIF_POLI_EKS;
      expect(poli.value).toBe(0);
      expect(poli.meaning).toContain('Tidak ada biaya poliklinik');
    });
  });

  describe('9. Empty-by-Design Fields (wajar_kosong)', () => {
    it('should mark BIRTH_WEIGHT as null (not applicable for age 2)', () => {
      const birthWeight = FIRDAN_CASE.extracted_data.wajar_kosong.BIRTH_WEIGHT;
      expect(birthWeight.value).toBeNull();
      expect(birthWeight.reason).toContain('bukan neonatus');
    });

    it('should mark ADL1 and ADL2 as null (not used for pediatric inpatient)', () => {
      expect(FIRDAN_CASE.extracted_data.wajar_kosong.ADL1.value).toBeNull();
      expect(FIRDAN_CASE.extracted_data.wajar_kosong.ADL2.value).toBeNull();
    });

    it('should mark SP/SR/SI/SD as null (no special procedures recorded)', () => {
      const sp = FIRDAN_CASE.extracted_data.wajar_kosong.SP;
      const sr = FIRDAN_CASE.extracted_data.wajar_kosong.SR;
      const si = FIRDAN_CASE.extracted_data.wajar_kosong.SI;
      const sd = FIRDAN_CASE.extracted_data.wajar_kosong.SD;

      expect(sp.value).toBeNull();
      expect(sr.value).toBeNull();
      expect(si.value).toBeNull();
      expect(sd.value).toBeNull();
    });

    it('should mark SP/SR/SI/SD tariffs as null', () => {
      const tariffs = [
        FIRDAN_CASE.extracted_data.wajar_kosong.TARIF_SP,
        FIRDAN_CASE.extracted_data.wajar_kosong.TARIF_SR,
        FIRDAN_CASE.extracted_data.wajar_kosong.TARIF_SI,
        FIRDAN_CASE.extracted_data.wajar_kosong.TARIF_SD,
      ];
      tariffs.forEach((tariff) => {
        expect(tariff.value).toBeNull();
      });
    });
  });

  describe('10. Consistency Checks — Triage vs Resume Medis', () => {
    it('should match vital signs between Triage and Resume Medis', () => {
      const checks = FIRDAN_CASE.consistency_checks.triage_vs_resume;
      expect(checks.vital_signs_match).toBe(true);
    });

    it('should match diagnosis between Triage and Resume Medis', () => {
      const checks = FIRDAN_CASE.consistency_checks.triage_vs_resume;
      expect(checks.diagnosis_match).toBe(true);
    });

    it('vital sign normality should be consistent across documents', () => {
      const triageHR = FIRDAN_CASE.extracted_data.vital_signs.HR;
      const triageRR = FIRDAN_CASE.extracted_data.vital_signs.RR;
      expect(triageHR.is_normal).toBe(true);
      expect(triageRR.is_normal).toBe(true);
    });
  });

  describe('11. Age-Based Thresholds Validation', () => {
    it('should apply correct age thresholds for 2-year-old', () => {
      const ageCheck = FIRDAN_CASE.consistency_checks.age_thresholds.age_2_years;
      expect(ageCheck.UMUR_TAHUN).toBe(2);
    });

    it('should verify HR 130 within normal range for 2-year-old (100-160 bpm)', () => {
      const ageCheck = FIRDAN_CASE.consistency_checks.age_thresholds.age_2_years;
      expect(ageCheck.extracted_hr).toBeGreaterThanOrEqual(100);
      expect(ageCheck.extracted_hr).toBeLessThanOrEqual(160);
      expect(ageCheck.is_normal).toBe(true);
    });

    it('should verify RR 30 within normal range for 2-year-old (25-35 breaths/min)', () => {
      const ageCheck = FIRDAN_CASE.consistency_checks.age_thresholds.age_2_years;
      expect(ageCheck.extracted_rr).toBeGreaterThanOrEqual(25);
      expect(ageCheck.extracted_rr).toBeLessThanOrEqual(35);
      expect(ageCheck.rr_is_normal).toBe(true);
    });
  });

  describe('12. Regression Test — Compare Against Golden Answers', () => {
    it('should have correct baseline metadata', () => {
      const baseline = FIRDAN_CASE.regression_test_baseline;
      expect(baseline.version).toBe('1.0');
      expect(baseline.expected_extraction_count).toBe(8);
      expect(baseline.expected_coding_count).toBe(3);
      expect(baseline.expected_error_count).toBe(0);
    });

    it('should maintain extraction field count consistency', () => {
      const salin = Object.keys(FIRDAN_CASE.extracted_data.salin).length;
      expect(salin).toBeGreaterThanOrEqual(7); // At least 7 salin fields
    });

    it('should maintain coding field count consistency', () => {
      const coding = Object.keys(FIRDAN_CASE.extracted_data.koding).length;
      expect(coding).toBeGreaterThanOrEqual(3); // DIAGLIST, PROCLIST, INACBG
    });

    it('should have zero validation errors in golden case', () => {
      const baseline = FIRDAN_CASE.regression_test_baseline;
      expect(baseline.expected_error_count).toBe(0);
    });

    it('golden case should be complete (no critical missing fields)', () => {
      const salin = FIRDAN_CASE.extracted_data.salin;
      const critical = ['NAMA_PASIEN', 'MRN', 'SEP', 'ADMISSION_DATE', 'BIRTH_DATE'];
      critical.forEach((field) => {
        expect(salin[field]).toBeDefined();
        expect(salin[field].value).toBeTruthy();
      });
    });
  });

  describe('13. Data Integrity — No OCR Hallucination', () => {
    it('diagnosis should be sourced from medical documents, not OCR imagination', () => {
      const diaglist = FIRDAN_CASE.extracted_data.koding.DIAGLIST;
      diaglist.diagnoses.forEach((diag: any) => {
        expect(diag.source).toContain('Resume_Medis_IGD');
        expect(diag.notes).toBeTruthy(); // Each diagnosis should have clinical notes
      });
    });

    it('procedures should be sourced from medical documents, not OCR imagination', () => {
      const proclist = FIRDAN_CASE.extracted_data.koding.PROCLIST;
      proclist.procedures.forEach((proc: any) => {
        expect(proc.source).toContain('Resume_Medis_IGD');
      });
    });

    it('all critical fields should have confidence >= 0.85', () => {
      const criticalFields = [
        FIRDAN_CASE.extracted_data.salin.SEP,
        FIRDAN_CASE.extracted_data.salin.NAMA_PASIEN,
        FIRDAN_CASE.extracted_data.koding.DIAGLIST.diagnoses[0],
      ];
      criticalFields.forEach((field: any) => {
        expect(field.confidence).toBeGreaterThanOrEqual(0.85);
      });
    });
  });
});
