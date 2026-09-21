/**
 * React Hook: useSuggestCoding
 * Menggunakan fitur saran koding dengan loading state + error handling
 */

import { useState, useCallback } from 'react';
import { suggestCoding, type SuggestionFinalResult } from '@/lib/suggestCodingService';

export interface UseSuggestCodingState {
  result: SuggestionFinalResult | null;
  loading: boolean;
  error: string | null;
  progress: number; // 0-100, menunjukkan progress step
  currentStep: 'extract' | 'suggest' | 'group' | 'tariff' | 'alternatives' | 'done' | null;
}

export interface UseSuggestCodingActions {
  suggest: (
    recordId: string,
    diagnosisSentence: string,
    procedureSentence: string,
    jenisKlaim: 'RAWAT_JALAN' | 'RAWAT_INAP',
    patientName: string,
    region?: string,
    kelasRs?: string
  ) => Promise<SuggestionFinalResult | null>;
  reset: () => void;
}

const STEP_PROGRESS: Record<string, number> = {
  extract: 20,
  suggest: 40,
  group: 60,
  tariff: 80,
  alternatives: 95,
  done: 100,
};

const STEP_LABELS: Record<string, string> = {
  extract: 'Mengekstraksi fakta klinis...',
  suggest: 'Menyarankan kode medis...',
  group: 'Mengelompokkan ke INA-CBG...',
  tariff: 'Mencari tarif...',
  alternatives: 'Membuat alternatif...',
  done: 'Selesai!',
};

export function useSuggestCoding(): [UseSuggestCodingState, UseSuggestCodingActions] {
  const [state, setState] = useState<UseSuggestCodingState>({
    result: null,
    loading: false,
    error: null,
    progress: 0,
    currentStep: null,
  });

  const updateProgress = useCallback((step: keyof typeof STEP_PROGRESS) => {
    setState((prev) => ({
      ...prev,
      progress: STEP_PROGRESS[step],
      currentStep: step as any,
    }));
  }, []);

  const suggest = useCallback(
    async (
      recordId: string,
      diagnosisSentence: string,
      procedureSentence: string,
      jenisKlaim: 'RAWAT_JALAN' | 'RAWAT_INAP',
      patientName: string,
      region = 'Regional 1',
      kelasRs = 'D'
    ): Promise<SuggestionFinalResult | null> => {
      setState({
        result: null,
        loading: true,
        error: null,
        progress: 0,
        currentStep: null,
      });

      try {
        updateProgress('extract');
        await new Promise((r) => setTimeout(r, 500)); // Visual feedback delay

        updateProgress('suggest');
        await new Promise((r) => setTimeout(r, 500));

        updateProgress('group');
        await new Promise((r) => setTimeout(r, 500));

        updateProgress('tariff');
        await new Promise((r) => setTimeout(r, 500));

        updateProgress('alternatives');
        await new Promise((r) => setTimeout(r, 500));

        // Main LLM call
        const result = await suggestCoding(
          recordId,
          diagnosisSentence,
          procedureSentence,
          jenisKlaim,
          patientName,
          region,
          kelasRs
        );

        updateProgress('done');

        setState({
          result,
          loading: false,
          error: null,
          progress: 100,
          currentStep: 'done',
        });

        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Terjadi kesalahan yang tidak diketahui.';

        setState({
          result: null,
          loading: false,
          error: errorMessage,
          progress: 0,
          currentStep: null,
        });

        console.error('[useSuggestCoding] Error:', err);
        return null;
      }
    },
    [updateProgress]
  );

  const reset = useCallback(() => {
    setState({
      result: null,
      loading: false,
      error: null,
      progress: 0,
      currentStep: null,
    });
  }, []);

  return [state, { suggest, reset }];
}

/**
 * Contoh penggunaan di component:
 *
 * ```tsx
 * export function CodingSuggestionFeature({ recordId, record }) {
 *   const [state, { suggest, reset }] = useSuggestCoding();
 *
 *   const handleSuggest = async () => {
 *     await suggest(
 *       recordId,
 *       record.diagnosis_text,
 *       record.procedure_text,
 *       record.jenis_klaim,
 *       record.nama_pasien
 *     );
 *   };
 *
 *   return (
 *     <div className="space-y-4">
 *       {state.loading && (
 *         <div className="p-4 bg-blue-50 rounded">
 *           <div className="flex items-center gap-2 mb-2">
 *             <Spinner className="w-4 h-4" />
 *             <span>{STEP_LABELS[state.currentStep || 'extract']}</span>
 *           </div>
 *           <div className="w-full bg-gray-200 rounded h-2">
 *             <div
 *               className="bg-blue-600 h-2 rounded transition-all"
 *               style={{ width: `${state.progress}%` }}
 *             />
 *           </div>
 *         </div>
 *       )}
 *
 *       {state.error && (
 *         <div className="p-4 bg-red-50 border border-red-200 rounded">
 *           <p className="text-red-800">{state.error}</p>
 *         </div>
 *       )}
 *
 *       {state.result && <SuggestionCodesCard result={state.result} />}
 *
 *       {!state.loading && (
 *         <Button onClick={handleSuggest}>
 *           {state.result ? 'Suggest Ulang' : 'Suggest Koding'}
 *         </Button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
