# Panduan Integrasi: Saran Koding ke Results Page

Dokumentasi langkah demi langkah untuk mengintegrasikan fitur saran koding ke halaman hasil (results/[fileId]/page.tsx).

## Quick Start

### 1. Tambahkan Hook ke Results Page

```tsx
// Di file: src/app/(dashboard)/results/[fileId]/page.tsx

import { useSuggestCoding } from '@/hooks/useSuggestCoding';
import { SuggestionCodesCard } from '@/components/SuggestionCodesCard';

export default function ResultsPage() {
  const [suggestState, { suggest: suggestCoding, reset }] = useSuggestCoding();
  
  // ... rest of component
}
```

### 2. Tambahkan Suggestion Button di FieldRow

Tambahkan button "Suggest Koding" di setiap row diagnosis atau procedure field:

```tsx
// Di bagian render FieldRow untuk DIAGLIST/PROCLIST:

{columnName === 'DIAGLIST' && row.status !== 'valid' && (
  <Button
    size="sm"
    variant="outline"
    onClick={() => handleSuggestForDiagnosis(row)}
    className="gap-1"
  >
    <Lightbulb className="w-3 h-3" />
    Suggest Koding
  </Button>
)}
```

### 3. Implement Handler Function

```tsx
const handleSuggestForDiagnosis = async (diagRow: FieldRow) => {
  // Ekstrak diagnosis dari field value atau documen
  const diagnosisSentence = diagRow.value || record.diagnosis_text;
  
  // Ekstrak procedure dari PROCLIST row (cari di field map)
  const procRow = fieldMap['PROCLIST'];
  const procedureSentence = procRow?.value || '';
  
  // Call suggest
  await suggestCoding(
    record.id,
    String(diagnosisSentence),
    String(procedureSentence),
    record.jenis_klaim as any,
    record.nama_pasien
  );
};
```

### 4. Tampilkan Hasil & Loading

```tsx
{suggestState.loading && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <Card className="p-6 w-96">
      <div className="flex items-center gap-2 mb-4">
        <Spinner className="w-5 h-5" />
        <span className="font-semibold">Memproses saran koding...</span>
      </div>
      <div className="w-full bg-gray-200 rounded h-2 overflow-hidden">
        <div
          className="bg-blue-600 h-2 rounded transition-all duration-300"
          style={{ width: `${suggestState.progress}%` }}
        />
      </div>
      <p className="text-sm text-gray-600 mt-2 text-center">
        {suggestState.currentStep === 'extract' && 'Mengekstraksi fakta klinis...'}
        {suggestState.currentStep === 'suggest' && 'Menyarankan kode medis...'}
        {suggestState.currentStep === 'group' && 'Mengelompokkan ke INA-CBG...'}
        {suggestState.currentStep === 'tariff' && 'Mencari tarif...'}
        {suggestState.currentStep === 'alternatives' && 'Membuat alternatif...'}
      </p>
    </Card>
  </div>
)}

{suggestState.error && (
  <AlertDialog open={!!suggestState.error}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Gagal Suggest Koding</AlertDialogTitle>
        <AlertDialogDescription>{suggestState.error}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogAction onClick={() => suggestState.reset()}>
        Tutup
      </AlertDialogAction>
    </AlertDialogContent>
  </AlertDialog>
)}

{suggestState.result && (
  <div className="fixed inset-0 bg-black/50 z-40" onClick={reset} />
)}

{suggestState.result && (
  <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-96 max-h-[90vh] overflow-y-auto">
    <Button
      size="sm"
      variant="ghost"
      onClick={reset}
      className="absolute top-2 right-2"
    >
      ✕
    </Button>
    <SuggestionCodesCard
      result={suggestState.result}
      onApply={(result) => {
        // Apply suggestion to form
        applyCodesFromSuggestion(result);
        reset();
      }}
    />
  </div>
)}
```

## Integration Points

### A. Data Flow: Record → Suggestion

```
User clicks "Suggest Koding" on DIAGLIST row
    ↓
extractClinicalFacts() extracts from Resume Medis + doc pages
    ↓
suggestCodesWithCitations() — LLM suggest ICD codes with quotes
    ↓
groupCodesToInaCBG() — INA-CBG grouping (blind to tariff)
    ↓
lookupTariff() — PMK 3/2023 tariff lookup
    ↓
generateAlternatives() — Alternative codes with reasoning
    ↓
SuggestionCodesCard displays result to verifikator
    ↓
User clicks "Apply" → applyCodesFromSuggestion() updates form
    ↓
verifikator submits changes → backend saves
```

### B. Apply Codes to Form

```tsx
const applyCodesFromSuggestion = (result: SuggestionFinalResult) => {
  // Apply diagnosis codes
  if (result.selected_diagnosis_codes.length > 0) {
    // Update DIAGLIST field
    const newDiagValue = result.selected_diagnosis_codes
      .map((c) => c.code)
      .join(', ');
    
    updateFieldValue('DIAGLIST', newDiagValue);
    
    // Optional: Tambah note dengan kutipan
    updateFieldValue('DIAGLIST_NOTES', 
      result.selected_diagnosis_codes
        .map((c) => `${c.code}: "${c.quotation}" (hal. ${c.page_number})`)
        .join('\n')
    );
  }
  
  // Apply procedure codes
  if (result.selected_procedure_codes.length > 0) {
    const newProcValue = result.selected_procedure_codes
      .map((c) => c.code)
      .join(', ');
    
    updateFieldValue('PROCLIST', newProcValue);
  }
  
  // Optional: Auto-fill INA-CBG jika kosong
  if (!fieldMap['INACBG']?.value && result.selected_inacbg) {
    updateFieldValue('INACBG', result.selected_inacbg);
  }
  
  // Mark field as "suggested" (status badge)
  markFieldSuggested('DIAGLIST');
  markFieldSuggested('PROCLIST');
};
```

### C. Audit Trail

Log setiap suggestion untuk audit:

```tsx
const logSuggestion = async (result: SuggestionFinalResult) => {
  await api.request('/api/v1/audit-logs', {
    method: 'POST',
    body: JSON.stringify({
      action: 'suggest_coding',
      record_id: record.id,
      suggestion_result: {
        diagnosis_codes: result.selected_diagnosis_codes.map((c) => c.code),
        procedure_codes: result.selected_procedure_codes.map((c) => c.code),
        inacbg_code: result.selected_inacbg,
        applied: false, // true jika verifikator klik Apply
      },
      timestamp: new Date().toISOString(),
    }),
  });
};
```

## UI Placement Options

### Option 1: Inline Button (Recommended)
Tombol "Suggest Koding" langsung di row DIAGLIST/PROCLIST
- ✅ Kontekstual, user tahu tombol ini untuk field apa
- ✅ Modal popup hasil suggestion tidak overlap table
- ✅ Verifikator bisa compare dokumen + suggestion side-by-side

### Option 2: Sidebar Button
Dedicated button di sidebar tools
- ✅ Tidak menambah complexity ke table row
- ❌ User mungkin tidak tahu feature exists
- ❌ Butuh extra step select field sebelum suggest

### Option 3: Batch Suggest
Auto-suggest semua codes di record sekaligus saat load
- ✅ Verifikator langsung lihat semua saran saat buka record
- ❌ Processing lama buat user wait (15-20 detik)
- ❌ Kalau fail, whole record suggestion gagal

**Rekomendasi: Option 1 (Inline Button)**

## Error Scenarios & Handling

### Scenario 1: Diagnosis Sentence Kosong
```tsx
if (!diagnosisSentence?.trim()) {
  showError('Silakan isi atau salin diagnosis dari dokumen terlebih dahulu.');
  return;
}
```

### Scenario 2: LLM Timeout (>30 detik)
```tsx
const timeout = setTimeout(() => {
  setState(prev => ({
    ...prev,
    error: 'Permintaan memakan waktu terlalu lama. Silakan coba lagi.',
    loading: false
  }));
}, 30000);
```

### Scenario 3: No Codes With Citations Found
```tsx
// Backend akan throw error dengan message:
// "Tidak ada kode dengan bukti dokumen yang valid."
// UI akan show error dialog ke verifikator
```

### Scenario 4: Tariff Lookup Failed
```tsx
// lookupTariff() returns null — proceed normally
// UI will show "Tarif tidak tersedia (data sedang dimuat)"
// Result tetap valid, cuma tariff field kosong
```

## Permission & Access Control

Fitur ini hanya boleh diakses oleh role tertentu:

```tsx
import { useRequireRole } from '@/lib/useRequireRole';

export function SuggestCodingButton() {
  const canAccess = useRequireRole(['verifikator', 'supervisor', 'admin']);
  
  if (!canAccess) {
    return null; // Tombol tidak ditampilkan
  }
  
  return <Button onClick={handleSuggestCoding}>Suggest Koding</Button>;
}
```

## Performance Optimization

### Caching Suggestions
Store hasil suggestion untuk record yang sudah diprocess:

```tsx
const [suggestionCache, setSuggestionCache] = useState<
  Record<string, SuggestionFinalResult>
>({});

const suggest = async (...) => {
  const cacheKey = `${recordId}-${diagnosisSentence}-${procedureSentence}`;
  
  if (suggestionCache[cacheKey]) {
    return suggestionCache[cacheKey];
  }
  
  const result = await suggestCoding(...);
  setSuggestionCache(prev => ({
    ...prev,
    [cacheKey]: result
  }));
  
  return result;
};
```

### Lazy Load Tariff
Tariff lookup bisa async optional:

```tsx
// Main flow tidak wait tariff
const result = await suggestCoding(...); // Tariff = null untuk saat ini
setState({ result, loading: false });

// Background: coba fetch tariff
lookupTariff(result.selected_inacbg).then(tariff => {
  if (tariff) {
    setState(prev => ({
      ...prev,
      result: {
        ...prev.result!,
        tariff
      }
    }));
  }
});
```

## Testing Checklist

- [ ] Test case Firdan: J45.9 + 93.94 + citations
- [ ] Empty diagnosis → error message
- [ ] LLM timeout → graceful error
- [ ] No codes with citation → rejected_codes populated
- [ ] Grouping tanpa tariff as input
- [ ] Tariff lookup null → display "N/A"
- [ ] Alternatives show with reasoning
- [ ] Copy-to-clipboard works
- [ ] Apply codes updates form values
- [ ] Audit log records suggestion
- [ ] Permission check blocks non-verifikator
- [ ] Modal dismissal clears state
- [ ] Multiple suggestions in same session

## Rollout Plan

### Phase 1: Soft Launch (Internal)
- Deploy to staging
- Test with Firdan case + 2-3 real cases
- Verifikator team feedback (1 week)
- Fix any bugs/UX issues

### Phase 2: Beta (Limited Production)
- Deploy to prod but hidden (feature flag off)
- Selected verifikator only (5-10 users)
- Monitor for 1-2 weeks
- Check audit logs for adoption rate

### Phase 3: Full Launch
- Enable feature flag
- All verifikator + supervisor access
- Monitor error rates
- Tweak based on real-world usage

### Phase 4: Iteration
- Collect feedback from verifikator
- Improve LLM prompts based on accuracy
- Add more test cases
- Consider auto-apply for high-confidence suggestions

## Support & Documentation

- User guide PDF: "Cara Menggunakan Fitur Saran Koding"
- Video tutorial: "Workflow Saran Koding di eClaim"
- FAQ doc: Common issues & solutions
- Support channel: #eclaim-support di Slack

## References

- `/src/lib/suggestCodingService.ts` — Main service
- `/src/components/SuggestionCodesCard.tsx` — UI component
- `/src/hooks/useSuggestCoding.ts` — React hook
- `CODING_SUGGESTION_ARCHITECTURE.md` — Architecture docs
