#!/usr/bin/env node

/**
 * Add Validation Constraint for ICD-10-CM Code Prevention
 *
 * This script adds/updates validation rules to prevent ICD-10-CM format codes
 * from being accepted during claim submission.
 *
 * ICD-10-CM format (INVALID for BPJS):
 *   - Pattern: Letter + 2 digits + dot + 1-3 digits (e.g., J45.909, E86.0)
 *
 * ICD-10 WHO format (VALID for BPJS):
 *   - Various patterns, typically validated against icd10_who_codes table
 *
 * Usage:
 *   node scripts/addValidationConstraint.js [--apply]
 *
 * Examples:
 *   # Preview validation rules (dry-run)
 *   node scripts/addValidationConstraint.js
 *
 *   # Actually apply validation rules
 *   node scripts/addValidationConstraint.js --apply
 */

const http = require('http');


const readline = require('readline');

// Configuration
const API_BASE = process.env.API_URL || 'http://localhost:5000/api/v1';
const AUTH_TOKEN = process.env.AUDIT_AUTH_TOKEN || '';

/**
 * Make HTTP request to backend API
 */
function apiRequest(endpoint, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, API_BASE);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(AUTH_TOKEN && { 'Authorization': `Bearer ${AUTH_TOKEN}` }),
      },
    };

    const protocol = url.protocol === 'https:' ? require('https') : http;
    const req = protocol.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(`API Error ${res.statusCode}: ${result.error || data}`));
          } else {
            resolve(result);
          }
        } catch  {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * Validation rules to add
 */
const VALIDATION_RULES = [
  {
    id: 'diagnosis_icd10cm_format_check',
    name: 'ICD-10-CM Format Check (INVALID)',
    description: 'Reject diagnosis codes with ICD-10-CM format (Letter + 2 digits + dot + 1-3 digits)',
    field: 'diagnosis_list',
    type: 'regex_pattern_rejection',
    pattern: '^[A-Z]\\d{2}\\.\\d{2,3}$', // 2-3 decimal digits = almost always US coding
    error_message: 'Diagnosis code format tidak valid untuk BPJS. Gunakan format ICD-10 WHO dari referensi pemerintah.',
    severity: 'critical',
    enabled: true,
    examples_invalid: [
      'J45.909',     // Unspecified asthma
      'E86.0',       // Dehydration
      'R01.1',       // Cardiac murmur
      'I10',         // Essential hypertension
      'M79.3',       // Panniculitis
      'F41.1',       // Generalized anxiety disorder
    ],
    examples_valid: [
      'I10',         // Essential hypertension (ICD-10 WHO)
      'E11',         // Type 2 diabetes mellitus
      'J45.9',       // Asthma, unspecified
      'M79.3',       // Other myofascitis
      'Z80.9',       // Family history of malignant neoplasm
    ],
    source: 'data-audit-icd10cm-cleanup',
    created_date: new Date().toISOString(),
  },

  {
    id: 'diagnosis_must_exist_in_icd10_who',
    name: 'Diagnosis Code Must Exist in ICD-10 WHO Reference',
    description: 'Only allow diagnosis codes that exist in the icd10_who_codes reference table',
    field: 'diagnosis_list',
    type: 'reference_table_validation',
    reference_table: 'icd10_who_codes',
    reference_field: 'code',
    error_message: 'Diagnosis code tidak ditemukan dalam referensi ICD-10 WHO yang sah untuk BPJS.',
    severity: 'critical',
    enabled: true,
    source: 'data-audit-icd10cm-cleanup',
    created_date: new Date().toISOString(),
  },

  {
    id: 'diagnosis_primary_format_check',
    name: 'Primary Diagnosis ICD-10-CM Format Check',
    description: 'Reject primary diagnosis code with ICD-10-CM format',
    field: 'diagnosis_primary',
    type: 'regex_pattern_rejection',
    pattern: '^[A-Z]\\d{2}\\.\\d{2,3}$', // 2-3 decimal digits = almost always US coding
    error_message: 'Diagnosis utama tidak boleh menggunakan format ICD-10-CM.',
    severity: 'critical',
    enabled: true,
    source: 'data-audit-icd10cm-cleanup',
    created_date: new Date().toISOString(),
  },

  {
    id: 'procedure_icd9cm_format_check',
    name: 'Procedure ICD-9-CM Format Check (INVALID for some cases)',
    description: 'Flag procedure codes with ICD-9-CM format (may need attention)',
    field: 'prosedur_list',
    type: 'regex_pattern_warning',
    pattern: '^\\d{2}\\.\\d{2}$',
    error_message: 'Procedure code format mungkin tidak sesuai standar BPJS terbaru. Periksa kembali.',
    severity: 'major',
    enabled: false, // Disabled by default - review needed
    source: 'data-audit-icd10cm-cleanup',
    created_date: new Date().toISOString(),
  },
];

/**
 * Database migration SQL (for future reference)
 */
const MIGRATION_SQL = `
-- Add validation rules for ICD-10-CM prevention
-- Run this SQL directly in your database if not using API

INSERT INTO validation_rules (
  id, name, description, field, type, pattern,
  error_message, severity, enabled, metadata
) VALUES
(
  'diagnosis_icd10cm_format_check',
  'ICD-10-CM Format Check (INVALID)',
  'Reject diagnosis codes with ICD-10-CM format',
  'diagnosis_list',
  'regex_pattern_rejection',
  '^[A-Z]\\\\d{2}\\\\.\\\\d{1,3}$',
  'Diagnosis code format tidak valid untuk BPJS. Gunakan format ICD-10 WHO.',
  'critical',
  true,
  '{"source":"data-audit-icd10cm-cleanup"}'
),
(
  'diagnosis_must_exist_in_icd10_who',
  'Diagnosis Code Must Exist in ICD-10 WHO Reference',
  'Only allow diagnosis codes that exist in icd10_who_codes table',
  'diagnosis_list',
  'reference_table_validation',
  NULL,
  'Diagnosis code tidak ditemukan dalam referensi ICD-10 WHO yang sah.',
  'critical',
  true,
  '{"reference_table":"icd10_who_codes","reference_field":"code","source":"data-audit-icd10cm-cleanup"}'
);

-- Add constraint to diagnosis_codes column if not exists
-- ALTER TABLE claim_records
-- ADD CONSTRAINT check_diagnosis_format
-- CHECK (diagnosis_list !~ '^[A-Z]\\\\d{2}\\\\.\\\\d{1,3}$');

-- Create validation audit log table if not exists
CREATE TABLE IF NOT EXISTS validation_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID REFERENCES claim_records(id),
  validation_rule_id VARCHAR(255),
  status VARCHAR(50),
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_validation_audit_log_record_id
ON validation_audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_validation_audit_log_rule_id
ON validation_audit_log(validation_rule_id);
`;

/**
 * Preview validation rules
 */
function previewRules() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('   Validation Rules Preview');
  console.log('═══════════════════════════════════════════════════════════════\n');

  VALIDATION_RULES.forEach((rule, idx) => {
    console.log(`${idx + 1}. ${rule.name}`);
    console.log(`   ID: ${rule.id}`);
    console.log(`   Field: ${rule.field}`);
    console.log(`   Type: ${rule.type}`);
    console.log(`   Severity: ${rule.severity}`);
    console.log(`   Enabled: ${rule.enabled ? '✓ Yes' : '✗ No'}`);
    console.log(`   Message: ${rule.error_message}`);

    if (rule.pattern) {
      console.log(`   Pattern: ${rule.pattern}`);
    }

    if (rule.examples_invalid) {
      console.log(`   Invalid Examples: ${rule.examples_invalid.join(', ')}`);
    }

    if (rule.examples_valid) {
      console.log(`   Valid Examples: ${rule.examples_valid.join(', ')}`);
    }

    console.log('');
  });
}

/**
 * Check existing validation rules
 */
async function checkExistingRules() {
  console.log('\nChecking existing validation rules...\n');

  try {
    const response = await apiRequest('/validation-rules');
    const existingRules = response.rules || response.data || [];

    const existingIds = new Set(existingRules.map(r => r.id));

    console.log(`Found ${existingRules.length} existing validation rules:\n`);

    VALIDATION_RULES.forEach(rule => {
      if (existingIds.has(rule.id)) {
        console.log(`  ✓ ${rule.id} (ALREADY EXISTS)`);
      } else {
        console.log(`  ✗ ${rule.id} (WILL BE ADDED)`);
      }
    });

    return existingIds;
  } catch (error) {
    console.warn('⚠️  Could not fetch existing rules:', error.message);
    console.log('    Continuing with full import...\n');
    return new Set();
  }
}

/**
 * Apply validation rules via API
 */
async function applyRules() {
  const existingIds = await checkExistingRules();

  console.log('\n' + '─'.repeat(65) + '\n');
  console.log('Applying validation rules...\n');

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;
  const errors = [];

  for (let i = 0; i < VALIDATION_RULES.length; i++) {
    const rule = VALIDATION_RULES[i];
    const progress = `[${i + 1}/${VALIDATION_RULES.length}]`;

    try {
      if (existingIds.has(rule.id)) {
        console.log(`${progress} ⊘ Skipped (already exists): ${rule.id}`);
        skipCount++;
        continue;
      }

      // Clean up fields not needed for API submission
      const ruleData = { ...rule };
      delete ruleData.examples_invalid;
      delete ruleData.examples_valid;

      await apiRequest('/validation-rules', 'POST', ruleData);
      console.log(`${progress} ✓ Created: ${rule.id}`);
      successCount++;
    } catch (error) {
      console.log(`${progress} ✗ Failed: ${rule.id}`);
      failCount++;
      errors.push({ rule_id: rule.id, error: error.message });
    }
  }

  console.log('\n' + '═'.repeat(65));
  console.log(`\nApplication Summary:`);
  console.log(`  Created: ${successCount}`);
  console.log(`  Skipped: ${skipCount}`);
  console.log(`  Failed: ${failCount}`);
  console.log(`  Total: ${VALIDATION_RULES.length}`);

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => {
      console.log(`  • ${e.rule_id}: ${e.error}`);
    });
  }

  console.log('\n✓ Validation rules have been applied!\n');
}

/**
 * Print usage
 */
function printUsage() {
  console.log(`
Usage: node scripts/addValidationConstraint.js [OPTIONS]

OPTIONS:
  --apply     Apply validation rules via API
  --help      Show this help message

EXAMPLES:
  # Preview validation rules (dry-run)
  node scripts/addValidationConstraint.js

  # Apply validation rules
  node scripts/addValidationConstraint.js --apply

ENVIRONMENT VARIABLES:
  API_URL               Backend API URL (default: http://localhost:5000/api/v1)
  AUDIT_AUTH_TOKEN      Authorization token for API calls

NOTES:
  - These rules will be enforced on all new diagnosis code submissions
  - Existing invalid codes can be cleaned up using auditOldData.js
  - For database-level constraints, see the SQL migration included in output
  `);
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const isApply = args.includes('--apply');

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('   Add ICD-10-CM Validation Constraint');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Show preview
  previewRules();

  if (isApply) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question('Apply these validation rules? (yes/no): ', async (answer) => {
      rl.close();

      if (answer.toLowerCase() === 'yes') {
        try {
          await applyRules();
        } catch (error) {
          console.error('❌ Error applying rules:', error.message);
          process.exit(1);
        }
      } else {
        console.log('❌ Application cancelled.');
        process.exit(0);
      }
    });
  } else {
    console.log('💡 To apply these rules, run:');
    console.log('   node scripts/addValidationConstraint.js --apply\n');

    console.log('SQL Migration (for database-level constraints):');
    console.log('─'.repeat(65));
    console.log(MIGRATION_SQL);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
