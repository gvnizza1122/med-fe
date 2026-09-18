# INA-CBG Grouping Service

Deterministic INA-CBG code grouping based on PMK 3/2023 specifications.

## Overview

The INA-CBG Grouping Service maps diagnosis codes (ICD-10) + procedure codes (ICD-9) + service type to INA-CBG CMG codes according to PMK 3/2023 Part I & II.

**Key Features:**
- Deterministic grouping (same input → same output, no AI guessing)
- Severity level detection from clinical findings (Level I/II/III)
- Special CMG detection (SP/SR/SI/SD/Subakut/Kronis)
- Kelas D top-up restrictions
- High confidence scoring
- Debug info for verification

## Architecture

### Files

- `src/lib/inaCbgGroupingService.ts` - Core grouping logic
- `src/lib/inaCbgGroupingService.test.ts` - Comprehensive test cases
- `src/lib/claimSuggestionWorkflow.ts` - Integration with claim verification workflow
- `src/components/InaCbgGroupingCard.tsx` - React UI component for displaying results

### Workflow Integration

The service is step 3 of the 7-step claim suggestion workflow:

```
1. [Validation] Extract & validate record data
2. [Extraction] Get diagnoses, procedures, vital signs from PDF/SIMRS
→ 3. [DETERMINISTIC] Group to INA-CBG ← This service
4. [Lookup] Fetch tariff from master data
5. [Calculation] Calculate claim amount
6. [Special Rules] Check PRB, RV-13, RV-15, Kelas D, etc
7. [Suggestions] Generate user-facing suggestions & warnings
```

## Usage

### Basic Usage

```typescript
import { groupClaimToCmg } from '@/lib/inaCbgGroupingService';

const result = await groupClaimToCmg({
  diagnosisCodes: ['J45.9'],      // ICD-10 codes
  procedureCodes: ['9394'],        // ICD-9 codes (optional)
  serviceType: 'RAWAT_JALAN',      // or 'RAWAT_INAP'
  clinicalFindings: {
    heartRate: 88,
    respiratoryRate: 22,
    temperature: 36.8,
    severity: 'mild'
  }
});

// result.inaCbgCode → 'J-3-13'
// result.cmgCode → 'J-3-13'
// result.severity → 'I'
// result.confidence → 0.95
```

### With Kelas RS Check

```typescript
const result = await groupClaimToCmg({
  diagnosisCodes: ['N19'],
  procedureCodes: ['3995'],        // Hemodialysis
  serviceType: 'RAWAT_INAP',
  kelasRs: 'D'                     // Check Kelas D restrictions
});

// result.klasD.hasTopUp → false
// result.klasD.warning → "CMG SD tidak berlaku top-up untuk Kelas D..."
```

### Complete Workflow

```typescript
import { runClaimSuggestionWorkflow } from '@/lib/claimSuggestionWorkflow';

const workflowResult = await runClaimSuggestionWorkflow(
  {
    recordId: 'REC001',
    patientName: 'Firdan',
    medicalRecordNumber: 'MR123',
    admissionDate: '2026-09-01',
    serviceType: 'RAWAT_JALAN',
    diagnosisCodes: ['J45.9'],
    procedureCodes: ['9394'],
    clinicalFindings: {
      heartRate: 88,
      respiratoryRate: 22
    }
  },
  'A' // Kelas RS
);

// workflowResult includes:
// - step3_grouping: INA-CBG grouping
// - step4_tariff: Tariff lookup result
// - step5_calculation: Claim calculation
// - step6_specialRules: PRB, Kelas D checks
// - step7_suggestions: User suggestions
// - overallConfidence: Combined confidence score
```

### React Component

```typescript
import { InaCbgGroupingCard } from '@/components/InaCbgGroupingCard';

export function VerificationPage() {
  const [groupingResult, setGroupingResult] = useState<GroupingResult>();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const handleApplySuggestion = (suggestion: Suggestion) => {
    // Apply suggestion to form/record
    console.log('Applied:', suggestion);
  };

  return (
    <InaCbgGroupingCard
      groupingResult={groupingResult!}
      suggestions={suggestions}
      onApplySuggestion={handleApplySuggestion}
    />
  );
}
```

## Grouping Rules

### Supported CMG Groups

Currently implemented grouping rules:

| Diagnosis | Service | CMG Code | Description |
|-----------|---------|----------|-------------|
| J45.x | Rawat Jalan | J-3-13 | Asthma with procedure (e.g., spirometry) |
| J45.x | Rawat Jalan | J-3-12 | Asthma without procedure |
| J45.x | Rawat Inap | J-1-1 | Uncomplicated asthma inpatient |
| J45.9x | Rawat Inap | J-1-2 | Severe asthma inpatient |
| K25.x | Rawat Jalan | K-4-17 | Gastric ulcer |
| K26.x | Rawat Jalan | K-4-18 | Duodenal ulcer |
| K25-K26 | Rawat Inap | K-1-8 | Uncomplicated peptic ulcer |
| K25-K26 + hemorrhage | Rawat Inap | K-1-9 | Peptic ulcer with hemorrhage |
| E10.x | Rawat Jalan | E-4-1 | Type 1 diabetes |
| E11.x | Rawat Jalan | E-4-3 | Type 2 diabetes |
| I10-I15.x | Rawat Jalan | I-4-1 | Hypertension |
| I10-I15 + crisis | Rawat Inap | I-1-2 | Hypertensive crisis |

**To add more rules:** Edit `GROUPING_RULES` array in `inaCbgGroupingService.ts`

## Severity Levels

Severity determined from clinical findings:

### Level I (Mild)
- HR: 60-100, RR: 12-24
- Temperature: < 38°C
- No severe symptoms

### Level II (Moderate)
- HR: 100-120 or < 60, RR: 25-30
- Temperature: 38-39°C
- Moderate distress

### Level III (Severe)
- HR: > 120 or < 60, RR: > 30
- Temperature: > 39°C
- Severe symptoms/critical

**Severity affects:** Tariff calculation, top-up eligibility, claim coverage

## Special CMG Types

| Type | Description | Kelas D Restriction | Example |
|------|-------------|-------------------|---------|
| SP | Prosedur Pembedahan (Surgery) | ✓ Yes | Cholecystectomy |
| SR | Radiologi (Radiology) | No | X-ray, CT scan |
| SI | Intervensi Non-Bedah (Intervention) | No | Endoscopy, dialysis |
| SD | Dialisis (Dialysis) | ✓ Yes | Hemodialysis |
| SUBAKUT | Perawatan Subakut (Subacute care) | No | Transitional care |
| KRONIS | Perawatan Kronis (Chronic care) | No | Diabetes, HTN mgmt |

**Kelas D Note:** When kelasRs='D', top-up not allowed for SP & SD types.

## Kelas D Restrictions

Kelas D is the lowest hospital class and has limited top-up options:

```typescript
// Example: Dialysis in Kelas D
const result = await groupClaimToCmg({
  diagnosisCodes: ['N19'],
  procedureCodes: ['3995'],
  serviceType: 'RAWAT_INAP',
  kelasRs: 'D'
});

result.klasD.hasTopUp; // false
result.klasD.warning;  // "CMG SD tidak berlaku top-up untuk Kelas D: Dialisis..."
```

**Affected CMG Types:**
- SP (Surgery) - Special CMG procedures
- SD (Dialysis) - Dialysis procedures

**Reference:** PMK 3/2023 Part II, pages 85-91

## Confidence Scoring

Confidence indicates how certain the grouping is:

- **0.95+** - Very high (diagnosis + procedure match)
- **0.70-0.94** - High (diagnosis only match)
- **0.50-0.69** - Medium (fallback rule used)
- **< 0.50** - Low (no specific rule found, using default)

**Warnings triggered at < 0.70** - User should manually review

## Test Cases

### Test 1: Firdan - Asthma with Spirometry

```typescript
const input: ClaimGroupingInput = {
  diagnosisCodes: ['J45.9'],
  procedureCodes: ['9394'],    // Spirometry
  serviceType: 'RAWAT_JALAN',
};

const result = await groupClaimToCmg(input);
// Expected:
// - inaCbgCode: 'J-3-13'
// - confidence: 0.95
// - debugInfo.matchedRule: 'asthma_outpatient_procedure_9394'
```

### Test 2: ELVINA - Gastric Ulcer

```typescript
const input: ClaimGroupingInput = {
  diagnosisCodes: ['K25.5'],
  procedureCodes: [],
  serviceType: 'RAWAT_JALAN',
  clinicalFindings: {
    severity: 'mild',
    heartRate: 72
  }
};

const result = await groupClaimToCmg(input);
// Expected:
// - cmgCode: 'K-4-17'
// - severity: 'I'
// - inaCbgCode: 'K-4-17-I'
```

### Test 3: Kelas D Dialysis

```typescript
const input: ClaimGroupingInput = {
  diagnosisCodes: ['N19'],
  procedureCodes: ['3995'],
  serviceType: 'RAWAT_INAP',
  kelasRs: 'D'
};

const result = await groupClaimToCmg(input);
// Expected:
// - specialCmg.type: 'SD'
// - klasD.hasTopUp: false
// - klasD.warning: Contains "Kelas D"
```

## API Reference

### `groupClaimToCmg(input: ClaimGroupingInput): Promise<GroupingResult>`

Main grouping function.

**Parameters:**
```typescript
interface ClaimGroupingInput {
  diagnosisCodes: string[];              // ICD-10 codes (required)
  procedureCodes?: string[];             // ICD-9 codes (optional)
  serviceType: 'RAWAT_JALAN' | 'RAWAT_INAP';
  kelasRs?: 'A' | 'B' | 'C' | 'D';
  clinicalFindings?: {
    heartRate?: number;
    respiratoryRate?: number;
    bloodPressureSystolic?: number;
    bloodPressureDiastolic?: number;
    temperature?: number;
    severity?: 'mild' | 'moderate' | 'severe';
    complication?: string;
  };
}
```

**Returns:**
```typescript
interface GroupingResult {
  inaCbgCode: string;          // Final code with severity (e.g., 'K-4-17-I')
  cmgCode: string;             // Base CMG code (e.g., 'K-4-17')
  severity?: 'I' | 'II' | 'III';
  specialCmg?: {
    type: 'SP' | 'SR' | 'SI' | 'SD' | 'SUBAKUT' | 'KRONIS';
    reason?: string;
  };
  klasD?: {
    hasTopUp: boolean;
    applicableToDClassOnly?: boolean;
    warning?: string;
  };
  confidence: number;          // 0-1 confidence score
  debugInfo?: {
    matchedDiagnosis?: string;
    matchedProcedure?: string;
    matchedRule?: string;
  };
}
```

### `validateCbgCode(code: string): { valid: boolean; error?: string }`

Validate CBG code format.

**Accepted formats:**
- `J-3-13` (3-part code)
- `K-4-17-I` (with severity)
- `E-4-1-III` (with Roman numeral severity)

### `extractCmgPrefix(cbgCode: string): string`

Extract CMG prefix from full code.

```typescript
extractCmgPrefix('K-4-17-I'); // 'K-4-17'
```

### `compareCbgCodes(current: string, previous: string): ComparisonResult`

Compare two CBG codes to detect changes.

```typescript
const result = compareCbgCodes('K-4-17-II', 'K-4-17-I');
// { same: false, severity_changed: 'upgraded' }
```

## Integration Checklist

- [ ] Import service in verification component
- [ ] Extract diagnosis codes from PDF/SIMRS
- [ ] Extract procedure codes from PDF/SIMRS
- [ ] Extract clinical findings (HR, RR, temp, severity)
- [ ] Call `groupClaimToCmg()` with extracted data
- [ ] Display results in `InaCbgGroupingCard` component
- [ ] Handle suggestions (errors, warnings, infos)
- [ ] Pass grouping result to tariff lookup (step 4)
- [ ] Apply Kelas D restrictions if applicable
- [ ] Generate final suggestions for user

## Troubleshooting

### CMG returns "UNKNOWN"
- Check if diagnosis codes are valid ICD-10
- Verify service type is correct
- See if diagnosis/procedure combination has no matching rule

### Low confidence (< 0.7)
- Consider adding procedure code if available
- Verify diagnosis code spelling/format
- Add clinical findings for better severity detection

### Kelas D top-up restriction not detected
- Verify `kelasRs: 'D'` is passed in input
- Check if diagnosis/procedure matches Special CMG pattern
- Review `SPECIAL_CMG_RULES` for your case

### Test fails in production
- Add PMK 3/2023 compliant diagnosis-to-CMG mappings
- Update `GROUPING_RULES` with actual government references
- Validate against official INA-CBG master tables

## References

- **PMK 3/2023** - Peraturan Menteri Kesehatan No. 3 Tahun 2023
- **Bagian I (hal. 31-59)** - CMG Grouping rules & tables
- **Bagian II (hal. 85-91)** - Special CMG criteria & Kelas restrictions
- **ICD-10-CM** - Diagnosis code standards
- **ICD-9-CM** - Procedure code standards

## Future Enhancements

- [ ] Add more CMG groups from PMK 3/2023
- [ ] Implement complication-based severity escalation
- [ ] Add support for bundled procedures (SP codes)
- [ ] Track grouping changes for audit trail
- [ ] Export grouping report for verification
- [ ] Integration with BPP master data API

## License

Internal - eClaim Project
