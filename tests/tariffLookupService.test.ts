/**
 * @fileoverview Unit tests untuk Tariff Lookup Service
 * (src/services/tariffLookupService.ts)
 */

import { lookupTariff } from '@/services/tariffLookupService';

describe('lookupTariff', () => {
  it('should return tariff data for a known INA-CBG code', () => {
    const result = lookupTariff('K-4-17');

    expect(result.found).toBe(true);
    expect(result.inacbg_code).toBe('K-4-17');
    expect(result.tariff_amount).toBe(320000);
    expect(result.region).toBe('Regional 1');
    expect(result.class).toBe('Kelas D');
    expect(result.source).toMatch(/PMK 3\/2023/);
  });

  it('should fall back to the base CMG code when a severity-suffixed variant is not in the table', () => {
    const result = lookupTariff('K-4-17-I');

    expect(result.found).toBe(true);
    expect(result.tariff_amount).toBe(320000);
    expect(result.note).toMatch(/K-4-17/);
  });

  it('should handle an unknown INA-CBG code gracefully (no throw, found=false)', () => {
    const result = lookupTariff('Z-9-99');

    expect(result.found).toBe(false);
    expect(result.tariff_amount).toBeNull();
    expect(result.note).toBeDefined();
  });

  it('should handle empty/invalid input gracefully', () => {
    expect(() => lookupTariff('')).not.toThrow();
    const result = lookupTariff('');
    expect(result.found).toBe(false);
    expect(result.tariff_amount).toBeNull();
  });
});
