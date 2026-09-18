# Implementation Guide: Medical Code Explanations (Keterangan Kode Diagnosis & Prosedur)

## Overview
Fitur ini menampilkan penjelasan detail untuk diagnosis dan prosedur yang dikoding dengan benar (status "Valid" atau "Disetujui"), memudahkan verifikator memahami alasan pemilihan kode tanpa harus menggali dokumen asli.

## Feature Structure

### 1. **Service Layer**: `src/lib/generateCodingExplanation.ts`
Modul core yang bertanggung jawab untuk:
- Parse kode diagnosis/prosedur (format semicolon-separated: `J45.9;I10`)
- Lookup deskripsi dari kamus ICD-10 WHO + ICD-9 CM
- Match temuan klinis dari record data dengan kode yang sesuai
- Generate penjelasan terstruktur dalam format bullet points

#### Key Functions:
```typescript
generateCodingExplanation(
  codeString: string,           // e.g., "J45.9;I10"
  type: 'diagnosis' | 'procedure',
  status: 'valid' | 'approved',
  clinicalFindings?: Record<string, any>,
  pageReference?: string         // e.g., "Resume Medis hal. 2"
): CodingExplanationResult
```

#### Dictionary Reference:
- **ICD-10_DICTIONARY**: Kamus ICD-10 WHO untuk diagnosis (currently ~10 common codes)
- **ICD9CM_PROCEDURES**: Kamus ICD-9-CM untuk prosedur (currently ~7 common procedures)
- **CLINICAL_FINDINGS**: Mapping antara temuan klinis (keywords) → interpretasi kode

### 2. **UI Component**: `src/components/CodingExplanationPanel.tsx`
Component React yang menampilkan penjelasan dalam tiga varian:

#### A. Full Panel (`CodingExplanationPanel`)
Collapsible accordion dengan header toggle:
```
▸ Penjelasan Kode (1 kode) [Valid/Disetujui]
  (click untuk expand)

▾ Penjelasan Kode (1 kode) [Valid/Disetujui]
  • J45.9 (Diagnosis)
  • Asthma, unspecified (WHO ICD-10 2010)
  • Penyakit sesak nafas jangka panjang...
  • Temuan: Auskultasi paru menunjukkan obstruksi
  • Tercatat di Resume Medis hal. 2
  • Status: Valid
```

#### B. Badge (`CodingExplanationBadge`)
Minimal display untuk space-constrained layouts:
```
✓ 1 kode valid [click untuk tooltip]
```

#### C. Tooltip (`CodingExplanationTooltip`)
Inline dengan text minimalis:
```
ⓘ Lihat penjelasan [hover untuk details]
```

### 3. **Integration Point**: `src/app/(dashboard)/results/[fileId]/page.tsx`

#### Changes Made:
1. **Import** component:
   ```typescript
   import { CodingExplanationPanel } from '@/components/CodingExplanationPanel';
   ```

2. **Update FieldRowTr function signature**:
   - Added `recordData?: Record<string, any>` parameter
   - Allows passing clinical findings to explanation generator

3. **Render explanation panel** in `FieldRowTr`:
   ```typescript
   {(field.column_name === 'DIAGLIST' || field.column_name === 'PROCLIST') && 
    (field.status === 'valid' || field.status === 'approved') && (
     <CodingExplanationPanel
       codeString={String(currentValue ?? '')}
       fieldType={field.column_name === 'DIAGLIST' ? 'diagnosis' : 'procedure'}
       status={field.status as 'valid' | 'approved'}
       clinicalFindings={recordData}
       pageReference={`Resume Medis`}
     />
   )}
   ```

## Test Cases

### Test Case 1: Firdan (J45.9 - Asthma dengan Bukti Klinis)
**Input:**
- Code: `J45.9`
- Status: `Valid`
- Clinical findings: "sesak, ronchi bilateral"

**Expected Output:**
```
▾ Penjelasan Kode (1 kode) [Valid]
  • J45.9 (Diagnosis)
  • Asthma, unspecified (WHO ICD-10 2010)
  • Penyakit sesak nafas jangka panjang tanpa penyebab spesifik yang diketahui
  • Temuan: Auskultasi paru menunjukkan obstruksi saluran napas
  • Tercatat di Resume Medis
  • Status: Valid
```

**Run Test:**
```bash
# Di browser console (development):
testCodingExplanation.testFirdanCase()

# Output di console:
=== Test Case: Firdan (J45.9) ===
Input: J45.9 dengan bukti ronchi bilateral
Result: {
  codes: 1,
  summary: "1 kode diagnosis dengan penjelasan klinis",
  isComplete: true
}
```

### Test Case 2: Multiple Codes (J45.9;I10)
Menampilkan 2 kode diagnosis dalam satu section, masing-masing dengan penjelasannya.

### Test Case 3: Unknown Code (Z99.9)
Kode yang tidak ada di kamus akan di-skip (tidak ditampilkan), `isComplete` = false.

## Data Structure

### CodingExplanationResult
```typescript
{
  codes: CodingExplanation[],    // Array penjelasan per kode
  summary: string,                // Ringkasan 1 baris
  isComplete: boolean             // true jika ada kode ditemukan
}
```

### CodingExplanation (per kode)
```typescript
{
  code: string,                              // "J45.9"
  type: 'diagnosis' | 'procedure',
  description: string,                       // Deskripsi resmi ICD-10
  layman: string,                            // Versi awam/mudah dipahami
  status: 'valid' | 'approved',
  clinicalFindings?: string[],               // Temuan yang mendukung
  sourceReference?: string,                  // "Resume Medis hal. 2"
  explanationBullets: string[]               // Final bullet points
}
```

## File Changes Summary

| File | Change | Purpose |
|------|--------|---------|
| `src/lib/generateCodingExplanation.ts` | **NEW** | Core service untuk generate explanations |
| `src/components/CodingExplanationPanel.tsx` | **NEW** | React component untuk UI display |
| `src/lib/generateCodingExplanation.test.ts` | **NEW** | Test cases + examples |
| `src/app/(dashboard)/results/[fileId]/page.tsx` | MODIFIED | Integrate component + pass recordData |

## How to Expand

### 1. Add More ICD-10 Codes
Edit `generateCodingExplanation.ts`:
```typescript
export const ICD10_DICTIONARY: Record<string, ICD10Code> = {
  // ... existing codes ...
  'A15.0': {
    code: 'A15.0',
    description: 'Tuberculosis of lung',
    layman: 'Penyakit TBC paru',
    category: 'Penyakit Infeksi'
  }
};
```

### 2. Add Clinical Finding Mappings
```typescript
export const CLINICAL_FINDINGS: Record<string, ClinicalFindingMapping> = {
  // ... existing findings ...
  'batuk_darah': {
    keywords: ['batuk darah', 'hemoptisis', 'cough blood'],
    supportedCodes: ['A15.0', 'A15.9', 'J45.9'],
    interpretation: 'Batuk darah menunjukkan kemungkinan TBC atau pneumonia'
  }
};
```

### 3. Backend Enhancement
Currently, the service uses static dictionary + keyword matching. For future versions:
- **Connect to backend database** of full ICD-10 codes
- **Add AI extraction** of clinical findings (not just keywords)
- **Enable multilingual** descriptions (IND + ENG)

## Performance Considerations

- **Lightweight**: Dictionary is static, no API calls during display
- **Instant rendering**: Generate explanation on-demand when component mounts
- **Collapsible**: Explanations hidden by default, only expand on user request
- **Batch processing**: Can generate explanations for multiple codes in one pass

## Browser Compatibility

- React 18+ (uses hooks)
- Modern CSS (CSS Grid, Flexbox)
- No external dependencies beyond existing UI components

## Accessibility

- Keyboard navigable (button toggles with Tab/Enter)
- Screen reader friendly (semantic HTML, proper ARIA labels)
- High contrast colors for status indicators (Valid = blue, Approved = emerald)
- Tooltip support for code descriptions

## Future Enhancements

1. **Multi-language support**
   - Add `DESCRIPTION_ID`, `DESCRIPTION_EN` to dictionaries
   - Language toggle in UI

2. **Interactive learning**
   - Click on bullet point → highlight in PDF
   - Link back to exact page/line in Resume Medis

3. **Code verification workflow**
   - "Confirm this explanation matches patient data" button
   - Audit trail of verifications

4. **Integration with BPJS vClaim**
   - Sync code descriptions with official BPJS ICD-10 mapping
   - Validate codes before submission

5. **AI-powered explanations**
   - Ask Claude: "Explain why J45.9 is coded for this patient"
   - Generate custom explanations based on actual record text

## Maintenance Notes

- Update dictionaries quarterly (new ICD-10 codes, deprecated codes)
- Test Firdan case after each dictionary update
- Monitor performance if dictionary grows beyond 1000 codes
- Keep clinical findings keywords fresh based on new diagnosis patterns

## References

- ICD-10 WHO 2010: Used by BPJS Indonesia (PMK 3/2023 Lampiran)
- ICD-9-CM: Legacy support for procedures
- INACBG Grouper: Code combinations validated against grouper logic
