'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useMemo } from 'react';
import { CheckCircle2, XCircle, AlertCircle, CircleDot, Circle, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface FieldValidation {
  column_name: string;
  value: string | number | null;
  status: 'valid' | 'error' | 'warning' | 'empty' | 'not_validated';
  rule_id?: string;
  error_message?: string;
  suggestion?: string;
  severity?: 'critical' | 'major' | 'minor';
}

interface DetailedValidationResultsProps {
  recordId: string;
  recordData: Record<string, any>;
  validationErrors: Array<any>;
  vclaimColumns?: string[];
  editMode?: boolean;
  onEdit?: (colName: string, newValue: any) => void;
  editedValues?: Record<string, any>;
}

const VCLAIM_COLUMNS = [
  'KODE_RS', 'KELAS_RS', 'KELAS_RAWAT', 'KODE_TARIF', 'PTD',
  'ADMISSION_DATE', 'DISCHARGE_DATE', 'BIRTH_DATE', 'BIRTH_WEIGHT', 'SEX',
  'DISCHARGE_STATUS', 'DIAGLIST', 'PROCLIST', 'ADL1', 'ADL2',
  'IN_SP', 'IN_SR', 'IN_SI', 'IN_SD', 'INACBG',
  'SUBACUTE', 'CHRONIC', 'SP', 'SR', 'SI',
  'SD', 'DESKRIPSI_INACBG', 'TARIF_INACBG', 'TARIF_SUBACUTE', 'TARIF_CHRONIC',
  'DESKRIPSI_SP', 'TARIF_SP', 'DESKRIPSI_SR', 'TARIF_SR', 'DESKRIPSI_SI',
  'TARIF_SI', 'DESKRIPSI_SD', 'TARIF_SD', 'TOTAL_TARIF', 'TARIF_RS',
  'TARIF_POLI_EKS', 'LOS', 'ICU_INDIKATOR', 'ICU_LOS', 'VENT_HOUR',
  'NAMA_PASIEN', 'MRN', 'UMUR_TAHUN', 'UMUR_HARI', 'DPJP',
  'SEP', 'NOKARTU', 'PAYOR_ID', 'CODER_ID', 'VERSI_INACBG',
  'VERSI_GROUPER', 'C1', 'C2', 'C3', 'C4'
];

const FIELD_MAPPING: Record<string, string> = {
  'KODE_RS': 'kode_rs', 'KELAS_RS': 'kelas_rs', 'KELAS_RAWAT': 'kelas_rawat',
  'KODE_TARIF': 'kode_tarif', 'PTD': 'ptd', 'ADMISSION_DATE': 'admission_date',
  'DISCHARGE_DATE': 'discharge_date', 'BIRTH_DATE': 'birth_date',
  'BIRTH_WEIGHT': 'birth_weight', 'SEX': 'gender', 'DISCHARGE_STATUS': 'discharge_status',
  'DIAGLIST': 'diagnosa_list', 'PROCLIST': 'prosedur_list', 'ADL1': 'adl1', 'ADL2': 'adl2',
  'IN_SP': 'in_sp', 'IN_SR': 'in_sr', 'IN_SI': 'in_si', 'IN_SD': 'in_sd',
  'SUBACUTE': 'subacute', 'CHRONIC': 'chronic', 'SP': 'sp', 'SR': 'sr', 'SI': 'si', 'SD': 'sd',
  'TARIF_SUBACUTE': 'tarif_subacute', 'TARIF_CHRONIC': 'tarif_chronic',
  'TOTAL_TARIF': 'total_tarif', 'TARIF_RS': 'tarif_rs', 'TARIF_POLI_EKS': 'tarif_poli_eks',
  'LOS': 'los', 'ICU_INDIKATOR': 'icu_indikator', 'ICU_LOS': 'icu_los', 'VENT_HOUR': 'vent_hour',
  'NAMA_PASIEN': 'nama_pasien', 'MRN': 'mrn', 'UMUR_TAHUN': 'umur_tahun',
  'UMUR_HARI': 'umur_hari', 'DPJP': 'dpjp_name', 'SEP': 'sep', 'NOKARTU': 'nokartu',
  'PAYOR_ID': 'payor_id', 'CODER_ID': 'coder_id', 'VERSI_INACBG': 'versi_inacbg',
  'VERSI_GROUPER': 'versi_grouper'
};

const VCLAIM_FILLED_COLUMNS = new Set([
  'TARIF_RS', 'CODER_ID', 'VERSI_INACBG', 'VERSI_GROUPER', 'C1', 'C2', 'C3', 'C4'
]);

export default function DetailedValidationResults({
  recordId,
  recordData,
  validationErrors,
  vclaimColumns = VCLAIM_COLUMNS,
  editMode = false,
  onEdit,
  editedValues = {}
}: DetailedValidationResultsProps) {
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'valid'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedColumn, setExpandedColumn] = useState<string | null>(null);

  // Build field validation map
  const fieldValidationMap = useMemo(() => {
    const map: Record<string, FieldValidation> = {};

    // Initialize all columns
    vclaimColumns.forEach(colName => {
      const dbField = FIELD_MAPPING[colName];
      const value = dbField ? recordData[dbField] : null;

      map[colName] = {
        column_name: colName,
        value: value ?? null,
        status: VCLAIM_FILLED_COLUMNS.has(colName) ? 'not_validated' :
                (value === null || value === undefined || value === '') ? 'empty' : 'valid',
      };
    });

    // Mark errors
    validationErrors?.forEach((err: any) => {
      const fieldName = err.field_name || '';
      // Find matching vClaim column
      const colName = Object.entries(FIELD_MAPPING).find(
        ([_, dbField]) => dbField === fieldName
      )?.[0];

      if (colName && map[colName]) {
        map[colName].status = 'error';
        map[colName].rule_id = err.rule_id;
        map[colName].error_message = err.error_message;
        map[colName].severity = err.severity;
        map[colName].suggestion = err.expected_value;
      }
    });

    return map;
  }, [recordData, validationErrors, vclaimColumns]);

  // Filter and search
  const displayColumns = useMemo(() => {
    return Object.values(fieldValidationMap)
      .filter(field => {
        if (filter === 'all') return true;
        if (filter === 'error') return field.status === 'error';
        if (filter === 'warning') return field.status === 'empty';
        if (filter === 'valid') return field.status === 'valid' || field.status === 'not_validated';
        return true;
      })
      .filter(field =>
        field.column_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(field.value).toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [fieldValidationMap, filter, searchTerm]);

  const stats = useMemo(() => ({
    total: vclaimColumns.length,
    errors: Object.values(fieldValidationMap).filter(f => f.status === 'error').length,
    warnings: Object.values(fieldValidationMap).filter(f => f.status === 'empty').length,
    valid: Object.values(fieldValidationMap).filter(f => f.status === 'valid' || f.status === 'not_validated').length,
  }), [fieldValidationMap, vclaimColumns]);

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'error': return <XCircle className="size-[18px]" style={{ color: getStatusColor(status) }} />;
      case 'warning': return <AlertCircle className="size-[18px]" style={{ color: getStatusColor(status) }} />;
      case 'valid': return <CheckCircle2 className="size-[18px]" style={{ color: getStatusColor(status) }} />;
      case 'not_validated': return <CircleDot className="size-[18px]" style={{ color: getStatusColor(status) }} />;
      case 'empty': return <Circle className="size-[18px]" style={{ color: getStatusColor(status) }} />;
      default: return <Circle className="size-[18px]" style={{ color: getStatusColor(status) }} />;
    }
  };

  function getStatusColor(status: string) {
    switch (status) {
      case 'error': return '#dc2626';
      case 'warning': return '#f59e0b';
      case 'valid': return '#10b981';
      case 'not_validated': return '#3b82f6';
      case 'empty': return '#9ca3af';
      default: return '#6b7280';
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'error': return 'ERROR';
      case 'warning': return 'EMPTY';
      case 'valid': return 'VALID';
      case 'not_validated': return 'vClaim';
      case 'empty': return 'KOSONG';
      default: return 'UNKNOWN';
    }
  };

  return (
    <div className="mt-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-5 pb-4 border-b flex-wrap gap-3"
      >
        <h3 className="text-base font-bold m-0">
          Validasi Lengkap (60 Kolom vClaim)
        </h3>
        <div className="flex gap-2 items-center flex-wrap">
          {[
            { count: stats.errors, label: 'Error', color: '#dc2626' },
            { count: stats.warnings, label: 'Kosong', color: '#f59e0b' },
            { count: stats.valid, label: 'Valid/vClaim', color: '#10b981' },
          ].map(stat => (
            <motion.div
              key={stat.label}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold border"
              style={{
                background: `${stat.color}15`,
                borderColor: `${stat.color}40`,
                color: stat.color,
              }}
              whileHover={{ scale: 1.05 }}
            >
              <span>{stat.count}</span>
              <span>{stat.label}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Toolbar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex gap-3 mb-5 flex-wrap"
      >
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Cari kolom atau nilai..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filter buttons */}
        {(['all', 'error', 'warning', 'valid'] as const).map(f => (
          <motion.div key={f} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              type="button"
              size="sm"
              variant={filter === f ? 'default' : 'secondary'}
              onClick={() => setFilter(f)}
            >
              {f === 'all' && 'Semua'}
              {f === 'error' && 'Hanya Error'}
              {f === 'warning' && 'Hanya Kosong'}
              {f === 'valid' && 'Hanya Valid'}
            </Button>
          </motion.div>
        ))}
      </motion.div>

      {/* Columns Grid */}
      <motion.div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.03 } }
        }}
        initial="hidden"
        animate="visible"
      >
        <AnimatePresence mode="popLayout">
          {displayColumns.length === 0 ? (
            <motion.div
              key="empty"
              className="col-span-full text-center py-10 text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="mb-2"><Search className="size-8 mx-auto" /></div>
              <div>Tidak ada kolom yang sesuai filter</div>
            </motion.div>
          ) : (
            displayColumns.map((field) => (
              <motion.div
                key={field.column_name}
                onClick={() => setExpandedColumn(
                  expandedColumn === field.column_name ? null : field.column_name
                )}
                className="rounded-lg border p-4 cursor-pointer transition-all"
                style={{
                  borderColor: `${getStatusColor(field.status)}40`,
                  background: `${getStatusColor(field.status)}08`,
                }}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                whileHover={{
                  borderColor: getStatusColor(field.status),
                  boxShadow: `0 4px 12px ${getStatusColor(field.status)}20`,
                  y: -2,
                }}
              >
                {/* Header */}
                <div className="flex items-center gap-2 mb-2.5">
                  <StatusIcon status={field.status} />
                  <div className="flex-1">
                    <div
                      className="text-xs font-bold uppercase tracking-wide"
                      style={{ color: getStatusColor(field.status) }}
                    >
                      {field.column_name}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {getStatusLabel(field.status)}
                    </div>
                  </div>
                </div>

                {/* Value Box */}
                {editMode && !VCLAIM_FILLED_COLUMNS.has(field.column_name) ? (
                  <textarea
                    value={String(editedValues[field.column_name] !== undefined ? editedValues[field.column_name] : field.value || '')}
                    onChange={(e) => onEdit?.(field.column_name, e.target.value)}
                    className="w-full min-h-[50px] rounded-md border bg-background px-3 py-2.5 text-[11px] font-mono resize-y outline-none"
                    style={{
                      borderColor: editedValues[field.column_name] !== undefined ? '#3b82f6' : getStatusColor(field.status),
                    }}
                  />
                ) : (
                  <div
                    className={cn(
                      'rounded-md border bg-background px-3 py-2.5 mb-2.5 font-mono text-xs break-words min-h-[28px] flex items-center',
                      field.status === 'error' ? 'text-destructive' : 'text-foreground',
                    )}
                    style={{
                      borderColor: `${editedValues[field.column_name] !== undefined ? '#3b82f6' : getStatusColor(field.status)}30`,
                    }}
                  >
                    {field.value === null || field.value === undefined || field.value === ''
                      ? <span className="text-muted-foreground italic">(kosong)</span>
                      : String(field.value).substring(0, 50)
                    }
                  </div>
                )}

                {/* Error Details */}
                {field.status === 'error' && field.error_message && (
                  <motion.div
                    className="rounded-md border px-2.5 py-2 text-[11px] leading-relaxed"
                    style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#7f1d1d' }}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <div className="font-semibold mb-1">
                      {field.rule_id}: {field.severity?.toUpperCase()}
                    </div>
                    <div>{field.error_message}</div>
                    {field.suggestion && (
                      <div className="mt-1.5 px-2 py-1.5 rounded" style={{ background: '#fee2e2' }}>
                        <strong>Saran:</strong> {field.suggestion}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Expand Indicator */}
                {(field.status === 'error' || field.value) && (
                  <motion.div
                    className="text-[11px] text-muted-foreground text-center mt-2 pt-2 border-t"
                    animate={{ opacity: expandedColumn === field.column_name ? 1 : 0.5 }}
                  >
                    {expandedColumn === field.column_name ? '▲ Sembunyikan' : '▼ Detail'}
                  </motion.div>
                )}
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </motion.div>

      {/* Summary Footer */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-6 rounded-lg border p-4 text-xs text-muted-foreground"
        style={{ background: 'linear-gradient(135deg, var(--muted) 0%, var(--secondary) 100%)' }}
      >
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <strong className="text-foreground">Total {stats.total} kolom vClaim</strong>
            <div className="text-[11px] mt-1">
              Kolom ditandai dengan indikator biru akan diisi oleh sistem vClaim secara otomatis
            </div>
          </div>
          <div className="flex gap-4 items-center">
            <div className="text-right">
              <div className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400">
                {stats.valid}/{stats.total}
              </div>
              <div>Valid / OK</div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
