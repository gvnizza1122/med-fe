'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useMemo } from 'react';

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
  'INACBG', 'DESKRIPSI_INACBG', 'TARIF_INACBG', 'DESKRIPSI_SP', 'TARIF_SP',
  'DESKRIPSI_SR', 'TARIF_SR', 'DESKRIPSI_SI', 'TARIF_SI', 'DESKRIPSI_SD', 'TARIF_SD',
  'C1', 'C2', 'C3', 'C4'
]);

export default function DetailedValidationResults({
  recordId,
  recordData,
  validationErrors,
  vclaimColumns = VCLAIM_COLUMNS
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'valid': return '✅';
      case 'not_validated': return '🔷';
      case 'empty': return '⚪';
      default: return '•';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'error': return '#dc2626';
      case 'warning': return '#f59e0b';
      case 'valid': return '#10b981';
      case 'not_validated': return '#3b82f6';
      case 'empty': return '#9ca3af';
      default: return '#6b7280';
    }
  };

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
    <div style={{ marginTop: 24 }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
          paddingBottom: 16,
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
          📋 Validasi Lengkap (60 Kolom vClaim)
        </h3>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { count: stats.errors, label: 'Error', color: '#dc2626' },
              { count: stats.warnings, label: 'Kosong', color: '#f59e0b' },
              { count: stats.valid, label: 'Valid/vClaim', color: '#10b981' },
            ].map(stat => (
              <motion.div
                key={stat.label}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: `${stat.color}15`,
                  border: `1px solid ${stat.color}40`,
                  fontSize: 12,
                  fontWeight: 600,
                  color: stat.color,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
                whileHover={{ scale: 1.05 }}
              >
                <span>{stat.count}</span>
                <span>{stat.label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Toolbar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        {/* Search */}
        <div style={{
          flex: 1,
          minWidth: 200,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          padding: '8px 12px',
        }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>🔍</span>
          <input
            type="text"
            placeholder="Cari kolom atau nilai..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: 13,
              color: 'var(--text-primary)',
            }}
          />
        </div>

        {/* Filter buttons */}
        {['all', 'error', 'warning', 'valid'].map(f => (
          <motion.button
            key={f}
            onClick={() => setFilter(f as any)}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              background: filter === f ? 'var(--primary)' : 'var(--surface)',
              color: filter === f ? 'white' : 'var(--text-primary)',
              transition: 'all 0.2s',
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {f === 'all' && 'Semua'}
            {f === 'error' && 'Hanya Error'}
            {f === 'warning' && 'Hanya Kosong'}
            {f === 'valid' && 'Hanya Valid'}
          </motion.button>
        ))}
      </motion.div>

      {/* Columns Grid */}
      <motion.div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 12,
        }}
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
              style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                padding: 40,
                color: 'var(--text-muted)',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
              <div>Tidak ada kolom yang sesuai filter</div>
            </motion.div>
          ) : (
            displayColumns.map((field, idx) => (
              <motion.div
                key={field.column_name}
                onClick={() => setExpandedColumn(
                  expandedColumn === field.column_name ? null : field.column_name
                )}
                style={{
                  padding: 16,
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${getStatusColor(field.status)}40`,
                  background: `${getStatusColor(field.status)}08`,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
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
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 10,
                }}>
                  <span style={{ fontSize: 18 }}>{getStatusIcon(field.status)}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: getStatusColor(field.status),
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      {field.column_name}
                    </div>
                    <div style={{
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      marginTop: 2,
                    }}>
                      {getStatusLabel(field.status)}
                    </div>
                  </div>
                </div>

                {/* Value Box */}
                <div style={{
                  background: 'var(--surface)',
                  border: `1px solid ${getStatusColor(field.status)}30`,
                  borderRadius: 'var(--radius-xs)',
                  padding: '10px 12px',
                  marginBottom: 10,
                  fontFamily: 'monospace',
                  fontSize: 12,
                  color: field.status === 'error' ? '#dc2626' : 'var(--text-primary)',
                  wordBreak: 'break-word',
                  minHeight: 28,
                  display: 'flex',
                  alignItems: 'center',
                }}>
                  {field.value === null || field.value === undefined || field.value === ''
                    ? <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>(kosong)</span>
                    : String(field.value).substring(0, 50)
                  }
                </div>

                {/* Error Details */}
                {field.status === 'error' && field.error_message && (
                  <motion.div
                    style={{
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: 'var(--radius-xs)',
                      padding: '8px 10px',
                      fontSize: 11,
                      color: '#7f1d1d',
                      lineHeight: '1.4',
                    }}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                      {field.rule_id}: {field.severity?.toUpperCase()}
                    </div>
                    <div>{field.error_message}</div>
                    {field.suggestion && (
                      <div style={{ marginTop: 6, padding: '6px 8px', background: '#fee2e2', borderRadius: 4 }}>
                        <strong>Saran:</strong> {field.suggestion}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Expand Indicator */}
                {(field.status === 'error' || field.value) && (
                  <motion.div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      textAlign: 'center',
                      marginTop: 8,
                      paddingTop: 8,
                      borderTop: '1px solid var(--border-color)',
                    }}
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
        style={{
          marginTop: 24,
          padding: 16,
          background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface-low) 100%)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-color)',
          fontSize: 12,
          color: 'var(--text-muted)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>Total {stats.total} kolom vClaim</strong>
            <div style={{ fontSize: 11, marginTop: 4 }}>
              Kolom ditandai dengan 🔷 akan diisi oleh sistem vClaim secara otomatis
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>
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
