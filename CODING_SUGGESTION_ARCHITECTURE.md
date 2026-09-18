# Saran Koding dengan Desain Bukti-Dulu (Evidence-First Design)

Dokumentasi arsitektur untuk fitur saran koding dengan 5 langkah: Extract & Cite → Suggest → Group → Tariff → Alternatives.

## Ringkasan

Sistem ini mengimplementasikan saran koding diagnosis + prosedur (ICD-10/ICD-9) dengan standar **bukti-dulu**: setiap kode HARUS memiliki kutipan langsung dari Resume Medis dengan halaman yang spesifik. Kode tanpa kutipan otomatis ditolak.

### 5 Langkah Alur

1. **Extract & Cite** (`suggestCodingService.ts` → `extractClinicalFacts`)
   - Ekstraksi fakta klinis dari Resume Medis
   - Setiap fakta catat halaman + quotation
   - Input: diagnosis sentence, procedure sentence, jenis rawat

2. **Suggest Codes** (`suggestCodesWithCitations`)
   - LLM suggest ICD-10-WHO + ICD-9-CM
   - **Validasi wajib**: Setiap kode punya `quotation` + `page_number`
   - Kode tanpa kutipan → TOLAK
   - Output: diagnosis codes + procedure codes + rejected codes

3. **Group Codes** (`groupCodesToInaCBG`)
   - Grouping codes ke INA-CBG
   - **Blind to tariff**: Fungsi grouping TIDAK terima tarif sebagai parameter
   - Input HANYA: diagnosis codes + procedure codes + jenis_klaim
   - Output: INA-CBG code + alternatives

4. **Tariff Lookup** (`lookupTariff`)
   - Ambil tarif dari tabel PMK 3/2023
   - Source: Regional 1, Kelas D
   - **Result-only**: Tarif hanya output, bukan input grouping
   - Gagal lookup tidak fatal (data mungkin belum tersedia)

5. **Show Alternatives** (`generateAlternatives`)
   - Tampilkan kode alternatif yang tidak dipilih
   - Jelaskan alasan penolakan
   - Contoh: "nebulisasi terdokumentasi di 2 dokumen → kode 93.94 lebih spesifik dari 93.90"

## Struktur File

```
src/lib/
├── suggestCodingService.ts        # Main service (5 functions + types)
├── suggestCodingService.test.ts   # Test cases & assertions (Firdan case)
└── api.ts                          # API endpoints (sudah update)

src/components/
└── SuggestionCodesCard.tsx         # UI card untuk display hasil
```

## API Endpoints

Backend perlu implementasi endpoints berikut (atau update existing):

```
POST /api/v1/coding/extract-facts
  Input: { record_id, diagnosis_sentence, procedure_sentence, jenis_klaim }
  Output: ClinicalExtract { facts[], summary }

POST /api/v1/coding/suggest-codes
  Input: { clinical_extract }
  Output: SuggestedCodesResult { diagnosis_codes[], procedure_codes[], rejected_codes[] }

POST /api/v1/coding/group-codes
  Input: { diagnosis_codes[], procedure_codes[], jenis_klaim }
  Output: GroupedCodesResult { inacbg_suggestion, alternatives[] }

POST /api/v1/coding/tariff-lookup
  Input: { inacbg_code, region, kelas_rs }
  Output: TariffResult { tariff, source }

POST /api/v1/coding/alternatives
  Input: { diagnosis_codes[], procedure_codes[], selected_inacbg, clinical_extract }
  Output: AlternativeGroup[] { reason_not_selected, evidence }
```

## Tipe Data

### ClinicalFact
```typescript
{
  type: 'diagnosis' | 'procedure' | 'vital_sign' | 'lab_result' | 'imaging'
  text: string
  page_number: number
  quotation: string  // Kutipan langsung dari dokumen
  context?: string   // Konteks tambahan
}
```

### CodeWithCitation
```typescript
{
  code: string           // Kode ICD (e.g., "J45.9")
  system: 'ICD-10-WHO' | 'ICD-9-CM'
  description: string
  quotation: string      // WAJIB - kutipan dari dokumen
  page_number: number    // WAJIB - halaman kutipan
  confidence: 'high' | 'medium' | 'low'
  reasoning: string      // Alasan LLM suggest kode ini
}
```

### SuggestionFinalResult
```typescript
{
  record_id: string
  patient_name: string
  jenis_klaim: string
  selected_diagnosis_codes: CodeWithCitation[]
  selected_procedure_codes: CodeWithCitation[]
  selected_inacbg: string
  tariff: TariffResult | null
  alternatives: AlternativeGroup[]
  timestamp: string
}
```

## Test Case: Firdan Muhammad

**Scenario**: Pasien Firdan, 3 hari rawat inap dengan asma akut (status asthmaticus), SpO2 rendah yang membaik dengan nebulisasi.

### Input
```typescript
suggestCoding(
  recordId: 'firdan-001',
  diagnosisSentence: 'Bronchial asthma with status asthmaticus, SpO2 78% on admission',
  procedureSentence: 'Oxygen therapy via nebulizer with bronchodilators, inhalation therapy',
  jenisKlaim: 'RAWAT_INAP',
  patientName: 'Firdan Muhammad'
)
```

### Expected Output

**Diagnosis Codes:**
- `J45.9` (Asthma, unspecified) — confidence: HIGH
  - Quotation: "Bronchial asthma, status asthmaticus"
  - Page: 1
  - Reasoning: "Status asthmaticus dengan desaturasi O2 berat (78%)"

**Procedure Codes:**
- `93.94` (Nebulizer therapy) — confidence: HIGH
  - Quotation: "Oxygen therapy, inhalation therapy with bronchodilators"
  - Page: 1
  - Reasoning: "Nebulisasi dengan bronchodilators, terapi utama untuk status asthmaticus"

**INA-CBG Grouping:**
- Code: `A82XXX` (contoh)
- Tariff: Rp 2.500.000 (contoh, dari PMK 3/2023)

**Alternatives:**
```
Rank 2: A81XXX
  - Diagnosis: J45.1 (Nonallergic asthma)
  - Procedure: 93.90 (Respiratory therapy)
  - Reason not selected: "J45.1 tidak ada bukti alergi; 93.90 terlalu umum dibanding 93.94"
  - Evidence: "nebulisasi terdokumentasi di 2 bagian dokumen (Halaman 1 & Treatment notes)"
```

## Integrasi dengan UI

### Menampilkan hasil di halaman results

```tsx
import { suggestCoding } from '@/lib/suggestCodingService';
import { SuggestionCodesCard } from '@/components/SuggestionCodesCard';

export function ResultsPage() {
  const [suggestion, setSuggestion] = useState(null);
  
  const handleSuggest = async () => {
    const result = await suggestCoding(
      recordId,
      record.diagnosis_text,
      record.procedure_text,
      record.jenis_klaim,
      record.nama_pasien
    );
    setSuggestion(result);
  };

  return (
    <>
      <Button onClick={handleSuggest}>Suggest Koding</Button>
      {suggestion && <SuggestionCodesCard result={suggestion} />}
    </>
  );
}
```

### SuggestionCodesCard Features

- ✅ Tampil diagnosis codes dengan kutipan halaman
- ✅ Tampil procedure codes dengan kutipan halaman
- ✅ Tampil INA-CBG result dengan tariff
- ✅ Expandable alternatives section
- ✅ Copy-to-clipboard untuk setiap kode
- ✅ Confidence badges (HIGH/MEDIUM/LOW)
- ✅ "Apply Suggestion" button

## Validasi & Error Handling

### Validasi Mandatory

1. **Setiap kode HARUS punya citation**
   ```typescript
   if (!code.quotation || code.page_number === null) {
     rejectedCodes.push({
       code: code.code,
       reason: 'no_quotation'
     });
   }
   ```

2. **Grouping blind to tariff**
   ```typescript
   // ✅ BENAR - hanya diagnosis + procedure + jenis_klaim
   groupCodesToInaCBG(diagCodes, procCodes, jenisKlaim)
   
   // ❌ SALAH - jangan include tarif
   groupCodesToInaCBG(diagCodes, procCodes, jenisKlaim, tariff)
   ```

3. **Tariff lookup tidak crash**
   ```typescript
   const tariff = await lookupTariff(...); // May return null
   if (!tariff) {
     // Proceed tanpa tariff, jangan abort
   }
   ```

### User-Friendly Error Messages

- ❌ "LLM API returned 500" → ✅ "Tidak dapat menyarankan kode medis. Periksa kembali dokumen..."
- ❌ "Missing field 'quotation'" → ✅ "Kode tanpa bukti dokumen ditolak. Pastikan Resume Medis lengkap..."
- ❌ "Database connection timeout" → ✅ "Pengambilan tarif gagal. Data akan ditampilkan setelah tersedia..."

## Development Checklist

Sebelum fitur go-live:

- [ ] Backend endpoints /api/v1/coding/* implemented
- [ ] LLM prompt untuk extract & suggest codes sudah ditest
- [ ] Test case Firdan terbukti output J45.9 + 93.94
- [ ] Semua kode di test case punya quotation + page_number
- [ ] Grouping tested tanpa tarif sebagai input
- [ ] Tariff lookup tested (OK kalau return null temporary)
- [ ] Alternatives generation tested dengan reasoning jelas
- [ ] UI card display semua elements (diagnosis, procedure, INA-CBG, alternatives)
- [ ] Copy-to-clipboard berfungsi
- [ ] Error handling tested (missing citation, grouping error, etc)
- [ ] Permission: hanya verifikator+ bisa access
- [ ] Audit log: catat setiap kali suggestion dibuat

## Known Limitations

1. **Tariff data not yet available** — `/api/v1/coding/tariff-lookup` akan return null sampai PMK 3/2023 data diload. Feature tidak crash, cuma skip tariff display.

2. **LLM accuracy depends on input** — Jika Resume Medis sangat singkat atau ambiguous, LLM mungkin tidak bisa extract facts dengan confidence tinggi.

3. **ICD-10-WHO mapping** — Backend perlu mapping table ICD-10-CM (American) → ICD-10-WHO 2010 (BPJS standard). Belum ada di codebase saat ini.

## FAQ

**Q: Kenapa semua kode harus punya kutipan?**
A: Untuk audit trail dan verifikator bisa langsung lihat bukti di dokumen. Koding tanpa bukti = tidak ada yang verifikator bisa check, risikonya besar.

**Q: Bagaimana kalau LLM suggest kode tapi tidak ada kutipan?**
A: Kode itu di-move ke `rejected_codes` array. Tidak ditampilkan ke verifikator.

**Q: Kenapa grouping tanpa tarif sebagai input?**
A: Grouping INA-CBG adalah masalah klinis murni (diagnosis + procedure + jenis rawat). Tarif tidak boleh influence keputusan klinis. Tarif hanya ditampilkan sebagai informasi hasil.

**Q: Bagaimana kalau ada 2 diagnosis atau 3 prosedur?**
A: Semuanya masuk ke grouping. Grouper akan handle kombinasi codes → single INA-CBG. Alternatives akan show kombinasi lain yang tidak dipilih.

**Q: Berapa lama suggestion process biasanya?**
A: Extract ~2-3s, Suggest ~5-10s (LLM call), Group ~1s, Tariff ~1s, Alternatives ~2-3s. Total: ~15-20s. UX harus show loading indicator.

## References

- PMK 3/2023 — INA-CBG specification
- ICD-10-WHO Versi 2010 — Diagnosis coding standard BPJS
- ICD-9-CM — Procedure coding (legacy, gradual migration to ICD-10-PCS)
- Backend grouper logic — `claimFiles.js` → `groupCodesToInaCBG()`
