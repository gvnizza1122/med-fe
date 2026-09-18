# ICD-10-CM vs ICD-10 WHO Quick Reference

## Format Differences at a Glance

### ICD-10-CM Format (INVALID for BPJS)
- Pattern: `Letter + 2 digits + dot + 2-3 digits` (e.g., `.XX` or `.XXX`)
- High-confidence detection: 2+ decimal places usually indicates US coding
- Examples: `J45.909`, `E86.01`, `R01.11`, `F41.11`
- Source: USA Centers for Medicare & Medicaid Services (CMS)
- Compliance: NOT accepted by BPJS

### ICD-10 WHO Format (VALID for BPJS)
- Pattern A: `Letter + 2 digits` (no decimal, e.g., `I10`, `E11`)
- Pattern B: `Letter + 2 digits + dot + 1 digit` (e.g., `J45.9`, `M79.3`)
- Examples: `I10`, `E11`, `J45.9`, `M79.3`, `F41.1`
- Source: World Health Organization
- Compliance: Required for BPJS submissions
- Note: Validated against icd10_who_codes reference table

---

## Common Mismatches Found in Production

### Respiratory Codes

| ICD-10-CM (INVALID) | ICD-10 WHO (VALID) | Condition | Action |
|-----|------|-----------|--------|
| J45.901 | J45.9 | Unspecified asthma - uncomplicated | Replace |
| J45.902 | J45.9 | Unspecified asthma - with exacerbation | Replace |
| J45.909 | J45.9 | Unspecified asthma - unspecified | Replace |
| J06.9 | J06.9 | Acute upper respiratory infection, unspecified | OK |
| J20.9 | J20.9 | Acute bronchitis, unspecified | OK |
| J44.1 | J44.1 | COPD with acute exacerbation | OK |
| R06.02 | R06.0 | Shortness of breath | Use R06.0 |

### Endocrine & Metabolic Codes

| ICD-10-CM (INVALID) | ICD-10 WHO (VALID) | Condition | Action |
|-----|------|-----------|--------|
| E86.0 | E86 | Dehydration | Replace |
| E86.1 | E86 | Hypovolemia | Replace |
| E11.9 | E11 | Type 2 diabetes mellitus | Use E11 |
| E10.9 | E10 | Type 1 diabetes mellitus | Use E10 |
| E11.22 | E11 | Type 2 diabetes with neuropathy | Use E11 |
| E66.01 | E66 | Obesity due to excess calories | Use E66 |

### Circulatory Codes

| ICD-10-CM (INVALID) | ICD-10 WHO (VALID) | Condition | Action |
|-----|------|-----------|--------|
| I10 | I10 | Essential hypertension | OK (ICD-10 WHO) |
| I11.9 | I11 | Hypertensive heart disease | Use I11 |
| I50.9 | I50 | Heart failure, unspecified | Use I50 |
| R01.1 | R01 | Cardiac murmur | Use R01 |
| I63.9 | I63 | Ischemic stroke, unspecified | Use I63 |
| I64 | I64 | Stroke, not specified as hemorrhage or ischemia | OK |

### Musculoskeletal Codes

| ICD-10-CM (INVALID) | ICD-10 WHO (VALID) | Condition | Action |
|-----|------|-----------|--------|
| M79.3 | M79.3 | Panniculitis, unspecified | OK |
| M79.6 | M79.6 | Panniculitis, unspecified location | OK |
| M54.5 | M54.5 | Low back pain | OK |
| M25.5 | M25.5 | Joint pain | OK |
| M79.2 | M79.2 | Nontraumatic muscle hematoma | OK |

### Mental Health Codes

| ICD-10-CM (INVALID) | ICD-10 WHO (VALID) | Condition | Action |
|-----|------|-----------|--------|
| F41.1 | F41.1 | Generalized anxiety disorder | OK |
| F32.9 | F32.9 | Major depressive disorder, single episode | OK |
| F33.9 | F33.9 | Major depressive disorder, recurrent | OK |
| F90.9 | F90.9 | ADHD, unspecified | OK |

### Genitourinary Codes

| ICD-10-CM (INVALID) | ICD-10 WHO (VALID) | Condition | Action |
|-----|------|-----------|--------|
| N39.0 | N39.0 | Urinary tract infection, site not specified | OK |
| N10 | N10 | Acute tubulo-interstitial nephritis | OK |
| E11.21 | E11 | Type 2 diabetes with neuropathy | Use E11 |

### Skin Codes

| ICD-10-CM (INVALID) | ICD-10 WHO (VALID) | Condition | Action |
|-----|------|-----------|--------|
| L89.90 | L89.9 | Unspecified pressure ulcer | Use L89.9 |
| L88.9 | L88 | Pyoderma gangrenosum | OK |
| L20.9 | L20.9 | Atopic dermatitis, unspecified | OK |

---

## Audit Detection Rules

The audit script identifies ICD-10-CM format codes using strict pattern matching:

```regex
Strict (Most Reliable):
^[A-Z]\d{2}\.\d{2,3}$

Loose (Also flags some WHO codes):
^[A-Z]\d{2}\.\d{1,3}$
```

**By Default:** Uses strict pattern (2-3 decimal digits only)

This matches:
- Starting with a single letter (A-Z)
- Followed by exactly 2 digits (0-9)
- A dot separator
- Followed by 2-3 digits (strict) or 1-3 digits (loose)

### Examples That Match (INVALID - Strict Pattern)
- `J45.909` ✓ matches (3 decimals = US coding)
- `E86.01` ✓ matches (2 decimals = US coding)
- `R01.11` ✓ matches (2 decimals = US coding)
- `F41.11` ✓ matches (2 decimals = US coding)

### Examples That DON'T Match (VALID)
- `I10` ✗ no decimal = valid WHO
- `I11` ✗ no decimal = valid WHO
- `J45.9` ✗ only 1 decimal = likely valid WHO
- `M79.3` ✗ only 1 decimal = likely valid WHO
- `F41.1` ✗ only 1 decimal = likely valid WHO

---

## Validation Workflow

### Step 1: Identify Invalid Code
```bash
node scripts/validateDiagnosisCodes.js "J45.909"
```

### Step 2: Find WHO Equivalent
- Typically the code WITHOUT the specific subclassification
- `J45.909` → `J45.9` (remove final digit or two)
- `E86.0` → `E86`
- `R01.1` → `R01`

### Step 3: Verify in Reference
```bash
node scripts/validateDiagnosisCodes.js "J45.9"
# Should show: VALID (ICD-10 WHO)
```

### Step 4: Update in System
- Either:
  1. Manually correct in record
  2. Run audit cleanup script (nullify + manual re-entry)
  3. Import corrected batch file

---

## Common Patterns & How to Fix

### Pattern 1: Decimal Precision Too High
| Found | Should Be | Reason |
|-------|-----------|--------|
| E86.0 | E86 | ICD-10 WHO doesn't use this decimal level |
| E86.1 | E86 | ICD-10 WHO doesn't have subclass .1 |
| J45.909 | J45.9 | WHO version uses only single decimal |

**Fix:** Remove decimals beyond what's in WHO reference

### Pattern 2: Specific US Subclassifications
| Found | Should Be | Reason |
|-------|-----------|--------|
| I10 + subclass | I10 | ICD-10 WHO stops at I10 |
| R01.1 | R01 | WHO uses only R01 |
| M79.31 | M79.3 | WHO stops at first decimal |

**Fix:** Use base code without US-specific extensions

### Pattern 3: Format Inconsistency
| Found | Issue | Fix |
|-------|-------|-----|
| J45.909 | 3 decimals | Use J45.9 (2 max in WHO) |
| E86.01 | 2 decimals | Use E86 (WHO has no decimal) |
| "J45.909" | Quoted string | Remove quotes |

**Fix:** Strip extra decimal places, remove quotes

---

## Batch Correction Examples

### Using Validation Script
```bash
# Test multiple codes
node scripts/validateDiagnosisCodes.js "J45.909,E86.0,R01.1,I10"

# Output shows which are invalid and which WHO codes to use
```

### Creating Correction File
```csv
record_id,old_code,new_code
rec001,J45.909,J45.9
rec002,E86.0,E86
rec003,R01.1,R01
rec004,M79.31,M79.3
```

Then import this file via your API or database tool.

---

## ICD-10 WHO Reference Structure

Valid ICD-10 WHO codes follow these patterns:

### Single Letter Prefix with Variations
```
Letter + 2 digits [.optional_subclassification]

Examples:
I10             - Essential hypertension
I11             - Hypertensive heart disease
I50             - Heart failure
J45.9           - Asthma, unspecified
M79.3           - Panniculitis, unspecified
E86             - Dehydration
E11             - Type 2 diabetes mellitus
```

### No Fixed Decimal Rule in WHO
Unlike ICD-10-CM:
- WHO doesn't mandate decimal position
- WHO codes are variable length
- WHO codes are always validated against reference table

### Validation Process
1. Check format: Letter + 2 digits + optional decimals
2. Verify in icd10_who_codes reference table
3. Not all codes with 1-3 decimals are invalid
4. Use reference table as source of truth

---

## Quick Diagnosis Fixes

### Most Common Replacements
```
J45.909  → J45.9  (Asthma)
E86.0    → E86    (Dehydration)
R01.1    → R01    (Cardiac murmur)
M79.31   → M79.3  (Panniculitis)
I11.9    → I11    (Hypertensive disease)
E11.9    → E11    (Type 2 diabetes)
F41.1    → F41.1  (Anxiety - this is OK)
I50.9    → I50    (Heart failure)
L89.90   → L89.9  (Pressure ulcer)
```

### Testing Your Fixes
```bash
# Before fixing
node scripts/validateDiagnosisCodes.js "J45.909,E86.0"
# Output: 2 codes with ICD-10-CM format (INVALID)

# After fixing
node scripts/validateDiagnosisCodes.js "J45.9,E86"
# Output: All codes VALID
```

---

## Emergency Cleanup

### For Large Scale Issues

1. **Identify affected records:**
```bash
node scripts/auditOldData.js > audit-report.txt
```

2. **Review report:**
```bash
grep "J45.909\|E86.0\|R01.1" audit-report.txt
```

3. **Create fix file:**
```csv
record_id,diagnosis_list,new_diagnosis_list
rec001,"J45.909","J45.9"
rec002,"E86.0","E86"
```

4. **Apply fixes:**
- Option A: Database update via SQL
- Option B: API bulk update
- Option C: Run audit cleanup script

5. **Verify fixes:**
```bash
node scripts/auditOldData.js
# Should show 0 affected records
```

---

## Prevention Going Forward

1. **Add validation rule:**
```bash
node scripts/addValidationConstraint.js --apply
```

2. **Test prevention:**
```bash
node scripts/testAudit.js --create
# Creates test records - should be rejected or flagged

node scripts/auditOldData.js
# Should detect test records
```

3. **Monitor submissions:**
- Watch audit logs for new ICD-10-CM format codes
- Alert users when they try to use invalid codes
- Provide clear error messages with WHO code suggestions

---

## References & Additional Resources

### BPJS Documentation
- Official ICD-10 WHO code list for BPJS
- Approved diagnosis codes per claim type
- Submission format specifications

### WHO ICD-10 Reference
- https://www.who.int/standards/classifications/classification-of-diseases
- Official WHO ICD-10 (2019 version)
- Updates and corrections

### CMS ICD-10-CM (For Reference Only)
- https://www.cms.gov/Medicare/Coding/ICD10
- NOT for BPJS use
- Context for why codes need conversion

### eClaim Documentation
- Backend API endpoints for diagnosis codes
- icd10_who_codes table schema
- Validation rule configuration

---

## Troubleshooting

### "Code not found in reference"
- The code might be valid WHO but not in your local reference table
- Update reference table from official BPJS source
- Or add code to reference if verified valid

### "Format looks valid but still fails"
- Check for trailing/leading spaces: `" I10"` → `"I10"`
- Check for case issues: `"i10"` → `"I10"`
- Verify against reference table exactly

### "Multiple codes in one field"
- Separate with semicolon: `"J45.9; E86"`
- Script auto-detects and validates each code
- Each code is checked independently

### "Need to know which codes are used most"
Check audit report:
```bash
node scripts/auditOldData.js --report
# Review summary.by_code section
```

---

**Last Updated:** 2024-01-20
**For Questions:** Contact eClaim Development Team
