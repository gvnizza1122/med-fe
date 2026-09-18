/**
 * @fileoverview Unit tests untuk wrapper `groupToInaCbg()` +
 * `isValidIcd10Code()` / `isValidIcd9Code()` (src/lib/inaCbgGroupingService.ts)
 */

import {
  groupToInaCbg,
  isValidIcd10Code,
  isValidIcd9Code,
} from '@/lib/inaCbgGroupingService';

describe('isValidIcd10Code / isValidIcd9Code', () => {
  it('should accept valid ICD-10 diagnosis code formats', () => {
    expect(isValidIcd10Code('J45.9')).toBe(true);
    expect(isValidIcd10Code('K25')).toBe(true);
    expect(isValidIcd10Code('E11.9')).toBe(true);
  });

  it('should reject malformed ICD-10 codes', () => {
    expect(isValidIcd10Code('12345')).toBe(false);
    expect(isValidIcd10Code('')).toBe(false);
    expect(isValidIcd10Code('U07')).toBe(false); // letter U tidak dipakai di ICD-10
  });

  it('should accept valid ICD-9 procedure code formats', () => {
    expect(isValidIcd9Code('9394')).toBe(true);
    expect(isValidIcd9Code('93.94')).toBe(true);
    expect(isValidIcd9Code('54')).toBe(true);
  });

  it('should reject malformed ICD-9 codes', () => {
    expect(isValidIcd9Code('ABC')).toBe(false);
    expect(isValidIcd9Code('')).toBe(false);
  });
});

describe('groupToInaCbg', () => {
  it('should group diagnosis + procedure to an INA-CBG code with description and reasoning', async () => {
    const result = await groupToInaCbg(['J45.9'], ['9394'], { serviceType: 'RAWAT_JALAN' });

    expect(result.inacbg_code).toBe('J-3-13');
    expect(result.description).toMatch(/Asthma/i);
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.reasoning).toMatch(/asthma_outpatient_procedure_9394/);
  });

  it('should lower confidence and mention the problem in reasoning when codes have invalid format', async () => {
    const result = await groupToInaCbg(['NOTACODE'], ['XX'], { serviceType: 'RAWAT_JALAN' });

    expect(result.confidence).toBeLessThanOrEqual(0.4);
    expect(result.reasoning).toMatch(/ICD-10/);
    expect(result.reasoning).toMatch(/ICD-9/);
  });

  it('should fall back to NON-CMG when no diagnosis code is recognized by any grouping rule', async () => {
    const result = await groupToInaCbg(['Z99.9'], [], { serviceType: 'RAWAT_JALAN' });

    expect(result.inacbg_code).toBe('NON-CMG');
    expect(result.description).toBeDefined();
  });
});
