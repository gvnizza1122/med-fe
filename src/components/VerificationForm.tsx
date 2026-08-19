'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useMemo, useEffect, type ReactElement } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, CircleDot, ClipboardCheck, Lightbulb, Pencil, Save, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

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

  const statusMeta: Record<string, { className: string; ring: string; icon: ReactElement }> = {
    error: {
      className: 'border-l-4 border-destructive bg-destructive/5',
      ring: 'text-destructive',
      icon: <XCircle className="h-4 w-4 text-destructive" />,
    },
    warning: {
      className: 'border-l-4 border-amber-500 bg-amber-500/5',
      ring: 'text-amber-600 dark:text-amber-400',
      icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
    },
    valid: {
      className: 'border-l-4 border-primary bg-primary/5',
      ring: 'text-primary',
      icon: <CheckCircle2 className="h-4 w-4 text-primary" />,
    },
    not_validated: {
      className: 'border-l-4 border-blue-500 bg-blue-500/5',
      ring: 'text-blue-600 dark:text-blue-400',
      icon: <CircleDot className="h-4 w-4 text-blue-500" />,
    },
    empty: {
      className: 'border-l-4 border-amber-500 bg-amber-500/5',
      ring: 'text-amber-600 dark:text-amber-400',
      icon: <CircleDot className="h-4 w-4 text-amber-500" />,
    },
  };

  const getStatusMeta = (status: string) => statusMeta[status] ?? {
    className: 'border-l-4 border-border bg-muted/30',
    ring: 'text-muted-foreground',
    icon: <CircleDot className="h-4 w-4 text-muted-foreground" />,
  };

  const hasChanges = Object.keys(editedValues).length > 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Header & Controls */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4"
      >
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            Verifikasi Data Klaim
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {redFields.length} field memerlukan perhatian
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Label
            htmlFor="show-all-columns"
            className="flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground"
          >
            <Switch
              id="show-all-columns"
              checked={showAll}
              onCheckedChange={setShowAll}
            />
            Tampilkan Semua 60 Kolom
          </Label>

          {!isEditing ? (
            <Button size="sm" onClick={() => setIsEditing(true)}>
              <Pencil className="h-3.5 w-3.5" />
              Edit Mode
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleCancel}>
                <X className="h-3.5 w-3.5" />
                Batalkan
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!hasChanges || isSaving}>
                <Save className="h-3.5 w-3.5" />
                {isSaving ? 'Menyimpan...' : `Simpan (${Object.keys(editedValues).length} perubahan)`}
              </Button>
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
            className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300"
          >
            {Object.keys(editedValues).length} field telah diubah
          </motion.div>
        )}
      </AnimatePresence>

      {/* Categories & Fields */}
      <div className="flex flex-col gap-6">
        {Object.entries(fieldsByCategory).map(([category, fields]) => (
          <motion.div
            key={category}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {category}
            </h4>

            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
              <AnimatePresence mode="popLayout">
                {fields.map((field) => {
                  const currentValue = editedValues[field.column_name] !== undefined
                    ? editedValues[field.column_name]
                    : field.value;
                  const isSystemField = VCLAIM_FILLED_COLUMNS.has(field.column_name);
                  const isChanged = editedValues[field.column_name] !== undefined;
                  const meta = getStatusMeta(field.status);

                  return (
                    <motion.div
                      key={field.column_name}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2 }}
                      className={cn(
                        'flex flex-col gap-2.5 rounded-xl border border-border/60 p-4 shadow-sm',
                        isChanged ? 'border-l-4 border-blue-500 bg-blue-500/5' : meta.className,
                      )}
                    >
                      {/* Field Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex flex-1 items-center gap-2">
                          {meta.icon}
                          <div>
                            <div className={cn('text-[11px] font-bold uppercase tracking-wide', meta.ring)}>
                              {field.column_name}
                            </div>
                            {isSystemField && (
                              <Badge variant="secondary" className="mt-0.5 h-4 px-1.5 text-[9px] font-normal italic">
                                Diisi sistem saat submit
                              </Badge>
                            )}
                          </div>
                        </div>
                        {isChanged && (
                          <Badge className="bg-blue-500 text-[10px] text-white hover:bg-blue-500">
                            DIUBAH
                          </Badge>
                        )}
                      </div>

                      {/* Error Message */}
                      {field.status === 'error' && field.error_message && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-[11px] leading-snug text-destructive"
                        >
                          <strong>{field.severity?.toUpperCase()}:</strong> {field.error_message}
                        </motion.div>
                      )}

                      {/* Field Input */}
                      {!isSystemField && isEditing ? (
                        <Textarea
                          value={String(currentValue || '')}
                          onChange={(e) => handleFieldChange(field.column_name, e.target.value)}
                          className={cn(
                            'min-h-[60px] resize-y font-mono text-xs',
                            isChanged && 'border-blue-500 focus-visible:ring-blue-500/30',
                          )}
                        />
                      ) : (
                        <div className="flex min-h-[32px] items-center break-words rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-foreground">
                          {currentValue === null || currentValue === undefined || currentValue === ''
                            ? <span className="italic text-muted-foreground">(kosong)</span>
                            : String(currentValue).substring(0, 100)
                          }
                        </div>
                      )}

                      {/* Suggestion */}
                      {field.suggestion && isEditing && (
                        <div className="flex items-start gap-1.5 rounded-lg border-l-2 border-amber-500 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-800 dark:text-amber-300">
                          <Lightbulb className="mt-0.5 h-3 w-3 shrink-0" />
                          <span><strong>Saran:</strong> {field.suggestion}</span>
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
          className="flex flex-col items-center gap-1 py-10 text-center text-muted-foreground"
        >
          <CheckCircle2 className="mb-1 h-8 w-8 text-primary" />
          <div className="text-sm font-semibold text-foreground">Semua Field Valid</div>
          <div className="text-xs">Tidak ada field yang memerlukan perhatian</div>
        </motion.div>
      )}
    </div>
  );
}

export default VerificationForm;
