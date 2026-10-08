#!/usr/bin/env node

/**
 * Audit Script: ICD-10-CM Code Detection and Cleanup
 *
 * Purpose:
 * - Scan all claims in the database
 * - Identify diagnosis codes with ICD-10-CM format (e.g., J45.909, E86.0)
 * - Flag invalid codes that don't match ICD-10 WHO standard
 * - Generate comprehensive report
 * - Provide cleanup options (delete or nullify diagnosis field)
 *
 * Usage:
 *   node scripts/auditOldData.js [--report] [--cleanup] [--option delete|nullify]
 *
 * Examples:
 *   # Audit only (no changes)
 *   node scripts/auditOldData.js
 *
 *   # Generate detailed report
 *   node scripts/auditOldData.js --report
 *
 *   # Show what would be cleaned up (dry-run)
 *   node scripts/auditOldData.js --cleanup
 *
 *   # Actually delete affected claims
 *   node scripts/auditOldData.js --cleanup --option delete --confirm
 *
 *   # Actually nullify diagnosis field
 *   node scripts/auditOldData.js --cleanup --option nullify --confirm
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration
const API_BASE = process.env.API_URL || 'http://localhost:5000/api/v1';
const AUTH_TOKEN = process.env.AUDIT_AUTH_TOKEN || '';
const BATCH_SIZE = 100;
const OUTPUT_DIR = path.join(__dirname, '..', 'audit-results');

// ICD-10-CM detection patterns
// ICD-10-CM format: Letter + 2 digits + dot + 2-3 digits (e.g., J45.909, E86.01, R01.11)
// ICD-10 WHO: Either no decimal (I10, E11) OR decimal with 1-2 digits (J45.9, M79.3)
// High-confidence ICD-10-CM detection: 2+ digits after decimal (almost always US coding)
const ICD10CM_PATTERN_STRICT = /^[A-Z]\d{2}\.\d{2,3}$/; // Only matches .XX or .XXX (US specific)
const ICD10CM_PATTERN_LOOSE = /^[A-Z]\d{2}\.\d{1,3}$/;   // Also matches .X (less specific)

// Common ICD-10-CM codes that should not be in BPJS system


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
 * Extract diagnosis codes from a diagnosis string
 * Diagnosis list format can vary: "J45.909; E86.0" or comma-separated, etc.
 */
function extractDiagnosisCodes(diagnosisStr) {
  if (!diagnosisStr || typeof diagnosisStr !== 'string') return [];

  // Split by common delimiters
  const codes = diagnosisStr
    .split(/[;,\n]/)
    .map(c => c.trim().toUpperCase())
    .filter(c => c && c.length > 0);

  return codes;
}

/**
 * Check if a code matches ICD-10-CM pattern
 * Uses strict pattern: 2+ decimal digits are almost always US coding
 */
function isICD10CMFormat(code, strict = true) {
  const pattern = strict ? ICD10CM_PATTERN_STRICT : ICD10CM_PATTERN_LOOSE;
  return pattern.test(code);
}

/**
 * Analyze a single claim record for ICD-10-CM codes
 */
function analyzeRecord(record) {
  const issues = [];

  // Check diagnosis_list field
  const diagnosisList = record.diagnosa_list || record.diagnosis_list || '';
  if (diagnosisList) {
    const codes = extractDiagnosisCodes(diagnosisList);
    const suspectCodes = codes.filter(code => isICD10CMFormat(code));

    if (suspectCodes.length > 0) {
      issues.push({
        type: 'icd10cm_format',
        field: 'diagnosis_list',
        value: diagnosisList,
        suspect_codes: suspectCodes,
        all_codes: codes,
      });
    }
  }

  // Check individual diagnosis codes if they exist as separate fields
  ['diagnosis_primary', 'diagnosis_utama', 'diagnosis_1'].forEach(field => {
    const code = record[field];
    if (code && isICD10CMFormat(code)) {
      issues.push({
        type: 'icd10cm_format',
        field: field,
        value: code,
        suspect_codes: [code],
      });
    }
  });

  return issues;
}

/**
 * Fetch all claims with pagination
 */
async function fetchAllClaims() {
  console.log('Fetching all claims from database...');
  const allRecords = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    try {
      console.log(`  Fetching page ${page}...`);
      const response = await apiRequest(`/records?page=${page}&limit=${BATCH_SIZE}`);

      if (response.records && response.records.length > 0) {
        allRecords.push(...response.records);
        page++;
        hasMore = response.records.length === BATCH_SIZE;
      } else {
        hasMore = false;
      }
    } catch (error) {
      console.error(`Error fetching page ${page}:`, error.message);
      if (page === 1) throw error; // Fail if first page fails
      break; // Continue with what we have
    }
  }

  console.log(`Total records fetched: ${allRecords.length}`);
  return allRecords;
}

/**
 * Run the complete audit
 */
async function runAudit() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('   eClaim ICD-10-CM Code Audit & Cleanup Script');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    // Create output directory
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Fetch all claims
    const allRecords = await fetchAllClaims();

    // Analyze each record
    console.log('\nAnalyzing records for ICD-10-CM codes...');
    const affectedRecords = [];
    const analysisMap = new Map();

    allRecords.forEach(record => {
      const issues = analyzeRecord(record);
      if (issues.length > 0) {
        affectedRecords.push({
          record_id: record.id || record.record_id,
          file_id: record.file_id,
          patient_name: record.nama_pasien || record.patient_name || 'N/A',
          patient_no: record.mrn || record.no_pasien || 'N/A',
          admission_date: record.admission_date,
          issues: issues,
        });
        analysisMap.set(record.id || record.record_id, issues);
      }
    });

    // Generate report
    console.log(`\nAudit Complete: Found ${affectedRecords.length} claim(s) with ICD-10-CM format codes\n`);

    // Detailed report
    const report = {
      timestamp: new Date().toISOString(),
      total_records_scanned: allRecords.length,
      affected_records_count: affectedRecords.length,
      affected_percentage: ((affectedRecords.length / allRecords.length) * 100).toFixed(2),
      severity: affectedRecords.length === 0 ? 'LOW' : affectedRecords.length <= 3 ? 'MEDIUM' : 'HIGH',
      details: affectedRecords,
      summary: {
        total_issues: affectedRecords.reduce((sum, r) => sum + r.issues.length, 0),
        by_field: {},
        by_code: {},
      },
    };

    // Calculate statistics
    affectedRecords.forEach(record => {
      record.issues.forEach(issue => {
        // By field
        if (!report.summary.by_field[issue.field]) {
          report.summary.by_field[issue.field] = 0;
        }
        report.summary.by_field[issue.field]++;

        // By code
        issue.suspect_codes.forEach(code => {
          if (!report.summary.by_code[code]) {
            report.summary.by_code[code] = 0;
          }
          report.summary.by_code[code]++;
        });
      });
    });

    // Save detailed report
    const reportPath = path.join(OUTPUT_DIR, `audit-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📋 Detailed report saved: ${reportPath}\n`);

    // Print summary
    console.log('AUDIT SUMMARY');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`Total records scanned:     ${report.total_records_scanned}`);
    console.log(`Affected records:          ${report.affected_records_count}`);
    console.log(`Affected percentage:       ${report.affected_percentage}%`);
    console.log(`Severity level:            ${report.severity}`);
    console.log(`Total issues found:        ${report.summary.total_issues}`);
    console.log('');

    if (Object.keys(report.summary.by_code).length > 0) {
      console.log('SUSPECT CODES FOUND:');
      Object.entries(report.summary.by_code)
        .sort((a, b) => b[1] - a[1])
        .forEach(([code, count]) => {
          console.log(`  • ${code}: ${count} occurrence(s)`);
        });
      console.log('');
    }

    if (Object.keys(report.summary.by_field).length > 0) {
      console.log('AFFECTED FIELDS:');
      Object.entries(report.summary.by_field)
        .sort((a, b) => b[1] - a[1])
        .forEach(([field, count]) => {
          console.log(`  • ${field}: ${count} record(s)`);
        });
      console.log('');
    }

    // Show sample affected records
    if (affectedRecords.length > 0) {
      console.log('SAMPLE AFFECTED RECORDS (first 5):');
      console.log('─────────────────────────────────────────────────────────────');
      affectedRecords.slice(0, 5).forEach((record, idx) => {
        console.log(`\n${idx + 1}. Record ID: ${record.record_id}`);
        console.log(`   Patient: ${record.patient_name} (${record.patient_no})`);
        console.log(`   Admission: ${record.admission_date}`);
        console.log(`   File ID: ${record.file_id}`);
        record.issues.forEach(issue => {
          console.log(`   Issue: ${issue.type} in field "${issue.field}"`);
          console.log(`     Codes: ${issue.suspect_codes.join(', ')}`);
          console.log(`     Value: ${issue.value}`);
        });
      });
      console.log('');
    }

    return { success: true, report, affectedRecords };
  } catch (error) {
    console.error('\n❌ Audit failed:', error.message);
    console.error('\nNote: Make sure the backend API is running at:', API_BASE);
    console.error('Set API_URL and AUDIT_AUTH_TOKEN environment variables if needed.');
    process.exit(1);
  }
}

/**
 * Preview cleanup action
 */
async function previewCleanup(affectedRecords, option = 'nullify') {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`   CLEANUP PREVIEW (${option.toUpperCase()})`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (option === 'delete') {
    console.log(`This action will DELETE ${affectedRecords.length} claim record(s).`);
    console.log('');
    console.log('Records to be deleted:');
    affectedRecords.forEach((record, idx) => {
      console.log(`  ${idx + 1}. ID: ${record.record_id} | Patient: ${record.patient_name}`);
    });
  } else if (option === 'nullify') {
    console.log(`This action will NULLIFY diagnosis field in ${affectedRecords.length} record(s).`);
    console.log('');
    console.log('Records to be updated:');
    affectedRecords.forEach((record, idx) => {
      const currentValues = record.issues
        .map(i => `"${i.value}"`)
        .join(', ');
      console.log(`  ${idx + 1}. ID: ${record.record_id}`);
      console.log(`     Current: ${currentValues}`);
      console.log(`     Will be set to: null`);
    });
  }

  console.log('\n⚠️  This action CANNOT be undone!');
  console.log('');
}

/**
 * Execute cleanup
 */
async function executeCleanup(affectedRecords, option = 'nullify', confirm = false) {
  if (!confirm) {
    console.log('\n❌ Cleanup aborted: --confirm flag required');
    console.log('Run with: --cleanup --option [delete|nullify] --confirm');
    process.exit(1);
  }

  console.log('\nExecuting cleanup...\n');

  let successCount = 0;
  let failCount = 0;
  const errors = [];

  for (let i = 0; i < affectedRecords.length; i++) {
    const record = affectedRecords[i];
    const progress = `[${i + 1}/${affectedRecords.length}]`;

    try {
      if (option === 'delete') {
        await apiRequest(`/records/${record.record_id}`, 'DELETE');
        console.log(`${progress} ✓ Deleted: ${record.record_id}`);
        successCount++;
      } else if (option === 'nullify') {
        await apiRequest(`/records/${record.record_id}`, 'PATCH', {
          diagnosis_list: null,
          diagnosa_list: null,
        });
        console.log(`${progress} ✓ Nullified: ${record.record_id}`);
        successCount++;
      }
    } catch (error) {
      console.log(`${progress} ✗ Failed: ${record.record_id}`);
      failCount++;
      errors.push({ record_id: record.record_id, error: error.message });
    }
  }

  console.log('\n' + '═'.repeat(65));
  console.log(`\nCleanup Summary:`);
  console.log(`  Successfully processed: ${successCount}`);
  console.log(`  Failed: ${failCount}`);
  console.log(`  Total: ${successCount + failCount}`);

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => {
      console.log(`  • ${e.record_id}: ${e.error}`);
    });
  }

  console.log('');

  // Save cleanup log
  const cleanupLog = {
    timestamp: new Date().toISOString(),
    option: option,
    total: affectedRecords.length,
    succeeded: successCount,
    failed: failCount,
    errors: errors,
  };

  const logPath = path.join(OUTPUT_DIR, `cleanup-log-${Date.now()}.json`);
  fs.writeFileSync(logPath, JSON.stringify(cleanupLog, null, 2));
  console.log(`📋 Cleanup log saved: ${logPath}`);
}

/**
 * Print usage information
 */
function printUsage() {
  console.log(`
Usage: node scripts/auditOldData.js [OPTIONS]

OPTIONS:
  --report              Generate detailed report (default: false)
  --cleanup             Preview cleanup actions (dry-run, no changes)
  --option <type>       Cleanup strategy: 'delete' or 'nullify' (default: nullify)
  --confirm             Execute cleanup (REQUIRED for actual changes)
  --help                Show this help message

EXAMPLES:
  # Audit only (no changes)
  node scripts/auditOldData.js

  # Generate detailed report
  node scripts/auditOldData.js --report

  # Preview cleanup (dry-run)
  node scripts/auditOldData.js --cleanup

  # Delete affected claims
  node scripts/auditOldData.js --cleanup --option delete --confirm

  # Nullify diagnosis field (default)
  node scripts/auditOldData.js --cleanup --option nullify --confirm

ENVIRONMENT VARIABLES:
  API_URL               Backend API URL (default: http://localhost:5000/api/v1)
  AUDIT_AUTH_TOKEN      Authorization token for API calls
  `);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }


  const isCleanup = args.includes('--cleanup');
  const optionIdx = args.indexOf('--option');
  const option = optionIdx >= 0 ? args[optionIdx + 1] : 'nullify';
  const isConfirm = args.includes('--confirm');

  // Validate option
  if (['delete', 'nullify'].indexOf(option) === -1) {
    console.error('❌ Invalid --option value. Must be "delete" or "nullify"');
    process.exit(1);
  }

  // Run audit
  const { affectedRecords } = await runAudit();

  // Handle cleanup if requested
  if (isCleanup) {
    previewCleanup(affectedRecords, option);

    if (isConfirm) {
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question('🔴 Are you ABSOLUTELY sure? This cannot be undone! (yes/no): ', async (answer) => {
        rl.close();

        if (answer.toLowerCase() === 'yes') {
          await executeCleanup(affectedRecords, option, true);
        } else {
          console.log('❌ Cleanup cancelled.');
          process.exit(1);
        }
      });
    } else {
      console.log('\n💡 To execute this cleanup, run:');
      console.log(`   node scripts/auditOldData.js --cleanup --option ${option} --confirm`);
    }
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
