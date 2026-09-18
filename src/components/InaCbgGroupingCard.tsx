'use client';
/**
 * INA-CBG Grouping Card Component
 * Displays CMG grouping results and suggestions in the verification UI.
 * Used in the suggestion workflow after diagnoses and procedures are extracted.
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GroupingResult } from '@/lib/inaCbgGroupingService';
import type { Suggestion } from '@/lib/claimSuggestionWorkflow';

interface InaCbgGroupingCardProps {
  groupingResult: GroupingResult;
  suggestions?: Suggestion[];
  onApplySuggestion?: (suggestion: Suggestion) => void;
  loading?: boolean;
}

export function InaCbgGroupingCard({
  groupingResult,
  suggestions = [],
  onApplySuggestion,
  loading = false,
}: InaCbgGroupingCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (section: string) => {
    const newSections = new Set(expandedSections);
    if (newSections.has(section)) {
      newSections.delete(section);
    } else {
      newSections.add(section);
    }
    setExpandedSections(newSections);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600 dark:text-green-400';
    if (confidence >= 0.7) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.9) return 'Sangat Yakin';
    if (confidence >= 0.7) return 'Cukup Yakin';
    return 'Kurang Yakin';
  };

  const getStatusIcon = (type: string) => {
    switch (type) {
      case 'ERROR':
        return <AlertCircle className="size-4 text-red-600 dark:text-red-400" />;
      case 'WARNING':
        return <AlertTriangle className="size-4 text-yellow-600 dark:text-yellow-400" />;
      case 'INFO':
        return <Info className="size-4 text-blue-600 dark:text-blue-400" />;
      case 'CORRECTION':
        return <CheckCircle className="size-4 text-green-600 dark:text-green-400" />;
      default:
        return null;
    }
  };

  const filteredSuggestions = {
    errors: suggestions.filter(s => s.type === 'ERROR'),
    warnings: suggestions.filter(s => s.type === 'WARNING'),
    corrections: suggestions.filter(s => s.type === 'CORRECTION'),
    infos: suggestions.filter(s => s.type === 'INFO'),
  };

  const hasCriticalIssues = filteredSuggestions.errors.length > 0;

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-card">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-semibold',
          'hover:bg-muted/50 transition-colors',
          hasCriticalIssues && 'bg-red-50 dark:bg-red-950/20'
        )}
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
          <span className="text-foreground">Grouping INA-CBG</span>
        </div>
        <div className="flex items-center gap-2">
          {loading ? (
            <span className="text-xs text-muted-foreground">Memproses...</span>
          ) : (
            <>
              <span className={cn(
                'font-mono text-base',
                hasCriticalIssues ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
              )}>
                {groupingResult.inaCbgCode}
              </span>
              <span className={cn(
                'text-xs',
                getConfidenceColor(groupingResult.confidence)
              )}>
                {getConfidenceLabel(groupingResult.confidence)}
              </span>
            </>
          )}
        </div>
      </button>

      {expanded && !loading && (
        <div className="border-t border-border divide-y divide-border">
          {/* CMG Code Section */}
          <div className="px-4 py-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-1">CMG Code</div>
                <div className="font-mono text-base">{groupingResult.cmgCode}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-1">Confidence</div>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full transition-colors',
                        groupingResult.confidence >= 0.9
                          ? 'bg-green-600'
                          : groupingResult.confidence >= 0.7
                          ? 'bg-yellow-600'
                          : 'bg-red-600'
                      )}
                      style={{ width: `${groupingResult.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold">
                    {(groupingResult.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Severity Section */}
          {groupingResult.severity && (
            <div className="px-4 py-3">
              <div className="text-xs font-semibold text-muted-foreground mb-2">Tingkat Keparahan</div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/20">
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                  Level {groupingResult.severity}
                </span>
              </div>
            </div>
          )}

          {/* Special CMG Section */}
          {groupingResult.specialCmg?.type && (
            <div className="px-4 py-3">
              <div className="text-xs font-semibold text-muted-foreground mb-2">Special CMG</div>
              <div className="space-y-1">
                <div className="font-semibold text-sm">{groupingResult.specialCmg.type}</div>
                {groupingResult.specialCmg.reason && (
                  <div className="text-xs text-muted-foreground">{groupingResult.specialCmg.reason}</div>
                )}
              </div>
            </div>
          )}

          {/* Kelas D Restrictions */}
          {groupingResult.klasD && (
            <div className={cn(
              'px-4 py-3',
              !groupingResult.klasD.hasTopUp && 'bg-yellow-50 dark:bg-yellow-950/10'
            )}>
              <div className="text-xs font-semibold text-muted-foreground mb-2">Kelas D</div>
              <div className="flex items-start gap-2">
                <div className={cn(
                  'mt-0.5 shrink-0 size-4 rounded-full',
                  groupingResult.klasD.hasTopUp
                    ? 'bg-green-100 dark:bg-green-900/30'
                    : 'bg-yellow-100 dark:bg-yellow-900/30'
                )}>
                  <div className={cn(
                    'size-full rounded-full flex items-center justify-center text-xs font-bold',
                    groupingResult.klasD.hasTopUp
                      ? 'text-green-700 dark:text-green-300'
                      : 'text-yellow-700 dark:text-yellow-300'
                  )}>
                    {groupingResult.klasD.hasTopUp ? '✓' : '✗'}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">
                    {groupingResult.klasD.hasTopUp ? 'Top-up Berlaku' : 'Top-up Tidak Berlaku'}
                  </div>
                  {groupingResult.klasD.warning && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {groupingResult.klasD.warning}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Debug Info Section */}
          {groupingResult.debugInfo && (
            <div
              className="px-4 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => toggleSection('debug')}
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                {expandedSections.has('debug') ? (
                  <ChevronDown className="size-3" />
                ) : (
                  <ChevronRight className="size-3" />
                )}
                <span>Debug Info</span>
              </div>
              {expandedSections.has('debug') && (
                <div className="mt-2 space-y-1 text-xs font-mono text-muted-foreground">
                  <div>
                    <span className="text-foreground">Matched Diagnosis:</span> {groupingResult.debugInfo.matchedDiagnosis || '-'}
                  </div>
                  <div>
                    <span className="text-foreground">Matched Rule:</span> {groupingResult.debugInfo.matchedRule || '-'}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Suggestions Section */}
      {suggestions.length > 0 && (
        <div className="border-t border-border">
          <button
            type="button"
            onClick={() => toggleSection('suggestions')}
            className="w-full flex items-center gap-2 px-4 py-3 text-xs font-semibold hover:bg-muted/50 transition-colors"
          >
            {expandedSections.has('suggestions') ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
            <span>Saran & Peringatan ({suggestions.length})</span>
            {filteredSuggestions.errors.length > 0 && (
              <span className="ml-auto text-xs font-bold text-red-600 dark:text-red-400">
                {filteredSuggestions.errors.length} Error
              </span>
            )}
            {filteredSuggestions.warnings.length > 0 && (
              <span className="ml-auto text-xs font-bold text-yellow-600 dark:text-yellow-400">
                {filteredSuggestions.warnings.length} Warning
              </span>
            )}
          </button>

          {expandedSections.has('suggestions') && (
            <div className="px-4 py-3 space-y-2 max-h-96 overflow-y-auto">
              {/* Errors */}
              {filteredSuggestions.errors.map((suggestion, idx) => (
                <SuggestionItem
                  key={`error-${idx}`}
                  suggestion={suggestion}
                  icon={getStatusIcon(suggestion.type)}
                  onApply={onApplySuggestion}
                  severity="error"
                />
              ))}

              {/* Warnings */}
              {filteredSuggestions.warnings.map((suggestion, idx) => (
                <SuggestionItem
                  key={`warning-${idx}`}
                  suggestion={suggestion}
                  icon={getStatusIcon(suggestion.type)}
                  onApply={onApplySuggestion}
                  severity="warning"
                />
              ))}

              {/* Corrections */}
              {filteredSuggestions.corrections.map((suggestion, idx) => (
                <SuggestionItem
                  key={`correction-${idx}`}
                  suggestion={suggestion}
                  icon={getStatusIcon(suggestion.type)}
                  onApply={onApplySuggestion}
                  severity="success"
                />
              ))}

              {/* Infos */}
              {filteredSuggestions.infos.map((suggestion, idx) => (
                <SuggestionItem
                  key={`info-${idx}`}
                  suggestion={suggestion}
                  icon={getStatusIcon(suggestion.type)}
                  onApply={onApplySuggestion}
                  severity="info"
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Suggestion Item Component
// ============================================================================

interface SuggestionItemProps {
  suggestion: Suggestion;
  icon?: React.ReactNode;
  onApply?: (suggestion: Suggestion) => void;
  severity: 'error' | 'warning' | 'success' | 'info';
}

function SuggestionItem({ suggestion, icon, onApply, severity }: SuggestionItemProps) {
  const bgMap = {
    error: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50',
    warning: 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900/50',
    success: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/50',
    info: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50',
  };

  const textMap = {
    error: 'text-red-900 dark:text-red-200',
    warning: 'text-yellow-900 dark:text-yellow-200',
    success: 'text-green-900 dark:text-green-200',
    info: 'text-blue-900 dark:text-blue-200',
  };

  return (
    <div className={cn('rounded border p-3', bgMap[severity])}>
      <div className="flex items-start gap-3">
        {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
        <div className="flex-1 min-w-0">
          <div className={cn('text-xs font-semibold', textMap[severity])}>
            {suggestion.title}
            {suggestion.reference && (
              <span className="ml-1 text-muted-foreground">({suggestion.reference})</span>
            )}
          </div>
          <p className={cn('text-xs mt-1', textMap[severity])}>
            {suggestion.description}
          </p>
          {suggestion.suggestedValue && (
            <div className="text-xs mt-2 font-mono">
              <span className="text-muted-foreground">Nilai: </span>
              <span className={textMap[severity]}>{suggestion.suggestedValue}</span>
            </div>
          )}
          {suggestion.action && onApply && (
            <button
              type="button"
              onClick={() => onApply(suggestion)}
              className={cn(
                'text-xs font-semibold mt-2 px-2 py-1 rounded',
                'hover:opacity-80 transition-opacity',
                severity === 'error' ? 'text-red-700 dark:text-red-300' : 'text-current'
              )}
            >
              {suggestion.action === 'APPLY' && 'Terapkan'}
              {suggestion.action === 'REVIEW' && 'Periksa'}
              {suggestion.action === 'CONTACT_IT' && 'Hubungi IT'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
