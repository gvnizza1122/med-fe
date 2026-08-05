'use client';
import { useEffect, useState, useCallback, useMemo, Fragment } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { api } from '@/lib/api';
import { ToastContainer, useToast } from '@/components/Toast';

// react-pdf (pdfjs-dist) mengakses DOMMatrix di level modul — API browser
// yang tidak ada saat Next.js SSR. Import statis biasa bikin server crash
// (ReferenceError: DOMMatrix is not defined) setiap kali halaman ini diakses,
// bukan hanya saat tombol "Lihat Dokumen PDF Asli" diklik. ssr:false memaksa
// modul ini (dan seluruh dependensinya) cuma dievaluasi di browser.
const PdfViewer = dynamic(() => import('@/components/PdfViewer'), { ssr: false });

interface FileInfo {
  id: string; file_name: string; period: string; status: string;
  total_records: number; valid_count: number; error_count: number; pending_count: number;
  error_summary: { rule_id: string; rule_name: string; count: number; severity: string }[];
  uploaded_by_name: string; created_at: string; column_count: number;
  has_pdf?: boolean;
}
interface ValidationError {
  rule_id: string; rule_name: string; field_name: string;
  error_message: string; expected_value: string; actual_value: string; severity: string;
}
interface ClaimRecord {
  id: string; row_number: number; sep: string; nokartu: string; nama_pasien: string;
  mrn: string; inacbg_code: string; deskripsi_inacbg: string;
  validation_status: string; error_count: number; errors: ValidationError[];
  [key: string]: any;
}

// ─── vClaim 60-column mapping ──────────────────────────────────────────────

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
  'Sistem (Isi Otomatis oleh vClaim)': ['TARIF_RS', 'CODER_ID', 'VERSI_INACBG', 'VERSI_GROUPER', 'C1', 'C2', 'C3', 'C4'],
};

interface CodeEvidence {
  code: string;
  type: 'diagnosis' | 'procedure';
  found: boolean;
  page_number: number | null;
  quotation: string | null;
}
interface SuggestedCode {
  code: string;
  type: 'diagnosis' | 'procedure';
  page_number: number;
  quotation: string;
  reasoning: string;
}
interface FieldRow {
  column_name: string;
  value: string | number | null;
  status: 'valid' | 'error' | 'empty' | 'system';
  rule_id?: string;
  error_message?: string;
  suggestion?: string;
  severity?: 'critical' | 'major' | 'minor';
  // Hasil AI review tahap kedua (alur AI ekstraksi -> rule engine -> AI review)
  // — dulu tampil di panel "Lihat Saran Audit AI" terpisah, sekarang langsung
  // di kolom Catatan/Saran tabel ini.
  aiNote?: string;
  codeEvidence?: CodeEvidence[];
  suggestedCodes?: SuggestedCode[];
}

// RV-13/14/15/16 (BA Kesepakatan BPJS No. 1247/2024) butuh data riwayat kunjungan
// lintas episode (jumlah episode konsul, riwayat obat kronis, urutan iterasi, dst)
// yang TIDAK PERNAH ada di PDF "Berkas Klaim Individual" — hanya tersedia kalau
// data masuk lewat bridging TXT/JSON dari SIMRS yang menyertakan kolom tambahan
// ini. Kalau tidak ada satupun penanda kolom ini di raw_data, keempat rule itu
// otomatis tidak pernah bisa menyala untuk record ini — bukan berarti klaimnya
// benar-benar valid dari sisi itu, verifikator wajib cek manual.
const EPISODE_TRACKING_MARKERS = [
  'JENIS_KONSULTASI', 'JUMLAH_EPISODE_KLAIM', 'IS_SAME_DAY',
  'HISTORI_OBAT_KRONIS_BULAN_BERTURUT', 'URUTAN_ITERASI',
];
const UNVERIFIABLE_WITHOUT_EPISODE_DATA = [
  { rule_id: 'RV-13', label: 'Gabung Episode Konsul Internal' },
  { rule_id: 'RV-14', label: 'Validasi Episode Rujukan Internal' },
  { rule_id: 'RV-15', label: 'Flagging Program Rujuk Balik (PRB)' },
  { rule_id: 'RV-16', label: 'Batas Maksimal Iterasi Obat Kronis' },
];

function hasEpisodeTrackingData(rawData: Record<string, any>): boolean {
  return EPISODE_TRACKING_MARKERS.some(k => rawData[k] !== undefined && rawData[k] !== null && rawData[k] !== '');
}

function parseRawData(recordData: Record<string, any>): Record<string, any> {
  if (!recordData.raw_data) return {};
  try { return typeof recordData.raw_data === 'string' ? JSON.parse(recordData.raw_data) : recordData.raw_data; }
  catch { return {}; }
}

interface AiReview {
  field_notes?: Record<string, string>;
  code_evidence?: CodeEvidence[];
  suggested_codes?: SuggestedCode[];
}

function parseAiReview(recordData: Record<string, any>): AiReview | null {
  if (!recordData.ai_review) return null;
  try { return typeof recordData.ai_review === 'string' ? JSON.parse(recordData.ai_review) : recordData.ai_review; }
  catch { return null; }
}

function buildFieldMap(recordData: Record<string, any>, validationErrors: ValidationError[]): Record<string, FieldRow> {
  const map: Record<string, FieldRow> = {};
  // raw_data (JSON hasil ekstraksi AI/import asli) selalu berisi ke-60 kolom
  // vClaim dan selalu diperbarui bersamaan dengan kolom DB saat verifikator
  // menyimpan perubahan — jadi ini sumber yang paling lengkap & terkini.
  // Kolom DB tersendiri hanya mencakup ~15 dari 60 kolom, dan sejumlah kolom
  // numerik (mis. tarif_inacbg, los, vent_hour) punya DEFAULT 0 di skema —
  // kalau backend tidak menulisnya, nilainya 0 padahal AI berhasil mengekstrak
  // angka asli. Jadi utamakan raw_data, kolom DB hanya jadi fallback.
  //
  // Rekaman LAMA (diunggah sebelum fitur raw_data ada, atau via jalur yang tidak
  // menyimpan raw_data) punya raw_data NULL/{} — jangan sampai tabel jadi kosong
  // semua: kalau raw_data kosong, pakai kolom DB (yang ~15 kolom) sebagai sumber.
  const rawData = parseRawData(recordData);
  const rawKeys = Object.keys(rawData);
  const hasRawData = rawKeys.length > 0;

  Object.values(FIELD_CATEGORIES).flat().forEach(colName => {
    const dbField = FIELD_MAPPING[colName];
    const dbValue = dbField ? recordData[dbField] : null;
    // Hanya pakai raw_data kalau JSON-nya benar-benar ada isinya. Kalau kosong,
    // kolom DB adalah satu-satunya sumber kebenaran yang tersisa.
    const rawValue = hasRawData ? rawData[colName] : undefined;
    const value = (rawValue === null || rawValue === undefined || rawValue === '')
      ? (dbValue ?? null)
      : rawValue;
    map[colName] = {
      column_name: colName,
      value: value ?? null,
      status: VCLAIM_FILLED_COLUMNS.has(colName) ? 'system' :
              (value === null || value === undefined || value === '') ? 'empty' : 'valid',
    };
  });
  validationErrors?.forEach(err => {
    const colName = Object.entries(FIELD_MAPPING).find(([, dbField]) => dbField === err.field_name)?.[0];
    if (colName && map[colName]) {
      map[colName].status = 'error';
      map[colName].rule_id = err.rule_id;
      map[colName].error_message = err.error_message;
      map[colName].severity = err.severity as FieldRow['severity'];
      map[colName].suggestion = err.expected_value;
    }
  });

  // Hasil AI review tahap kedua — dulu panel "Lihat Saran Audit AI" terpisah,
  // sekarang langsung digabung ke kolom Catatan/Saran field yang bersangkutan.
  const aiReview = parseAiReview(recordData);
  if (aiReview) {
    if (aiReview.field_notes) {
      Object.entries(aiReview.field_notes).forEach(([dbFieldName, note]) => {
        const colName = Object.entries(FIELD_MAPPING).find(([, dbField]) => dbField === dbFieldName)?.[0];
        if (colName && map[colName] && note) {
          map[colName].aiNote = note;
        }
      });
    }
    if (aiReview.code_evidence && aiReview.code_evidence.length > 0) {
      if (map['DIAGLIST']) map['DIAGLIST'].codeEvidence = aiReview.code_evidence.filter(e => e.type === 'diagnosis');
      if (map['PROCLIST']) map['PROCLIST'].codeEvidence = aiReview.code_evidence.filter(e => e.type === 'procedure');
    }
    if (aiReview.suggested_codes && aiReview.suggested_codes.length > 0) {
      if (map['DIAGLIST']) map['DIAGLIST'].suggestedCodes = aiReview.suggested_codes.filter(s => s.type === 'diagnosis');
      if (map['PROCLIST']) map['PROCLIST'].suggestedCodes = aiReview.suggested_codes.filter(s => s.type === 'procedure');
    }
  }

  return map;
}

function statusBadgeClass(status: FieldRow['status']) {
  if (status === 'error') return 'badge-error';
  if (status === 'empty') return 'badge-pending';
  if (status === 'system') return 'badge-secondary';
  return 'badge-valid';
}
function statusLabel(status: FieldRow['status']) {
  if (status === 'error') return 'Error';
  if (status === 'empty') return 'Kosong';
  if (status === 'system') return 'Otomatis vClaim';
  return 'Valid';
}

// ─── Unified 60-column table (replaces old "Validasi 60 Kolom" + "Verifikasi & Edit" tabs) ───

function RecordFieldsTable({
  recordData, validationErrors, editing, editedValues, onEdit, onlyIssues,
}: {
  recordData: Record<string, any>;
  validationErrors: ValidationError[];
  editing: boolean;
  editedValues: Record<string, any>;
  onEdit: (col: string, val: string) => void;
  onlyIssues: boolean;
}) {
  const fieldMap = useMemo(() => buildFieldMap(recordData, validationErrors), [recordData, validationErrors]);

  const categories = Object.entries(FIELD_CATEGORIES).map(([category, cols]) => ({
    category,
    rows: cols
      .map(c => fieldMap[c])
      .filter(f => !onlyIssues || f.status === 'error' || f.status === 'empty'),
  }));
  const totalRows = categories.reduce((n, c) => n + c.rows.length, 0);

  return (
    <div className="table-container" style={{ maxHeight: 560, overflowY: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th style={{ width: 190 }}>Kolom</th>
            <th>Nilai</th>
            <th style={{ width: 110 }}>Status</th>
            <th>Catatan / Saran</th>
          </tr>
        </thead>
        <tbody>
          {totalRows === 0 && onlyIssues ? (
            <tr>
              <td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                <strong>✅ Tidak ada data bermasalah</strong> — semua kolom vClaim terisi &amp; valid.
                Matikan &ldquo;Tampilkan hanya yang bermasalah&rdquo; untuk melihat seluruh data klaim.
              </td>
            </tr>
          ) : (
            categories.map(({ category, rows }) => (
              <Fragment key={category}>
                <tr>
                  <td colSpan={4} style={{ background: 'var(--surface)', fontWeight: 700, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    {category}
                  </td>
                </tr>
                {rows.map(field => {
                  const isSystem = field.status === 'system';
                  const currentValue = editedValues[field.column_name] !== undefined
                    ? editedValues[field.column_name] : field.value;
                  const isChanged = editedValues[field.column_name] !== undefined;
                  return (
                    <tr key={field.column_name}>
                      <td style={{ fontWeight: 600, fontSize: 12 }}>{field.column_name}</td>
                      <td>
                        {editing && !isSystem ? (
                          <input
                            type="text"
                            value={String(currentValue ?? '')}
                            onChange={e => onEdit(field.column_name, e.target.value)}
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              borderRadius: 4,
                              border: `1px solid ${isChanged ? 'var(--accent-blue)' : 'var(--border-color)'}`,
                              background: 'var(--surface)',
                              color: 'var(--text-primary)',
                              fontFamily: 'monospace',
                              fontSize: 12,
                            }}
                          />
                        ) : (
                          <span style={{
                            fontFamily: 'monospace',
                            fontSize: 12,
                            color: field.status === 'error' ? '#dc2626' : 'var(--text-primary)',
                          }}>
                            {currentValue === null || currentValue === undefined || currentValue === ''
                              ? <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>(kosong)</span>
                              : String(currentValue)}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${statusBadgeClass(field.status)}`} style={{ fontSize: 10 }}>
                          {statusLabel(field.status)}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {field.status === 'error' && field.error_message && (
                          <div>
                            <div style={{ color: '#dc2626', marginBottom: 4 }}>
                              <strong>{field.rule_id}:</strong> {field.error_message}
                            </div>
                            {field.suggestion && (
                              <div style={{
                                background: 'var(--surface-secondary, rgba(59,130,246,0.08))',
                                borderLeft: '3px solid var(--accent-blue, #3b82f6)',
                                padding: '6px 10px',
                                borderRadius: '0 4px 4px 0',
                                marginTop: 4,
                              }}>
                                <strong>Perbaiki menjadi:</strong>{' '}
                                <code style={{ fontFamily: 'monospace', fontSize: 12 }}>{field.suggestion}</code>
                              </div>
                            )}
                          </div>
                        )}
                        {field.status === 'empty' && !field.codeEvidence && (
                          <span style={{ color: '#f59e0b' }}>Data tidak ditemukan di dokumen PDF. Periksa dan isi manual.</span>
                        )}
                        {field.aiNote && (
                          <div style={{
                            marginTop: field.status === 'error' ? 6 : 0,
                            background: 'var(--surface-secondary, rgba(124,58,237,0.06))',
                            borderLeft: '3px solid #7c3aed',
                            padding: '6px 10px',
                            borderRadius: '0 4px 4px 0',
                          }}>
                            <strong>🤖 AI:</strong> {field.aiNote}
                          </div>
                        )}
                        {field.codeEvidence && field.codeEvidence.length > 0 && (
                          <div style={{ marginTop: (field.status === 'error' || field.aiNote) ? 6 : 0, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {field.codeEvidence.map(ev => (
                              <span
                                key={ev.code}
                                className={`badge ${ev.found ? 'badge-valid' : 'badge-error'}`}
                                style={{ fontSize: 10, fontFamily: 'monospace', cursor: ev.quotation ? 'help' : 'default' }}
                                title={ev.found && ev.quotation ? `Hal. ${ev.page_number}: "${ev.quotation}"` : !ev.found ? 'Tidak ada bukti dokumen — periksa manual' : undefined}
                              >
                                {ev.found ? '✅' : '⚠️'} {ev.code}
                              </span>
                            ))}
                          </div>
                        )}
                        {field.suggestedCodes && field.suggestedCodes.length > 0 && (
                          <div style={{ marginTop: 4, color: '#2563eb' }}>
                            💡 Kode tambahan terdeteksi di dokumen:{' '}
                            {field.suggestedCodes.map((s, i) => (
                              <span key={s.code} title={`Hal. ${s.page_number}: "${s.quotation}"${s.reasoning ? ` — ${s.reasoning}` : ''}`} style={{ cursor: 'help', fontFamily: 'monospace' }}>
                                {i > 0 && ', '}{s.code}
                              </span>
                            ))}
                          </div>
                        )}
                        {field.status !== 'error' && field.status !== 'empty' && !field.aiNote && !field.codeEvidence?.length && !field.suggestedCodes?.length && (
                          isSystem ? 'Diisi otomatis saat kirim ke vClaim' : '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </Fragment>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Loading ────────────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="loading">
      <div className="spinner" />
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function ResultsPage() {
  const params = useParams();
  const fileId = params.fileId as string;
  const { toasts, addToast, removeToast } = useToast();
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [records, setRecords] = useState<ClaimRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [isSavingRecord, setIsSavingRecord] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const [maximizeData, setMaximizeData] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedValues, setEditedValues] = useState<Record<string, any>>({});
  const [onlyIssues, setOnlyIssues] = useState(false);

  const loadRecords = useCallback(async () => {
    try {
      const p: Record<string, string> = { page: String(page), limit: '30' };
      if (filter !== 'all') p.status = filter;
      if (search) p.search = search;
      const d = await api.getRecords(fileId, p);
      setRecords(d.records); setTotal(d.total);
      if (d.records && d.records.length > 0) {
        const firstErrorRecord = d.records.find((r: any) => r.error_count > 0);
        setSelectedRecordId(prev => {
          if (prev && d.records.some((r: any) => r.id === prev)) return prev;
          return firstErrorRecord ? firstErrorRecord.id : d.records[0].id;
        });
      }
    } catch (err) { console.error('[Results] Gagal memuat records:', err); }
  }, [fileId, page, filter, search]);

  const loadFileInfo = useCallback(async () => {
    try {
      const f = await api.getFile(fileId);
      setFileInfo(f);
    } catch (err) { console.error('[Results] Gagal memuat info file:', err); }
  }, [fileId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadFileInfo();
      setLoading(false);
    })();
  }, [fileId, loadFileInfo]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  // Reset per-record edit/evidence state saat ganti record
  useEffect(() => {
    setIsEditing(false);
    setEditedValues({});
    setShowPdf(false);
    setMaximizeData(false);
  }, [selectedRecordId]);

  const handleExport = async () => {
    try {
      const res = await api.exportFile(fileId, filter === 'all' ? 'all' : filter);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `validasi_${fileInfo?.file_name || 'klaim'}.xlsx`;
      a.click(); URL.revokeObjectURL(url);
    } catch { alert('Export gagal'); }
  };

  const handleApprove = async () => {
    if (!confirm('Yakin ingin menyetujui file ini? File yang disetujui siap dikirim ke vClaim.')) return;
    try {
      await api.approveFile(fileId);
      await loadFileInfo();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal menyetujui');
    }
  };

  const handleSaveRecord = async () => {
    if (!selectedRecordId || Object.keys(editedValues).length === 0) return;
    setIsSavingRecord(true);
    try {
      await api.updateRecordValues(selectedRecordId, editedValues);
      addToast('Perubahan berhasil disimpan', 'success');
      setEditedValues({});
      setIsEditing(false);
      await loadRecords();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Gagal menyimpan perubahan', 'error');
    } finally {
      setIsSavingRecord(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!fileInfo) return (
    <div className="empty-state"><h3>File tidak ditemukan</h3></div>
  );

  const totalPages = Math.ceil(total / 30);
  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
  const canApprove = ['supervisor', 'admin'].includes(user.role) && fileInfo.status === 'completed';

  const selectedRecord = selectedRecordId ? records.find(r => r.id === selectedRecordId) : null;

  return (
    <div className="fade-in results-page-container">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* ─── Header ──────────────────────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Hasil Validasi</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fileInfo.file_name}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          {canApprove && (
            <button className="btn btn-success" onClick={handleApprove}>Setujui</button>
          )}
        </div>
      </div>

      {/* ─── Compact summary bar ─────────────────────────────────────── */}
      <div className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Data</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{fileInfo.total_records}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Valid</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>{fileInfo.valid_count}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Error</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626' }}>{fileInfo.error_count}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pending</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b' }}>{fileInfo.pending_count}</div>
        </div>
        {fileInfo.error_summary && fileInfo.error_summary.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginLeft: 'auto' }}>
            {fileInfo.error_summary.map(rule => (
              <span key={rule.rule_id} className={`badge badge-${rule.severity}`} style={{ fontSize: 10 }}>
                {rule.rule_id} · {rule.count}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ─── Toolbar: search / filter (only relevant when there's more than 1 record) ─── */}
      {(total > 1 || search || filter !== 'all') && (
        <div className="results-toolbar">
          <div className="search-container" style={{ borderRadius: 'var(--radius-sm)' }}>
            <span className="search-icon">🔍</span>
            <input
              className="search-input"
              placeholder="Cari Nama, SEP, atau No. Kartu..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="filter-group">
            <span className="filter-label">Status:</span>
            <select className="filter-select" value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}>
              <option value="all">Semua Rekam</option>
              <option value="valid">Valid</option>
              <option value="error">Error</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>
      )}

      <div className="split-layout">
        {/* ─── Left: records list (multi-record files) ────────────────── */}
        {(total > 1 || records.length > 1) && (
          <div className="panel-left">
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                <table>
                  <thead>
                    <tr><th>Nama Pasien</th><th>No. SEP</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {records.length === 0 ? (
                      <tr><td colSpan={3} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>Tidak ada data</td></tr>
                    ) : records.map(rec => (
                      <tr
                        key={rec.id}
                        className={selectedRecordId === rec.id ? 'selected-row' : ''}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedRecordId(rec.id)}
                      >
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{rec.nama_pasien || '(kosong)'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>MRN: {rec.mrn || '-'}</div>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{rec.sep}</td>
                        <td><span className={`badge badge-${rec.validation_status}`} style={{ fontSize: 10 }}>{rec.validation_status.toUpperCase()}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="pagination" style={{ marginTop: 12 }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>← Sebelumnya</button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 7) pageNum = i + 1;
                  else if (page <= 4) pageNum = i + 1;
                  else if (page >= totalPages - 3) pageNum = totalPages - 6 + i;
                  else pageNum = page - 3 + i;
                  return (
                    <button key={pageNum} className={page === pageNum ? 'active' : ''} onClick={() => setPage(pageNum)}>
                      {pageNum}
                    </button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Selanjutnya →</button>
              </div>
            )}
          </div>
        )}

        {/* ─── Right: selected record detail ───────────────────────────── */}
        {/* Saat panel-left tidak dirender (cuma 1 record), div ini tetap jadi
            grid item di dalam .split-layout — tanpa gridColumn: 1/-1 dia akan
            terjebak di kolom pertama (380px) dan kolom kanan (1fr) kosong. */}
        <div
          className={total > 1 || records.length > 1 ? 'panel-right' : ''}
          style={{
            position: 'static',
            width: '100%',
            gridColumn: (total > 1 || records.length > 1) ? undefined : '1 / -1',
          }}
        >
          {selectedRecord ? (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>{selectedRecord.nama_pasien} (SEP: {selectedRecord.sep})</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    MRN: {selectedRecord.mrn || '-'} · Status:{' '}
                    <span className={`badge badge-${selectedRecord.validation_status}`} style={{ fontSize: 10 }}>
                      {selectedRecord.validation_status.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                    <input type="checkbox" checked={onlyIssues} onChange={e => setOnlyIssues(e.target.checked)} />
                    Tampilkan hanya yang bermasalah
                  </label>
                  {!isEditing ? (
                    <button className="btn btn-secondary btn-sm" onClick={() => setIsEditing(true)}>Edit</button>
                  ) : (
                    <>
                      <button className="btn btn-secondary btn-sm" onClick={() => { setIsEditing(false); setEditedValues({}); }}>Batal</button>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={Object.keys(editedValues).length === 0 || isSavingRecord}
                        onClick={handleSaveRecord}
                      >
                        {isSavingRecord ? 'Menyimpan...' : `Simpan (${Object.keys(editedValues).length})`}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* ─── Peringatan: rule yang tidak bisa diverifikasi otomatis ── */}
              {!hasEpisodeTrackingData(parseRawData(selectedRecord)) && (
                <div style={{
                  marginBottom: 16, padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                  background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.35)',
                  fontSize: 12, color: 'var(--text-primary)',
                }}>
                  <strong>⚠️ Cek manual diperlukan</strong> — berkas ini tidak menyertakan data riwayat kunjungan/episode, sehingga beberapa aturan tidak bisa diperiksa otomatis. Harap pastikan secara manual.
                  {' '}
                  {UNVERIFIABLE_WITHOUT_EPISODE_DATA.map((r, i) => (
                    <span key={r.rule_id}>
                      {i > 0 && ', '}
                      <strong>{r.rule_id}</strong> ({r.label})
                    </span>
                  ))}.
                </div>
              )}

              {/* ─── Bukti primer: dokumen PDF asli vs data klaim ───────── */}
              {/* Tampil jika berkas aslinya PDF (via nama file, tidak bergantung
                  flag has_pdf dari backend) — kalau file ternyata hilang di disk,
                  PdfViewer menampilkan pesan yang jelas. */}
              {String(fileInfo.file_name || '').toLowerCase().endsWith('.pdf') && (
                <div style={{ marginBottom: 16 }}>
                  <button className="btn-glass" onClick={() => setShowPdf(v => !v)}>
                    {showPdf ? 'Sembunyikan Dokumen PDF Asli' : 'Lihat Dokumen PDF Asli'}
                  </button>
                </div>
              )}

              {/* ─── The single 60-column table (side-by-side dengan PDF saat dibuka) ─── */}
              {showPdf ? (
                <div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setMaximizeData(v => !v)}>
                      {maximizeData ? 'Kembali' : 'Perbesar Data'}
                    </button>
                  </div>
                  <div className={`pdf-compare-grid${maximizeData ? ' maximized' : ''}`}>
                    <div style={{
                      minWidth: 0,
                      order: maximizeData ? 1 : 0,  // data first when maximized
                      maxHeight: maximizeData ? 'none' : 780,
                      overflowY: maximizeData ? 'visible' : 'auto',
                    }}>
                      <RecordFieldsTable
                        recordData={selectedRecord}
                        validationErrors={selectedRecord.errors || []}
                        editing={isEditing}
                        editedValues={editedValues}
                        onEdit={(col, val) => setEditedValues(prev => ({ ...prev, [col]: val }))}
                        onlyIssues={onlyIssues}
                      />
                    </div>
                    <div style={{
                      minWidth: 0,
                      order: maximizeData ? 2 : 0,
                    }}>
                      <PdfViewer fileId={fileId} fileName={fileInfo.file_name} height={maximizeData ? 420 : 780} />
                    </div>
                  </div>
                </div>
              ) : (
                <RecordFieldsTable
                  recordData={selectedRecord}
                  validationErrors={selectedRecord.errors || []}
                  editing={isEditing}
                  editedValues={editedValues}
                  onEdit={(col, val) => setEditedValues(prev => ({ ...prev, [col]: val }))}
                  onlyIssues={onlyIssues}
                />
              )}

            </div>
          ) : (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              Pilih data dari tabel untuk melihat detail validasi
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
