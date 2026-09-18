# Firdan Case (SEP 0170R0110926V001417) — Golden Test Case Guide

## Overview

**Firdan Case** adalah kasus uji baku (golden test case) untuk validasi sistem ekstraksi field eClaim. Kasus ini digunakan untuk:

1. **Unit Testing** — Memastikan setiap field diekstrak dengan benar dari dokumen
2. **Regression Testing** — Mendeteksi kapan ekstraksi berubah (baik improves maupun regressions)
3. **Integration Testing** — Memvalidasi konsistensi data antar dokumen dan sistem
4. **Automation** — Setiap kali ada perubahan ekstraksi/feature, run Firdan test → bandingkan output

## Patient Demographics

| Field | Value | Note |
|-------|-------|------|
| **SEP** | 0170R0110926V001417 | Referral ID |
| **Nama Pasien** | FIRDAN | Laki-laki (inferred dari nama) |
| **MRN** | 0170-026-01 | Medical Record Number |
| **Tanggal Lahir** | 2022-09-18 | Usia **2 tahun** pada saat masuk |
| **Umur (Tahun)** | 2 | Pediatric case |
| **Umur (Hari)** | 730 | Approx. 2 x 365 |
| **Berat Badan** | 14.5 kg | Triage record |

## Admission Details

| Field | Value | Note |
|-------|-------|------|
| **Tanggal Masuk** | 2024-09-18 | Admission to IGD |
| **Tanggal Keluar** | 2024-09-20 | Discharge from inpatient |
| **LOS (Length of Stay)** | 2 hari | 2024-09-20 minus 2024-09-18 |
| **Status Keluar** | Pulang Membaik | Discharged in stable condition |
| **Jenis Klaim** | RAWAT_INAP | Inpatient admission |
| **Kelas Rawat** | III | Ward class |

## Clinical Information

### Diagnosis (DIAGLIST)

Diagnoses extracted dari **Resume Medis IGD**, bukan OCR karangan:

| Seq | ICD-10 | Deskripsi | Source | Confidence |
|-----|--------|-----------|--------|-----------|
| 1 | **J06.9** | Acute upper respiratory infection, unspecified | Resume Medis IGD | 92% |
| 2 | **R01.1** | Cardiac murmur, unspecified | Resume Medis IGD | 88% |

**Catatan**: 
- Diagnosis utama (J06.9) adalah ISPA — gejala batuk, pilek, demam
- Diagnosis sekunder (R01.1) adalah bising jantung (innocent murmur, normal pada anak)

### Procedures (PROCLIST)

Procedures extracted dari **Resume Medis IGD**, bukan OCR karangan:

| Seq | ICD-9 | Deskripsi | Source | Confidence |
|-----|--------|-----------|--------|-----------|
| 1 | **93.0** | Physical examination and evaluation | Resume Medis IGD | 91% |
| 2 | **99.04** | Irrigation of nasal passages | Resume Medis IGD | 87% |

### INA-CBG Grouping

| Field | Value | Note |
|-------|-------|------|
| **INACBG Code** | AAA0149 | Acute Upper Respiratory Infection without CC |
| **Tarif** | Rp 1,750,000 | Standard BPJS tariff for AAA0149 |
| **Add-ons** | None | No ICU, no special procedures |
| **Total Tarif** | Rp 1,750,000 | Final billable amount |

## Vital Signs — Age-Based Normalization

**Critical**: Firdan case mencakup validasi vital signs yang **normal untuk usia 2 tahun** tetapi mungkin terlihat abnormal jika menggunakan standar dewasa.

| Vital Sign | Nilai | Unit | Normal Range (2 Tahun) | Status |
|------------|-------|------|------------------------|--------|
| **HR** | 130 | bpm | 100–160 | ✓ NORMAL |
| **RR** | 30 | breaths/min | 25–35 | ✓ NORMAL |
| **Temperature** | 37.5 | °C | 36.5–37.5 | ✓ NORMAL |
| **BP Systolic** | 105 | mmHg | 95–110 | ✓ NORMAL |
| **BP Diastolic** | 68 | mmHg | 60–75 | ✓ NORMAL |

### Age Thresholds Validation

Sistem harus **menerapkan ambang usia yang tepat** saat memvalidasi vital signs:
- HR 130 untuk anak 2 tahun: NORMAL (tidak ABNORMAL)
- RR 30 untuk anak 2 tahun: NORMAL (tidak TACHYPNEA)

Jika sistem menandai HR 130 atau RR 30 sebagai abnormal untuk pediatric patient, itu adalah **BUG** dalam age-based normalization logic.

## Field Categorization

Firdan case mencakup semua 6 kategori field jenis yang ada di `fieldTypeRegistry.ts`:

### 1. SALIN (Copied as-is from document)

Fields yang disalin langsung dari dokumen, diubah hanya untuk normalisasi format:
- NAMA_PASIEN, MRN, BIRTH_DATE, SEP, NOKARTU, DPJP, ADMISSION_DATE, BERAT_BADAN

| Field | Source | Confidence |
|-------|--------|-----------|
| NAMA_PASIEN | SEP | 99% |
| MRN | SEP | 98% |
| BIRTH_DATE | SEP | 97% |
| SEP | SEP | 99% |
| NOKARTU | SEP | 96% |
| DPJP | Resume Medis IGD | 95% |
| ADMISSION_DATE | SEP | 99% |
| BERAT_BADAN | Triage | 94% |

**Validasi**: Semua field SALIN harus confidence ≥ 90%.

### 2. TURUNAN (Derived from other fields)

Fields yang dihitung dari field lain:
- SEX (dari NAMA_PASIEN), UMUR_TAHUN/HARI (dari BIRTH_DATE), LOS (dari ADMISSION_DATE dan DISCHARGE_DATE), TARIF (dari INA-CBG lookup), dll.

| Field | Derived From | Logic | Confidence |
|-------|--------------|-------|-----------|
| SEX | NAMA_PASIEN | Nama FIRDAN = laki-laki | 85% |
| UMUR_TAHUN | BIRTH_DATE | 2024-09-18 minus 2022-09-18 = 2 tahun | 99% |
| UMUR_HARI | BIRTH_DATE | 2 tahun × 365 = 730 hari | 99% |
| LOS | ADMISSION_DATE + DISCHARGE_DATE | 2024-09-20 minus 2024-09-18 = 2 | 99% |
| DISCHARGE_STATUS | Resume Medis IGD | Status keluar: Pulang Membaik | 96% |
| TARIF_INACBG | INA-CBG tariff table | Std BPJS rate untuk AAA0149 | 95% |
| TOTAL_TARIF | TARIF_INACBG | Rp 1,750,000 (no add-ons) | 97% |

**Validasi**: Semua field TURUNAN harus dihitung dengan akurat; tidak ada hardcoded values.

### 3. KODING (Clinical Coding: Diagnosis, Procedure, INA-CBG)

Diagnosis dan procedure harus **diambil dari Resume Medis IGD**, bukan hasil OCR atau hallucination:
- DIAGLIST (diagnosis codes), PROCLIST (procedure codes), INACBG (grouping result)

**Red Flag**: Jika diagnosis/procedure muncul tanpa sumber yang jelas atau tidak tertera di dokumen klinis → likely hallucination.

### 4. KONFIGURASI (Hospital Settings)

Fields yang sama untuk semua klaim dalam satu RS:
- KODE_RS (0170), KELAS_RS (B), PAYOR_ID (BPJS_KESEHATAN)

### 5. FAKTA_NOL (Fact Zero: zero is information)

Fields dengan nilai 0 yang bermakna (bukan kosong):
- ICU_INDIKATOR = 0 (tidak ICU), ICU_LOS = 0 (durasi 0 hari), VENT_HOUR = 0 (tidak ventilator)

**Penting**: 0 ≠ kosong (null). Sistem harus membedakan keduanya.

### 6. WAJAR_KOSONG (Justifiably Empty)

Fields yang kosong karena tidak berlaku untuk klaim jenis ini:
- BIRTH_WEIGHT (tidak untuk usia 2 tahun), ADL1/ADL2 (tidak pediatric), SP/SR/SI/SD (tidak digunakan)

## Running Tests

### Unit Tests

```bash
# Run Firdan validation suite
npm test tests/firdan_validation.test.ts

# Run with coverage
npm test tests/firdan_validation.test.ts -- --coverage

# Run specific test
npm test tests/firdan_validation.test.ts -- -t "should extract NAMA_PASIEN correctly"
```

### Regression Tests

```bash
# Run regression test (compare against golden answers)
npm run test:regression -- --sep=0170R0110926V001417

# Run regression test with file ID from upload batch
npm run test:regression -- --fileId=<upload-batch-id>

# Run with verbose output (print full diff report)
npm run test:regression -- --sep=0170R0110926V001417 --verbose

# Save report to file
npm run test:regression -- --sep=0170R0110926V001417 --output=./reports
```

### Watch Mode

```bash
# Watch for changes and re-run tests
npm test tests/firdan_validation.test.ts -- --watch
```

## Test Structure

```
tests/
├── fixtures/
│   └── firdan_case.json              # Golden test data (kunci jawaban)
├── firdan_validation.test.ts         # Unit test suite
├── regression_runner.ts              # Regression testing logic
├── setup.ts                          # Jest configuration
└── FIRDAN_CASE_GUIDE.md              # This file
```

## Adding New Tests

Saat menambahkan field baru atau mengubah ekstraksi logic:

1. **Update `firdan_case.json`** dengan expected value yang benar
2. **Add test case** di `firdan_validation.test.ts` untuk field baru
3. **Run tests** untuk memastikan tidak ada regressions
4. **Commit** dengan deskripsi perubahan

Contoh:

```typescript
it('should extract NEW_FIELD correctly', () => {
  const expected = FIRDAN_CASE.extracted_data.salin.NEW_FIELD.expected;
  const actual = FIRDAN_CASE.extracted_data.salin.NEW_FIELD.value;
  expect(actual).toBe(expected);
});
```

## Golden Data Maintenance

**Firdan case TIDAK boleh diubah kecuali:**
1. Kunci jawaban dari Link 5 spec diperbarui
2. Ada error dalam data yang sudah teridentifikasi dan divalidasi
3. Requirement field berubah secara resmi

**Setiap perubahan harus di-document** dengan timestamp dan reason:

```json
{
  "regression_test_baseline": {
    "timestamp": "2026-09-18T00:00:00Z",
    "version": "1.0",
    "last_updated": "2026-09-18",
    "update_reason": "Initial golden baseline setup"
  }
}
```

## Troubleshooting

### Test fails: "should extract NAMA_PASIEN correctly"

**Possible causes:**
- OCR confidence below threshold
- Field mapping changed
- Regex pattern for name normalization changed

**Debug:**
```bash
npm run test:regression -- --sep=0170R0110926V001417 --verbose
# Check extracted value vs expected in report
```

### Test fails: "should calculate LOS correctly"

**Possible causes:**
- Date parsing logic changed
- Timezone handling issue
- Off-by-one error in date arithmetic

**Debug:**
```bash
# Add console.log in test to inspect calculated values
expect(actual).toBe(expected); // Will show diff
```

### Test fails: "HR 130 should be NORMAL for 2-year-old"

**Possible causes:**
- Age thresholds table outdated
- Age-based normalization logic removed or broken

**Debug:**
- Check `vital_signs_normalization.ts` or similar
- Verify age thresholds match WHO pediatric standards
- Ensure age is calculated correctly (UMUR_TAHUN)

## Reference Documents

The following documents were used to create Firdan case:

1. **Link 5 Spec** — Field mapping & answer key (referenced in task)
2. **WHO Pediatric Standards** — Age-based vital sign thresholds
3. **BPJS INA-CBG Grouper** — AAA0149 coding & tariff
4. **eClaim Field Registry** — `fieldTypeRegistry.ts` (6 field types)

## Contact & Questions

For questions about Firdan case or test infrastructure:
- Check this guide first
- Review `firdan_case.json` structure
- Run tests with `--verbose` flag to see detailed diff
- Add `console.log()` to test cases for debugging

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-09-18 | Initial golden baseline: 8 salin + 7 turunan + 3 koding + 4 konfigurasi fields. All vital signs normal for age. No errors expected. |
