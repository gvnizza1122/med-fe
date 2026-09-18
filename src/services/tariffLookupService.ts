/**
 * Tariff Lookup Service
 *
 * Lookup tarif INA-CBG (PMK 3/2023, Regional 1, Kelas D) berdasarkan kode
 * INA-CBG hasil grouping (lihat `inaCbgGroupingService.ts`).
 *
 * Data tarif di bawah ini REPRESENTATIF -- disusun konsisten dengan
 * `MOCK_TARIFFS` di `claimSuggestionWorkflow.ts` dan tabel aturan grouping
 * di `inaCbgGroupingService.ts`, sambil menunggu impor lampiran tarif resmi
 * PMK 3/2023. TODO: ganti dengan master data resmi (mis. dari DB/API) kalau
 * sudah tersedia.
 */

import { extractCmgPrefix } from '../lib/inaCbgGroupingService';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface TariffLookupOptions {
  kelasRs?: 'A' | 'B' | 'C' | 'D';
}

export interface TariffLookupResult {
  inacbg_code: string;
  tariff_amount: number | null;
  region: string;
  class: string;
  source: string;
  found: boolean;
  note?: string;
}

interface TariffEntry {
  cmgCode: string; // kode CMG dasar tanpa suffix severity, mis. 'K-4-17'
  description: string;
  kelasD: number; // tarif Kelas D, Regional 1 (IDR)
}

// ============================================================================
// TARIFF TABLE -- PMK 3/2023, Regional 1, Kelas D
// ============================================================================

const TARIFF_TABLE_REGIONAL_1_KELAS_D: TariffEntry[] = [
  { cmgCode: 'J-3-13', description: 'Asthma dengan spirometry (Rawat Jalan)', kelasD: 450000 },
  { cmgCode: 'J-3-12', description: 'Asthma tanpa prosedur (Rawat Jalan)', kelasD: 320000 },
  { cmgCode: 'J-1-1', description: 'Asma tanpa komplikasi (Rawat Inap)', kelasD: 2100000 },
  { cmgCode: 'J-1-2', description: 'Asma berat / status asmatikus (Rawat Inap)', kelasD: 3400000 },
  { cmgCode: 'K-4-17', description: 'Tukak lambung (Rawat Jalan)', kelasD: 320000 },
  { cmgCode: 'K-4-18', description: 'Tukak duodenum (Rawat Jalan)', kelasD: 300000 },
  { cmgCode: 'K-1-8', description: 'Tukak peptik tanpa komplikasi (Rawat Inap)', kelasD: 2300000 },
  { cmgCode: 'K-1-9', description: 'Tukak peptik dengan perdarahan (Rawat Inap)', kelasD: 4800000 },
  { cmgCode: 'E-4-1', description: 'Diabetes tipe 1 (Rawat Jalan)', kelasD: 280000 },
  { cmgCode: 'E-4-3', description: 'Diabetes tipe 2 (Rawat Jalan)', kelasD: 260000 },
  { cmgCode: 'E-4-4', description: 'Diabetes tipe 2 dengan komplikasi (Rawat Jalan)', kelasD: 380000 },
  { cmgCode: 'I-4-1', description: 'Hipertensi esensial (Rawat Jalan)', kelasD: 220000 },
  { cmgCode: 'I-1-2', description: 'Krisis hipertensi (Rawat Inap)', kelasD: 2600000 },
];

const REGION = 'Regional 1';
const RS_CLASS = 'Kelas D';
const SOURCE = 'PMK 3/2023 (data representatif -- menunggu impor lampiran tarif resmi)';

// ============================================================================
// LOOKUP FUNCTION
// ============================================================================

/**
 * Lookup tarif INA-CBG. Selalu mengembalikan hasil (tidak throw) walaupun
 * kode tidak dikenali -- caller wajib cek field `found`.
 */
export function lookupTariff(inacbgCode: string, _options: TariffLookupOptions = {}): TariffLookupResult {
  const baseResult = {
    region: REGION,
    class: RS_CLASS,
    source: SOURCE,
  };

  if (!inacbgCode || typeof inacbgCode !== 'string' || inacbgCode.trim().length === 0) {
    return {
      ...baseResult,
      inacbg_code: inacbgCode ?? '',
      tariff_amount: null,
      found: false,
      note: 'Kode INA-CBG tidak valid/kosong.',
    };
  }

  const exact = TARIFF_TABLE_REGIONAL_1_KELAS_D.find((e) => e.cmgCode === inacbgCode);
  if (exact) {
    return {
      ...baseResult,
      inacbg_code: inacbgCode,
      tariff_amount: exact.kelasD,
      found: true,
    };
  }

  // Fallback: cocokkan prefix CMG tanpa suffix severity (mis. 'K-4-17-I' -> 'K-4-17')
  const prefix = extractCmgPrefix(inacbgCode);
  const byPrefix = TARIFF_TABLE_REGIONAL_1_KELAS_D.find((e) => e.cmgCode === prefix);
  if (byPrefix) {
    return {
      ...baseResult,
      inacbg_code: inacbgCode,
      tariff_amount: byPrefix.kelasD,
      found: true,
      note: `Tarif diambil dari kode dasar ${byPrefix.cmgCode} (varian severity "${inacbgCode}" tidak ada di tabel tarif).`,
    };
  }

  return {
    ...baseResult,
    inacbg_code: inacbgCode,
    tariff_amount: null,
    found: false,
    note: `Kode INA-CBG "${inacbgCode}" tidak ditemukan di tabel tarif PMK 3/2023 Regional 1 Kelas D. Perlu verifikasi manual/pembaruan master data.`,
  };
}
