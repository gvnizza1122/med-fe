'use client';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lightbulb, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Copy } from 'lucide-react';
import type {
  SuggestionFinalResult,
  CodeWithCitation,
} from '@/lib/suggestCodingService';
import { cn } from '@/lib/utils';

interface SuggestionCodesCardProps {
  result: SuggestionFinalResult;
  onApply?: (result: SuggestionFinalResult) => void;
}

export function SuggestionCodesCard({
  result,
  onApply,
}: SuggestionCodesCardProps) {
  const [expandedAlternatives, setExpandedAlternatives] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const renderCodeWithCitation = (code: CodeWithCitation, type: 'diagnosis' | 'procedure') => (
    <div
      key={`${type}-${code.code}`}
      className="mb-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <code className="font-mono font-bold text-base text-blue-700 dark:text-blue-300">
              {code.code}
            </code>
            <Badge
              variant="outline"
              className={cn(
                'text-xs',
                code.confidence === 'high'
                  ? 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-100'
                  : code.confidence === 'medium'
                    ? 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900 dark:text-yellow-100'
                    : 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900 dark:text-orange-100'
              )}
            >
              {code.confidence}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {code.system}
            </Badge>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{code.description}</p>
          <div className="bg-white dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700 mb-2">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              Kutipan Dokumen (Halaman {code.page_number}):
            </p>
            <p className="text-xs text-gray-700 dark:text-gray-300 italic">
              &ldquo;{code.quotation}&rdquo;
            </p>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
            <strong>Alasan:</strong> {code.reasoning}
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleCopyCode(code.code)}
          className="flex-shrink-0"
        >
          <Copy className={cn('w-4 h-4', copiedCode === code.code && 'text-green-600')} />
        </Button>
      </div>
    </div>
  );

  return (
    <Card className="w-full p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        <h3 className="font-bold text-lg text-blue-900 dark:text-blue-100">
          Saran Koding dengan Bukti Dokumen
        </h3>
      </div>

      {/* Patient & Case Info */}
      <div className="mb-4 p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="font-semibold text-gray-700 dark:text-gray-300">Pasien:</span>{' '}
            <span className="text-gray-600 dark:text-gray-400">{result.patient_name}</span>
          </div>
          <div>
            <span className="font-semibold text-gray-700 dark:text-gray-300">Jenis Klaim:</span>{' '}
            <span className="text-gray-600 dark:text-gray-400">{result.jenis_klaim}</span>
          </div>
        </div>
      </div>

      {/* Diagnosis Codes */}
      <div className="mb-4">
        <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
          Diagnosis ({result.selected_diagnosis_codes.length})
        </h4>
        {result.selected_diagnosis_codes.length > 0 ? (
          result.selected_diagnosis_codes.map((code) =>
            renderCodeWithCitation(code, 'diagnosis')
          )
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-400 p-2 bg-gray-100 dark:bg-gray-800 rounded">
            Tidak ada diagnosis dengan bukti ditemukan.
          </p>
        )}
      </div>

      {/* Procedure Codes */}
      <div className="mb-4">
        <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
          Prosedur ({result.selected_procedure_codes.length})
        </h4>
        {result.selected_procedure_codes.length > 0 ? (
          result.selected_procedure_codes.map((code) =>
            renderCodeWithCitation(code, 'procedure')
          )
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-400 p-2 bg-gray-100 dark:bg-gray-800 rounded">
            Tidak ada prosedur dengan bukti ditemukan.
          </p>
        )}
      </div>

      {/* INA-CBG Result */}
      <div className="mb-4 p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
        <h4 className="font-bold text-green-900 dark:text-green-100 mb-2">Hasil Grouping INA-CBG</h4>
        <div className="flex items-end gap-2">
          <div>
            <p className="text-xs text-green-700 dark:text-green-300 mb-1">Kode INA-CBG:</p>
            <code className="font-mono font-bold text-lg text-green-700 dark:text-green-300">
              {result.selected_inacbg}
            </code>
          </div>
          {result.tariff && (
            <div className="ml-auto">
              <p className="text-xs text-green-700 dark:text-green-300 mb-1">Tarif (PMK 3/2023):</p>
              <p className="font-bold text-lg text-green-700 dark:text-green-300">
                Rp {result.tariff.tariff.toLocaleString('id-ID')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Alternatives */}
      {result.alternatives.length > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <button
            onClick={() => setExpandedAlternatives(!expandedAlternatives)}
            className="w-full flex items-center justify-between font-bold text-yellow-900 dark:text-yellow-100 hover:text-yellow-700 dark:hover:text-yellow-200"
          >
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Kode Alternatif ({result.alternatives.length})
            </span>
            {expandedAlternatives ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {expandedAlternatives && (
            <div className="mt-3 space-y-2">
              {result.alternatives.map((alt) => (
                <div
                  key={alt.inacbg_code}
                  className="p-2 bg-white dark:bg-gray-900 rounded border border-yellow-200 dark:border-yellow-800"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-mono font-bold text-yellow-700 dark:text-yellow-300">
                        {alt.inacbg_code} (Alternatif #{alt.rank})
                      </p>
                      <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">
                        <strong>Diagnosis:</strong> {alt.diagnosis_codes.join(', ')}
                      </p>
                      <p className="text-xs text-gray-700 dark:text-gray-300">
                        <strong>Prosedur:</strong> {alt.procedure_codes.join(', ')}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 italic">
                        <strong>Alasan tidak dipilih:</strong> {alt.reason_not_selected}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        <strong>Bukti:</strong> {alt.evidence}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        {onApply && (
          <Button
            onClick={() => onApply(result)}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            Terapkan Saran Koding
          </Button>
        )}
        <Button variant="outline" className="flex-1">
          Baca Penjelasan Lengkap
        </Button>
      </div>

      {/* Timestamp */}
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
        Saran dibuat: {new Date(result.timestamp).toLocaleString('id-ID')}
      </p>
    </Card>
  );
}
