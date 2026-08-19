'use client';
import { useEffect, useState, useCallback, useMemo, Fragment } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { ToastContainer, useToast } from '@/components/Toast';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Header } from '@/components/dashboard/header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Search, CheckCircle2, XCircle, ChevronLeft, ChevronRight, FileText, Sparkles, Lightbulb, AlertTriangle, PanelLeftOpen, Users } from 'lucide-react';

// react-pdf (pdfjs-dist) mengakses DOMMatrix di level modul — API browser
// yang tidak ada saat Next.js SSR. Import statis biasa bikin server crash
// (ReferenceError: DOMMatrix is not defined) setiap kali halaman ini diakses,
// bukan hanya saat tombol "Lihat Dokumen PDF Asli" diklik. ssr:false memaksa
// modul ini (dan seluruh dependensinya) cuma dievaluasi di browser.
const PdfViewer = dynamic(() => import('@/components/PdfViewer'), { ssr: false });

// GAWAT_DARURAT dipertahankan di sini (walau sudah dihapus dari picker upload)
// supaya file lama berkategori itu tetap tampil labelnya dengan benar.
const JENIS_KLAIM_OPTIONS = [
  { value: 'RAWAT_JALAN', label: 'Rawat Jalan', icon: '🚶', accent: '#2563eb' },
  { value: 'RAWAT_INAP', label: 'Rawat Inap', icon: '🛏️', accent: '#6366f1' },
  { value: 'GAWAT_DARURAT', label: 'IGD / Gawat Darurat', icon: '🚨', accent: '#dc2626' },
];

interface FileInfo {
  id: string; file_name: string; period: string; status: string;
  total_records: number; valid_count: number; error_count: number; pending_count: number;
  error_summary: { rule_id: string; rule_name: string; count: number; severity: string }[];
  uploaded_by_name: string; created_at: string; column_count: number;
  has_pdf?: boolean;
  jenis_klaim?: string | null;
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
// yang TIDAK PERNAH ada di 1 dokumen PDF sendirian — hanya tersedia kalau (a) data
// masuk lewat bridging TXT/JSON dari SIMRS yang menyertakan kolom tambahan ini,
// atau (b) backend berhasil cross-check RV-13 antar record NOKARTU+tanggal sama
// di database (lihat detectAndFlagInternalEpisodes() di claimFiles.js — kalau itu
// jalan, kolom jumlah_episode_klaim/jenis_konsultasi/is_same_day di DB TERISI,
// meski raw_data — snapshot asli upload — tetap kosong, makanya cek di bawah
// tidak cuma baca raw_data, tapi juga kolom record langsung). Kalau tidak ada
// satupun penanda ini, RV-13/14/15/16 tidak pernah bisa menyala untuk record ini
// — bukan berarti klaimnya benar-benar valid dari sisi itu, verifikator wajib
// cek manual.
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

function hasEpisodeTrackingData(record: Record<string, any>): boolean {
  const rawData = parseRawData(record);
  if (EPISODE_TRACKING_MARKERS.some(k => rawData[k] !== undefined && rawData[k] !== null && rawData[k] !== '')) {
    return true;
  }
  // Kolom DB langsung (diisi cross-check backend, bukan lewat raw_data) —
  // jenis_konsultasi & jumlah_episode_klaim > 1 artinya cross-check RV-13
  // sudah menemukan & menandai kunjungan lintas-poli hari yang sama.
  return Boolean(record.jenis_konsultasi) && Number(record.jumlah_episode_klaim) > 1;
}

function parseRawData(recordData: Record<string, any>): Record<string, any> {
  if (!recordData.raw_data) return {};
  try { return typeof recordData.raw_data === 'string' ? JSON.parse(recordData.raw_data) : recordData.raw_data; }
  catch { return {}; }
}

interface PendingRiskNote {
  pattern: string;
  page_number: number;
  basis: string;
  note: string;
}

interface AiReview {
  field_notes?: Record<string, string>;
  code_evidence?: CodeEvidence[];
  suggested_codes?: SuggestedCode[];
  pending_risk_notes?: PendingRiskNote[];
}

// Label ramah-verifikator untuk tiap pola risiko pending — dipetakan dari
// analisis data pending BPJS riil (lihat aiReviewService.js di backend untuk
// definisi lengkap tiap pola & aturan bukti dokumennya).
const PENDING_RISK_LABELS: Record<string, string> = {
  kegawatan_lemah: 'Kriteria kegawatan lemah',
  manifestasi_ikut_du: 'Diagnosis sekunder = manifestasi DU',
  tb_level_fktp: 'TB seharusnya cukup di FKTP',
  usg_berulang_tanpa_indikasi: 'USG berulang tanpa indikasi baru',
  rujuk_saja_tanpa_tindakan: 'Kunjungan rujuk-saja, cek kode Z71.9',
};

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

function StatusBadge({ status }: { status: FieldRow['status'] }) {
  if (status === 'error') return <Badge variant="destructive" className="text-[10px]">Error</Badge>;
  if (status === 'empty') return <Badge className="text-[10px] border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">Kosong</Badge>;
  if (status === 'system') return <Badge variant="secondary" className="text-[10px]">Otomatis vClaim</Badge>;
  return <Badge className="text-[10px] border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">Valid</Badge>;
}

function RecordStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === 'error') return <Badge variant="destructive" className="text-[10px]">{status.toUpperCase()}</Badge>;
  if (s === 'pending') return <Badge className="text-[10px] border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">{status.toUpperCase()}</Badge>;
  return <Badge className="text-[10px] border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">{status.toUpperCase()}</Badge>;
}

// ─── Unified 60-column table (replaces old "Validasi 60 Kolom" + "Verifikasi & Edit" tabs) ───

// Kategori field yang cuma relevan untuk pasien menginap — disembunyikan
// total untuk RAWAT_JALAN (bukan cuma dikosongkan) supaya tidak membingungkan
// verifikator ("kenapa ada data ICU untuk pasien rawat jalan?").
const INPATIENT_ONLY_CATEGORIES = new Set(['ICU & Ventilasi']);

function RecordFieldsTable({
  recordData, validationErrors, editing, editedValues, onEdit, onlyIssues, jenisKlaim,
}: {
  recordData: Record<string, any>;
  validationErrors: ValidationError[];
  editing: boolean;
  editedValues: Record<string, any>;
  onEdit: (col: string, val: string) => void;
  onlyIssues: boolean;
  jenisKlaim?: string | null;
}) {
  const fieldMap = useMemo(() => buildFieldMap(recordData, validationErrors), [recordData, validationErrors]);

  const categories = Object.entries(FIELD_CATEGORIES)
    .filter(([category]) => !(jenisKlaim === 'RAWAT_JALAN' && INPATIENT_ONLY_CATEGORIES.has(category)))
    .map(([category, cols]) => ({
      category,
      rows: cols
        .map(c => fieldMap[c])
        .filter(f => !onlyIssues || f.status === 'error' || f.status === 'empty'),
    }));
  const totalRows = categories.reduce((n, c) => n + c.rows.length, 0);

  return (
    <div className="rounded-lg border overflow-y-auto" style={{ maxHeight: 560 }}>
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 z-10 bg-muted">
          <tr className="border-b">
            <th className="w-[190px] text-left px-3 py-2 font-semibold text-xs">Kolom</th>
            <th className="text-left px-3 py-2 font-semibold text-xs">Nilai</th>
            <th className="w-[110px] text-left px-3 py-2 font-semibold text-xs">Status</th>
            <th className="text-left px-3 py-2 font-semibold text-xs">Catatan / Saran</th>
          </tr>
        </thead>
        <tbody>
          {totalRows === 0 && onlyIssues ? (
            <tr>
              <td colSpan={4} className="text-center py-6 text-muted-foreground">
                <strong className="text-foreground">✅ Tidak ada data bermasalah</strong> — semua kolom vClaim terisi &amp; valid.
                Matikan &ldquo;Tampilkan hanya yang bermasalah&rdquo; untuk melihat seluruh data klaim.
              </td>
            </tr>
          ) : (
            categories.map(({ category, rows }) => (
              <Fragment key={category}>
                <tr>
                  <td colSpan={4} className="bg-muted/70 font-bold text-[11px] text-muted-foreground uppercase tracking-wide px-3 py-1.5">
                    {category}
                  </td>
                </tr>
                {rows.map(field => {
                  const isSystem = field.status === 'system';
                  const currentValue = editedValues[field.column_name] !== undefined
                    ? editedValues[field.column_name] : field.value;
                  const isChanged = editedValues[field.column_name] !== undefined;
                  return (
                    <tr key={field.column_name} className="border-b last:border-0 hover:bg-muted/40 align-top">
                      <td className="px-3 py-2 font-semibold text-xs">{field.column_name}</td>
                      <td className="px-3 py-2">
                        {editing && !isSystem ? (
                          <input
                            type="text"
                            value={String(currentValue ?? '')}
                            onChange={e => onEdit(field.column_name, e.target.value)}
                            className={cn(
                              'w-full rounded-md border bg-background px-2 py-1.5 font-mono text-xs',
                              'focus:outline-none focus:ring-2 focus:ring-ring/50',
                              isChanged ? 'border-blue-500' : 'border-input',
                            )}
                          />
                        ) : (
                          <span className={cn('font-mono text-xs', field.status === 'error' ? 'text-destructive' : 'text-foreground')}>
                            {currentValue === null || currentValue === undefined || currentValue === ''
                              ? <span className="text-muted-foreground italic">(kosong)</span>
                              : String(currentValue)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={field.status} />
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {field.status === 'error' && field.error_message && (
                          <div>
                            <div className="text-destructive mb-1">
                              <strong>{field.rule_id}:</strong> {field.error_message}
                            </div>
                            {field.suggestion && (
                              <div className="bg-blue-500/10 border-l-2 border-blue-500 px-2.5 py-1.5 rounded-r-md mt-1">
                                <strong>Perbaiki menjadi:</strong>{' '}
                                <code className="font-mono text-xs">{field.suggestion}</code>
                              </div>
                            )}
                          </div>
                        )}
                        {field.status === 'empty' && !field.codeEvidence && (
                          <span className="text-amber-600 dark:text-amber-400">
                            {(field.column_name === 'KODE_RS' || field.column_name === 'KELAS_RS')
                              ? <>Field ini atribut rumah sakit, bukan per-klaim — memang tidak pernah tercetak di SEP/Resume Medis pasien. Isi sekali di menu <strong>Aturan Validasi &gt; Profil Rumah Sakit</strong>, akan otomatis terisi untuk klaim berikutnya.</>
                              : 'Data tidak ditemukan di dokumen PDF. Periksa dan isi manual.'}
                          </span>
                        )}
                        {field.aiNote && (
                          <div className={cn('bg-violet-500/10 border-l-2 border-violet-500 px-2.5 py-1.5 rounded-r-md', field.status === 'error' ? 'mt-1.5' : '')}>
                            <strong className="inline-flex items-center gap-1"><Sparkles className="size-3" /> AI:</strong> {field.aiNote}
                          </div>
                        )}
                        {field.codeEvidence && field.codeEvidence.length > 0 && (
                          <div className={cn('flex flex-wrap gap-1', (field.status === 'error' || field.aiNote) ? 'mt-1.5' : '')}>
                            {field.codeEvidence.map(ev => (
                              <span
                                key={ev.code}
                                className={cn(
                                  'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-mono border',
                                  ev.found
                                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30'
                                    : 'bg-destructive/10 text-destructive border-destructive/30',
                                  ev.quotation ? 'cursor-help' : '',
                                )}
                                title={ev.found && ev.quotation ? `Hal. ${ev.page_number}: "${ev.quotation}"` : !ev.found ? 'Tidak ada bukti dokumen — periksa manual' : undefined}
                              >
                                {ev.found ? <CheckCircle2 className="size-3" /> : <AlertTriangle className="size-3" />} {ev.code}
                              </span>
                            ))}
                          </div>
                        )}
                        {field.suggestedCodes && field.suggestedCodes.length > 0 && (
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-blue-600 dark:text-blue-400">
                            <span className="inline-flex items-center gap-1"><Lightbulb className="size-3" /> Kode disarankan dari dokumen (belum diklaim, verifikasi dulu sebelum dipakai):</span>
                            {field.suggestedCodes.map((s, i) => {
                              const currentCodes = String(currentValue ?? '').split(';').map(c => c.trim()).filter(Boolean);
                              const alreadyApplied = currentCodes.includes(s.code);
                              return (
                                <span key={s.code} className="inline-flex items-center gap-1">
                                  {i > 0 && <span>,</span>}
                                  <span title={`Hal. ${s.page_number}: "${s.quotation}"${s.reasoning ? ` — ${s.reasoning}` : ''}`} className="cursor-help font-mono">
                                    {s.code}
                                  </span>
                                  {editing && !isSystem && (
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="sm"
                                      disabled={alreadyApplied}
                                      onClick={() => onEdit(field.column_name, [...currentCodes, s.code].join(';'))}
                                      className="h-5 px-1.5 text-[10px]"
                                    >
                                      {alreadyApplied ? '✓ Diterapkan' : 'Terapkan'}
                                    </Button>
                                  )}
                                </span>
                              );
                            })}
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
    <div className="flex items-center justify-center py-24">
      <div className="size-8 rounded-full border-2 border-muted border-t-primary animate-spin" />
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
  const [listCollapsed, setListCollapsed] = useState(false);

  const selectRecord = (id: string) => {
    setSelectedRecordId(id);
    setListCollapsed(true);
  };

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

  // Berapa persen data (di halaman yang sudah dimuat) yang butuh cek manual
  // karena field riwayat episode kosong — verifikator ingin tahu skala
  // dampaknya, bukan cuma tahu record yang sedang dilihat saja yang kena.
  const episodeGapStats = useMemo(() => {
    if (records.length === 0) return null;
    const affected = records.filter(r => !hasEpisodeTrackingData(r));
    if (affected.length === 0) return null;
    return {
      count: affected.length,
      ofLoaded: records.length,
      pct: Math.round((affected.length / records.length) * 100),
    };
  }, [records]);

  if (loading) return <LoadingSpinner />;
  if (!fileInfo) return (
    <div className="flex items-center justify-center py-24 text-muted-foreground">
      <h3 className="text-base font-semibold">File tidak ditemukan</h3>
    </div>
  );

  const totalPages = Math.ceil(total / 30);
  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
  const canApprove = ['supervisor', 'admin'].includes(user.role) && fileInfo.status === 'completed';

  const selectedRecord = selectedRecordId ? records.find(r => r.id === selectedRecordId) : null;

  const kategori = JENIS_KLAIM_OPTIONS.find(o => o.value === fileInfo.jenis_klaim);

  return (
    <div className="animate-fade-in space-y-4">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <Header
        title="Hasil Validasi"
        description={fileInfo.file_name}
        actions={
          <>
            {kategori && (
              <Badge
                className="text-[11px] border-transparent"
                style={{ background: `color-mix(in srgb, ${kategori.accent} 14%, transparent)`, color: kategori.accent }}
              >
                {kategori.icon} {kategori.label}
              </Badge>
            )}
            <Button variant="outline" onClick={handleExport}>Ekspor</Button>
            {canApprove && (
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleApprove}>Setujui</Button>
            )}
          </>
        }
      />

      {/* ─── Compact summary bar ─────────────────────────────────────── */}
      <Card className="p-4 flex flex-row flex-wrap items-center gap-7">
        <div>
          <div className="text-[11px] text-muted-foreground">Total Data</div>
          <div className="text-xl font-bold">{fileInfo.total_records}</div>
        </div>
        <div>
          <div className="text-[11px] text-muted-foreground">Valid</div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{fileInfo.valid_count}</div>
        </div>
        <div>
          <div className="text-[11px] text-muted-foreground">Error</div>
          <div className="text-xl font-bold text-destructive">{fileInfo.error_count}</div>
        </div>
        <div>
          <div className="text-[11px] text-muted-foreground">Pending</div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{fileInfo.pending_count}</div>
        </div>
        {fileInfo.error_summary && fileInfo.error_summary.length > 0 && (
          <div className="flex flex-wrap gap-2 ml-auto">
            {fileInfo.error_summary.map(rule => (
              <Badge
                key={rule.rule_id}
                variant={rule.severity === 'critical' ? 'destructive' : 'secondary'}
                className="text-[10px]"
              >
                {rule.rule_id} · {rule.count}
              </Badge>
            ))}
          </div>
        )}
      </Card>

      {/* ─── Toolbar: search / filter (only relevant when there's more than 1 record) ─── */}
      {(total > 1 || search || filter !== 'all') && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Cari Nama, SEP, atau No. Kartu..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Status:</span>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={filter}
              onChange={e => { setFilter(e.target.value); setPage(1); }}
            >
              <option value="all">Semua Rekam</option>
              <option value="valid">Valid</option>
              <option value="error">Error</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>
      )}

      <div className={cn('flex gap-4 items-start', !(total > 1 || records.length > 1) && 'block')}>
        {/* ─── Left: records list (multi-record files) — collapses to a rail once a record is picked, so the detail panel gets room to breathe ── */}
        {(total > 1 || records.length > 1) && (
          <motion.div
            className="shrink-0 overflow-hidden"
            animate={{ width: listCollapsed ? 48 : 380 }}
            initial={false}
            transition={{ type: 'spring', stiffness: 340, damping: 32 }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {listCollapsed ? (
                <motion.button
                  key="rail"
                  onClick={() => setListCollapsed(false)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="w-12 h-[420px] rounded-xl border border-border bg-card hover:bg-muted/50 flex flex-col items-center justify-center gap-3 text-muted-foreground hover:text-foreground transition-colors"
                  title="Tampilkan daftar pasien"
                >
                  <PanelLeftOpen className="size-4" />
                  <span
                    className="text-[11px] font-medium tracking-wide"
                    style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                  >
                    Daftar Pasien ({total || records.length})
                  </span>
                </motion.button>
              ) : (
                <motion.div
                  key="list"
                  className="space-y-3 w-[380px]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15, delay: 0.1 }}
                >
                  <Card className="p-0 overflow-hidden gap-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left px-3 py-2 text-xs font-semibold">Nama Pasien</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold">No. SEP</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {records.length === 0 ? (
                            <tr><td colSpan={3} className="text-center py-6 text-muted-foreground">Tidak ada data</td></tr>
                          ) : records.map(rec => (
                            <tr
                              key={rec.id}
                              className={cn('cursor-pointer border-b last:border-0 hover:bg-muted/40', selectedRecordId === rec.id && 'bg-primary/10')}
                              onClick={() => selectRecord(rec.id)}
                            >
                              <td className="px-3 py-2">
                                <div className="font-semibold text-[13px]">{rec.nama_pasien || '(kosong)'}</div>
                                <div className="text-[11px] text-muted-foreground">MRN: {rec.mrn || '-'}</div>
                              </td>
                              <td className="px-3 py-2 font-mono text-xs">{rec.sep}</td>
                              <td className="px-3 py-2"><RecordStatusBadge status={rec.validation_status} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>

                  {totalPages > 1 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                        <ChevronLeft className="size-3.5" /> Sebelumnya
                      </Button>
                      {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 7) pageNum = i + 1;
                        else if (page <= 4) pageNum = i + 1;
                        else if (page >= totalPages - 3) pageNum = totalPages - 6 + i;
                        else pageNum = page - 3 + i;
                        return (
                          <Button
                            key={pageNum}
                            variant={page === pageNum ? 'default' : 'outline'}
                            size="sm"
                            className="w-8 px-0"
                            onClick={() => setPage(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                      <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                        Selanjutnya <ChevronRight className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ─── Right: selected record detail ───────────────────────────── */}
        <div className="min-w-0 flex-1">
          {selectedRecord ? (
            <Card className="p-5">
              <div className="flex justify-between items-start mb-4 flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold">{selectedRecord.nama_pasien} (SEP: {selectedRecord.sep})</h3>
                    {kategori && (
                      <Badge
                        className="text-[11px] border-transparent"
                        style={{ background: `color-mix(in srgb, ${kategori.accent} 14%, transparent)`, color: kategori.accent }}
                      >
                        {kategori.icon} {kategori.label}
                      </Badge>
                    )}
                    {parseRawData(selectedRecord).POTENSI_PRB_SEP && (
                      <Badge
                        className="text-[11px] border-transparent bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300"
                        title="Flag ini tercetak langsung dari sistem BPJS di halaman SEP, bukan simpulan AI/RS — pertimbangkan cek status PRB pasien ini."
                      >
                        🔔 Potensi PRB (BPJS)
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
                    MRN: {selectedRecord.mrn || '-'} · Status:
                    <RecordStatusBadge status={selectedRecord.validation_status} />
                    {parseRawData(selectedRecord).JENIS_KUNJUNGAN_SEP && (
                      <span>· Jenis Kunjungan (SEP): <span className="text-foreground">{parseRawData(selectedRecord).JENIS_KUNJUNGAN_SEP}</span></span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input type="checkbox" checked={onlyIssues} onChange={e => setOnlyIssues(e.target.checked)} />
                    Tampilkan hanya yang bermasalah
                  </label>
                  {!isEditing ? (
                    <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>Edit</Button>
                  ) : (
                    <>
                      <Button variant="secondary" size="sm" onClick={() => { setIsEditing(false); setEditedValues({}); }}>Batal</Button>
                      <Button
                        size="sm"
                        disabled={Object.keys(editedValues).length === 0 || isSavingRecord}
                        onClick={handleSaveRecord}
                      >
                        {isSavingRecord ? 'Menyimpan...' : `Simpan (${Object.keys(editedValues).length})`}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* ─── Peringatan: rule yang tidak bisa diverifikasi otomatis ── */}
              {!hasEpisodeTrackingData(selectedRecord) && (
                <div className="mb-4 px-3.5 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-foreground flex gap-2">
                  <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="space-y-1.5">
                    <div>
                      <strong>Cek manual diperlukan</strong> — berkas ini tidak menyertakan data riwayat kunjungan/episode, sehingga beberapa aturan tidak bisa diperiksa otomatis. Harap pastikan secara manual.
                      {' '}
                      {UNVERIFIABLE_WITHOUT_EPISODE_DATA.map((r, i) => (
                        <span key={r.rule_id}>
                          {i > 0 && ', '}
                          <strong>{r.rule_id}</strong> ({r.label})
                        </span>
                      ))}.
                    </div>
                    {episodeGapStats && (
                      <div className="flex items-center gap-1.5 pt-0.5 border-t border-amber-500/20 mt-1.5">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/20 font-semibold text-amber-800 dark:text-amber-300 tabular-nums">
                          {episodeGapStats.pct}%
                        </span>
                        <span className="text-muted-foreground">
                          data pada berkas ini ({episodeGapStats.count} dari {episodeGapStats.ofLoaded} record{episodeGapStats.ofLoaded < total ? ' yang dimuat' : ''}) berpotensi pending karena alasan yang sama — field riwayat episode kosong, sama seperti record yang sedang dilihat.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ─── Potensi risiko pending (di luar rule engine) ─────────
                  Pola administratif/klinis yang paling sering bikin klaim RS
                  ini di-pending verifikator BPJS (dianalisis dari data
                  pending riil), dideteksi AI dari bukti dokumen — bukan
                  error validasi format, jadi ditampilkan terpisah dari tabel
                  di bawah. Selalu tertaut ke kutipan dokumen; verifikator
                  yang memutuskan, bukan aplikasi. */}
              {(() => {
                const pendingRisks = parseAiReview(selectedRecord)?.pending_risk_notes;
                if (!pendingRisks || pendingRisks.length === 0) return null;
                return (
                  <div className="mb-4 px-3.5 py-2.5 rounded-lg bg-violet-500/10 border border-violet-500/30 text-xs text-foreground space-y-2.5">
                    <div className="flex items-center gap-2 font-semibold text-violet-700 dark:text-violet-300">
                      <Sparkles className="size-4 shrink-0" />
                      Potensi Risiko Pending — {pendingRisks.length} pola terdeteksi AI dari dokumen
                    </div>
                    {pendingRisks.map((risk, i) => (
                      <div key={i} className="pl-6 border-l-2 border-violet-500/30 space-y-1">
                        <div className="font-semibold">
                          {PENDING_RISK_LABELS[risk.pattern] || risk.pattern}
                          <span className="ml-1.5 font-normal text-muted-foreground">(hal. {risk.page_number})</span>
                        </div>
                        <div className="text-muted-foreground">{risk.note}</div>
                        <div className="italic text-muted-foreground/80">&ldquo;{risk.basis}&rdquo;</div>
                      </div>
                    ))}
                    <div className="pt-1 text-muted-foreground/80">
                      Ini saran untuk dicek verifikator/koder, bukan keputusan final — rule engine tidak menolak klaim karena hal ini.
                    </div>
                  </div>
                );
              })()}

              {/* ─── Bukti primer: dokumen PDF asli vs data klaim ───────── */}
              {/* Tampil jika berkas aslinya PDF (via nama file, tidak bergantung
                  flag has_pdf dari backend) — kalau file ternyata hilang di disk,
                  PdfViewer menampilkan pesan yang jelas. */}
              {String(fileInfo.file_name || '').toLowerCase().endsWith('.pdf') && (
                <div className="mb-4">
                  <Button variant="outline" size="sm" onClick={() => setShowPdf(v => !v)}>
                    <FileText className="size-3.5" />
                    {showPdf ? 'Sembunyikan Dokumen PDF Asli' : 'Lihat Dokumen PDF Asli'}
                  </Button>
                </div>
              )}

              {/* ─── The single 60-column table (side-by-side dengan PDF saat dibuka) ─── */}
              {showPdf ? (
                <div>
                  <div className="flex gap-2 mb-2 items-center">
                    <Button variant="secondary" size="sm" onClick={() => setMaximizeData(v => !v)}>
                      {maximizeData ? 'Kembali' : 'Perbesar Data'}
                    </Button>
                  </div>
                  <div className={cn('grid gap-4', maximizeData ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-2')}>
                    <div
                      className="min-w-0"
                      style={{
                        order: maximizeData ? 1 : 0,
                        maxHeight: maximizeData ? 'none' : 780,
                        overflowY: maximizeData ? 'visible' : 'auto',
                      }}
                    >
                      <RecordFieldsTable
                        recordData={selectedRecord}
                        validationErrors={selectedRecord.errors || []}
                        editing={isEditing}
                        editedValues={editedValues}
                        onEdit={(col, val) => setEditedValues(prev => ({ ...prev, [col]: val }))}
                        onlyIssues={onlyIssues}
                        jenisKlaim={fileInfo.jenis_klaim}
                      />
                    </div>
                    <div className="min-w-0" style={{ order: maximizeData ? 2 : 0 }}>
                      {/* ─── ErrorBoundary lokal, BUKAN global ───────────────
                          PdfViewer pakai pdf.js (canvas + web worker) yang
                          perilakunya bisa beda-beda tergantung browser/PC
                          (versi lama, driver grafis, antivirus yang blok
                          worker script, dst) — device tim RS pernah crash
                          total & minta reload, padahal PC lain aman-aman
                          saja. Sebelum ini TIDAK ADA ErrorBoundary di mana
                          pun di aplikasi, jadi crash apapun di PdfViewer
                          menjalar ke seluruh halaman (termasuk tabel 60
                          kolom yang jauh lebih penting dari sekadar preview
                          PDF). key={fileId} supaya boundary reset otomatis
                          kalau pindah record — sekali crash tidak nge-stuck
                          selamanya. */}
                      <ErrorBoundary
                        key={fileId}
                        fallback={
                          <div
                            className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card p-6 text-center"
                            style={{ height: maximizeData ? 420 : 780 }}
                          >
                            <FileText className="size-6 text-muted-foreground" />
                            <p className="text-sm font-semibold text-foreground">Dokumen PDF tidak dapat ditampilkan</p>
                            <p className="max-w-xs text-xs text-muted-foreground">
                              Terjadi kendala teknis saat menampilkan pratinjau PDF di perangkat ini (kadang terjadi di browser versi lama). Data klaim di sebelah tetap bisa dibaca & diedit seperti biasa.
                            </p>
                          </div>
                        }
                      >
                        <PdfViewer fileId={fileId} fileName={fileInfo.file_name} height={maximizeData ? 420 : 780} />
                      </ErrorBoundary>
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
                  jenisKlaim={fileInfo.jenis_klaim}
                />
              )}
            </Card>
          ) : (
            <Card className="p-10 text-center text-muted-foreground">
              Pilih data dari tabel untuk melihat detail validasi
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
