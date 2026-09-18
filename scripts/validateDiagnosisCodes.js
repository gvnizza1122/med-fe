#!/usr/bin/env node

/**
 * Diagnosis Code Validation Utility
 *
 * Validates diagnosis codes against ICD-10 WHO reference and checks format compliance.
 *
 * Usage:
 *   node scripts/validateDiagnosisCodes.js <codes> [--ref-file <path>]
 *
 * Examples:
 *   # Check single code
 *   node scripts/validateDiagnosisCodes.js "J45.909"
 *
 *   # Check multiple codes (comma-separated)
 *   node scripts/validateDiagnosisCodes.js "J45.909,E86.0,I10"
 *
 *   # Check against custom reference file
 *   node scripts/validateDiagnosisCodes.js "I10,E11" --ref-file ./icd10-codes.json
 *
 *   # Batch validation from file
 *   node scripts/validateDiagnosisCodes.js --from-file codes.txt
 *
 *   # Test diagnosis string format
 *   node scripts/validateDiagnosisCodes.js "J45.909; E86.0; R01.1"
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// Configuration
const API_BASE = process.env.API_URL || 'http://localhost:5000/api/v1';
const AUTH_TOKEN = process.env.AUDIT_AUTH_TOKEN || '';

/**
 * ICD-10-CM Pattern Detection
 * Strict: 2-3 decimal digits = almost always US coding
 * Loose: 1-3 decimal digits = includes some valid WHO codes
 */
const ICD10CM_PATTERN_STRICT = /^[A-Z]\d{2}\.\d{2,3}$/;
const ICD10CM_PATTERN_LOOSE = /^[A-Z]\d{2}\.\d{1,3}$/;

function isICD10CMFormat(code, strict = true) {
  const pattern = strict ? ICD10CM_PATTERN_STRICT : ICD10CM_PATTERN_LOOSE;
  return pattern.test(code.trim().toUpperCase());
}

/**
 * Extract diagnosis codes from string
 */
function extractCodes(diagStr) {
  return diagStr
    .split(/[;,\n]/)
    .map(c => c.trim().toUpperCase())
    .filter(c => c && c.length > 0);
}

/**
 * Get valid ICD-10 WHO codes from backend
 */
function fetchICD10WHOCodes() {
  return new Promise((resolve, reject) => {
    const url = new URL('/icd10-codes', API_BASE);
    const options = {
      method: 'GET',
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
            // Try alternative endpoint
            resolve(null);
          } else {
            const codes = result.codes || result.data || [];
            const codeSet = new Set(codes.map(c => c.code || c));
            resolve(codeSet);
          }
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.end();
  });
}

/**
 * Load ICD-10 WHO codes from file
 */
function loadCodesFromFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    if (Array.isArray(data)) {
      return new Set(data.map(item => {
        if (typeof item === 'string') return item;
        if (item.code) return item.code;
        return null;
      }).filter(Boolean));
    }

    if (data.codes && Array.isArray(data.codes)) {
      return new Set(data.codes);
    }

    return null;
  } catch (error) {
    console.error(`Error loading codes from ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Validate a single code
 */
function validateCode(code, validCodeSet = null) {
  const upper = code.trim().toUpperCase();

  return {
    code: code,
    code_normalized: upper,
    is_icd10cm_format: isICD10CMFormat(upper),
    exists_in_reference: validCodeSet ? validCodeSet.has(upper) : null,
    status: isICD10CMFormat(upper) ? 'INVALID' : (validCodeSet && !validCodeSet.has(upper) ? 'UNKNOWN' : 'VALID'),
  };
}

/**
 * Generate detailed report
 */
function generateReport(codes, validationResults, validCodeSet = null) {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('   Diagnosis Code Validation Report');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Summary statistics
  const valid = validationResults.filter(r => r.status === 'VALID');
  const invalid = validationResults.filter(r => r.status === 'INVALID');
  const unknown = validationResults.filter(r => r.status === 'UNKNOWN');

  console.log('SUMMARY');
  console.log('─'.repeat(65));
  console.log(`Total codes analyzed:  ${validationResults.length}`);
  console.log(`Valid (ICD-10 WHO):    ${valid.length} (${((valid.length / validationResults.length) * 100).toFixed(1)}%)`);
  console.log(`Invalid (ICD-10-CM):   ${invalid.length} (${((invalid.length / validationResults.length) * 100).toFixed(1)}%)`);
  console.log(`Unknown in reference:  ${unknown.length} (${validCodeSet ? ((unknown.length / validationResults.length) * 100).toFixed(1) : 'N/A'}%)`);
  console.log('');

  // Detailed results
  console.log('DETAILED RESULTS');
  console.log('─'.repeat(65));

  validationResults.forEach((result, idx) => {
    const icon = result.status === 'VALID' ? '✓' : '✗';
    const status = result.status === 'VALID' ? 'VALID (ICD-10 WHO)' : result.status === 'INVALID' ? 'INVALID (ICD-10-CM)' : 'UNKNOWN';

    console.log(`${idx + 1}. ${result.code_normalized}`);
    console.log(`   Status: ${icon} ${status}`);

    if (result.is_icd10cm_format) {
      console.log(`   ⚠️  Pattern matches ICD-10-CM format (Letter+2digits.1-3digits)`);
    }

    if (validCodeSet && !result.exists_in_reference && result.status !== 'INVALID') {
      console.log(`   ⚠️  Code not found in ICD-10 WHO reference table`);
    }

    console.log('');
  });

  // Recommendations
  console.log('RECOMMENDATIONS');
  console.log('─'.repeat(65));

  if (invalid.length > 0) {
    console.log(`\n❌ ${invalid.length} code(s) with ICD-10-CM format detected:`);
    invalid.forEach(code => {
      console.log(`   • ${code.code_normalized}`);
    });
    console.log('\nAction: Replace with valid ICD-10 WHO codes from BPJS reference.');
  }

  if (unknown.length > 0 && validCodeSet) {
    console.log(`\n⚠️  ${unknown.length} code(s) not found in reference:`);
    unknown.forEach(code => {
      console.log(`   • ${code.code_normalized}`);
    });
    console.log('\nAction: Verify these codes exist in ICD-10 WHO reference table.');
  }

  if (valid.length === validationResults.length) {
    console.log('\n✓ All codes are valid and comply with BPJS standards!');
  }

  console.log('');
}

/**
 * Print usage
 */
function printUsage() {
  console.log(`
Usage: node scripts/validateDiagnosisCodes.js [OPTIONS]

ARGUMENTS:
  <codes>                 Diagnosis code(s) to validate
                         Format: "CODE1,CODE2" or "CODE1; CODE2"
  --from-file <path>     Read codes from file (one per line)
  --ref-file <path>      Use custom reference file for ICD-10 WHO codes

OPTIONS:
  --json                 Output as JSON instead of formatted text
  --help                 Show this help message

EXAMPLES:
  # Validate single code
  node scripts/validateDiagnosisCodes.js "J45.909"

  # Validate multiple codes
  node scripts/validateDiagnosisCodes.js "J45.909,E86.0,I10"

  # Validate with semicolon separator (as used in eClaim)
  node scripts/validateDiagnosisCodes.js "J45.909; E86.0; R01.1"

  # Batch validation from file
  node scripts/validateDiagnosisCodes.js --from-file codes.txt

  # Use custom reference file
  node scripts/validateDiagnosisCodes.js "I10,E11" --ref-file ./icd10-reference.json

  # Output as JSON
  node scripts/validateDiagnosisCodes.js "J45.909" --json

REFERENCE FILE FORMAT:
  JSON array of codes:
  ["I10", "E11", "J45.9", "M79.3", ...]

  JSON object with codes array:
  {"codes": ["I10", "E11", ...]}

  JSON array of objects:
  [{"code": "I10", "description": "..."}]

ENVIRONMENT VARIABLES:
  API_URL                Backend API URL (default: http://localhost:5000/api/v1)
  AUDIT_AUTH_TOKEN       Authorization token for API calls
  `);
}

/**
 * Main validation function
 */
async function validate(codesToValidate, refFile = null, outputJson = false) {
  // Extract codes
  const codes = extractCodes(codesToValidate);

  if (codes.length === 0) {
    console.error('No codes provided to validate');
    process.exit(1);
  }

  // Load reference codes
  let validCodeSet = null;

  if (refFile) {
    console.log(`Loading reference codes from: ${refFile}`);
    validCodeSet = loadCodesFromFile(refFile);
  } else {
    console.log('Fetching ICD-10 WHO reference codes from API...');
    validCodeSet = await fetchICD10WHOCodes();
  }

  if (!validCodeSet) {
    console.log('(Reference codes not available - format validation only)');
  }

  // Validate each code
  const results = codes.map(code => validateCode(code, validCodeSet));

  // Output
  if (outputJson) {
    console.log(JSON.stringify({
      codes_analyzed: codes.length,
      results: results,
      summary: {
        valid: results.filter(r => r.status === 'VALID').length,
        invalid: results.filter(r => r.status === 'INVALID').length,
        unknown: results.filter(r => r.status === 'UNKNOWN').length,
      },
    }, null, 2));
  } else {
    generateReport(codes, results, validCodeSet);
  }

  // Return for scripting
  return results;
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  let codesToValidate = null;
  let refFile = null;
  let outputJson = false;
  let fromFile = null;

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--ref-file' && i + 1 < args.length) {
      refFile = args[++i];
    } else if (args[i] === '--from-file' && i + 1 < args.length) {
      fromFile = args[++i];
    } else if (args[i] === '--json') {
      outputJson = true;
    } else if (!args[i].startsWith('--')) {
      codesToValidate = args[i];
    }
  }

  // Load codes from file if specified
  if (fromFile) {
    if (!fs.existsSync(fromFile)) {
      console.error(`File not found: ${fromFile}`);
      process.exit(1);
    }
    const content = fs.readFileSync(fromFile, 'utf-8');
    codesToValidate = content.split('\n').filter(c => c.trim()).join(',');
  }

  if (!codesToValidate) {
    console.error('No codes provided');
    printUsage();
    process.exit(1);
  }

  try {
    await validate(codesToValidate, refFile, outputJson);
  } catch (error) {
    console.error('Validation error:', error.message);
    process.exit(1);
  }
}

main();
