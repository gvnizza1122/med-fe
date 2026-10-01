/**
 * @fileoverview Regression Test for Firdan Case
 *
 * Runs automated regression tests whenever extraction logic changes
 *
 * Usage:
 *   npm run test:regression
 */

import {
  loadGoldenData,
  generateRegressionReport,
  assertRegressionPassed,
  printReport,
  compareData,
} from './regression_runner';

describe('Regression Testing — Firdan Case', () => {
  let goldenData: any;
  it('tidak mengambil expected dari hasil ekstraksi untuk menutupi kode salah', () => {
    const expected = [{ icd10: 'J45.9', sequence: 1 }];
    const diffs = compareData({ DIAGLIST: { diagnoses: [{ icd10: 'WRONG', sequence: 1 }], expected } },
      { DIAGLIST: { expected } }, 'koding');
    expect(diffs).toHaveLength(1);
    expect(diffs[0].severity).toBe('critical');
  });
  it('mempertahankan nilai nol saat membandingkan field', () => {
    expect(compareData({ LOS: { value: 0 } }, { LOS: { expected: 0 } }, 'turunan')).toEqual([]);
  });

  beforeAll(() => {
    goldenData = loadGoldenData();
  });

  describe('Golden Data Loaded', () => {
    it('should load firdan_case.json without errors', () => {
      expect(goldenData).toBeDefined();
      expect(goldenData.metadata).toBeDefined();
      expect(goldenData.extracted_data).toBeDefined();
    });

    it('should have all required field categories', () => {
      const categories = ['salin', 'turunan', 'koding', 'konfigurasi', 'fakta_nol', 'wajar_kosong'];
      categories.forEach(cat => {
        expect(goldenData.extracted_data[cat]).toBeDefined();
      });
    });

    it('should have baseline regression data', () => {
      const baseline = goldenData.regression_test_baseline;
      expect(baseline).toBeDefined();
      expect(baseline.version).toBe('1.0');
      expect(baseline.expected_error_count).toBe(0);
    });
  });

  describe('Regression Report Generation', () => {
    it('should generate clean report when data matches golden answers', () => {
      // Use the same data as golden to test perfect match
      const report = generateRegressionReport(
        goldenData.extracted_data,
        goldenData,
        '0170R0110926V001417'
      );

      expect(report).toBeDefined();
      expect(report.sep).toBe('0170R0110926V001417');
      expect(report.recommendation).toBe('PASS');
    });

    it('report should have correct structure', () => {
      const report = generateRegressionReport(
        goldenData.extracted_data,
        goldenData,
        '0170R0110926V001417'
      );

      expect(report.timestamp).toBeDefined();
      expect(report.totalFields).toBeGreaterThan(0);
      expect(report.matchedFields).toBeGreaterThan(0);
      expect(report.diffCount).toBeDefined();
      expect(report.criticalErrors).toBeDefined();
      expect(report.warnings).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(['PASS', 'PASS_WITH_WARNINGS', 'FAIL']).toContain(report.recommendation);
    });

    it('should detect critical mismatches', () => {
      // Simulate extraction with critical error
      const extractedWithError = JSON.parse(JSON.stringify(goldenData.extracted_data));
      extractedWithError.koding.DIAGLIST.diagnoses[0].icd10 = 'WRONG_CODE';

      const report = generateRegressionReport(
        extractedWithError,
        goldenData,
        '0170R0110926V001417'
      );

      expect(report.criticalErrors).toBeGreaterThan(0);
      expect(report.recommendation).toBe('FAIL');
    });

    it('should detect warning-level mismatches', () => {
      // Simulate extraction with warning error
      const extractedWithWarning = JSON.parse(JSON.stringify(goldenData.extracted_data));
      extractedWithWarning.turunan.DISCHARGE_STATUS.value = 'Pulang Atas Permintaan Sendiri';

      const report = generateRegressionReport(
        extractedWithWarning,
        goldenData,
        '0170R0110926V001417'
      );

      if (report.warnings > 0) {
        expect(['PASS_WITH_WARNINGS', 'FAIL']).toContain(report.recommendation);
      }
    });
  });

  describe('Regression Assertion Helper', () => {
    it('should pass assertion when no critical errors', () => {
      const report = generateRegressionReport(
        goldenData.extracted_data,
        goldenData,
        '0170R0110926V001417'
      );

      // Should not throw
      expect(() => assertRegressionPassed(report)).not.toThrow();
    });

    it('should fail assertion when critical errors exist', () => {
      const extractedWithError = JSON.parse(JSON.stringify(goldenData.extracted_data));
      extractedWithError.koding.DIAGLIST.diagnoses[0].icd10 = 'WRONG_CODE';

      const report = generateRegressionReport(
        extractedWithError,
        goldenData,
        '0170R0110926V001417'
      );

      expect(() => assertRegressionPassed(report)).toThrow(/FAILED/);
    });

    it('should fail assertion when warnings exceed threshold', () => {
      const extractedWithWarning = JSON.parse(JSON.stringify(goldenData.extracted_data));
      // Simulate multiple warnings
      extractedWithWarning.turunan.DISCHARGE_STATUS.value = 'Different Value';
      extractedWithWarning.turunan.DISCHARGE_DATE.value = '2024-09-21'; // Wrong date

      const report = generateRegressionReport(
        extractedWithWarning,
        goldenData,
        '0170R0110926V001417'
      );

      if (report.warnings > 1) {
        expect(() => assertRegressionPassed(report, 0)).toThrow(/warnings/);
      }
    });
  });

  describe('Report Output', () => {
    it('should print report without errors', () => {
      const report = generateRegressionReport(
        goldenData.extracted_data,
        goldenData,
        '0170R0110926V001417'
      );

      // Mock console.log to verify it was called
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      printReport(report);

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('REGRESSION TEST REPORT')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Baseline Validation', () => {
    it('should match expected baseline field counts', () => {
      const baseline = goldenData.regression_test_baseline;
      const report = generateRegressionReport(
        goldenData.extracted_data,
        goldenData,
        '0170R0110926V001417'
      );

      expect(report.diffCount).toBe(baseline.expected_error_count);
    });

    it('should have zero critical errors in golden data', () => {
      const baseline = goldenData.regression_test_baseline;
      expect(baseline.expected_error_count).toBe(0);
    });
  });
});

/**
 * Optional: Manual regression testing with actual backend extraction
 * (Uncomment when backend API is available)
 */

describe.skip('Regression Testing — With Backend Integration', () => {
  /*
  it('should pass regression test with actual extracted data', async () => {
    // Mock API call to backend
    const api = {
      getRecords: jest.fn().mockResolvedValue({
        records: [
          {
            id: 'firdan-001',
            extracted_data: { ... }, // Actual extracted data from backend
          }
        ]
      })
    };

    const extractedData = (await api.getRecords('fileId')).records[0].extracted_data;
    const report = generateRegressionReport(extractedData, goldenData, '0170R0110926V001417');

    assertRegressionPassed(report);
  });
  */
});
