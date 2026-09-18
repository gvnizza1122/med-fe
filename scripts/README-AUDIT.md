# eClaim ICD-10-CM Code Audit & Cleanup Tools

Complete toolkit for auditing and cleaning up incorrect ICD-10-CM diagnosis codes in the eClaim system.

## Overview

This toolkit helps identify, report, and remove claims that contain **ICD-10-CM format codes** (e.g., `J45.909`, `E86.0`) which are invalid for BPJS claims. Only **ICD-10 WHO format codes** are accepted.

### Key Differences

| Aspect | ICD-10-CM (INVALID for BPJS) | ICD-10 WHO (VALID for BPJS) |
|--------|-------|---------|
| Format | Letter + 2 digits + dot + 1-3 digits | Various formats validated against reference table |
| Examples | `J45.909`, `E86.0`, `R01.1` | `I10`, `E11`, `J45.9` |
| Source | USA (Centers for Medicare & Medicaid) | WHO (World Health Organization) |
| Compliance | Not BPJS compliant | Required for BPJS |

## Tools

### 1. `auditOldData.js` - Main Audit & Cleanup Script

Scans database for invalid ICD-10-CM format codes and generates reports.

#### Usage

```bash
# Audit only (no changes)
node scripts/auditOldData.js

# Generate detailed report
node scripts/auditOldData.js --report

# Preview cleanup (dry-run, no changes)
node scripts/auditOldData.js --cleanup

# Nullify diagnosis field in affected records (REQUIRES CONFIRMATION)
node scripts/auditOldData.js --cleanup --option nullify --confirm

# Delete affected claims entirely (REQUIRES CONFIRMATION)
node scripts/auditOldData.js --cleanup --option delete --confirm

# Show help
node scripts/auditOldData.js --help
```

#### Output Files

Generated in `audit-results/` directory:

- `audit-report-{timestamp}.json` - Detailed audit report with all findings
- `cleanup-log-{timestamp}.json` - Log of cleanup actions taken

#### Report Contents

Each audit report includes:

```json
{
  "timestamp": "2024-01-20T10:30:00.000Z",
  "total_records_scanned": 10500,
  "affected_records_count": 3,
  "affected_percentage": "0.03",
  "severity": "LOW",
  "details": [
    {
      "record_id": "abc123",
      "patient_name": "John Doe",
      "patient_no": "MRN001",
      "admission_date": "2024-01-15",
      "file_id": "file001",
      "issues": [
        {
          "type": "icd10cm_format",
          "field": "diagnosis_list",
          "value": "J45.909",
          "suspect_codes": ["J45.909"],
          "all_codes": ["J45.909"]
        }
      ]
    }
  ],
  "summary": {
    "total_issues": 3,
    "by_field": {
      "diagnosis_list": 3
    },
    "by_code": {
      "J45.909": 1,
      "E86.0": 1,
      "R01.1": 1
    }
  }
}
```

#### Cleanup Options

**Option A: Nullify (Recommended)**
```bash
node scripts/auditOldData.js --cleanup --option nullify --confirm
```
- Sets `diagnosis_list` field to `NULL`
- Allows re-entry of correct ICD-10 WHO codes
- Less data loss
- Flags record for re-verification

**Option B: Delete**
```bash
node scripts/auditOldData.js --cleanup --option delete --confirm
```
- Removes entire claim record
- Complete data removal
- Use only if duplicates exist
- Cannot be undone

### 2. `addValidationConstraint.js` - Add Prevention Rules

Adds validation rules to the database to prevent future ICD-10-CM code submissions.

#### Usage

```bash
# Preview validation rules (dry-run)
node scripts/addValidationConstraint.js

# Apply validation rules
node scripts/addValidationConstraint.js --apply

# Show help
node scripts/addValidationConstraint.js --help
```

#### Rules Added

1. **Diagnosis ICD-10-CM Format Check**
   - Field: `diagnosis_list`
   - Pattern: `^[A-Z]\d{2}\.\d{1,3}$`
   - Severity: Critical
   - Action: Reject submission

2. **Diagnosis Code Must Exist in ICD-10 WHO Reference**
   - Field: `diagnosis_list`
   - Validates against: `icd10_who_codes` table
   - Severity: Critical
   - Action: Reject unknown codes

3. **Primary Diagnosis ICD-10-CM Format Check**
   - Field: `diagnosis_primary`
   - Pattern: `^[A-Z]\d{2}\.\d{1,3}$`
   - Severity: Critical
   - Action: Reject submission

#### Database Migration SQL

For direct database implementation, use the SQL provided in the script output:

```sql
INSERT INTO validation_rules (
  id, name, description, field, type, pattern, 
  error_message, severity, enabled
) VALUES (
  'diagnosis_icd10cm_format_check',
  'ICD-10-CM Format Check (INVALID)',
  'Reject diagnosis codes with ICD-10-CM format',
  'diagnosis_list',
  'regex_pattern_rejection',
  '^[A-Z]\d{2}\.\d{1,3}$',
  'Diagnosis code format tidak valid untuk BPJS.',
  'critical',
  true
);
```

### 3. `testAudit.js` - Test & Verification Script

Creates test records with known ICD-10-CM codes to verify audit functionality.

#### Usage

```bash
# Run detection test (local, no API needed)
node scripts/testAudit.js

# Create test records in database
node scripts/testAudit.js --create

# Delete test records
node scripts/testAudit.js --cleanup

# Show help
node scripts/testAudit.js --help
```

#### Test Data Included

- `J45.909` - Unspecified asthma (ICD-10-CM)
- `E86.0` - Dehydration (ICD-10-CM)
- `R01.1` - Cardiac murmur (ICD-10-CM)
- `M79.3` - Panniculitis (ICD-10-CM)
- Mixed ICD-10 WHO codes (should pass validation)

#### Test Workflow

```bash
# 1. Run detection test
node scripts/testAudit.js
# Output shows detection accuracy with test data

# 2. Create test records
node scripts/testAudit.js --create
# Creates 5 test claims with known invalid codes

# 3. Run audit to verify detection
node scripts/auditOldData.js --report
# Should find exactly 5 affected records

# 4. Verify cleanup detection
node scripts/auditOldData.js --cleanup
# Preview shows 5 records to be cleaned

# 5. Clean up test records
node scripts/testAudit.js --cleanup
# Removes test data from database
```

## Environment Variables

All scripts support these environment variables:

```bash
# Backend API endpoint
export API_URL=http://localhost:5000/api/v1

# Authorization token (if required)
export AUDIT_AUTH_TOKEN=your-bearer-token-here
```

### Default Values

If not set:
- `API_URL`: `http://localhost:5000/api/v1`
- `AUDIT_AUTH_TOKEN`: (empty - no authentication)

## Running the Complete Workflow

### Step 1: Audit Existing Data

```bash
node scripts/auditOldData.js
```

This generates a report without making any changes. Review the output to understand:
- How many records are affected
- Which diagnosis codes are problematic
- Severity assessment

### Step 2: Generate Detailed Report

```bash
node scripts/auditOldData.js --report
```

Generates a JSON report file in `audit-results/` directory for further analysis.

### Step 3: Preview Cleanup

```bash
node scripts/auditOldData.js --cleanup
```

Shows exactly which records would be affected and what changes would be made (dry-run, no changes).

### Step 4: Choose Cleanup Strategy

**If records are duplicates or truly invalid:**
```bash
node scripts/auditOldData.js --cleanup --option delete --confirm
```

**If records might need re-verification (RECOMMENDED):**
```bash
node scripts/auditOldData.js --cleanup --option nullify --confirm
```

### Step 5: Add Prevention Rules

```bash
node scripts/addValidationConstraint.js --apply
```

This prevents similar issues from occurring in future submissions.

### Step 6: Verify with Test Data

```bash
# Create test records
node scripts/testAudit.js --create

# Run audit (should find test records)
node scripts/auditOldData.js

# Clean up test records
node scripts/testAudit.js --cleanup
```

## Recommendations

### General

✓ **Always audit first** before making changes
✓ **Review the detailed report** for context
✓ **Test with sample data** before production use
✓ **Backup database** before cleanup operations
✓ **Add prevention rules** immediately after cleanup

### Cleanup Strategy

✓ **Use Nullify** if:
  - Records might contain valid information
  - You want to allow re-entry of correct codes
  - Records need verification review

✓ **Use Delete** if:
  - Records are confirmed as duplicates
  - You have verified there's no loss of information
  - Records were test/demo data

### Backup & Recovery

Before cleanup operations:

```bash
# PostgreSQL
pg_dump -U username -d database_name > backup-$(date +%Y%m%d-%H%M%S).sql

# MongoDB
mongodump --db database_name --out backup-$(date +%Y%m%d-%H%M%S)
```

## Error Handling

### Common Errors

**"Tidak dapat terhubung ke server"**
- Verify backend API is running
- Check `API_URL` environment variable
- Ensure network connectivity

**"API Error 401: Unauthorized"**
- Verify `AUDIT_AUTH_TOKEN` if required
- Check if token is still valid
- Refresh token if expired

**"Diagnosis code tidak ditemukan dalam referensi"**
- Code doesn't exist in ICD-10 WHO reference table
- May need to be added to reference database first
- Contact administrator for code validation

### Troubleshooting

1. **Check API connectivity:**
```bash
curl http://localhost:5000/api/v1/records?limit=1
```

2. **View audit output:**
```bash
cat audit-results/audit-report-*.json | jq '.'
```

3. **Test detection locally:**
```bash
node scripts/testAudit.js
```

## Performance Considerations

- **Large databases (>50,000 records):** May take 5-30 minutes
- **Cleanup operations:** ~10 records per second
- **Database:** No locks held; operations are safe for production
- **Network:** Requires stable connection to backend API

### Optimization Tips

1. **Batch processing:** Run during off-peak hours
2. **Monitor progress:** Check output in real-time
3. **Checkpoint:** Can safely interrupt and resume
4. **Parallel cleanup:** Run on multiple servers (verify coordination)

## Logging & Monitoring

### Audit Logs

All operations are logged:
- `audit-results/audit-report-{timestamp}.json` - Audit findings
- `audit-results/cleanup-log-{timestamp}.json` - Cleanup results
- `audit-results/test-records-{timestamp}.json` - Test data reference

### Reviewing Logs

```bash
# View latest audit report
cat audit-results/audit-report-*.json | tail -1 | jq '.summary'

# Count affected records
jq '.affected_records_count' audit-results/audit-report-*.json

# List problematic codes
jq '.summary.by_code' audit-results/audit-report-*.json | jq 'keys'
```

## FAQ

**Q: Will this affect valid claims?**
A: No. Only claims with ICD-10-CM format codes are flagged. Valid ICD-10 WHO codes pass through.

**Q: Can I run this on a live production database?**
A: Yes, audit is read-only. Cleanup requires explicit `--confirm` flag. Backup first anyway.

**Q: What happens if a code is both in diagnosis_list and diagnosis_primary?**
A: Each field is checked separately; both would be affected by cleanup.

**Q: How do I know if my codes are ICD-10 WHO?**
A: Check against the backend's `icd10_who_codes` reference table or validate with BPJS documentation.

**Q: Can I undo a cleanup operation?**
A: Not automatically. Restore from database backup if needed.

**Q: How long does cleanup take?**
A: Approximately 10 records per second depending on network and database performance.

## Support

For issues or questions:

1. Check logs in `audit-results/` directory
2. Review error messages in console output
3. Consult backend API logs
4. Contact system administrator

## Version History

- **v1.0** (2024-01-20): Initial release
  - Audit ICD-10-CM format codes
  - Nullify or delete affected records
  - Add prevention validation rules
  - Test suite with sample data

## References

- **ICD-10-CM**: https://www.cms.gov/Medicare/Coding/ICD10
- **ICD-10 WHO**: https://www.who.int/standards/classifications/classification-of-diseases
- **BPJS Standards**: Check BPJS documentation for approved code formats

---

**Last Updated:** 2024-01-20
**Status:** Production Ready
**Author:** eClaim Development Team
