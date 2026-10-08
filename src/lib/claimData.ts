export type ClaimFieldValue = string | number | null;
export interface ClaimValidationIssue {
  field_name?: string; rule_id?: string; error_message?: string;
  expected_value?: string; severity?: 'critical' | 'major' | 'minor';
}
export function fieldValue(value: unknown): ClaimFieldValue {
  return typeof value === 'string' || typeof value === 'number' ? value : null;
}
export function jsonObject(value: unknown): Record<string, unknown> {
  try {
    const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch { return {}; }
}

export function claimPercentage(count: number, total: number): number {
  if (!Number.isFinite(count) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.min(100, Math.max(0, (count / total) * 100));
}
