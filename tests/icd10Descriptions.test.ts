/**
 * @fileoverview Unit tests untuk kamus deskripsi ICD-10
 * (src/lib/icd10Descriptions.ts) dan integrasinya di generateCodingExplanation
 */

import {
  getICD10Description,
  getICD10DescriptionsForCodes,
} from '@/lib/icd10Descriptions';
import { generateCodingExplanation } from '@/lib/generateCodingExplanation';

describe('getICD10Description', () => {
  it('should return the WHO ICD-10 description for a known code', () => {
    expect(getICD10Description('A09.9')).toMatch(/Gastroenteritis/i);
    expect(getICD10Description('I10')).toMatch(/Essential.*hypertension/i);
  });

  it('should be case-insensitive and tolerant of extra whitespace', () => {
    expect(getICD10Description('a09.9')).toBe(getICD10Description('A09.9'));
    expect(getICD10Description('  A09.9  ')).toBe(getICD10Description('A09.9'));
  });

  it('should take the first code when given a slash-separated alternate code', () => {
    expect(getICD10Description('A09.9/J45.9')).toBe(getICD10Description('A09.9'));
  });

  it('should return the fallback "—" for an unknown or malformed code', () => {
    expect(getICD10Description('ZZ99.9')).toBe('—');
    expect(getICD10Description('021.0')).toBe('—'); // not valid WHO ICD-10 format
  });

  it('should return the fallback "—" for null/undefined/empty input', () => {
    expect(getICD10Description(null)).toBe('—');
    expect(getICD10Description(undefined)).toBe('—');
    expect(getICD10Description('')).toBe('—');
  });
});

describe('getICD10DescriptionsForCodes', () => {
  it('should parse a multi-code string separated by ";" and return each description', () => {
    const results = getICD10DescriptionsForCodes('A09.9;J45.9');

    expect(results).toHaveLength(2);
    expect(results[0].code).toBe('A09.9');
    expect(results[0].description).toMatch(/Gastroenteritis/i);
    expect(results[1].code).toBe('J45.9');
    expect(results[1].description).toMatch(/Asthma/i);
  });

  it('should also support "," as a separator', () => {
    const results = getICD10DescriptionsForCodes('I10,E11.9');
    expect(results.map(r => r.code)).toEqual(['I10', 'E11.9']);
  });

  it('should return an empty array for empty/undefined input', () => {
    expect(getICD10DescriptionsForCodes('')).toEqual([]);
    expect(getICD10DescriptionsForCodes(undefined)).toEqual([]);
  });
});

describe('generateCodingExplanation with ICD-10 descriptions', () => {
  it('should include the WHO description as a bullet for a diagnosis code found in the big dictionary but not in the small local dictionary', () => {
    const result = generateCodingExplanation('A09.9', 'diagnosis', 'valid');

    expect(result.codes).toHaveLength(1);
    const bullets = result.codes[0].explanationBullets;
    expect(bullets[0]).toMatch(/Gastroenteritis/i);
  });

  it('should place the description bullet before the resume medis quotation bullet', () => {
    const result = generateCodingExplanation(
      'A09.9',
      'diagnosis',
      'valid',
      undefined,
      undefined,
      [{ code: 'A09.9', found: true, page_number: 3, quotation: 'GEA dgn dehidrasi ringan' }]
    );

    const bullets = result.codes[0].explanationBullets;
    const descIdx = bullets.findIndex(b => /Gastroenteritis/i.test(b));
    const quoteIdx = bullets.findIndex(b => b.includes('Dari Resume Medis'));

    expect(descIdx).toBeGreaterThanOrEqual(0);
    expect(quoteIdx).toBeGreaterThan(descIdx);
  });

  it('should fall back gracefully when the diagnosis code has no known ICD-10 description', () => {
    const result = generateCodingExplanation('021.0', 'diagnosis', 'valid');

    expect(result.codes).toHaveLength(1);
    const bullets = result.codes[0].explanationBullets;
    expect(bullets.join(' ')).toMatch(/tidak ada di kamus offline|konfirmasi/i);
  });

  it('should note that ICD-9-CM descriptions are unavailable for unmapped procedure codes', () => {
    const result = generateCodingExplanation('88.78', 'procedure', 'valid');

    expect(result.codes).toHaveLength(1);
    const bullets = result.codes[0].explanationBullets;
    expect(bullets[0]).toMatch(/ICD-9-CM tidak tersedia/i);
  });

  it('should still work end-to-end for the WAHYU MURNIYATI sample codes', () => {
    const diagResult = generateCodingExplanation('021.0;A09.9', 'diagnosis', 'valid');
    const procResult = generateCodingExplanation('88.78;98.59', 'procedure', 'valid');

    expect(diagResult.codes.map(c => c.code)).toEqual(['021.0', 'A09.9']);
    expect(diagResult.codes[1].explanationBullets[0]).toMatch(/Gastroenteritis/i);

    expect(procResult.codes.map(c => c.code)).toEqual(['88.78', '98.59']);
  });
});
