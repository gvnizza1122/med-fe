/**
 * @fileoverview Regression Test Runner untuk Firdan Case
 *
 * Cara kerja:
 * 1. Ekstrak data dari PDF dokumen klaim menggunakan backend API
 * 2. Bandingkan hasil ekstraksi dengan golden answers (firdan_case.json)
 * 3. Generate diff report (field mana yang berubah)
 * 4. Print hasil dalam format yang mudah dibaca
 *
 * Usage:
 *   npm run test:regression -- --sep=0170R0110926V001417
 *   npm run test:regression -- --fileId=<upload-batch-id>
 */

import * as fs from 'fs';
import * as path from 'path';

interface RegressionDiff {
  field: string;
  fieldType: 'salin' | 'turunan' | 'koding' | 'konfigurasi' | 'fakta_nol' | 'wajar_kosong';
  expected: any;
  actual: any;
  match: boolean;
  confidence?: number;
  severity: 'critical' | 'warning' | 'info';
}

interface RegressionReport {
  timestamp: string;
  sep: string;
  totalFields: number;
  matchedFields: number;
  diffCount: number;
  criticalErrors: number;
  warnings: number;
  diffs: RegressionDiff[];
  summary: string;
  recommendation: 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL';
}

/**
 * Load golden test data (baseline)
 */
export function loadGoldenData() {
  const filepath = path.join(__dirname, 'fixtures', 'firdan_case.json');
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
}

/**
 * Compare extracted data against golden answers
 */
export function compareData(
  extracted: Record<string, any>,
  golden: Record<string, any>,
  fieldType: string
): RegressionDiff[] {
  const diffs: RegressionDiff[] = [];

  Object.entries(golden).forEach(([field, goldenValue]: any) => {
    const extractedValue = extracted[field];

    // Determine if values match
    const match = deepEqual(extractedValue?.value || extractedValue, goldenValue.expected || goldenValue);

    if (!match) {
      let severity: 'critical' | 'warning' | 'info' = 'info';

      // Critical: mismatch dalam primary diagnosis, procedures, atau vital signs
      if (['DIAGLIST', 'PROCLIST', 'INACBG', 'HR', 'RR'].includes(field)) {
        severity = 'critical';
      }
      // Warning: mismatch dalam secondary fields atau tariffs
      else if (['DISCHARGE_STATUS', 'TARIF_INACBG', 'LOS'].includes(field)) {
        severity = 'warning';
      }

      diffs.push({
        field,
        fieldType: fieldType as any,
        expected: goldenValue.expected || goldenValue,
        actual: extractedValue?.value || extractedValue,
        match: false,
        confidence: extractedValue?.confidence,
        severity,
      });
    }
  });

  return diffs;
}

/**
 * Simple deep equality check
 */
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;

  if (typeof a === 'object') {
    if (Array.isArray(a) && Array.isArray(b)) {
      return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
    }
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    return keysA.length === keysB.length && keysA.every(k => deepEqual(a[k], b[k]));
  }

  return false;
}

/**
 * Generate regression report
 */
export function generateRegressionReport(
  extractedData: Record<string, any>,
  goldenData: Record<string, any>,
  sep: string
): RegressionReport {
  const allDiffs: RegressionDiff[] = [];
  let totalFields = 0;

  // Compare each field type
  Object.entries(goldenData.extracted_data).forEach(([fieldType, fields]: any) => {
    const extracted = extractedData[fieldType] || {};
    const diffs = compareData(extracted, fields, fieldType);
    allDiffs.push(...diffs);
    totalFields += Object.keys(fields).length;
  });

  const matchedFields = totalFields - allDiffs.length;
  const criticalErrors = allDiffs.filter(d => d.severity === 'critical').length;
  const warnings = allDiffs.filter(d => d.severity === 'warning').length;

  let recommendation: 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL' = 'PASS';
  if (criticalErrors > 0) {
    recommendation = 'FAIL';
  } else if (warnings > 0) {
    recommendation = 'PASS_WITH_WARNINGS';
  }

  const report: RegressionReport = {
    timestamp: new Date().toISOString(),
    sep,
    totalFields,
    matchedFields,
    diffCount: allDiffs.length,
    criticalErrors,
    warnings,
    diffs: allDiffs,
    summary: generateSummary(matchedFields, totalFields, criticalErrors, warnings),
    recommendation,
  };

  return report;
}

/**
 * Generate human-readable summary
 */
function generateSummary(
  matched: number,
  total: number,
  critical: number,
  warnings: number
): string {
  const percentage = ((matched / total) * 100).toFixed(1);
  const lines = [
    `Ekstraksi field: ${matched}/${total} cocok (${percentage}%)`,
  ];

  if (critical > 0) {
    lines.push(`KRITIS: ${critical} field tidak cocok (diagnosis, prosedur, atau vital sign)`);
  }
  if (warnings > 0) {
    lines.push(`PERINGATAN: ${warnings} field dengan perbedaan minor`);
  }

  return lines.join('\n');
}

/**
 * Print regression report to console
 */
export function printReport(report: RegressionReport): void {
  console.log('\n' + '='.repeat(80));
  console.log(`REGRESSION TEST REPORT — Firdan Case (SEP ${report.sep})`);
  console.log('='.repeat(80));
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`Status: ${report.recommendation}`);
  console.log('');

  console.log('SUMMARY:');
  console.log(report.summary);
  console.log('');

  if (report.diffs.length > 0) {
    console.log('DIFFS (Field Mismatches):');
    console.log('-'.repeat(80));

    // Group by severity
    const byType = {
      critical: report.diffs.filter(d => d.severity === 'critical'),
      warning: report.diffs.filter(d => d.severity === 'warning'),
      info: report.diffs.filter(d => d.severity === 'info'),
    };

    Object.entries(byType).forEach(([severity, diffs]) => {
      if (diffs.length > 0) {
        console.log(`\n${severity.toUpperCase()}:`);
        diffs.forEach(diff => {
          console.log(`  • ${diff.fieldType}.${diff.field}`);
          console.log(`    Expected: ${JSON.stringify(diff.expected)}`);
          console.log(`    Actual:   ${JSON.stringify(diff.actual)}`);
          if (diff.confidence !== undefined) {
            console.log(`    Confidence: ${(diff.confidence * 100).toFixed(0)}%`);
          }
        });
      }
    });
  } else {
    console.log('✓ Semua field cocok dengan golden answers!');
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Save report to JSON file
 */
export function saveReport(
  report: RegressionReport,
  outputDir: string = path.join(__dirname, '../reports')
): string {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filename = `regression_${report.sep}_${new Date().toISOString().split('T')[0]}.json`;
  const filepath = path.join(outputDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
  console.log(`Report saved to: ${filepath}`);

  return filepath;
}

/**
 * Main entry point for regression testing
 *
 * Usage:
 *   runRegressionTest({ extractedData: {...}, sep: '0170R0110926V001417' })
 */
export async function runRegressionTest(options: {
  extractedData: Record<string, any>;
  sep: string;
  outputDir?: string;
  verbose?: boolean;
}): Promise<RegressionReport> {
  const golden = loadGoldenData();
  const report = generateRegressionReport(options.extractedData, golden, options.sep);

  if (options.verbose !== false) {
    printReport(report);
  }

  if (options.outputDir) {
    saveReport(report, options.outputDir);
  }

  return report;
}

/**
 * Test helper untuk integration tests
 */
export function assertRegressionPassed(report: RegressionReport, maxWarnings = 0): void {
  if (report.recommendation === 'FAIL') {
    const criticalList = report.diffs
      .filter(d => d.severity === 'critical')
      .map(d => `${d.fieldType}.${d.field}`)
      .join(', ');
    throw new Error(`Regression test FAILED: Critical field mismatch in ${criticalList}`);
  }

  if (report.recommendation === 'PASS_WITH_WARNINGS' && report.warnings > maxWarnings) {
    throw new Error(`Regression test has ${report.warnings} warnings (max allowed: ${maxWarnings})`);
  }
}
