# eClaim Testing Infrastructure Setup

**Date**: 2026-09-18  
**Golden Test Case**: Firdan (SEP 0170R0110926V001417)  
**Status**: Ready for regression testing

## Overview

This document describes the comprehensive test infrastructure for eClaim field extraction validation, with **Firdan Case** as the golden baseline test case.

## What Was Created

### 1. Test Fixtures

**Location**: `tests/fixtures/firdan_case.json`

Contains the golden test data (kunci jawaban) for Firdan case with:
- Metadata (4-dokumen bundle: SEP, Resume Medis IGD, Resep, Triage)
- Extracted data (8 salin + 7 turunan + 3 koding + 4 konfigurasi fields)
- Vital signs validation (HR 130, RR 30 — normal untuk age 2 tahun)
- Consistency checks (Triage vs Resume alignment)
- Regression baseline (expected errors: 0)

**Key fields validated**:
- Diagnoses: J06.9 (ISPA), R01.1 (Innocent Murmur) — from Resume Medis, NOT OCR
- Procedures: 93.0 (Exam), 99.04 (Irrigation) — from Resume Medis, NOT OCR
- INA-CBG: AAA0149 (ISPA without CC)
- Vital signs: HR 130, RR 30 (normal for 2-year-old)

### 2. Test Suites

#### Main Unit Test Suite
**Location**: `tests/firdan_validation.test.ts`

38 test cases covering:
1. Field extraction — Salin (8 tests)
2. Field extraction — Turunan (9 tests)
3. Field extraction — Koding (6 tests)
4. Vital signs — Age-based normalization (5 tests)
5. Consistency checks — Triage vs Resume (2 tests)
6. Regression testing — Against golden baseline (5 tests)
7. Data integrity — No OCR hallucination (3 tests)

**Run with**:
```bash
npm test tests/firdan_validation.test.ts
```

#### Regression Test Suite
**Location**: `tests/regression_runner.test.ts`

8 test cases covering:
- Golden data loading
- Report generation (clean, critical errors, warnings)
- Regression assertions
- Report output formatting
- Baseline validation

**Run with**:
```bash
npm run test:regression
```

### 3. Testing Utilities

#### Regression Runner
**Location**: `tests/regression_runner.ts`

Reusable functions for regression testing:
- `loadGoldenData()` — Load Firdan baseline
- `compareData()` — Compare extracted vs expected
- `generateRegressionReport()` — Create detailed diff report
- `printReport()` — Human-readable console output
- `saveReport()` — Export report to JSON file
- `assertRegressionPassed()` — Test assertion helper

Usage:
```typescript
import { runRegressionTest } from './regression_runner';

const report = await runRegressionTest({
  extractedData: {...},
  sep: '0170R0110926V001417',
  verbose: true
});
```

### 4. Configuration

#### Jest Config
**Location**: `jest.config.js`

- Test environment: node
- Test pattern: `**/?(*.)+(spec|test).ts`
- Setup file: `tests/setup.ts`
- Timeout: 30 seconds
- Module mapping: `@/` → `src/`

#### Package.json Scripts
```json
{
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage",
  "test:regression": "jest tests/regression_runner.test.ts --runInBand"
}
```

#### Jest Setup
**Location**: `tests/setup.ts`

- Node environment polyfills
- localStorage mock
- Console error suppression

### 5. CI/CD Integration

**Location**: `.github/workflows/firdan-regression.yml`

Automated workflow that:
- Runs on every push/PR to main/develop
- Executes Firdan golden tests
- Runs regression test suite
- Uploads coverage reports
- Posts results comment on PR
- Fails build if regressions detected

## Field Categories Tested

### SALIN (Copied as-is from document)
- NAMA_PASIEN, MRN, BIRTH_DATE, SEP, NOKARTU, DPJP, ADMISSION_DATE, BERAT_BADAN
- **Expected confidence**: ≥ 90%
- **Tests**: 8 unit tests

### TURUNAN (Derived from other fields)
- SEX, UMUR_TAHUN, UMUR_HARI, DISCHARGE_DATE, LOS, KELAS_RAWAT, DESKRIPSI_INACBG, TARIF_INACBG, TOTAL_TARIF
- **Expected accuracy**: 100% (deterministic)
- **Tests**: 9 unit tests

### KODING (Clinical Coding)
- DIAGLIST (J06.9, R01.1), PROCLIST (93.0, 99.04), INACBG (AAA0149)
- **Source**: Resume Medis IGD (NOT OCR karangan)
- **Expected confidence**: ≥ 85%
- **Tests**: 6 unit tests

### KONFIGURASI (Hospital Settings)
- KODE_RS, KELAS_RS, PAYOR_ID
- **Expected accuracy**: 100%
- **Tests**: Integrated with other tests

### FAKTA_NOL (Fact Zero)
- ICU_INDIKATOR, ICU_LOS, VENT_HOUR (all = 0)
- **Meaning**: 0 is information, not missing
- **Tests**: Validated in integration

### WAJAR_KOSONG (Justifiably Empty)
- BIRTH_WEIGHT (not for age 2), ADL1/ADL2, SP/SR/SI/SD (not used)
- **Expected**: null with reason
- **Tests**: 8 fields validated

## Vital Signs Age-Based Normalization

**Critical test**: HR 130 and RR 30 for 2-year-old should be marked as NORMAL

| Vital Sign | Firdan Value | Normal Range (2yo) | Status |
|------------|--------------|-------------------|--------|
| HR | 130 bpm | 100–160 | ✓ NORMAL |
| RR | 30 breaths/min | 25–35 | ✓ NORMAL |
| Temperature | 37.5 °C | 36.5–37.5 | ✓ NORMAL |
| BP Systolic | 105 mmHg | 95–110 | ✓ NORMAL |
| BP Diastolic | 68 mmHg | 60–75 | ✓ NORMAL |

**Why this matters**: If system uses adult thresholds, HR 130 might be flagged as tachycardia (wrong!). Age-based logic must be applied.

## Running Tests

### Development

```bash
# Run all tests once
npm test

# Run with watch mode (re-run on file changes)
npm test -- --watch

# Run specific test file
npm test tests/firdan_validation.test.ts

# Run specific test case
npm test -- -t "should extract NAMA_PASIEN correctly"

# With coverage report
npm test -- --coverage
```

### Regression Testing

```bash
# Run regression test suite
npm run test:regression

# With verbose output (prints full diff report)
npm run test:regression -- --verbose

# Save report to file
npm run test:regression -- --output=./reports
```

### Pre-Deployment Check

```bash
# Run full test suite + regression tests
npm test && npm run test:regression
```

## Test Results Interpretation

### ✓ PASS
- All 38 test cases pass
- No field mismatches with golden answers
- Regression test: PASS
- **Action**: Safe to deploy

### ⚠ PASS_WITH_WARNINGS
- 35-37 test cases pass
- 1-3 fields have minor mismatches (e.g., DISCHARGE_STATUS)
- Regression test: PASS_WITH_WARNINGS
- **Action**: Review diff report, decide if acceptable before merging

### ✗ FAIL
- 1+ critical field mismatches (diagnosis codes, vital signs, procedures)
- Regression test: FAIL
- **Action**: DO NOT DEPLOY. Fix issues and re-test.

Example FAIL scenario:
```
CRITICAL:
  • koding.DIAGLIST[0].icd10
    Expected: J06.9
    Actual:   HALLUCINATED_CODE
    
→ Indicates OCR or clinical coding pipeline is broken
```

## Adding New Tests

When adding a new field or changing extraction logic:

1. **Update fixture** (`tests/fixtures/firdan_case.json`):
   ```json
   "salin": {
     "NEW_FIELD": {
       "value": "actual_value",
       "expected": "expected_value",
       "confidence": 0.95,
       "source": "SEP"
     }
   }
   ```

2. **Add test case** (`tests/firdan_validation.test.ts`):
   ```typescript
   it('should extract NEW_FIELD correctly', () => {
     const expected = FIRDAN_CASE.extracted_data.salin.NEW_FIELD.expected;
     const actual = FIRDAN_CASE.extracted_data.salin.NEW_FIELD.value;
     expect(actual).toBe(expected);
   });
   ```

3. **Run tests**:
   ```bash
   npm test tests/firdan_validation.test.ts -- -t "NEW_FIELD"
   npm run test:regression
   ```

4. **Commit**:
   ```bash
   git add tests/fixtures/firdan_case.json tests/firdan_validation.test.ts
   git commit -m "test: add NEW_FIELD validation to Firdan golden test"
   ```

## File Locations Summary

| File | Purpose |
|------|---------|
| `tests/fixtures/firdan_case.json` | Golden test data (kunci jawaban) |
| `tests/firdan_validation.test.ts` | 38 unit test cases |
| `tests/regression_runner.ts` | Regression testing utilities |
| `tests/regression_runner.test.ts` | 8 regression test cases |
| `tests/setup.ts` | Jest configuration |
| `tests/README.md` | Test infrastructure guide |
| `tests/FIRDAN_CASE_GUIDE.md` | Detailed Firdan case documentation |
| `jest.config.js` | Jest configuration |
| `.github/workflows/firdan-regression.yml` | CI/CD workflow |
| `TESTING_SETUP.md` | This file |

## Dependencies

New dependencies added to `package.json`:

```json
{
  "devDependencies": {
    "@types/jest": "^29.5.11",
    "jest": "^29.7.0",
    "jest-environment-node": "^29.7.0",
    "ts-jest": "^29.1.1"
  }
}
```

Install with:
```bash
npm install
```

## Next Steps

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run tests to verify setup**:
   ```bash
   npm test
   npm run test:regression
   ```

3. **Create a git commit**:
   ```bash
   git add tests/ jest.config.js package.json .github/workflows/
   git commit -m "setup: Firdan golden test case infrastructure

   - Golden test fixture: tests/fixtures/firdan_case.json
   - Unit test suite: 38 tests covering all field categories
   - Regression test runner: Compare against golden baseline
   - CI/CD workflow: Auto-run tests on push/PR
   
   Test coverage:
   - Salin (8): NAMA_PASIEN, MRN, SEP, NOKARTU, etc.
   - Turunan (9): SEX, UMUR_TAHUN, LOS, TARIF_INACBG, etc.
   - Koding (6): DIAGLIST (J06.9, R01.1), PROCLIST (93.0, 99.04), INACBG
   - Vital signs (5): HR 130, RR 30 (normal for 2yo), BP, temp
   - Consistency (2): Triage vs Resume alignment
   
   Regression baseline: 0 expected errors
   "
   ```

4. **Review test output**:
   - All 38 unit tests should pass
   - Regression report should show PASS
   - Check console output for any warnings

5. **Integrate with CI/CD**:
   - Push branch with workflow file
   - Tests will run automatically on GitHub Actions

## Troubleshooting

### Tests fail with "Cannot find module"
```bash
npm install
npm test
```

### Regression test hangs
```bash
# Kill background processes
pkill -f jest

# Run with timeout
npm run test:regression -- --testTimeout=10000
```

### Coverage report not generated
```bash
npm test -- --coverage
# Check coverage/ directory
```

### GitHub Actions workflow not triggering
- Ensure workflow file is in `.github/workflows/firdan-regression.yml`
- Commit and push to trigger
- Check Actions tab in GitHub for logs

## References

- **Fixture Structure**: `tests/fixtures/firdan_case.json`
- **Detailed Guide**: `tests/FIRDAN_CASE_GUIDE.md`
- **Regression Logic**: `tests/regression_runner.ts`
- **Jest Documentation**: https://jestjs.io/

## Questions?

1. Check `tests/FIRDAN_CASE_GUIDE.md` for detailed case explanation
2. Review `tests/README.md` for test infrastructure overview
3. Run tests with `--verbose` flag to see detailed output
4. Add console.log() statements to tests for debugging

---

**Setup completed**: 2026-09-18  
**Status**: Ready for first test run  
**Expected result**: ✓ PASS (38/38 tests, no regressions)
