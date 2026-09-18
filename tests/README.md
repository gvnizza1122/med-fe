# eClaim Test Infrastructure

Comprehensive test suite untuk validasi sistem ekstraksi field eClaim, dengan fokus pada **Firdan Case** (SEP 0170R0110926V001417) sebagai golden test case.

## Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run specific test suite
npm test tests/firdan_validation.test.ts

# Run regression tests
npm run test:regression

# Watch mode (re-run on file changes)
npm test -- --watch

# Coverage report
npm test -- --coverage
```

## Test Structure

```
tests/
├── fixtures/
│   └── firdan_case.json                    # Golden test data (kunci jawaban)
│                                            # Contains: metadata, extracted_data,
│                                            #           consistency_checks, baseline
│
├── setup.ts                                # Jest configuration & polyfills
│
├── firdan_validation.test.ts              # Main unit test suite (13 describe blocks)
│                                            # Tests: salin, turunan, koding, vital signs,
│                                            #        consistency, regression, data integrity
│
├── regression_runner.ts                    # Regression testing logic
│                                            # Functions: loadGoldenData(),
│                                            #            generateRegressionReport(),
│                                            #            assertRegressionPassed(),
│                                            #            printReport()
│
├── regression_runner.test.ts              # Regression test suite
│                                            # Tests: report generation, assertions, output
│
├── FIRDAN_CASE_GUIDE.md                   # Comprehensive guide to Firdan case
│
└── README.md                              # This file
```

## Firdan Case Overview

**Firdan Case** adalah kasus uji baku yang mencakup:

| Aspect | Details |
|--------|---------|
| **SEP** | 0170R0110926V001417 |
| **Pasien** | FIRDAN (2 tahun, laki-laki) |
| **Diagnosis** | ISPA (J06.9) + Innocent Murmur (R01.1) |
| **Vital Signs** | HR 130, RR 30 (normal untuk usia 2 tahun) |
| **LOS** | 2 hari (RAWAT_INAP) |
| **Tarif** | Rp 1,750,000 (INA-CBG AAA0149) |
| **Field Count** | 8 salin + 7 turunan + 3 koding + 4 konfigurasi fields |
| **Errors Expected** | 0 (golden baseline) |

### Why Firdan Case?

1. **Comprehensive** — Mencakup semua 6 jenis field (salin, turunan, koding, konfigurasi, fakta_nol, wajar_kosong)
2. **Realistic** — Kasus pediatric umum di RS (ISPA + murmur)
3. **Tricky** — Vital signs yang normal untuk usia 2 tahun tapi mungkin terlihat abnormal untuk dewasa
4. **Documented** — Setiap field memiliki expected value, source, dan confidence score
5. **Reusable** — Dapat dijalankan setiap kali ada perubahan ekstraksi/feature

## Test Categories

### 1. Unit Tests (`firdan_validation.test.ts`)

Validates setiap field extraction category:

- **Salin** (8 tests) — Copied fields dari dokumen (NAMA_PASIEN, MRN, SEP, dll)
- **Turunan** (9 tests) — Derived fields (UMUR_TAHUN, LOS, TARIF, dll)
- **Koding** (6 tests) — Clinical coding (DIAGLIST, PROCLIST, INACBG)
- **Vital Signs** (5 tests) — Age-based normalization (HR, RR, BP, temp)
- **Consistency** (2 tests) — Triage vs Resume Medis alignment
- **Regression** (5 tests) — Compare against golden baseline
- **Data Integrity** (3 tests) — Prevent OCR hallucination

**Total: 38 test cases**

### 2. Regression Tests (`regression_runner.test.ts`)

Automated regression detection:

- Load golden data
- Compare extracted vs expected
- Generate diff report
- Assert PASS/PASS_WITH_WARNINGS/FAIL
- Print human-readable summary

**Used when**: Setiap kali ada perubahan ekstraksi logic, jalankan regression test untuk memastikan tidak ada regressions.

## Field Categorization

Firdan case mencakup semua 6 kategori field dari `fieldTypeRegistry.ts`:

### SALIN (Copied as-is)
- NAMA_PASIEN, MRN, BIRTH_DATE, SEP, NOKARTU, DPJP, ADMISSION_DATE, BERAT_BADAN
- **Expected Confidence**: ≥ 90%

### TURUNAN (Derived)
- SEX, UMUR_TAHUN, UMUR_HARI, DISCHARGE_DATE, LOS, TARIF_INACBG, TOTAL_TARIF, DESKRIPSI_INACBG
- **Expected Accuracy**: 100% (deterministic calculation)

### KODING (Clinical Coding)
- DIAGLIST (J06.9, R01.1)
- PROCLIST (93.0, 99.04)
- INACBG (AAA0149)
- **Source**: Resume Medis IGD, NOT OCR karangan
- **Expected Confidence**: ≥ 85%

### KONFIGURASI (Hospital Settings)
- KODE_RS (0170), KELAS_RS (B), PAYOR_ID (BPJS_KESEHATAN)
- **Expected Accuracy**: 100% (configuration)

### FAKTA_NOL (Fact Zero)
- ICU_INDIKATOR = 0, ICU_LOS = 0, VENT_HOUR = 0
- **Meaning**: 0 is information, not missing/empty

### WAJAR_KOSONG (Justifiably Empty)
- BIRTH_WEIGHT, ADL1/ADL2, SP/SR/SI/SD (tidak berlaku untuk kasus ini)
- **Expected**: null dengan reason

## Running Tests

### Basic Test Execution

```bash
# Run all tests
npm test

# Run specific file
npm test tests/firdan_validation.test.ts

# Run specific test case
npm test -- -t "should extract NAMA_PASIEN correctly"

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### Regression Testing

```bash
# Run regression test suite
npm run test:regression

# With verbose output (print full diff report)
npm run test:regression -- --verbose

# Save to file
npm run test:regression -- --output=./reports
```

### CI/CD Integration

Add to `.github/workflows/test.yml`:

```yaml
- name: Run Firdan Golden Tests
  run: npm test tests/firdan_validation.test.ts

- name: Run Regression Tests
  run: npm run test:regression
```

## Interpreting Test Results

### PASS ✓

```
✓ 38 test cases passed
✓ All fields match golden answers
✓ No critical errors
→ Ready to deploy
```

### PASS_WITH_WARNINGS ⚠

```
✓ 37 test cases passed
✗ 1 test case has warning (e.g., DISCHARGE_STATUS different)
! Review diff report before deploying
```

### FAIL ✗

```
✗ Multiple test cases failed
✗ Critical fields don't match (e.g., diagnosis codes, vital signs)
→ DO NOT DEPLOY until issues fixed
```

## Regression Report Example

When running `npm run test:regression`, you'll see:

```
================================================================================
REGRESSION TEST REPORT — Firdan Case (SEP 0170R0110926V001417)
================================================================================
Timestamp: 2026-09-18T10:30:00Z
Status: PASS

SUMMARY:
Ekstraksi field: 30/30 cocok (100%)
✓ Semua field cocok dengan golden answers!

================================================================================
```

Or if there are diffs:

```
DIFFS (Field Mismatches):
────────────────────────────────────────────────────────────────────────────

CRITICAL:
  • koding.DIAGLIST
    Expected: [{"icd10":"J06.9","sequence":1},...]
    Actual:   [{"icd10":"WRONG_CODE",...}]
    Confidence: 92%

WARNING:
  • turunan.DISCHARGE_STATUS
    Expected: "Pulang Membaik"
    Actual:   "Pulang Atas Permintaan Sendiri"
    Confidence: 96%
```

## Adding New Tests

1. **Update fixture** (`firdan_case.json`):
   ```json
   "extracted_data": {
     "salin": {
       "NEW_FIELD": {
         "value": "expected_value",
         "expected": "expected_value",
         "confidence": 0.95
       }
     }
   }
   ```

2. **Add test case** (`firdan_validation.test.ts`):
   ```typescript
   it('should extract NEW_FIELD correctly', () => {
     const expected = FIRDAN_CASE.extracted_data.salin.NEW_FIELD.expected;
     const actual = FIRDAN_CASE.extracted_data.salin.NEW_FIELD.value;
     expect(actual).toBe(expected);
   });
   ```

3. **Run tests**:
   ```bash
   npm test
   npm run test:regression
   ```

## Common Issues

### Test fails: "HR 130 should be NORMAL for 2-year-old"

**Root cause**: Age-based vital sign normalization is broken.

**Debug**:
```bash
npm test -- -t "HR 130" --verbose
# Check: Is age calculated correctly? Are thresholds for age 2 years applied?
```

**Fix**: Review age calculation and vital sign threshold logic.

### Test fails: "should extract DIAGLIST correctly"

**Root cause**: Diagnosis extraction from Resume Medis is not working.

**Debug**:
```bash
npm run test:regression -- --verbose
# Check: Is Resume Medis being parsed? Are diagnosis codes extracted correctly?
```

**Fix**: Review OCR → clinical coding pipeline.

### Test fails: "should calculate LOS correctly"

**Root cause**: Date parsing or arithmetic is wrong.

**Debug**:
```typescript
console.log('ADMISSION:', actual_admission_date);
console.log('DISCHARGE:', actual_discharge_date);
console.log('LOS:', actual_los); // Should be 2
```

**Fix**: Review date calculation logic.

## Golden Data Maintenance

**Firdan case baseline can only change if:**
1. ✓ Link 5 spec (kunci jawaban) is updated
2. ✓ Identified error in current golden data
3. ✓ Official requirement change

**DO NOT change** without:
- [ ] Documented reason
- [ ] Updated timestamp in regression_test_baseline
- [ ] Team approval (if in production)

## References

- **Field Registry**: `src/lib/fieldTypeRegistry.ts` (6 field types)
- **Firdan Guide**: `tests/FIRDAN_CASE_GUIDE.md` (detailed documentation)
- **Fixture**: `tests/fixtures/firdan_case.json` (golden data)
- **Jest Docs**: https://jestjs.io/docs/getting-started

## Questions?

1. Check `FIRDAN_CASE_GUIDE.md` for detailed explanation
2. Review fixture structure in `firdan_case.json`
3. Run tests with `--verbose` flag
4. Add `console.log()` to test for debugging

---

**Last Updated**: 2026-09-18
**Firdan Case Version**: 1.0
**Total Test Cases**: 38 (unit) + 8 (regression) = 46
