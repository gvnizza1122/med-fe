# eClaim ICD-10-CM Audit & Cleanup - Quick Start Guide

## What This Does

Identifies and removes **ICD-10-CM format diagnosis codes** (like `J45.909`, `E86.01`) from eClaim database and prevents them from being saved in the future.

### Problem
- eClaim production has claims with invalid **ICD-10-CM format codes**
- These codes are US-specific (Centers for Medicare & Medicaid)
- BPJS only accepts **ICD-10 WHO format codes**
- Invalid codes cause claim rejections and processing delays

### Solution
- **Audit** existing database for invalid codes
- **Report** how many claims are affected
- **Clean up** affected records (nullify or delete)
- **Prevent** future invalid submissions with validation rules

---

## 5-Minute Setup

### 1. Copy Scripts
```bash
# Scripts are already in: scripts/
ls scripts/auditOldData.js
ls scripts/addValidationConstraint.js
```

### 2. Check Backend Connection
```bash
# Verify backend API is running
curl http://localhost:5000/api/v1/records?limit=1
# Should return JSON response (no error)
```

### 3. Run Audit (Read-Only)
```bash
cd eclaim-production
node scripts/auditOldData.js
```

Output shows:
- How many records are affected
- Which diagnosis codes are problematic
- Severity assessment (LOW/MEDIUM/HIGH)

---

## Quick Examples

### Example 1: Audit Only
```bash
# Check for problems without making changes
node scripts/auditOldData.js

# Output:
# Audit Complete: Found 3 claim(s) with ICD-10-CM format codes
# 
# AUDIT SUMMARY
# ─────────────────────────────────────────
# Total records scanned:     10500
# Affected records:          3
# Affected percentage:       0.03%
# Severity level:            LOW
#
# SUSPECT CODES FOUND:
#   • J45.909: 1 occurrence(s)
#   • E86.01: 1 occurrence(s)
#   • F41.11: 1 occurrence(s)
```

### Example 2: Test Detection with Sample Data
```bash
# Run local detection test (no API needed)
node scripts/testAudit.js

# Output shows detection is 100% accurate
# ─────────────────────────────────────────
# Total codes analyzed: 10
# ICD-10-CM codes found: 6
# Detection accuracy: 100%
# Valid records: 1/5
# Invalid records: 4/5
```

### Example 3: Validate Specific Codes
```bash
# Check if specific codes are valid
node scripts/validateDiagnosisCodes.js "J45.909,E86.01,I10,E11"

# Output:
# 1. J45.909
#    Status: ✗ INVALID (ICD-10-CM)
#
# 2. E86.01
#    Status: ✗ INVALID (ICD-10-CM)
#
# 3. I10
#    Status: ✓ VALID (ICD-10 WHO)
#
# 4. E11
#    Status: ✓ VALID (ICD-10 WHO)
```

### Example 4: Preview Cleanup
```bash
# See which records would be affected
node scripts/auditOldData.js --cleanup

# Output: Shows exactly which 3 records would be changed
# CLEANUP PREVIEW (NULLIFY)
# ═══════════════════════════════════════════
# This action will NULLIFY diagnosis field in 3 record(s).
#
# Records to be updated:
#   1. ID: rec001 | Patient: John Doe
#      Current: "J45.909"
#      Will be set to: null
#
#   2. ID: rec002 | Patient: Jane Smith
#      Current: "E86.01"
#      Will be set to: null
#
#   3. ID: rec003 | Patient: Bob Johnson
#      Current: "F41.11"
#      Will be set to: null
```

### Example 5: Execute Cleanup (Nullify)
```bash
# Nullify diagnosis fields in affected records
node scripts/auditOldData.js --cleanup --option nullify --confirm

# Follow interactive prompt:
# 🔴 Are you ABSOLUTELY sure? This cannot be undone! (yes/no): yes
#
# Executing cleanup...
#
# [1/3] ✓ Nullified: rec001
# [2/3] ✓ Nullified: rec002
# [3/3] ✓ Nullified: rec003
#
# Cleanup Summary:
#   Successfully processed: 3
#   Failed: 0
```

### Example 6: Add Prevention Rules
```bash
# Add validation to prevent future invalid codes
node scripts/addValidationConstraint.js --apply

# Follow interactive prompt:
# Apply these validation rules? (yes/no): yes
#
# Applying validation rules...
#
# [1/3] ✓ Created: diagnosis_icd10cm_format_check
# [2/3] ✓ Created: diagnosis_must_exist_in_icd10_who
# [3/3] ✓ Created: diagnosis_primary_format_check
#
# ✓ Validation rules have been applied!
```

---

## Standard Workflow

### Step 1: Understand the Problem
```bash
node scripts/auditOldData.js
# Review affected count and severity
```

### Step 2: Generate Detailed Report
```bash
node scripts/auditOldData.js --report
# Review audit-results/audit-report-*.json
# See which diagnosis codes are most common
```

### Step 3: Test with Sample Data
```bash
node scripts/testAudit.js
# Verify detection works correctly
```

### Step 4: Preview Cleanup
```bash
node scripts/auditOldData.js --cleanup
# See exactly which records would be affected
```

### Step 5: Execute Cleanup
```bash
node scripts/auditOldData.js --cleanup --option nullify --confirm
# Choose: nullify (recommended) or delete
```

### Step 6: Add Prevention
```bash
node scripts/addValidationConstraint.js --apply
# Prevent similar issues in future
```

### Step 7: Verify Success
```bash
node scripts/auditOldData.js
# Should show: Affected records: 0
```

---

## File Guide

### Audit Scripts
| File | Purpose | Usage |
|------|---------|-------|
| `auditOldData.js` | Main audit & cleanup script | `node scripts/auditOldData.js` |
| `addValidationConstraint.js` | Add prevention rules | `node scripts/addValidationConstraint.js` |
| `validateDiagnosisCodes.js` | Validate single codes | `node scripts/validateDiagnosisCodes.js "I10"` |
| `testAudit.js` | Test detection accuracy | `node scripts/testAudit.js` |

### Documentation
| File | Purpose |
|------|---------|
| `README-AUDIT.md` | Complete reference guide |
| `REFERENCE-ICD10.md` | ICD-10-CM vs WHO codes reference |
| `QUICK-START.md` | This file |

### Output Directory
```
audit-results/
├── audit-report-{timestamp}.json      # Audit findings
├── cleanup-log-{timestamp}.json       # Cleanup results
└── test-records-{timestamp}.json      # Test data reference
```

---

## Common Codes

### Most Frequently Found (Invalid ICD-10-CM)
```
J45.909  → Replace with: J45.9     (Asthma)
E86.01   → Replace with: E86       (Dehydration)
F41.11   → Replace with: F41.1     (Anxiety)
R01.11   → Replace with: R01       (Cardiac murmur)
```

### Always Valid (ICD-10 WHO)
```
I10      (Essential hypertension)
E11      (Type 2 diabetes)
J45.9    (Asthma, unspecified)
M79.3    (Panniculitis)
F41.1    (Generalized anxiety)
```

For full code reference: See `REFERENCE-ICD10.md`

---

## Troubleshooting

### "Cannot connect to server"
```bash
# Check backend is running
curl http://localhost:5000/api/v1/records?limit=1

# If fails:
# - Verify backend service is running
# - Check API_URL environment variable
# - Ensure network connectivity
```

### "API Error 401: Unauthorized"
```bash
# Set authentication token
export AUDIT_AUTH_TOKEN="your-token-here"
node scripts/auditOldData.js
```

### "No records found"
```bash
# Verify database has data
curl http://localhost:5000/api/v1/records?limit=1

# If empty, create test data
node scripts/testAudit.js --create
```

### "Want to undo a cleanup?"
```bash
# Restore from database backup
pg_restore -U username -d database_name backup.sql
```

---

## Pattern Reference

### Invalid (Detected as ICD-10-CM)
```
Pattern: Letter + 2 digits + dot + 2-3 digits
Examples: J45.909, E86.01, F41.11, R01.11
Status: ❌ WILL BE FLAGGED
```

### Valid (Allowed)
```
Pattern A: Letter + 2 digits (no dot)
Examples: I10, E11, J45, M79
Status: ✓ PASS

Pattern B: Letter + 2 digits + dot + 1 digit
Examples: J45.9, M79.3, F41.1, R01
Status: ✓ PASS
```

---

## Help & Documentation

### Get Script Help
```bash
node scripts/auditOldData.js --help
node scripts/addValidationConstraint.js --help
node scripts/validateDiagnosisCodes.js --help
node scripts/testAudit.js --help
```

### View Detailed Docs
- **Complete Guide**: `scripts/README-AUDIT.md`
- **ICD-10 Reference**: `scripts/REFERENCE-ICD10.md`
- **This Guide**: `scripts/QUICK-START.md`

### Check Output Files
```bash
# View audit report
cat audit-results/audit-report-*.json | jq '.'

# View cleanup log
cat audit-results/cleanup-log-*.json | jq '.'

# List all output files
ls -la audit-results/
```

---

## Important Notes

⚠️ **Before Cleanup**
- Backup database first
- Review affected records in audit report
- Test with sample data
- Run preview (--cleanup) first

✓ **After Cleanup**
- Add validation rules to prevent recurrence
- Re-run audit to verify (should show 0 affected)
- Monitor new submissions for similar issues
- Consider ICD-10 WHO reference training

---

## Quick Decision Tree

```
Do you have ICD-10-CM codes in production?
├─ YES
│  ├─ Want to see how many? 
│  │  └─ node scripts/auditOldData.js
│  ├─ Want detailed report?
│  │  └─ node scripts/auditOldData.js --report
│  ├─ Want to fix them?
│  │  ├─ Preview first: node scripts/auditOldData.js --cleanup
│  │  └─ Then execute: node scripts/auditOldData.js --cleanup --option nullify --confirm
│  └─ Want to prevent future issues?
│     └─ node scripts/addValidationConstraint.js --apply
└─ NO
   └─ Consider adding prevention rules anyway:
      node scripts/addValidationConstraint.js --apply
```

---

## Next Steps

1. **Run audit**: See current status
2. **Review report**: Understand the scope
3. **Add prevention**: Prevent future issues
4. **Execute cleanup**: Fix existing data
5. **Verify success**: Confirm all fixed

---

**Status**: Production Ready
**Last Updated**: 2024-01-20
**Questions?**: Check README-AUDIT.md or REFERENCE-ICD10.md
