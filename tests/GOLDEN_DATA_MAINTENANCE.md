# Golden Data Maintenance Guide

**Document Version**: 1.0  
**Last Updated**: 2026-09-18  
**Golden Test Case**: Firdan (SEP 0170R0110926V001417)

## Overview

This guide describes how to maintain, update, and validate the Firdan golden test case over time as features and requirements evolve.

## Golden Data Immutability Policy

The Firdan golden test case is a **locked reference baseline**. It should ONLY change under these conditions:

### ✓ ALLOWED CHANGES

1. **Link 5 Spec Update** — Kunci jawaban dari requirement berubah
   - Update fixture
   - Document reason with timestamp
   - Update version number
   - Review by project lead

2. **Identified Error** — Bug ditemukan dalam golden data saat review
   - Example: Wrong expected value due to misreading dokumen klinis
   - Must be validated against actual patient dokumen
   - Requires approval before merge

3. **Official Requirement Change** — Spec/standard berubah
   - Example: WHO pediatric thresholds updated
   - INA-CBG grouper logic changed
   - Requires formal requirement document

### ✗ PROHIBITED CHANGES

- DO NOT change to make failing tests pass (commit to fixing code instead)
- DO NOT change without documentation
- DO NOT change due to system changes without approval
- DO NOT change confidence scores without reason

## Change Management Process

### Step 1: Identify Change Need

When you discover a need to update golden data:

```
Issue: Field extraction logic changed
Reason: Updated ICD-10 coding to follow new BPJS standard
Impact: DIAGLIST expected values might change
Decision: Review with team → update fixture
```

### Step 2: Create Backup

Before any modification:

```bash
# Save current version
cp tests/fixtures/firdan_case.json tests/fixtures/firdan_case.json.backup.2026-09-18
git add tests/fixtures/firdan_case.json.backup.2026-09-18
```

### Step 3: Update Fixture

Edit `tests/fixtures/firdan_case.json`:

```json
{
  "extracted_data": {
    "salin": {
      "NAMA_PASIEN": {
        "value": "FIRDAN",
        "expected": "FIRDAN",  // ← Changed from "FIRDAN2"
        "confidence": 0.99,
        "source": "SEP"
      }
    }
  },
  "regression_test_baseline": {
    "timestamp": "2026-09-18T10:30:00Z",
    "version": "1.0",
    "last_updated": "2026-09-18T10:30:00Z",
    "last_updated_by": "gvn.izza@gmail.com",
    "update_reason": "Fixed NAMA_PASIEN expected value (was typo)",  // ← Add reason
    "previous_version": "1.0",
    "changes": [
      {
        "field": "NAMA_PASIEN",
        "previous_expected": "FIRDAN2",
        "new_expected": "FIRDAN",
        "reason": "Corrected typo from original fixture"
      }
    ]
  }
}
```

### Step 4: Update Tests

If test expectations change, update `tests/firdan_validation.test.ts`:

```typescript
// Before
it('should extract NAMA_PASIEN correctly', () => {
  const expected = 'FIRDAN2'; // ← Old
  expect(actual).toBe(expected);
});

// After
it('should extract NAMA_PASIEN correctly', () => {
  const expected = FIRDAN_CASE.extracted_data.salin.NAMA_PASIEN.expected; // ← Use fixture
  expect(actual).toBe(expected);
});
```

### Step 5: Run Tests

```bash
npm test tests/firdan_validation.test.ts
npm run test:regression
```

If tests fail, investigate:
- Is the expected value really correct?
- Is the code logic wrong?
- Which one needs fixing?

### Step 6: Document Change

Create commit message with full context:

```bash
git commit -m "chore(test): update Firdan golden data — DIAGLIST expected values

Update reason: INA-CBG grouper changed to v53 standard
Impact: J06.9 diagnosis now includes secondary coding
Source: Link 5 spec update dated 2026-09-17

Changes:
- DIAGLIST[0].icd10: J06.9 (unchanged)
- DIAGLIST[1].icd10: R01.1 (added innocent murmur)
- DIAGLIST[1].confidence: 88% (WHO standard)

Backward compatibility: None (baseline update)
Tested: ✓ All 38 unit tests pass
         ✓ Regression test clean

Golden data version: 1.1
Updated by: gvn.izza@gmail.com
"
```

## Version Control Strategy

### Versioning Scheme

Use semantic versioning for golden data:

```
version: major.minor.patch
- Major: Fundamental change (new field type, different patient class)
- Minor: Field value/calculation update (new diagnosis, tariff change)
- Patch: Documentation or typo fix (confidence score, source clarification)
```

**Example progression**:
- 1.0.0 — Initial golden baseline (2026-09-18)
- 1.1.0 — Added BERAT_BADAN field (2026-10-15)
- 1.1.1 — Fixed DPJP typo (2026-10-20)
- 1.2.0 — Updated INA-CBG to v53 (2026-11-01)
- 2.0.0 — New pediatric ISPA case standard (2026-12-01)

### Golden Data Metadata

Include full metadata in fixture:

```json
{
  "metadata": {
    "sep": "0170R0110926V001417",
    "patient_name": "FIRDAN",
    "created_date": "2026-09-18",
    "created_by": "gvn.izza@gmail.com"
  },
  "regression_test_baseline": {
    "timestamp": "2026-09-18T00:00:00Z",
    "version": "1.0.0",
    "last_updated": "2026-09-18T00:00:00Z",
    "last_updated_by": "gvn.izza@gmail.com",
    "update_reason": "Initial golden baseline setup",
    "source_documents": [
      "Link 5 spec (Field mapping table)",
      "WHO Pediatric Standards (Vital sign thresholds)",
      "BPJS INA-CBG Grouper v52"
    ],
    "validation_status": "APPROVED",
    "approver": "Project Lead",
    "expected_extraction_count": 8,
    "expected_coding_count": 3,
    "expected_error_count": 0
  }
}
```

## Field Value Update Examples

### Example 1: Diagnosis Code Change

**Scenario**: INA-CBG grouper updated, J06.9 should now be J06.8

```json
// Old
"DIAGLIST": {
  "diagnoses": [
    {
      "icd10": "J06.9",
      "deskripsi": "Acute upper respiratory infection, unspecified"
    }
  ]
}

// New
"DIAGLIST": {
  "diagnoses": [
    {
      "icd10": "J06.8",
      "deskripsi": "Acute upper respiratory infection, specified location"
    }
  ]
}
```

**Update fixture**:
1. Change `icd10: "J06.9"` → `"J06.8"`
2. Update `deskripsi`
3. Add change log:
   ```json
   "changes": [{
     "field": "DIAGLIST[0].icd10",
     "previous": "J06.9",
     "current": "J06.8",
     "reason": "INA-CBG grouper v53 standard",
     "date": "2026-09-20"
   }]
   ```

**Test impact**:
- Unit test: `should extract primary diagnosis correctly` → must pass
- Regression test: Will detect this change automatically

### Example 2: Vital Signs Threshold Change

**Scenario**: WHO updates pediatric HR normal range for age 2

```json
// Old
"HR": {
  "value": 130,
  "normal_range": "100–160 bpm (age 2 years)",  // ← Old range
  "is_normal": true
}

// New
"HR": {
  "value": 130,
  "normal_range": "95–165 bpm (age 2 years)",   // ← Updated range
  "is_normal": true
}
```

**Update fixture**:
1. Change `normal_range`
2. Verify `is_normal` is still true
3. Add changelog with WHO reference

**Test impact**:
- Validation logic may need update
- Run tests to ensure HR 130 still marked as normal
- If system uses hardcoded ranges, update those

### Example 3: Confidence Score Adjustment

**Scenario**: OCR accuracy improved, confidence for MRN extraction now 99%

```json
// Old
"MRN": {
  "value": "0170-026-01",
  "confidence": 0.98  // ← Was 98%
}

// New
"MRN": {
  "value": "0170-026-01",
  "confidence": 0.995  // ← Now 99.5%
}
```

**Update fixture**:
1. Update confidence score
2. Add reason (OCR improvement, better font recognition, etc.)
3. Update test assertions if they check minimum threshold

**Test impact**:
- No functional change (value same)
- Regression test will report this as "info" level diff
- Optional: Update confidence threshold tests if lower

## Validation Checklist

Before committing any golden data update:

- [ ] **Source verified**: Is the new value correct per Link 5 spec?
- [ ] **Tests pass**: Do all 38 unit tests pass?
- [ ] **Regression clean**: Does regression test show PASS?
- [ ] **Documented**: Is change reason clear in commit message?
- [ ] **Versioned**: Updated version number in baseline?
- [ ] **Reviewed**: Has someone else reviewed the change?
- [ ] **Backward compat**: Any systems relying on old value?
- [ ] **Impact analyzed**: Will this affect other test cases?

## Rollback Procedure

If golden data update causes unexpected failures:

### Option 1: Quick Rollback

```bash
# Revert single file
git checkout HEAD~ -- tests/fixtures/firdan_case.json

# Re-run tests
npm test
npm run test:regression

# If clean, commit revert
git commit -m "revert(test): golden data update — caused regressions

Reverted changes to firdan_case.json due to unexpected test failures.
Investigation needed before re-applying.
"
```

### Option 2: Restore from Backup

```bash
# Copy backup over current
cp tests/fixtures/firdan_case.json.backup.2026-09-18 tests/fixtures/firdan_case.json

# Re-run tests
npm test
npm run test:regression

# Verify clean
git status
```

### Option 3: Selective Revert

```bash
# Revert only specific field
git diff HEAD~ -- tests/fixtures/firdan_case.json
# Manually fix the problematic field
npm test
npm run test:regression
git add tests/fixtures/firdan_case.json
git commit -m "fix(test): revert DIAGLIST change only"
```

## Audit Trail

Document all changes in a changelog:

**File**: `tests/fixtures/CHANGELOG.md`

```markdown
# Firdan Golden Test Case — Changelog

## [1.0.0] — 2026-09-18

### Initial Release
- Golden baseline: 30 fields across 6 categories
- Vital signs validation for age 2 years
- 38 unit tests + 8 regression tests
- Zero expected errors
- Status: APPROVED by Project Lead

## [1.1.0] — 2026-10-15

### Added
- BERAT_BADAN field (14.5 kg from Triage)
- Wajar_kosong validation for pediatric fields

### Changed
- DPJP confidence 94% → 95% (improved OCR)

### Fixed
- UMUR_HARI calculation (was 729, now 730)

**Approved by**: Project Lead  
**Tested**: ✓ All 39 tests pass  

---
```

## Regular Maintenance Tasks

### Weekly
- [ ] Check if any bug reports reference golden data
- [ ] Review recent commits for extraction changes
- [ ] Run regression tests locally

### Monthly
- [ ] Review test failure patterns
- [ ] Update documentation if needed
- [ ] Check for outdated thresholds/standards

### Quarterly
- [ ] Full review of all expected values
- [ ] Validate against current Link 5 spec
- [ ] Update version if needed
- [ ] Team discussion on any needed updates

## Common Pitfalls to Avoid

### ❌ DON'T

1. **Change golden data to make tests pass**
   - Fix the code instead
   - Golden data is the source of truth

2. **Update without documenting reason**
   - Future developers won't understand
   - Makes rollback harder

3. **Change multiple fields at once**
   - Makes regression detection harder
   - Split into separate commits

4. **Forget to update version number**
   - Version tracking becomes unreliable
   - Hard to trace what changed

5. **Change confidence scores without reason**
   - Indicates you don't understand the field
   - Ask for clarification first

### ✓ DO

1. **Document every change thoroughly**
   - Why (reason/source)
   - What (which field, old→new value)
   - When (date/timestamp)
   - Who (your name/email)

2. **Run tests after every change**
   - Unit tests must pass
   - Regression must be clean or explained

3. **Get second opinion for major changes**
   - Another developer reviews
   - Approves before merge

4. **Keep good audit trail**
   - Commit messages detail changes
   - Changelog updated
   - Backup created

5. **Test impact analysis**
   - What systems depend on this field?
   - Will change break anything?
   - Are there related fields?

## Questions?

- **"Is this change allowed?"** → Check "ALLOWED CHANGES" section
- **"How do I update value X?"** → Follow "Change Management Process"
- **"Tests failed after my change"** → See "Troubleshooting" or "Rollback Procedure"
- **"What version should I use?"** → Check "Versioning Scheme"
- **"How to document this?"** → See "Update Fixture" step

---

**Document version**: 1.0  
**Last updated**: 2026-09-18  
**Contact**: gvn.izza@gmail.com for questions
