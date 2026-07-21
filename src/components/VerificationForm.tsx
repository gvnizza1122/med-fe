'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useMemo, useEffect } from 'react';

interface FieldData {
  column_name: string;
  value: string | number | null;
  status: 'valid' | 'error' | 'warning' | 'empty' | 'not_validated';
  error_message?: string;
  suggestion?: string;
  severity?: 'critical' | 'major' | 'minor';
}

interface VerificationFormProps {
  recordId: string;
  recordData: Record<string, any>;
  validationErrors: Array<any>;
  vclaimColumns?: string[];
  onSave?: (changes: Record<string, any>) => Promise<void>;
  isSaving?: boolean;
}

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
  'VERSI_GROUPER': 'versi_grouper',
  'INACBG': 'inacbg_code', 'DESKRIPSI_INACBG': 'deskripsi_inacbg', 'TARIF_INACBG': 'tarif_inacbg',
  'DESKRIPSI_SP': 'deskripsi_sp', 'DESKRIPSI_SR': 'deskripsi_sr', 'DESKRIPSI_SI': 'deskripsi_si',
  'DESKRIPSI_SD': 'deskripsi_sd', 'TARIF_SP': 'tarif_sp', 'TARIF_SR': 'tarif_sr',
  'TARIF_SI': 'tarif_si', 'TARIF_SD': 'tarif_sd',
};

const VCLAIM_FILLED_COLUMNS = new Set([
  'TARIF_RS', 'CODER_ID', 'VERSI_INACBG', 'VERSI_GROUPER', 'C1', 'C2', 'C3', 'C4'
]);

const FIELD_CATEGORIES: Record<string, string[]> = {
  'Identitas Pasien': ['NAMA_PASIEN', 'MRN', 'SEX', 'BIRTH_DATE', 'BIRTH_WEIGHT', 'UMUR_TAHUN', 'UMUR_HARI'],
  'Data Rawatan': ['KODE_RS', 'KELAS_RS', 'KELAS_RAWAT', 'ADMISSION_DATE', 'DISCHARGE_DATE', 'DISCHARGE_STATUS', 'LOS'],
  'Diagnosis & Prosedur': ['DIAGLIST', 'PROCLIST', 'ADL1', 'ADL2'],
  'INA-CBG & Tarif': ['INACBG', 'DESKRIPSI_INACBG', 'TARIF_INACBG', 'SP', 'SR', 'SI', 'SD',
                       'DESKRIPSI_SP', 'TARIF_SP', 'DESKRIPSI_SR', 'TARIF_SR', 'DESKRIPSI_SI',
                       'TARIF_SI', 'DESKRIPSI_SD', 'TARIF_SD', 'TOTAL_TARIF'],
  'ICU & Ventilasi': ['ICU_INDIKATOR', 'ICU_LOS', 'VENT_HOUR'],
  'Asuransi & Rujukan': ['SEP', 'NOKARTU', 'PAYOR_ID', 'DPJP', 'KODE_TARIF', 'PTD', 'IN_SP', 'IN_SR', 'IN_SI', 'IN_SD', 'SUBACUTE', 'CHRONIC', 'TARIF_POLI_EKS'],
  'Sistem (Isi Otomatis)': ['TARIF_RS', 'CODER_ID', 'VERSI_INACBG', 'VERSI_GROUPER', 'C1', 'C2', 'C3', 'C4'],
};

const VCLAIM_COLUMNS = Object.values(FIELD_CATEGORIES).flat();

function VerificationForm({
  recordId,
  recordData,
  validationErrors = [],
  vclaimColumns = VCLAIM_COLUMNS,
  onSave,
  isSaving = false,
}: VerificationFormProps) {
  const [showAll, setShowAll] = useState(false);
  const [editedValues, setEditedValues] = useState<Record<string, any>>({});
  const [isEditing, setIsEditing] = useState(false);

  const fieldValidationMap = useMemo(() => {
    const map: Record<string, FieldData> = {};

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

    validationErrors?.forEach((err: any) => {
      const fieldName = err.field_name || '';
      const colName = Object.entries(FIELD_MAPPING).find(
        ([_, dbField]) => dbField === fieldName
      )?.[0];

      if (colName && map[colName]) {
        map[colName].status = 'error';
        map[colName].error_message = err.error_message;
        map[colName].severity = err.severity;
        map[colName].suggestion = err.expected_value;
      }
    });

    return map;
  }, [recordData, validationErrors, vclaimColumns]);

  const redFields = useMemo(() => {
    return Object.values(fieldValidationMap)
      .filter(f => f.status === 'error' || f.status === 'empty')
      .sort((a, b) => {
        const severityOrder: Record<string, number> = { critical: 0, major: 1, minor: 2 };
        return (severityOrder[a.severity || 'minor'] ?? 99) - (severityOrder[b.severity || 'minor'] ?? 99);
      });
  }, [fieldValidationMap]);

  const fieldsByCategory = useMemo(() => {
    const grouped: Record<string, FieldData[]> = {};
    Object.entries(FIELD_CATEGORIES).forEach(([category, fields]) => {
      grouped[category] = fields
        .map(colName => fieldValidationMap[colName])
        .filter(f => showAll || f.status === 'error' || f.status === 'empty');
    });
    return Object.fromEntries(Object.entries(grouped).filter(([_, fields]) => fields.length > 0));
  }, [fieldValidationMap, showAll]);

  const handleFieldChange = (colName: string, newValue: any) => {
    setEditedValues(prev => ({
      ...prev,
      [colName]: newValue,
    }));
  };

  const handleSave = async () => {
    if (!onSave || Object.keys(editedValues).length === 0) return;
    try {
      await onSave(editedValues);
      setEditedValues({});
      setIsEditing(false);
    } catch (err) {
      console.error('Save gagal:', err);
    }
  };

  const handleCancel = () => {
    setEditedValues({});
    setIsEditing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'error': return '#dc2626';
      case 'warning': return '#f59e0b';
      case 'valid': return '#10b981';
      case 'not_validated': return '#3b82f6';
      case 'empty': return '#f59e0b';
      default: return '#6b7280';
    }
  };

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

  const hasChanges = Object.keys(editedValues).length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header & Controls */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: 16,
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, marginBottom: 4 }}>
            📝 Verifikasi Data Klaim
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            {redFields.length} field memerlukan perhatian
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            cursor: 'pointer',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            background: showAll ? 'var(--primary)' : 'var(--surface)',
            color: showAll ? 'white' : 'var(--text-primary)',
            border: '1px solid' + (showAll ? 'var(--primary)' : 'var(--border-color)'),
            transition: 'all 0.2s',
          }}>
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            Tampilkan Semua 60 Kolom
          </label>

          {!isEditing ? (
            <motion.button
              onClick={() => setIsEditing(true)}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: 'white',
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              ✏️ Edit Mode
            </motion.button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <motion.button
                onClick={handleCancel}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: 'var(--surface)',
                  color: 'var(--text-primary)',
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Batalkan
              </motion.button>
              <motion.button
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: hasChanges && !isSaving ? 'pointer' : 'not-allowed',
                  background: hasChanges && !isSaving ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#d1d5db',
                  color: 'white',
                  opacity: hasChanges && !isSaving ? 1 : 0.6,
                }}
                whileHover={hasChanges && !isSaving ? { scale: 1.02 } : {}}
                whileTap={hasChanges && !isSaving ? { scale: 0.98 } : {}}
              >
                {isSaving ? '💾 Menyimpan...' : `💾 Simpan (${Object.keys(editedValues).length} perubahan)`}
              </motion.button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Field Changes Indicator */}
      <AnimatePresence>
        {hasChanges && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              padding: 12,
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              fontSize: 12,
              color: 'var(--accent-blue)',
              fontWeight: 600,
            }}
          >
            📝 {Object.keys(editedValues).length} field telah diubah
          </motion.div>
        )}
      </AnimatePresence>

      {/* Categories & Fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {Object.entries(fieldsByCategory).map(([category, fields]) => (
          <motion.div
            key={category}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h4 style={{
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 12,
            }}>
              {category}
            </h4>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 12,
            }}>
              <AnimatePresence mode="popLayout">
                {fields.map((field, idx) => {
                  const currentValue = editedValues[field.column_name] !== undefined
                    ? editedValues[field.column_name]
                    : field.value;
                  const isSystemField = VCLAIM_FILLED_COLUMNS.has(field.column_name);
                  const isChanged = editedValues[field.column_name] !== undefined;

                  return (
                    <motion.div
                      key={field.column_name}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2 }}
                      style={{
                        padding: 16,
                        borderRadius: 'var(--radius-sm)',
                        border: `1px solid ${isChanged ? '#3b82f6' : getStatusColor(field.status)}40`,
                        background: isChanged ? 'rgba(59, 130, 246, 0.08)' : `${getStatusColor(field.status)}08`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        transition: 'all 0.2s',
                      }}
                      whileHover={!isSystemField ? { borderColor: getStatusColor(field.status), boxShadow: `0 4px 12px ${getStatusColor(field.status)}20` } : {}}
                    >
                      {/* Field Header */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                          <span style={{ fontSize: 18 }}>{getStatusIcon(field.status)}</span>
                          <div>
                            <div style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: getStatusColor(field.status),
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}>
                              {field.column_name}
                            </div>
                            {isSystemField && (
                              <div style={{
                                fontSize: 9,
                                color: 'var(--text-muted)',
                                fontStyle: 'italic',
                              }}>
                                Isi otomatis saat submit
                              </div>
                            )}
                          </div>
                        </div>
                        {isChanged && (
                          <span style={{
                            fontSize: 10,
                            background: '#3b82f6',
                            color: 'white',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontWeight: 600,
                          }}>
                            DIUBAH
                          </span>
                        )}
                      </div>

                      {/* Error Message */}
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
                        >
                          <strong>{field.severity?.toUpperCase()}:</strong> {field.error_message}
                        </motion.div>
                      )}

                      {/* Field Input */}
                      {!isSystemField && isEditing ? (
                        <textarea
                          value={String(currentValue || '')}
                          onChange={(e) => handleFieldChange(field.column_name, e.target.value)}
                          style={{
                            width: '100%',
                            minHeight: 60,
                            padding: '8px 10px',
                            borderRadius: 'var(--radius-xs)',
                            border: `1px solid ${isChanged ? '#3b82f6' : 'var(--border-color)'}`,
                            background: 'var(--surface)',
                            color: 'var(--text-primary)',
                            fontSize: 12,
                            fontFamily: 'monospace',
                            resize: 'vertical',
                            outline: 'none',
                            transition: 'all 0.2s',
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor = '#3b82f6';
                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = isChanged ? '#3b82f6' : 'var(--border-color)';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        />
                      ) : (
                        <div style={{
                          background: 'var(--surface)',
                          border: `1px solid ${getStatusColor(field.status)}30`,
                          borderRadius: 'var(--radius-xs)',
                          padding: '10px 12px',
                          fontFamily: 'monospace',
                          fontSize: 12,
                          color: field.status === 'error' ? '#dc2626' : 'var(--text-primary)',
                          wordBreak: 'break-word',
                          minHeight: 32,
                          display: 'flex',
                          alignItems: 'center',
                        }}>
                          {currentValue === null || currentValue === undefined || currentValue === ''
                            ? <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>(kosong)</span>
                            : String(currentValue).substring(0, 100)
                          }
                        </div>
                      )}

                      {/* Suggestion */}
                      {field.suggestion && isEditing && (
                        <div style={{
                          padding: '6px 8px',
                          background: '#fef3c7',
                          borderRadius: 'var(--radius-xs)',
                          fontSize: 11,
                          color: '#78350f',
                          borderLeft: '2px solid #f59e0b',
                        }}>
                          <strong>💡 Saran:</strong> {field.suggestion}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Empty State */}
      {Object.keys(fieldsByCategory).length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            textAlign: 'center',
            padding: 40,
            color: 'var(--text-muted)',
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Semua Field Valid</div>
          <div style={{ fontSize: 12 }}>Tidak ada field yang memerlukan perhatian</div>
        </motion.div>
      )}
    </div>
  );
}

export default VerificationForm;
