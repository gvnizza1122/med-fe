'use client';
import { useEffect, useState, useCallback, useMemo, useRef, Fragment, type CSSProperties, type ReactNode, type Ref } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { ToastContainer, useToast } from '@/components/Toast';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Rv20ConfirmationModal } from '@/components/Rv20ConfirmationModal';
import { SuratKlarifikasiModal } from '@/components/SuratKlarifikasiModal';
import { PadananKodeNyeriCard } from '@/components/PadananKodeNyeriCard';
import { CodingExplanationPanel } from '@/components/CodingExplanationPanel';
import { DOCUMENT_TYPE_LABELS } from '@/lib/generateCodingExplanation';
import { Header } from '@/components/dashboard/header';
import { InaCbgTarifDisplay, InaCbgTarifPending } from '@/components/InaCbgTarifDisplay';
import { KetentuanKlaimCard, type TemuanKombinasiKode } from '@/components/KetentuanKlaimCard';
import { IdentitasHalamanCard, type TemuanIdentitasHalaman } from '@/components/IdentitasHalamanCard';
import { SyaratPenunjangCard, type TemuanSyaratPenunjang } from '@/components/SyaratPenunjangCard';
import { TemuanTindakanCard, type TemuanTindakan, type SilangTindakan } from '@/components/TemuanTindakanCard';
import { KonsistensiDataCard, type TemuanKonsistensi } from '@/components/KonsistensiDataCard';
import { validateClinicalCoherence, type VitalSigns, type ClinicalCoherenceInput } from '@/services/clinicalCoherenceValidator';
// import { InaCbgDashboardCard } from '@/components/InaCbgDashboardCard'; // disembunyikan sementara (18 Sep 2026)

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { FIELD_TYPE_REGISTRY } from '@/lib/fieldTypeRegistry';
import { Search, CheckCircle2, XCircle, ChevronLeft, ChevronRight, FileText, Sparkles, Lightbulb, AlertTriangle, PanelLeftOpen, Users } from 'lucide-react';

// react-pdf (pdfjs-dist) mengakses DOMMatrix di level modul — API browser
// yang tidak ada saat Next.js SSR. Import statis biasa bikin server crash
// (ReferenceError: DOMMatrix is not defined) setiap kali halaman ini diakses,
// bukan hanya saat tombol "Lihat Dokumen PDF Asli" diklik. ssr:false memaksa
// modul ini (dan seluruh dependensinya) cuma dievaluasi di browser.
const PdfViewer = dynamic(() => import('@/components/PdfViewer'), { ssr: false });

// Kategori GAWAT_DARURAT dihapus 21 Sep 2026 (kunjungan IGD termasuk Rawat
// Jalan). Labelnya SENGAJA disisakan di sini sebagai jaring pengaman
// tampilan: kalau ada berkas lama yang lolos dari migrasi data, labelnya
// tetap terbaca dan tidak muncul sebagai kategori kosong.
const JENIS_KLAIM_OPTIONS = [
  { value: 'RAWAT_JALAN', label: 'Rawat Jalan', icon: '🚶', accent: '#2563eb' },
  { value: 'RAWAT_INAP', label: 'Rawat Inap', icon: '🛏️', accent: '#6366f1' },
  { value: 'GAWAT_DARURAT', label: 'IGD / Gawat Darurat', icon: '🚨', accent: '#dc2626' },
];

// Kode status keluar (DISCHARGE_STATUS) resmi vClaim BPJS — dicek RV-08 (1-5).
// Ditampilkan sebagai "1 - Pulang atas persetujuan dokter" dsb, bukan angka
// polos atau kata mentah hasil salinan dokumen ("Pulang"), supaya verifikator
// langsung paham artinya tanpa harus hafal kodenya.
const DISCHARGE_STATUS_LABELS: Record<string, string> = {
  '1': 'Pulang atas persetujuan dokter (sembuh / kondisi membaik)',
  '2': 'Dirujuk ke rumah sakit lain',
  '3': 'Pulang atas permintaan sendiri (APS / menolak nasihat medis)',
  '4': 'Meninggal dunia',
  '5': 'Lainnya',
};

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
  'UMUR_HARI': 'umur_hari', 'DPJP': 'dpjp_name', 'NOKARTU': 'nokartu',
  'PAYOR_ID': 'payor_id', 'CODER_ID': 'coder_id', 'VERSI_INACBG': 'versi_inacbg',
  'VERSI_GROUPER': 'versi_grouper',
  'INACBG': 'inacbg_code', 'DESKRIPSI_INACBG': 'deskripsi_inacbg', 'TARIF_INACBG': 'tarif_inacbg',
  'DESKRIPSI_SP': 'deskripsi_sp', 'DESKRIPSI_SR': 'deskripsi_sr', 'DESKRIPSI_SI': 'deskripsi_si',
  'DESKRIPSI_SD': 'deskripsi_sd', 'TARIF_SP': 'tarif_sp', 'TARIF_SR': 'tarif_sr',
  'TARIF_SI': 'tarif_si', 'TARIF_SD': 'tarif_sd',
};

const FIELD_LABELS: Record<string, string> = {
  'KODE_RS': 'Kode RS', 'KELAS_RS': 'Kelas RS', 'KELAS_RAWAT': 'Kelas Rawat',
  'KODE_TARIF': 'Kode Tarif', 'PTD': 'PTD', 'ADMISSION_DATE': 'Tanggal Masuk',
  'DISCHARGE_DATE': 'Tanggal Keluar', 'BIRTH_DATE': 'Tanggal Lahir',
  'BIRTH_WEIGHT': 'Berat Lahir (kg)', 'BERAT_BADAN': 'Berat Badan', 'SEX': 'Jenis Kelamin', 'DISCHARGE_STATUS': 'Status Keluar',
  'DIAGLIST': 'Daftar Diagnosis', 'PROCLIST': 'Daftar Prosedur', 'ADL1': 'ADL1', 'ADL2': 'ADL2',
  'IN_SP': 'Indikator SP', 'IN_SR': 'Indikator SR', 'IN_SI': 'Indikator SI', 'IN_SD': 'Indikator SD',
  'SUBACUTE': 'Subakut', 'CHRONIC': 'Kronis', 'SP': 'SP', 'SR': 'SR', 'SI': 'SI', 'SD': 'SD',
  'TARIF_SUBACUTE': 'Tarif Subakut', 'TARIF_CHRONIC': 'Tarif Kronis',
  'TOTAL_TARIF': 'Total Tarif', 'TARIF_RS': 'Tarif RS', 'TARIF_POLI_EKS': 'Tarif Poli Eks',
  'LOS': 'Lama Rawat (hari)', 'ICU_INDIKATOR': 'Indikator ICU', 'ICU_LOS': 'Lama ICU (hari)', 'VENT_HOUR': 'Jam Ventilasi',
  'NAMA_PASIEN': 'Nama Pasien', 'MRN': 'MRN', 'UMUR_TAHUN': 'Umur (tahun)',
  'UMUR_HARI': 'Umur (hari)', 'DPJP': 'DPJP', 'NOKARTU': 'Nomor Kartu',
  'PAYOR_ID': 'Payor ID', 'CODER_ID': 'Coder ID', 'VERSI_INACBG': 'Versi INA-CBG',
  'VERSI_GROUPER': 'Versi Grouper',
  'INACBG': 'Kode INA-CBG', 'DESKRIPSI_INACBG': 'Deskripsi INA-CBG', 'TARIF_INACBG': 'Tarif INA-CBG',
  'DESKRIPSI_SP': 'Deskripsi SP', 'DESKRIPSI_SR': 'Deskripsi SR', 'DESKRIPSI_SI': 'Deskripsi SI',
  'DESKRIPSI_SD': 'Deskripsi SD', 'TARIF_SP': 'Tarif SP', 'TARIF_SR': 'Tarif SR',
  'TARIF_SI': 'Tarif SI', 'TARIF_SD': 'Tarif SD',
};

// Rule engine (ruleEngine.js) reports validation_errors.field_name in lowercase
// snake_case (mis. "diagnosa_list", "tarif_rs") -- beda dari FIELD_LABELS yang
// dikunci UPPERCASE nama kolom vClaim. Tanpa ini, label mentah snake_case bocor
// ke UI "Kenapa Status Pending?" (mis. "diagnosa_list:" alih-alih "Daftar
// Diagnosis:") untuk SEMUA field, bukan cuma satu -- lihat SNAKE_TO_UPPER.
const SNAKE_TO_UPPER: Record<string, string> = Object.fromEntries(
  Object.entries(FIELD_MAPPING).map(([upper, snake]) => [snake, upper])
);
// Field khusus hasil rule engine (RV-13/14/15/16, lihat EPISODE_TRACKING_MARKERS)
// yang tidak punya padanan kolom vClaim 60-kolom, jadi tidak ada di FIELD_MAPPING.
const EXTRA_FIELD_LABELS: Record<string, string> = {
  jumlah_episode_klaim: 'Jumlah Episode Klaim',
  urutan_iterasi: 'Urutan Iterasi',
};

function getFieldLabel(columnName: string): string {
  if (FIELD_LABELS[columnName]) return FIELD_LABELS[columnName];
  const upper = SNAKE_TO_UPPER[columnName];
  if (upper && FIELD_LABELS[upper]) return FIELD_LABELS[upper];
  return EXTRA_FIELD_LABELS[columnName] || columnName;
}

const VCLAIM_FILLED_COLUMNS = new Set([
  'TARIF_RS', 'CODER_ID', 'VERSI_INACBG', 'VERSI_GROUPER', 'C1', 'C2', 'C3', 'C4'
]);

const FIELD_CATEGORIES: Record<string, string[]> = {
  // BERAT_BADAN (kontrak backend: kunci raw_data JSON persis "BERAT_BADAN",
  // terpisah dari BIRTH_WEIGHT/berat lahir) SENGAJA tidak dimasukkan ke
  // FIELD_MAPPING -- field ini TIDAK punya kolom DB tersendiri, HANYA ada
  // di raw_data. buildFieldMap() sudah menangani ini otomatis: kalau
  // FIELD_MAPPING[colName] undefined, dbValue jadi null & value murni dari
  // raw_data (fallback null kalau dokumen tidak mencatatnya -- wajar, banyak
  // dokumen tidak mencantumkan berat badan, status 'empty' biasa, tidak wajib).
  'Identitas Pasien': ['NAMA_PASIEN', 'MRN', 'SEX', 'BIRTH_DATE', 'BIRTH_WEIGHT', 'BERAT_BADAN', 'UMUR_TAHUN', 'UMUR_HARI'],
  'Data Rawatan': ['KODE_RS', 'KELAS_RS', 'KELAS_RAWAT', 'ADMISSION_DATE', 'DISCHARGE_DATE', 'DISCHARGE_STATUS', 'LOS'],
  'Diagnosis & Prosedur': ['DIAGLIST', 'PROCLIST', 'ADL1', 'ADL2'],
  'INA-CBG & Tarif': ['INACBG', 'DESKRIPSI_INACBG', 'TARIF_INACBG', 'SP', 'SR', 'SI', 'SD',
    'DESKRIPSI_SP', 'TARIF_SP', 'DESKRIPSI_SR', 'TARIF_SR', 'DESKRIPSI_SI',
    'TARIF_SI', 'DESKRIPSI_SD', 'TARIF_SD', 'TOTAL_TARIF'],
  'ICU & Ventilasi': ['ICU_INDIKATOR', 'ICU_LOS', 'VENT_HOUR'],
  // Baris SEP disembunyikan dari tabel data klaim 21 Sep 2026 (permintaan
  // klien). Nilainya tetap diekstrak & divalidasi seperti biasa -- yang
  // dihilangkan cuma tampilannya.
  'Asuransi & Rujukan': ['NOKARTU', 'PAYOR_ID', 'DPJP', 'KODE_TARIF', 'PTD', 'IN_SP', 'IN_SR', 'IN_SI', 'IN_SD', 'SUBACUTE', 'CHRONIC', 'TARIF_POLI_EKS'],
  // 'Sistem (Isi Otomatis oleh vClaim)' (TARIF_RS/CODER_ID/VERSI_INACBG/
  // VERSI_GROUPER/C1-C4) sengaja DIHAPUS dari tampilan atas permintaan user —
  // staf tidak paham istilah C1-C4, dan kolomnya (terutama C2) kadang berisi
  // blob JSON panjang yang merusak layout tabel. Kolom-kolom ini tetap ada
  // di database/raw_data (diisi otomatis saat submit ke vClaim), cuma tidak
  // lagi dirender di tabel 60-kolom ini.
};

interface CodeEvidence {
  code: string;
  type: 'diagnosis' | 'procedure';
  found: boolean;
  page_number: number | null;
  quotation: string | null;
  // Ditambah 19 Sep 2026 (fix item 7/8/9) -- lihat code_evidence[] di
  // aiReviewService.js. document_type dari metadata halaman (deterministik),
  // review_status model status baru per kode (VALID/PENDING
  // tidak terverifikasi), review_flags alasan + evidence tambahan.
  document_type?: 'rincian_biaya' | 'spri' | 'sep' | 'resume_medis' | 'triase_igd' | 'lab' | 'berkas_eklaim' | 'lainnya' | null;
  review_status?: 'VALID' | 'PENDING';
  review_flags?: { reason: string; alternative_code?: string | null; action?: string | null }[];
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
  // 'wajar_kosong'/'usulan' ditambahkan 16 Sep 2026 (P1-2, badge 6-status) --
  // sebelumnya field wajar_kosong (mis. SP/SR/SI/SD, ADL1/2) yang kosong sama
  // sekali tidak dibedakan dari field salin yang genuinely hilang (sama-sama
  // 'empty'), padahal maknanya beda total: satu normal, satu perlu ditindak.
  // 'usulan' = field koding kosong TAPI ada suggestedCodes AI menunggu
  // verifikasi manual (bukan blank yang sama sekali tidak ada bahan).
  // 'review' ditambah 19 Sep 2026 (fix item 8/9) -- DIAGLIST/PROCLIST yang
  // punya code_evidence dengan review_status perlu_review/evidence_tidak_
  // terverifikasi (lab rutin, diagnosis consistency, kutipan tak terverifikasi).
  status: 'valid' | 'error' | 'empty' | 'system' | 'wajar_kosong' | 'usulan' | 'review';
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
  page_number: number | null;
  basis: string;
  note: string;
}

// Restrukturisasi total 10-11 Sep 2026: 3 tabel (Parameter, Ambang Batas,
// Agregasi Kriteria K1-K5) menggantikan model lama (5 kriteria a-e freeform).
// Lihat kegawatdaruratanReference.js/kegawatdaruratanAggregation.js di backend.
interface KegawatdaruratanParameterFinding {
  key: string;
  label: string;
  ditemukan: boolean;
  status: 'normal' | 'abnormal' | null;
  nilai: string | null;
  page_number: number | null;
  kutipan: string | null;
  // Ditambahkan 11 Sep 2026: Tabel 1 boleh menampilkan temuan dari Resume
  // Medis Rawat Inap sebagai KONTEKS TAMBAHAN kalau Triase tidak mencatatnya
  // -- TIDAK ikut menentukan verdict K1-K5 (tetap Triase-only), murni info.
  sumber_dokumen?: 'triase_igd' | 'resume_medis' | null;
  // Ditambahkan 12-13 Sep 2026 (modul Pneumonia J12-J18) -- HANYA terisi utk
  // key==='retraksi', null utk 10 parameter lain. interkostal = distres napas
  // LEBIH BERAT per PNPK Tatalaksana Pneumonia pada Anak IDAI.
  retraksi_grade?: 'subkostal' | 'interkostal' | null;
}

interface KegawatdaruratanVitalFinding {
  nilai: number | null;
  band: 'normal' | 'borderline' | 'gawat' | null;
  page_number: number | null;
  kutipan: string | null;
  // Backend menandai TD yang di dokumen tertulis 0: itu cara petugas
  // menulis "tidak diukur", bukan hasil pengukuran (tekanan darah
  // sistolik 0 pada pasien hidup mustahil). nilai & band dikosongkan di
  // backend supaya tidak terhitung gawat; penanda ini dipakai untuk
  // menjelaskan ke koder dari mana angka 0 itu berasal.
  tercatat_nol?: boolean;
  instrumen_diharapkan?: string | null;
  // Tri-state (fix item 4, 19 Sep 2026): bedakan "kolomnya ada di form tapi
  // kosong" (empty_on_form, perlu ditindak) dari "form ini memang tidak
  // punya kolom itu" (not_in_form, BUKAN masalah). Field lama tanpa data ini
  // (belum di-generate ulang) akan undefined -- pemanggil WAJIB treat
  // undefined SAMA seperti 'empty_on_form' (perilaku lama, jangan diam-diam
  // sembunyikan action item untuk data yang belum diberi form_status).
  form_status?: 'recorded' | 'empty_on_form' | 'not_in_form';
}

interface KegawatdaruratanEvidence {
  // 'tindakan_segera'/'esi' ditambah 19 Sep 2026 (fix item 5).
  sumber: 'parameter_findings' | 'vital_findings' | 'ai_k1' | 'proclist' | 'tindakan_segera' | 'esi';
  key?: string;
  label?: string;
  nilai?: string | number;
  band?: string;
  kutipan?: string | null;
  page_number?: number | null;
  kode?: string;
  deskripsi?: string;
  id?: string;
  skor?: number;
  signal?: boolean;
}

interface KegawatdaruratanKriteria {
  kriteria: 'K1' | 'K2' | 'K3' | 'K4' | 'K5';
  label: string;
  status: 'ya' | 'borderline' | 'tidak';
  evidence: KegawatdaruratanEvidence[];
  catatan: string;
}

interface KegawatdaruratanAssessment {
  ringkasan: string;
  parameter_findings: KegawatdaruratanParameterFinding[];
  vital_findings: Record<string, KegawatdaruratanVitalFinding>;
  kriteria: KegawatdaruratanKriteria[];
  age_group: string | null;
  // Ditambah 19 Sep 2026 (fix item 5) -- tindakan keperawatan segera (teks
  // bebas, quote-validated) & skor ESI dari Triase IGD.
  tindakan_keperawatan?: { quotation: string; page_number: number }[];
  esi?: { skor: number | null; page_number: number | null; kutipan: string | null };
}

interface DiagnosisConsistencyFlag {
  code: string;
  status: string;
  alternative_code: string | null;
  alternative_label?: string | null;
  action: string;
  reason: string;
}

interface InaCbgResult {
  code: string;
  description: string;
  confidence: number; // 0..1
  reasoning?: string;
}

interface TariffResult {
  // Disamakan dengan bentuk yang dikirim backend (aiReviewService.js:
  // tarifResult). Salinan tipe ini sempat berbeda dari komponennya dan
  // sama-sama salah menamai field-nya tariff_amount.
  amount: number | null; // Rp, null kalau tarif tidak berlaku
  note?: string; // alasan spesifik saat amount null
  region: string; // e.g. "Regional 1"
  class: string; // e.g. "D"
  source: string; // e.g. "PMK 3/2023"
}

interface AiReview {
  // Tipe 3 ketentuan klaim (aturan kombinasi kode) -- diisi backend di
  // aiReviewService.js, kosong kalau tidak ada aturan yang terpicu.
  kombinasi_kode?: TemuanKombinasiKode[];
  identitas_halaman?: TemuanIdentitasHalaman[];
  syarat_penunjang?: TemuanSyaratPenunjang[];
  temuan_tindakan?: TemuanTindakan[];
  silang_tindakan?: SilangTindakan[];
  konsistensi_data?: TemuanKonsistensi[];
  field_notes?: Record<string, string>;
  code_evidence?: CodeEvidence[];
  suggested_codes?: SuggestedCode[];
  pending_risk_notes?: PendingRiskNote[];
  kegawatdaruratan_assessment?: KegawatdaruratanAssessment | null;
  // Ditambah 19 Sep 2026 (fix item 9) -- lihat diagnosisConsistencyService.js.
  diagnosis_consistency_flags?: DiagnosisConsistencyFlag[];
  // Ditambah 19 Sep 2026 -- INA-CBG grouping hasil dan tarif lookup
  inacbg_result?: InaCbgResult;
  tariff_result?: TariffResult;
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
  diagnosis_vitals_mismatch: 'Diagnosis vs vital sign tidak cocok',
  los_diagnosis_mismatch: 'Lama rawat vs diagnosis tidak cocok',
  komorbid_sekunder_tanpa_evaluasi: 'Diagnosis sekunder tanpa evaluasi krisis',
  massa_jinak_tanpa_infiltrasi: 'Massa jinak tanpa infiltrasi struktur vital',
  diagnosis_evidence_mismatch: 'Diagnosis tanpa bukti penunjang (lab/kultur/imaging)',
  observasi_igd_tidak_terdokumentasi: 'Observasi UGD tidak terdokumentasi',
  rawat_inap_rujuk_hari_sama: 'Rawat inap dirujuk di hari yang sama',
  kombinasi_kode_ht_gagal_jantung: 'Kode HT + gagal jantung belum digabung (I13.x)',
  resume_medis_tidak_ada: 'Resume medis tidak ditemukan di berkas',
  dnr_cardiac_arrest_kontradiksi: 'Kode cardiac arrest bertentangan dengan status DNR',
  pneumonia_tanpa_temuan_klinis: 'Pneumonia tanpa temuan auskultasi/radiologis',
  pneumonia_severity_vs_rawat_inap: 'Keparahan pneumonia vs rawat inap/gawat darurat',
};

/** Pecah teks catatan jadi daftar poin singkat (mendukung format "- ..." /
 * "• ..." per baris). Kalau teks berupa paragraf tunggal, jadikan 1 poin.
 * Dipakai di panel "Alasan Bisa Pending" supaya tidak tampil sebagai
 * paragraf panjang. */
function toBulletPoints(text: string): string[] {
  const raw = String(text || '');
  const lines = raw
    .split(/\r?\n|•/)
    .map(l => l.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean);
  return lines.length > 1 ? lines : (raw.trim() ? [raw.trim()] : []);
}

/** Potong teks jadi maks N karakter, sisipkan "…" kalau kepotong. */
function truncatePoint(text: string, max = 110): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

function parseAiReview(recordData: Record<string, any>): AiReview | null {
  if (!recordData.ai_review) return null;
  try { return typeof recordData.ai_review === 'string' ? JSON.parse(recordData.ai_review) : recordData.ai_review; }
  catch { return null; }
}

function buildFieldMap(recordData: Record<string, any>, validationErrors: ValidationError[], editedValues?: Record<string, any>): Record<string, FieldRow> {
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
    const isEmptyValue = value === null || value === undefined || value === '';
    // 'wajar_kosong' HANYA dipakai saat field itu benar2 kosong -- field
    // jenis wajar_kosong yang KEBETULAN terisi (mis. ADL1 ada isinya untuk
    // kasus subakut/kronis) tetap 'valid' seperti biasa, registry cuma
    // mengubah ARTI kekosongannya, bukan memaksa status tertentu.
    const jenis = FIELD_TYPE_REGISTRY[colName]?.jenis;
    map[colName] = {
      column_name: colName,
      value: value ?? null,
      status: VCLAIM_FILLED_COLUMNS.has(colName) ? 'system' :
        isEmptyValue ? (jenis === 'wajar_kosong' ? 'wajar_kosong' : 'empty') : 'valid',
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

  // Status 'usulan': field koding (DIAGLIST/PROCLIST) yang masih kosong TAPI
  // punya suggestedCodes menunggu -- beda dari 'empty' polos (tidak ada bahan
  // sama sekali). Tombol Terapkan sengaja dimatikan (lihat FieldRowTr), jadi
  // status ini murni informasi "ada usulan, verifikasi & ketik manual", BUKAN
  // status yang bisa berubah otomatis kalau usulan "diterapkan". Dicek
  // TERAKHIR (setelah suggestedCodes ke-assign di atas) supaya cuma override
  // field yang statusnya masih 'empty', tidak menimpa 'error' dari rule engine
  // (error tetap prioritas tertinggi, di-overlay terpisah SETELAH fungsi ini
  // return -- lihat pemanggil validationErrors?.forEach di atas function ini).
  for (const col of ['DIAGLIST', 'PROCLIST']) {
    if (map[col]?.status === 'empty' && (map[col].suggestedCodes?.length ?? 0) > 0) {
      map[col].status = 'usulan';
    }
  }

  // DIHAPUS 21 Sep 2026 (permintaan klien): kode yang isinya valid tapi
  // backend tandai review_status PENDING kini diperlakukan valid penuh.
  // Blok upgrade 'valid' -> 'review' sengaja tidak dijalankan lagi -- ini
  // SATU-SATUNYA tempat status itu di-set, jadi mematikannya di sini ikut
  // menghilangkan badge "Perlu Review", hitungan banner "N masalah",
  // section merah, dan filter "hanya yang bermasalah" sekaligus.

  // Berkas yang tidak menyertakan lembar SEP: baris SEP & Nomor Kartu
  // dibuang dari tabel (21 Sep 2026, permintaan klien). Keduanya cuma ada
  // di lembar SEP, jadi menampilkannya sebagai "Kosong" bikin berkas
  // terlihat bermasalah padahal datanya memang tidak ada di dokumen.
  //
  // has_bpjs_page dideteksi backend dari isi PDF (hasBpjsPageSignal di
  // pdfPageClassifier.js) dan sudah dipakai ruleEngine untuk tidak
  // menerbitkan error RV di sini -- tabel ini yang belum ikut tahu.
  // Dicek === false, bukan falsy: kalau field-nya tidak terkirim
  // (undefined), perilakunya tetap seperti dulu.
  if (recordData?.has_bpjs_page === false) {
    delete map['SEP'];
    delete map['NOKARTU'];
  }

  return map;
}

// Satu definisi "field ini masih butuh tindakan" dipakai di SEMUA tempat yang
// menghitung/menyaring masalah (banner atas, badge per-kategori, mode
// onlyIssues, dst) -- sebelumnya tiap tempat menulis predikat yang sama
// (`status==='error'||status==='empty'`) berulang, gampang salah satu
// kelewat kalau status baru ditambah (persis yang terjadi kalau 'usulan'
// ditambah manual di 5 tempat berbeda). 'wajar_kosong' SENGAJA tidak masuk
// sini -- itu tujuan utamanya, field itu memang bukan masalah.
function isIssueStatus(status: FieldRow['status']): boolean {
  return status === 'error' || status === 'empty' || status === 'usulan' || status === 'review';
}

function StatusBadge({ status }: { status: FieldRow['status'] }) {
  if (status === 'error') return <Badge variant="destructive" className="text-[10px]">Error</Badge>;
  if (status === 'empty') return <Badge className="text-[10px] border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">Kosong</Badge>;
  if (status === 'system') return <Badge variant="secondary" className="text-[10px]">Otomatis vClaim</Badge>;
  // wajar_kosong: netral (bukan hijau "aman diperiksa", bukan kuning "perlu
  // ditindak") -- field ini memang tidak berlaku untuk klaim ini, kosongnya
  // itu sendiri sudah informasi lengkap, tidak ikut hitungan masalah (lihat
  // isIssueStatus).
  if (status === 'wajar_kosong') return <Badge className="text-[10px] border-transparent bg-muted text-muted-foreground">Wajar kosong</Badge>;
  // usulan: garis putus-putus sengaja beda dari badge lain (semua solid) --
  // koder harus bisa bedakan sekilas mana yang disalin dari dokumen vs
  // disusun sistem & masih menunggu verifikasi manual.
  if (status === 'usulan') return <Badge className="text-[10px] border-dashed border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">Usulan</Badge>;
  // 'review' ditambah 19 Sep 2026 (fix item 8/9) -- isinya SUDAH ada (bukan
  // kosong) tapi backend menandai perlu dicek manual (lab rutin, konsistensi
  // diagnosis, atau evidence yang gagal terverifikasi) -- warna amber beda
  // dari 'error' (merah, jelas salah) supaya urgensinya tidak disamakan.
  if (status === 'review') return <Badge className="text-[10px] border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">Perlu Review</Badge>;
  return <Badge className="text-[10px] border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">Valid</Badge>;
}

// Label yang ditampilkan ke verifikator selalu "PENDING" untuk status
// error/pending (konsisten dengan kolom "Pending" di Riwayat Upload) — warna
// tetap dibedakan (merah utk error/major, kuning utk pending/minor) supaya
// tingkat urgensi tetap terlihat walau labelnya sama.
function RecordStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === 'error') return <Badge variant="destructive" className="text-[10px]">PENDING</Badge>;
  if (s === 'pending') return <Badge className="text-[10px] border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">PENDING</Badge>;
  return <Badge className="text-[10px] border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">{status.toUpperCase()}</Badge>;
}

// ─── Ringkasan cepat (banner + dot severity) ────────────────────────────────
// Dipakai bersama oleh tabel utama & Kegawatdaruratan untuk tampilan "simpel"
// (kesimpulan dulu, detail belakangan) — lihat SimplifiedFieldAccordion &
// KegawatdaruratanTable. Toggle "Tampilkan tabel lengkap" tetap membuka versi
// asli (tabel penuh) di kedua tempat, jadi data/detail tidak pernah hilang,
// cuma defaultnya diringkas.
function SummaryBanner({ tone, action, children }: { tone: 'success' | 'info' | 'warning' | 'danger'; action?: ReactNode; children: ReactNode }) {
  const toneClass: Record<string, string> = {
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400',
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400',
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400',
    danger: 'bg-destructive/10 border-destructive/30 text-destructive',
  };
  return (
    <div className={cn('rounded-lg border px-3 py-2 text-xs font-medium mb-3 flex items-center justify-between gap-2 flex-wrap', toneClass[tone])}>
      <span>{children}</span>
      {action}
    </div>
  );
}

function SeverityDot({ level }: { level: 'normal' | 'borderline' | 'gawat' | 'missing' }) {
  const color = level === 'gawat' ? 'var(--destructive)'
    : level === 'borderline' ? '#059669'
      : level === 'missing' ? 'var(--muted-foreground)'
        : '#059669'; // normal
  return <span className="inline-block size-2 rounded-full shrink-0" style={{ background: color }} />;
}

// ─── Unified 60-column table (replaces old "Validasi 60 Kolom" + "Verifikasi & Edit" tabs) ───

// Kategori field yang cuma relevan untuk pasien menginap — disembunyikan
// total (bukan cuma dikosongkan) supaya tidak membingungkan verifikator.
// Ditampilkan HANYA untuk RAWAT_INAP -- RAWAT_JALAN jelas tidak relevan, dan
// GAWAT_DARURAT (IGD) juga TIDAK relevan karena pasien IGD belum tentu masuk
// rawat inap ICU (lihat filter di categories, RecordFieldsTable).
const INPATIENT_ONLY_CATEGORIES = new Set(['ICU & Ventilasi']);

// Field per-field (bukan kategori penuh) yang disembunyikan tergantung jenis
// klaim -- kategori induknya (mis. "Diagnosis & Prosedur") tetap tampil dgn
// field lain di dalamnya, cuma field spesifik ini yang dilewati saat render.
// Definisi FIELD_CATEGORIES TIDAK diubah (kalau nanti perlu dikembalikan,
// tinggal hapus dari sini) -- pola yang sama dengan INPATIENT_ONLY_CATEGORIES,
// cuma level field. Kosong sekarang -- ADL1/ADL2 pindah ke ALWAYS_HIDDEN_FIELDS
// (17 Sep 2026, permintaan klien: disembunyikan semua jenis klaim, bukan cuma
// IGD) -- struktur ini dipertahankan (bukan dihapus) kalau nanti ada field
// lain yang perlu disembunyikan HANYA utk jenis klaim tertentu.
const JENIS_KLAIM_HIDDEN_FIELDS: Record<string, Set<string>> = {};
// Field yang disembunyikan dari tampilan tabel di SEMUA jenis klaim (bukan
// dihapus dari FIELD_CATEGORIES -- data mentahnya tetap ada di raw_data/DB,
// cuma tidak dirender di sini). Permintaan klien 17 Sep 2026, sebagian besar
// field ini SELALU kosong/None/0 di semua klaim yang pernah diperiksa dan
// dianggap menambah kebisingan tanpa informasi:
// - PTD: nilainya SELALU 1, dicurigai BUKAN hasil ekstraksi asli, masih
//   menunggu konfirmasi tim casemix soal arti field ini (lihat fieldTypeRegistry
//   di backend, perlu_konfirmasi:true).
// - ADL1/ADL2: cuma dipakai kasus subakut/kronis, hampir selalu kosong.
// - KODE_TARIF: cuma ada di lembar hasil grouper (jarang tersedia).
// - IN_SP/IN_SR/IN_SI/IN_SD, SUBACUTE, CHRONIC, TARIF_POLI_EKS: field top-up
//   Special CMG & poli eksekutif, wajar_kosong utk klaim tanpa top-up (lihat
//   fieldTypeRegistry) -- klien minta dihilangkan dari tampilan sepenuhnya
//   drpd ditandai "wajar kosong", supaya tabel lebih ringkas.
// - BERAT_BADAN: permintaan klien 18 Sep 2026 -- kolom Berat Badan
//   disembunyikan dari tabel.
const ALWAYS_HIDDEN_FIELDS = new Set([
  'PTD', 'ADL1', 'ADL2', 'KODE_TARIF',
  'IN_SP', 'IN_SR', 'IN_SI', 'IN_SD', 'SUBACUTE', 'CHRONIC', 'TARIF_POLI_EKS',
  'BERAT_BADAN', 'BIRTH_WEIGHT',
]);

// Satu baris <tr> tabel field — diekstrak dari RecordFieldsTable supaya bisa
// dipakai ULANG APA ADANYA oleh SimplifiedFieldAccordion (tampilan ringkas)
// TANPA menduplikasi logika edit/AI-note/code-evidence — jadi mode ringkas
// & tabel lengkap selalu tampil identik per-baris, cuma beda pengelompokan.
function FieldRowTr({
  field, editing, editedValues, onEdit, autofilledFrom, isHighlighted, isZebra, rowRef, recordData,
}: {
  field: FieldRow;
  editing: boolean;
  editedValues: Record<string, any>;
  onEdit: (col: string, val: string) => void;
  autofilledFrom: unknown;
  isHighlighted: boolean;
  isZebra: boolean;
  rowRef?: Ref<HTMLTableRowElement>;
  recordData?: Record<string, any>;
}) {
  const isSystem = field.status === 'system';
  const currentValue = editedValues[field.column_name] !== undefined
    ? editedValues[field.column_name] : field.value;
  const isChanged = editedValues[field.column_name] !== undefined;
  return (
    <tr
      ref={rowRef}
      className={cn(
        'border-b last:border-0 hover:bg-muted/40 align-top',
        isZebra && !isHighlighted && 'bg-muted/25',
        isHighlighted && 'bg-amber-500/15 ring-1 ring-inset ring-amber-500/40'
      )}
    >
      <td className="px-3 py-2 font-semibold text-xs">{getFieldLabel(field.column_name)}</td>
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
          <span className={cn('font-mono text-xs break-all whitespace-pre-wrap', field.status === 'error' ? 'text-destructive' : 'text-foreground')}>
            {currentValue === null || currentValue === undefined || currentValue === ''
              ? <span className="text-muted-foreground italic">(kosong)</span>
              : field.column_name === 'DISCHARGE_STATUS' && DISCHARGE_STATUS_LABELS[String(currentValue)]
                ? `${currentValue} - ${DISCHARGE_STATUS_LABELS[String(currentValue)]}`
                : String(currentValue)}
          </span>
        )}
        {autofilledFrom === 'mrn_history' && !isChanged && (
          <Badge
            variant="outline"
            className="ml-1.5 shrink-0 border-blue-500/40 text-[10px] text-blue-700 dark:text-blue-400 cursor-pointer"
            title="Kosong dari dokumen ini — diisi otomatis dari kunjungan sebelumnya (MRN sama). Klik untuk edit kalau ternyata beda."
            onClick={() => onEdit(field.column_name, String(currentValue ?? ''))}
          >
            dari riwayat
          </Badge>
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
            {field.codeEvidence.map(ev => {
              // Fix item 7/8/9 (19 Sep 2026): warna chip & tooltip WAJIB ikut
              // review_status per kode (bukan cuma found/tidak) -- lab rutin/
              // konsistensi diagnosis/kutipan tak terverifikasi harus terlihat
              // beda dari "Valid" biasa. Provenance ("Hal. N") sekarang
              // menyertakan tipe dokumen dari document_type (metadata
              // halaman), BUKAN ditebak/diasumsikan sama untuk semua kode.
              // review_status sengaja TIDAK lagi mewarnai chip (status
              // "Perlu Review" dihapus 21 Sep 2026) -- chip cuma bedakan
              // ada-bukti vs tidak-ada-bukti.
              const needsReview = false;
              const docLabel = ev.document_type ? DOCUMENT_TYPE_LABELS[ev.document_type] : 'dokumen';
              const reasonText = ev.review_flags?.map(f => f.reason).join(' ');
              const title = !ev.found
                ? 'Tidak ada bukti dokumen — periksa manual'
                : ev.quotation
                ? `${docLabel} hal. ${ev.page_number}: "${ev.quotation}"${reasonText ? ` — ${reasonText}` : ''}`
                : reasonText;
              return (
                <span
                  key={ev.code}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-mono border',
                    !ev.found
                      ? 'bg-destructive/10 text-destructive border-destructive/30'
                      : needsReview
                      ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30'
                      : 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
                    title ? 'cursor-help' : '',
                  )}
                  title={title}
                >
                  {ev.found ? <CheckCircle2 className="size-3" /> : <AlertTriangle className="size-3" />} {ev.code}
                </span>
              );
            })}
          </div>
        )}
        {/* Penjelasan Kode untuk DIAGLIST/PROCLIST — tampil bila ada nilai, status apapun */}
        {(field.column_name === 'DIAGLIST' || field.column_name === 'PROCLIST') &&
          !isBlankValue(currentValue) && (
            <CodingExplanationPanel
              codeString={String(currentValue ?? '')}
              fieldType={field.column_name === 'DIAGLIST' ? 'diagnosis' : 'procedure'}
              status={field.status as any}
              clinicalFindings={recordData}
              // pageReference hardcode "Resume Medis" DIHAPUS 19 Sep 2026 (fix
              // item 7) -- provenance sekarang WAJIB dari codeEvidence[].
              // document_type (metadata halaman per kode), BUKAN ditebak sama
              // untuk semua kode. Tanpa codeEvidence, label fallback ke
              // generik ("dokumen") di generateCodingExplanation.ts, TIDAK
              // diam-diam menampilkan "Resume Medis" yang mungkin salah.
              codeEvidence={field.codeEvidence}
            />
          )}
        {field.suggestedCodes && field.suggestedCodes.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-blue-600 dark:text-blue-400">
            <span className="inline-flex items-center gap-1"><Lightbulb className="size-3" /> Saran kode:</span>
            {field.suggestedCodes.map((s, i) => {
              const currentCodes = String(currentValue ?? '').split(';').map(c => c.trim()).filter(Boolean);
              const alreadyApplied = currentCodes.includes(s.code);
              return (
                <span key={s.code} className="inline-flex items-center gap-1">
                  {i > 0 && <span>,</span>}
                  <span title={`Hal. ${s.page_number}: "${s.quotation}"${s.reasoning ? ` — ${s.reasoning}` : ''}`} className="cursor-help font-mono">
                    {s.code}
                  </span>
                  {/* Tombol "Terapkan" DIMATIKAN sengaja (bukan cuma disabled saat
                      alreadyApplied) -- kode di sini format ICD-10-CM (Amerika),
                      BUKAN ICD-10 WHO Versi 2010 yang dipakai BPJS (PMK 3/2023
                      Lampiran). Menerapkan otomatis lebih berbahaya daripada
                      menampilkan saran tanpa penyaring -- lihat evaluasi 14 Sep
                      2026. Aktifkan lagi HANYA setelah kamus ICD-10 WHO terpasang
                      & suggested_codes divalidasi terhadap kamus itu di backend. */}
                  {!isSystem && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled
                      title="Sementara dimatikan: kode ini format ICD-10-CM (Amerika), belum divalidasi terhadap ICD-10 WHO yang dipakai BPJS. Cocokkan manual dulu, lalu ketik kode WHO yang benar ke field ini."
                      onClick={() => onEdit(field.column_name, [...currentCodes, s.code].join(';'))}
                      className="h-5 px-1.5 text-[10px]"
                    >
                      {alreadyApplied ? '✓ Diterapkan (sebelum fix)' : 'Terapkan (nonaktif)'}
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
}

// Daftar tindakan konkret di bawah banner ringkasan utama -- supaya koder
// tidak perlu scroll baca detail dulu buat tahu apa yang masih perlu
// dikerjakan utk record ini. Disusun MURNI dari data yang sudah dihitung
// (fieldMap via categories) + ai_review record ini -- TIDAK memanggil API
// baru. Kalau tidak ada satupun tindakan (record bersih), return null (tidak
// menampilkan box kosong), sesuai prinsip "jangan tampilkan yang tidak perlu".
function ActionChecklist({ categories, recordData }: { categories: { category: string; rows: FieldRow[] }[]; recordData: Record<string, any> }) {
  const allFields = useMemo(() => categories.flatMap(c => c.rows), [categories]);
  const actions: string[] = [];

  // KODE_RS/KELAS_RS kosong sudah punya pesan sendiri (arahkan ke Profil RS)
  // di FieldRowTr (field.status === 'empty' block) -- baris ini konsisten
  // dgn pesan itu, cuma diringkas jadi item checklist.
  if (allFields.some(f => f.column_name === 'KELAS_RS' && f.status === 'empty')) {
    actions.push('Isi Kelas RS di Profil RS');
  }

  // Field kosong lain (bukan KODE_RS/KELAS_RS, administratif RS, sudah
  // ditangani di atas) -- "kosong" di sini definisinya sama dgn badge
  // "Kosong" (field.status === 'empty'), BUKAN disamakan dgn field error.
  const otherEmpty = allFields.filter(f => f.status === 'empty' && f.column_name !== 'KELAS_RS' && f.column_name !== 'KODE_RS');
  if (otherEmpty.length > 0) {
    const labels = otherEmpty.slice(0, 2).map(f => getFieldLabel(f.column_name));
    const extra = otherEmpty.length - labels.length;
    actions.push(`Lengkapi ${otherEmpty.length} field kosong (${labels.join(', ')}${extra > 0 ? `, +${extra} lagi` : ''})`);
  }

  // Tombol "Terapkan" kode saran AI DIMATIKAN sengaja (format ICD-10-CM
  // Amerika, belum divalidasi ke ICD-10 WHO -- lihat komentar di FieldRowTr)
  // -- artinya SEMUA kode saran sekarang butuh verifikasi & ketik manual.
  if (allFields.some(f => (f.suggestedCodes?.length ?? 0) > 0)) {
    actions.push('Verifikasi & ketik kode diagnosis/prosedur secara manual');
  }

  // Pola risiko pending dari AI review tahap kedua (heuristik, lihat
  // PENDING_RISK_LABELS utk definisi ramah-verifikator tiap pola).
  const pendingRisks = parseAiReview(recordData)?.pending_risk_notes;
  pendingRisks?.forEach(risk => actions.push(PENDING_RISK_LABELS[risk.pattern] || risk.pattern));

  // SpO2 tidak tercatat -- parameter kunci yang paling langsung dicek
  // verifikator BPJS utk klaim pernapasan. FIX ITEM 4 (19 Sep 2026): dulu
  // cukup cek nilai kosong TANPA tahu apakah form Triase IGD RS ybs memang
  // punya kolom SpO2 sama sekali -- false positive nyata (RS yang form-nya
  // tidak mencetak SpO2 selalu dapat action item ini). Sekarang WAJIB cek
  // form_status (tri-state) juga: HANYA tampilkan kalau kolomnya ADA di form
  // tapi kosong (empty_on_form) -- bukan kalau form memang tidak punya
  // kolom itu (not_in_form). form_status undefined (data lama, belum
  // di-generate ulang) diperlakukan SAMA seperti empty_on_form (perilaku
  // lama) supaya tidak diam-diam menyembunyikan action item.
  const spo2 = parseAiReview(recordData)?.kegawatdaruratan_assessment?.vital_findings?.SpO2;
  const spo2Missing = spo2 && (spo2.nilai === null || spo2.nilai === undefined);
  const spo2NotInForm = spo2?.form_status === 'not_in_form';
  if (spo2Missing && !spo2NotInForm) {
    actions.push('Lengkapi/cek SpO2');
  }

  // Kode diagnosis/prosedur yang backend tandai perlu review (fix item 8/9:
  // lab rutin, konsistensi diagnosis O21.x, evidence tak terverifikasi) --
  // BUKAN error, tapi tetap perlu tindakan verifikator sebelum submit.
  // Butir "Cek kode ..." dihapus 21 Sep 2026 bersama status "Perlu Review".

  if (actions.length === 0) return null;

  return (
    <div className="mb-3 rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-xs">
      <div className="mb-1 font-display font-semibold text-blue-700 dark:text-blue-400">Yang perlu dikerjakan:</div>
      <ul className="space-y-0.5 text-foreground/90">
        {actions.slice(0, 5).map((a, i) => (
          <li key={i} className="flex items-start gap-1.5">
            <span className="text-blue-600 dark:text-blue-400">•</span>
            <span>{a}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Rendering khusus kategori "INA-CBG & Tarif" ────────────────────────────
// Kategori ini sengaja TIDAK dirender lewat FieldRowTr generik satu-satu
// (beda dari kategori lain) karena 3 masalah spesifik kategori ini yang tidak
// bisa dibereskan tanpa logic antar-field (FieldRowTr/buildFieldMap SENGAJA
// tidak disentuh, direservasi sesi lain -- lihat catatan di atasnya):
// (1) literal string "None"/"null" dari raw_data bocor apa adanya ke layar;
// (2) TARIF_INACBG/TOTAL_TARIF bernilai 0 dapat badge "Valid" padahal artinya
//     belum ada grouping sama sekali (0 bukan "kosong" secara harfiah, tapi
//     bukan "valid" juga -- perlu status netral tersendiri);
// (3) 12 baris top-up SP/SR/SI/SD + turunannya selalu tampil satu-satu walau
//     hampir selalu kosong (klaim tanpa top-up Special CMG).
function isBlankValue(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  const s = String(v).trim().toLowerCase();
  return s === '' || s === 'none' || s === 'null';
}

// Satu baris field ala FieldRowTr tapi versi ringan khusus kategori ini --
// selalu render blank sbg "—" (bukan "None"/"null" mentah, bukan juga gaya
// "(kosong)" FieldRowTr supaya konsisten dalam SATU kategori ini), dan
// mendukung override badge/catatan utk kasus "menunggu kode INA-CBG".
function InaCbgFieldRow({
  field, editing, editedValues, onEdit, badgeOverride, noteOverride,
}: {
  field: FieldRow;
  editing: boolean;
  editedValues: Record<string, any>;
  onEdit: (col: string, val: string) => void;
  badgeOverride?: ReactNode;
  noteOverride?: ReactNode;
}) {
  const currentValue = editedValues[field.column_name] !== undefined ? editedValues[field.column_name] : field.value;
  const isChanged = editedValues[field.column_name] !== undefined;
  return (
    <tr className="border-b last:border-0 hover:bg-muted/40 align-top">
      <td className="px-3 py-2 font-semibold text-xs">{getFieldLabel(field.column_name)}</td>
      <td className="px-3 py-2">
        {editing ? (
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
          <span className="font-mono text-xs break-all whitespace-pre-wrap text-foreground">
            {isBlankValue(currentValue) ? <span className="text-muted-foreground">—</span> : String(currentValue)}
          </span>
        )}
      </td>
      <td className="px-3 py-2">{badgeOverride ?? <StatusBadge status={field.status} />}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{noteOverride ?? '—'}</td>
    </tr>
  );
}

// Urutan APA ADANYA dari FIELD_CATEGORIES['INA-CBG & Tarif'] (12 field top-up
// Special CMG SP/SR/SI/SD + Deskripsi/Tarif masing-masing).
const INA_CBG_TOPUP_COLS = [
  'SP', 'SR', 'SI', 'SD',
  'DESKRIPSI_SP', 'TARIF_SP', 'DESKRIPSI_SR', 'TARIF_SR',
  'DESKRIPSI_SI', 'TARIF_SI', 'DESKRIPSI_SD', 'TARIF_SD',
];

function InaCbgSection({
  rows, editing, editedValues, onEdit, recordData,
}: {
  rows: FieldRow[];
  editing: boolean;
  editedValues: Record<string, any>;
  onEdit: (col: string, val: string) => void;
  recordData: Record<string, any>;
}) {
  const byCol = useMemo(() => Object.fromEntries(rows.map(f => [f.column_name, f])), [rows]);
  // Default tertutup -- kasus paling umum (klaim tanpa top-up) tidak perlu
  // 12 baris kosong menyita layar, tapi datanya tetap bisa dibuka (prinsip:
  // penyederhanaan tidak pernah menghilangkan akses ke data mentah).
  const [showTopUp, setShowTopUp] = useState(false);

  const inacbgRawValue = editedValues['INACBG'] !== undefined ? editedValues['INACBG'] : byCol['INACBG']?.value;
  const inacbgFilled = !isBlankValue(inacbgRawValue);
  // suggested_codes ada utk DIAGLIST/PROCLIST (lihat parseAiReview) -- kalau
  // ada, artinya resume medis cukup informatif utk membentuk usulan kode
  // walau lembar grouper tidak ada di berkas ini (Keadaan B). Sengaja TIDAK
  // menghitung kode INA-CBG sendiri di sini (perlu tabel tarif PMK 3/2023
  // yang belum ada di frontend) -- cukup arahkan ke field yang sudah py saran.
  const hasSuggestedCodes = (parseAiReview(recordData)?.suggested_codes?.length ?? 0) > 0;

  const topUpAllBlank = useMemo(() => INA_CBG_TOPUP_COLS.every(c => {
    const v = editedValues[c] !== undefined ? editedValues[c] : byCol[c]?.value;
    return isBlankValue(v);
  }), [byCol, editedValues]);

  // TARIF_INACBG/TOTAL_TARIF=0 SAAT INACBG juga kosong bukan "valid" (belum
  // ada grouping sama sekali) tapi juga bukan "error" -- status netral
  // "menunggu", beda dari makna badge "Kosong" (yang menyiratkan wajib diisi
  // manual; di sini memang belum BISA diisi sebelum INACBG ada).
  const isWaitingTarif = (col: string) => {
    if (inacbgFilled) return false;
    const v = editedValues[col] !== undefined ? editedValues[col] : byCol[col]?.value;
    return isBlankValue(v) || Number(v) === 0;
  };
  const waitingBadge = <Badge className="text-[10px] border-transparent bg-muted text-muted-foreground">Menunggu kode INA-CBG</Badge>;
  const waitingNote = 'Tarif baru terhitung setelah kode INA-CBG ada & diverifikasi.';

  return (
    <>
      {/* Keadaan A/B/C -- lihat komentar di atas InaCbgSection */}
      {!inacbgFilled && (
        <tr>
          <td colSpan={4} className="px-3 py-2">
            {hasSuggestedCodes ? (
              <div className="rounded-md border border-blue-500/30 bg-blue-500/10 px-2.5 py-2 text-xs text-blue-700 dark:text-blue-400">
                Lembar hasil grouper tidak ada di berkas ini. Kode diagnosis/prosedur di atas perlu diverifikasi &amp; diketik manual sebelum grouping bisa dihitung.
              </div>
            ) : (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-700 dark:text-amber-400">
                Lembar grouper tidak ada, dan data klinis di dokumen tidak cukup untuk membentuk usulan kode. Pindai ulang berkas dengan menyertakan lembar hasil grouper, lalu Baca Ulang.
              </div>
            )}
          </td>
        </tr>
      )}

      {['INACBG', 'DESKRIPSI_INACBG'].map(col => byCol[col] && (
        <InaCbgFieldRow key={col} field={byCol[col]} editing={editing} editedValues={editedValues} onEdit={onEdit} />
      ))}
      {byCol['TARIF_INACBG'] && (
        <InaCbgFieldRow
          field={byCol['TARIF_INACBG']}
          editing={editing}
          editedValues={editedValues}
          onEdit={onEdit}
          badgeOverride={isWaitingTarif('TARIF_INACBG') ? waitingBadge : undefined}
          noteOverride={isWaitingTarif('TARIF_INACBG') ? waitingNote : undefined}
        />
      )}

      {/* Top-Up Special CMG -- kolaps jadi 1 baris kalau SEMUA 12 field kosong */}
      {topUpAllBlank && !showTopUp ? (
        <tr className="border-b last:border-0">
          <td colSpan={4} className="px-3 py-2 text-xs text-muted-foreground">
            Top-Up Special CMG — tidak ada{' '}
            <button
              type="button"
              className="ml-1 text-blue-600 dark:text-blue-400 hover:underline"
              onClick={() => setShowTopUp(true)}
            >
              Lihat 12 baris detail →
            </button>
          </td>
        </tr>
      ) : (
        <>
          {topUpAllBlank && (
            <tr>
              <td colSpan={4} className="px-3 py-1.5 text-right">
                <button
                  type="button"
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                  onClick={() => setShowTopUp(false)}
                >
                  ▴ Sembunyikan detail Top-Up
                </button>
              </td>
            </tr>
          )}
          {INA_CBG_TOPUP_COLS.map(col => byCol[col] && (
            <InaCbgFieldRow key={col} field={byCol[col]} editing={editing} editedValues={editedValues} onEdit={onEdit} />
          ))}
        </>
      )}

      {byCol['TOTAL_TARIF'] && (
        <InaCbgFieldRow
          field={byCol['TOTAL_TARIF']}
          editing={editing}
          editedValues={editedValues}
          onEdit={onEdit}
          badgeOverride={isWaitingTarif('TOTAL_TARIF') ? waitingBadge : undefined}
          noteOverride={isWaitingTarif('TOTAL_TARIF') ? waitingNote : undefined}
        />
      )}
    </>
  );
}

// Helper: Check if ICU & Ventilasi category has any meaningful data
function hasIcuVentilasiData(fieldMap: Record<string, FieldRow>, editedValues: Record<string, any>): boolean {
  const ICU_VENTILASI_FIELDS = ['ICU_INDIKATOR', 'ICU_LOS', 'VENT_HOUR'];
  return ICU_VENTILASI_FIELDS.some(field => {
    const currentValue = editedValues[field] !== undefined ? editedValues[field] : fieldMap[field]?.value;
    // Field dianggap punya data jika:
    // - Bukan kosong (null/undefined/'')
    // - Bukan "0" atau 0 (angka nol dianggap kosong untuk Lama ICU/Ventilasi)
    return currentValue !== null && currentValue !== undefined && currentValue !== '' && Number(currentValue) !== 0;
  });
}

// Helper: Extract age from record data (either from raw data or DB fields)
function extractAge(recordData: Record<string, any>): number | null {
  const rawData = parseRawData(recordData);

  // Try to get age from raw data first
  const rawAgeYear = rawData?.UMUR_TAHUN;
  const rawAgeDay = rawData?.UMUR_HARI;

  // Try to get age from DB fields
  const dbAgeYear = recordData?.umur_tahun;

  // Prefer year-based age, fallback to day-based
  const ageYear = rawAgeYear !== undefined && rawAgeYear !== null ? rawAgeYear : dbAgeYear;
  const ageDay = rawAgeDay !== undefined && rawAgeDay !== null ? rawAgeDay : null;

  // If we have year-based age, use it
  if (ageYear !== undefined && ageYear !== null && ageYear !== '') {
    const age = Number(ageYear);
    if (!isNaN(age)) return age;
  }

  // If we have day-based age and no year, convert days to years
  if (ageDay !== undefined && ageDay !== null && ageDay !== '') {
    const age = Math.floor(Number(ageDay) / 365);
    if (!isNaN(age)) return age;
  }

  return null;
}

function RecordFieldsTable({
  recordData, validationErrors, editing, editedValues, onEdit, onlyIssues, jenisKlaim, highlightFields,
}: {
  recordData: Record<string, any>;
  validationErrors: ValidationError[];
  editing: boolean;
  editedValues: Record<string, any>;
  onEdit: (col: string, val: string) => void;
  onlyIssues: boolean;
  jenisKlaim?: string | null;
  highlightFields?: Set<string>;
}) {
  const fieldMap = useMemo(() => buildFieldMap(recordData, validationErrors, editing ? editedValues : undefined), [recordData, validationErrors, editing, editedValues]);
  const highlightRowRef = useRef<HTMLTableRowElement | null>(null);
  // Deep-link dari Pending BPJS (?highlight=...) harus langsung tampil dalam
  // konteks penuh (lihat highlightFields di komponen induk) -- default ke
  // tabel lengkap kalau ada highlight aktif saat halaman dibuka, supaya tidak
  // perlu logic tambahan utk auto-expand kategori tertentu di mode ringkas.
  const [showFullTable, setShowFullTable] = useState(() => !!(highlightFields && highlightFields.size > 0));
  // Reset mode ringkas/lengkap & override expand kategori saat pindah record
  // (recordData.id berubah) -- TIDAK pakai key={record.id} di call site (lihat
  // catatan di call site) supaya tidak remount penuh, cukup reset state lokal
  // yang relevan lewat effect ini, pola yang sama dipakai komponen induk utk
  // reset isEditing/editedValues per-record.
  useEffect(() => {
    setShowFullTable(!!(highlightFields && highlightFields.size > 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordData.id]);

  useEffect(() => {
    if (highlightFields && highlightFields.size > 0) {
      highlightRowRef.current?.scrollIntoView({ block: 'center' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordData, highlightFields]);

  // Check if ICU & Ventilasi category should be hidden due to no data
  const hasIcuData = useMemo(() => hasIcuVentilasiData(fieldMap, editedValues), [fieldMap, editedValues]);

  // Extract patient age for conditional field visibility
  const patientAge = useMemo(() => extractAge(recordData), [recordData]);

  const categories = Object.entries(FIELD_CATEGORIES)
    .filter(([category]) => {
      // Hide if INPATIENT_ONLY and not RAWAT_INAP
      if (INPATIENT_ONLY_CATEGORIES.has(category) && jenisKlaim !== 'RAWAT_INAP') return false;
      // Hide ICU & Ventilasi if no data exists
      if (category === 'ICU & Ventilasi' && !hasIcuData) return false;
      // Hide INA-CBG & Tarif as it is rendered separately now
      if (category === 'INA-CBG & Tarif') return false;
      return true;
    })
    .map(([category, cols]) => ({
      category,
      rows: cols
        .filter(c => {
          // Hide if in ALWAYS_HIDDEN_FIELDS or JENIS_KLAIM_HIDDEN_FIELDS
          if (ALWAYS_HIDDEN_FIELDS.has(c)) return false;
          if (jenisKlaim && JENIS_KLAIM_HIDDEN_FIELDS[jenisKlaim]?.has(c)) return false;

          // Conditional: Hide UMUR (age) fields if age >= 17
          if ((c === 'UMUR_TAHUN' || c === 'UMUR_HARI') && patientAge !== null && patientAge >= 17) {
            return false;
          }

          return true;
        })
        .map(c => fieldMap[c])
        .filter(f => !onlyIssues || isIssueStatus(f.status)),
    }));
  const totalRows = categories.reduce((n, c) => n + c.rows.length, 0);

  // Ringkasan banner -- "masalah" = error ATAU kosong, definisi yang SAMA
  // dengan checkbox "Tampilkan hanya yang bermasalah" & pesan "Tidak ada data
  // bermasalah" di bawah (bukan definisi baru khusus banner ini).
  const issueCategories = categories.filter(c => c.rows.some(f => isIssueStatus(f.status)));
  const totalIssueFields = categories.reduce((n, c) => n + c.rows.filter(f => isIssueStatus(f.status)).length, 0);
  const hasErrorField = categories.some(c => c.rows.some(f => f.status === 'error'));

  const toggleButton = (
    <Button variant="outline" size="sm" onClick={() => setShowFullTable(v => !v)} className="text-[11px] h-7 shrink-0">
      {showFullTable ? '▴ Tampilkan ringkas' : 'Tampilkan tabel lengkap →'}
    </Button>
  );

  return (
    <div>
      {!onlyIssues && (
        <SummaryBanner tone={totalIssueFields === 0 ? 'success' : hasErrorField ? 'danger' : 'warning'} action={toggleButton}>
          {totalIssueFields === 0
            ? `✅ Semua ${totalRows} kolom data valid`
            : `⚠️ ${totalIssueFields} masalah dari ${totalRows} kolom data — ${issueCategories.map(c => c.category).join(', ')}, wajib dicek`}
        </SummaryBanner>
      )}
      {!onlyIssues && <ActionChecklist categories={categories} recordData={recordData} />}
      {!onlyIssues && !showFullTable ? (
        <SimplifiedFieldAccordion
          categories={categories}
          editing={editing}
          editedValues={editedValues}
          onEdit={onEdit}
          recordData={recordData}
          highlightFields={highlightFields}
          highlightRowRef={highlightRowRef}
        />
      ) : (
        <div className="rounded-lg border overflow-y-auto" style={{ maxHeight: 560 }}>
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-muted">
              <tr className="border-b">
                <th className="font-display w-[190px] text-left px-3 py-2 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Kolom</th>
                <th className="font-display text-left px-3 py-2 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Nilai</th>
                <th className="font-display w-[110px] text-left px-3 py-2 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Status</th>
                <th className="font-display text-left px-3 py-2 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Catatan / Saran</th>
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
                // rowParity: dihitung lintas semua kategori (bukan nth-child CSS)
                // supaya baris judul kategori (yang selang-seling di antara baris
                // data) tidak ikut kena zebra dan tidak merusak pola genap-ganjil.
                (() => {
                  let rowParity = 0; return categories.map(({ category, rows }) => (
                    <Fragment key={category}>
                      <tr>
                        <td colSpan={4} className="bg-muted/70 font-bold text-[11px] text-muted-foreground uppercase tracking-wide px-3 py-1.5">
                          {category}
                        </td>
                      </tr>
                      {rows.map(field => {
                        const isHighlighted = !!highlightFields?.has(field.column_name);
                        const isZebra = rowParity++ % 2 === 1;
                        return (
                          <FieldRowTr
                            key={field.column_name}
                            field={field}
                            editing={editing}
                            editedValues={editedValues}
                            onEdit={onEdit}
                            autofilledFrom={parseRawData(recordData)[`_autofill_${field.column_name}`]}
                            isHighlighted={isHighlighted}
                            isZebra={isZebra}
                            rowRef={isHighlighted ? highlightRowRef : undefined}
                            recordData={recordData}
                          />
                        );
                      })}
                    </Fragment>
                  ))
                })()
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Mode ringkas Tabel Utama: banner + akordeon per kategori (default: kategori
// bermasalah terbuka, sisanya tertutup jadi satu baris ringkasan). Tombol
// "Tampilkan tabel lengkap" di RecordFieldsTable membuka tabel ASLI (tidak
// lewat komponen ini) -- jadi komponen ini murni tampilan alternatif, bukan
// satu-satunya jalan ke data (prinsip: data tidak pernah hilang, cuma
// defaultnya diringkas). Baris di dalam kategori yang dibuka memakai
// FieldRowTr APA ADANYA (sama persis dengan tabel lengkap), jadi edit/AI-note/
// code-evidence tetap berfungsi identik di kedua mode.
function SimplifiedFieldAccordion({
  categories, editing, editedValues, onEdit, recordData, highlightFields, highlightRowRef,
}: {
  categories: { category: string; rows: FieldRow[] }[];
  editing: boolean;
  editedValues: Record<string, any>;
  onEdit: (col: string, val: string) => void;
  recordData: Record<string, any>;
  highlightFields?: Set<string>;
  highlightRowRef: { current: HTMLTableRowElement | null };
}) {
  const categoryHasIssue = useMemo(
    () => Object.fromEntries(categories.map(c => [c.category, c.rows.some(f => isIssueStatus(f.status))])),
    [categories]
  );
  const [expandOverride, setExpandOverride] = useState<Record<string, boolean>>({});
  // Reset override expand/collapse saat pindah record (tidak pakai key-based
  // remount, lihat catatan di RecordFieldsTable) supaya kategori yang di-expand
  // manual utk record A tidak "bocor" ke record B.
  useEffect(() => {
    setExpandOverride({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordData.id]);
  const isExpanded = (category: string) =>
    expandOverride[category] !== undefined ? expandOverride[category] : !!categoryHasIssue[category];
  const toggleCategory = (category: string) => setExpandOverride(prev => ({ ...prev, [category]: !isExpanded(category) }));

  let rowParity = 0;
  return (
    <div className="space-y-2">
      {categories.map(({ category, rows }) => {
        if (rows.length === 0) return null;
        const expanded = isExpanded(category);
        const issueCount = rows.filter(f => isIssueStatus(f.status)).length;
        const validCount = rows.length - issueCount;
        return (
          <div key={category} className={cn('rounded-lg border overflow-hidden', issueCount > 0 ? 'border-destructive/30' : 'border-border')}>
            <button
              type="button"
              onClick={() => toggleCategory(category)}
              className={cn(
                'w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide',
                issueCount > 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted/70 text-muted-foreground'
              )}
            >
              <span>{expanded ? '▾' : '▸'} {category}</span>
              <span className={cn('normal-case font-semibold', issueCount === 0 && 'text-emerald-700 dark:text-emerald-400')}>
                {issueCount > 0 ? `${issueCount} masalah ⚠️` : `${validCount}/${rows.length} valid ✓`}
              </span>
            </button>
            {expanded && (
              <table className="w-full text-sm border-collapse">
                <tbody>
                  {category === 'INA-CBG & Tarif' ? (
                    <InaCbgSection rows={rows} editing={editing} editedValues={editedValues} onEdit={onEdit} recordData={recordData} />
                  ) : (
                    rows.map(field => {
                      const isHighlighted = !!highlightFields?.has(field.column_name);
                      const isZebra = rowParity++ % 2 === 1;
                      return (
                        <FieldRowTr
                          key={field.column_name}
                          field={field}
                          editing={editing}
                          editedValues={editedValues}
                          onEdit={onEdit}
                          autofilledFrom={parseRawData(recordData)[`_autofill_${field.column_name}`]}
                          isHighlighted={isHighlighted}
                          isZebra={isZebra}
                          rowRef={isHighlighted ? highlightRowRef : undefined}
                          recordData={recordData}
                        />
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── INA-CBG & Tarif Display with Clinical Coherence Validation ───────────────

/**
 * Extract vital signs from kegawatdaruratan assessment
 */
function extractVitalSigns(recordData: Record<string, any>): VitalSigns {
  const assessment = parseAiReview(recordData)?.kegawatdaruratan_assessment;
  if (!assessment?.vital_findings) return {};

  const vitals = assessment.vital_findings;
  return {
    hr: vitals.HR?.nilai ?? undefined,
    rr: vitals.RR?.nilai ?? undefined,
    spo2: vitals.SpO2?.nilai ?? undefined,
    temp: vitals.Suhu?.nilai ?? undefined,
    bp: vitals.TD_sistolik?.nilai && vitals.TD_diastolik?.nilai
      ? `${vitals.TD_sistolik.nilai}/${vitals.TD_diastolik.nilai}`
      : undefined,
  };
}

/**
 * Extract diagnosis codes and evidence from record
 */
function extractDiagnosis(recordData: Record<string, any>) {
  const rawData = parseRawData(recordData);
  const diagList = rawData.DIAGLIST || recordData.diagnosa_list || '';
  const diagCodes = String(diagList).split(';').map(c => c.trim()).filter(Boolean);
  const primaryDiagnosis = diagCodes[0] || '';

  const aiReview = parseAiReview(recordData);
  const codeEvidence = aiReview?.code_evidence?.filter(e => e.type === 'diagnosis') || [];
  const primaryEvidence = codeEvidence.find(e => e.code === primaryDiagnosis);

  return {
    code: primaryDiagnosis,
    evidence: primaryEvidence
      ? {
        quotation: primaryEvidence.quotation || '',
        page_number: primaryEvidence.page_number || 0,
      }
      : undefined,
    allCodes: diagCodes,
  };
}

/**
 * Extract procedure codes and evidence from record
 */
function extractProcedure(recordData: Record<string, any>) {
  const rawData = parseRawData(recordData);
  const procList = rawData.PROCLIST || recordData.prosedur_list || '';
  const procCodes = String(procList).split(';').map(c => c.trim()).filter(Boolean);
  const primaryProcedure = procCodes[0] || '';

  const aiReview = parseAiReview(recordData);
  const codeEvidence = aiReview?.code_evidence?.filter(e => e.type === 'procedure') || [];
  const primaryEvidence = codeEvidence.find(e => e.code === primaryProcedure);

  return {
    code: primaryProcedure,
    evidence: primaryEvidence
      ? {
        quotation: primaryEvidence.quotation || '',
        page_number: primaryEvidence.page_number || 0,
      }
      : undefined,
    allCodes: procCodes,
  };
}

/**
 * Component: INA-CBG & Tarif Display with Clinical Coherence Check
 */
function InaCbgCoherenceDisplay({ recordData }: { recordData: Record<string, any> }) {
  const diagnosis = extractDiagnosis(recordData);
  const procedure = extractProcedure(recordData);
  const vitals = extractVitalSigns(recordData);
  const aiReview = parseAiReview(recordData);

  // Coherence validation
  const coherenceInput: ClinicalCoherenceInput = {
    diagnosis_utama: diagnosis.allCodes.join(' '),
    prosedur: procedure.allCodes.join(' '),
    alasan_masuk: parseRawData(recordData).ALASAN_MASUK || '',
    vital_signs: vitals,
    clinical_findings: parseRawData(recordData).CLINICAL_FINDINGS || '',
  };

  const coherenceResult = validateClinicalCoherence(coherenceInput);

  // If no diagnosis/procedure, show incomplete state
  if (!diagnosis.code && !procedure.code) {
    return (
      <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 px-4 py-3">
        <p className="text-xs font-medium text-amber-200/90">
          <span className="font-bold text-amber-500">Data tidak lengkap.</span>{' '}
          Diagnosis dan prosedur harus diisi terlebih dahulu sebelum dapat menampilkan INA-CBG & tarif.
        </p>
      </div>
    );
  }

  // If incoherent, show issues
  if (!coherenceResult.isCoherent) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 px-4 py-3">
          <p className="text-xs font-medium text-amber-200/90">
            <span className="font-bold text-amber-500">Pending verifikasi klinis.</span>{' '}
            Ditemukan ketidaksesuaian antara diagnosis, prosedur, dan tanda vital. Silakan periksa dan sesuaikan sebelum melanjutkan.
          </p>
        </div>
        {coherenceResult.issues.length > 0 && (
          <div className="rounded-lg border border-amber-900/30 bg-amber-950/10 px-4 py-3">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2">Isu yang ditemukan:</p>
            <ul className="space-y-1.5 text-xs text-amber-600 dark:text-amber-300">
              {coherenceResult.issues.map((issue, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 text-amber-500">•</span>
                  <span>{issue}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // If coherent but no INA-CBG result, show pending
  const inacbgResult = aiReview?.inacbg_result;
  const tariffResult = aiReview?.tariff_result;

  if (!inacbgResult || !tariffResult) {
    return <InaCbgTarifPending />;
  }

  // Show the full INA-CBG & Tarif display
  return (
    <InaCbgTarifDisplay
      diagnosis_code={diagnosis.code}
      diagnosis_evidence={diagnosis.evidence}
      prosedur_code={procedure.code}
      prosedur_evidence={procedure.evidence}
      inacbg_result={inacbgResult}
      tariff_result={tariffResult}
    />
  );
}

// ─── Kegawatdaruratan (Permenkes 47/2018 Pasal 3) — 3 tabel ─────────────────
// Restrukturisasi total 10-11 Sep 2026: Ringkasan + Tabel 1 (Parameter
// pemeriksaan fisik, per-record) + Tabel 2 (Ambang batas vital, per-record
// DAN referensi dewasa inline) + Tabel 3 (Agregasi K1-K5). K2-K5 dihitung
// deterministik di backend (kegawatdaruratanAggregation.js) dari data yang
// diekstrak AI — bukan lagi judgment freeform AI langsung. K1 tetap AI
// judgment (bahasa, bukan lookup angka). Kutipan divalidasi server-side
// (anti-halusinasi) — tabel ini menampilkan APA ADANYA yang terdokumentasi,
// bukan checklist untuk diisi/direkayasa manual.
const KRITERIA_STATUS_STYLE: Record<string, string> = {
  ya: 'border-transparent',
  borderline: 'border-transparent',
  tidak: 'border-transparent',
};
const KRITERIA_STATUS_COLOR: Record<string, CSSProperties> = {
  ya: { background: 'color-mix(in srgb, var(--color-destructive, #dc2626) 14%, transparent)', color: 'var(--destructive)' },
  borderline: { background: 'color-mix(in srgb, var(--color-amber-500, #f59e0b) 16%, transparent)', color: '#b45309' },
  tidak: { background: 'color-mix(in srgb, var(--color-muted-foreground, #71717a) 14%, transparent)', color: 'var(--muted-foreground)' },
};
const KRITERIA_STATUS_LABEL: Record<string, string> = { ya: 'Ya', borderline: 'Borderline', tidak: 'Tidak' };
// Label singkat utk mode ringkas Tabel 3 (mis. "K2 · Napas / sirkulasi") --
// istilah resmi lengkap (k.label dari backend) tetap ada via tooltip/title,
// tidak pernah dihilangkan, cuma tidak jadi teks utama supaya cepat dipindai.
const KRITERIA_SHORT_LABEL: Record<string, string> = {
  K1: 'Ancaman nyawa', K2: 'Napas / sirkulasi', K3: 'Kesadaran',
  K4: 'Hemodinamik', K5: 'Tindakan segera',
};

const VITAL_LABELS: Record<string, { label: string; unit: string; referensiDewasa: string }> = {
  RR: { label: 'Laju Napas (RR)', unit: 'x/mnt', referensiDewasa: 'Normal 12-20, Borderline 21-29/10-11, Gawat <10/>29' },
  SpO2: { label: 'Saturasi O2 (SpO2)', unit: '%', referensiDewasa: 'Normal >=95, Borderline 90-94, Gawat <90 (sama semua usia)' },
  HR: { label: 'Nadi (HR)', unit: 'x/mnt', referensiDewasa: 'Normal 60-100, Borderline 50-59/101-120, Gawat <50/>120' },
  TD_sistolik: { label: 'TD Sistolik', unit: 'mmHg', referensiDewasa: 'Normal 90-140, Borderline 80-89/141-179, Gawat <80/>=180' },
  TD_diastolik: { label: 'TD Diastolik', unit: 'mmHg', referensiDewasa: 'Normal 60-89, Borderline 50-59/90-120, Gawat <50/>120' },
  Suhu: { label: 'Suhu', unit: '°C', referensiDewasa: 'Normal 36.1-37.5, Borderline 35-36/37.6-38.4, Gawat <35/>=39' },
  GCS: { label: 'GCS Total', unit: 'poin', referensiDewasa: 'Normal 15, Borderline 13-14, Gawat <13 (sama semua usia)' },
  Nyeri: { label: 'Skala Nyeri', unit: '0-10', referensiDewasa: 'Normal 0, Borderline 1-6, Gawat >6 (sama semua usia)' },
};
const AGE_GROUP_LABELS: Record<string, string> = {
  neonatus: 'Neonatus (0-28 hari)', bayi: 'Bayi (1-12 bulan)', toddler: 'Toddler (1-2 th)',
  prasekolah: 'Prasekolah (3-5 th)', usia_sekolah: 'Usia sekolah (6-11 th)', remaja: 'Remaja (12-15 th)',
  dewasa: 'Dewasa (16-64 th)', lansia: 'Lansia (>=65 th)',
};
// Status "Borderline" disembunyikan dari tampilan 21 Sep 2026 (permintaan
// klien): nilai yang masuk rentang borderline ditampilkan sebagai Normal.
// Ambang/perhitungan di dalam sistem SENGAJA tidak diubah -- itu keputusan
// klinis yang menunggu grading ESH dari dokter, jadi cukup labelnya dulu.
const BAND_LABEL: Record<string, string> = { normal: 'Normal', borderline: 'Normal', gawat: 'Gawat' };
const BAND_COLOR: Record<string, CSSProperties> = {
  normal: { color: 'var(--muted-foreground)' },
  borderline: { color: 'var(--muted-foreground)' }, // disamakan dengan normal (lihat BAND_LABEL)
  gawat: { color: 'var(--destructive)', fontWeight: 600 },
};

// Label band untuk tekanan darah memakai istilah ESH/ESC 2023, bukan
// "Normal". Sejak band borderline disembunyikan (21 Sep 2026), rentang
// 140-179 sistolik akan tampil sebagai "Normal" padahal menurut ESH itu
// hipertensi grade 1-2 -- angka 165/100 berlabel Normal jelas menyesatkan
// koder. Kata "Borderline" tetap tidak dipakai di mana pun.
//
// Band borderline TD punya DUA sisi: rentang tinggi (hipertensi) dan
// rentang rendah (mendekati hipotensi, sistolik 80-89). Hanya sisi tinggi
// yang boleh dilabeli hipertensi -- sisi rendah ikut perilaku vital lain.
// Penjelasan kenapa sebuah TTV tidak dihitung walau ada angkanya di dokumen.
// Alasannya beda per parameter, jadi teksnya tidak bisa satu untuk semua:
// tekanan darah 0 lazim dipakai menandai "tidak diukur" (apalagi pada bayi),
// sedangkan GCS tidak pernah bisa di bawah 3 karena tiap komponennya minimal 1.
function penjelasanTercatatNol(key: string): string {
  if (key === "GCS") {
    return "Nilai GCS di dokumen di bawah 3. GCS terendah yang mungkin adalah 3 (tiap komponen minimal bernilai 1), jadi angka itu tidak bisa berasal dari penilaian yang benar-benar dilakukan. Nilai ini karena itu tidak dihitung sebagai kondisi gawat.";
  }
  if (key === "TD_sistolik" || key === "TD_diastolik") {
    return "Di dokumen tertulis 0. Tekanan darah 0 pada pasien hidup mustahil secara klinis, jadi 0 dipakai petugas untuk menandai tidak diukur. Pada bayi, tekanan darah memang tidak selalu diukur rutin. Nilai ini karena itu tidak dihitung sebagai kondisi gawat.";
  }
  const namaUmum: Record<string, string> = {
    SpO2: "Saturasi 0%",
    HR: "Nadi 0",
    RR: "Laju napas 0",
    Suhu: "Suhu 0 derajat",
  };
  const nama = namaUmum[key] || "Nilai 0";
  return nama + " pada pasien hidup mustahil secara klinis, jadi 0 dipakai petugas untuk menandai kolom yang tidak diukur. Nilai ini karena itu tidak dihitung sebagai kondisi gawat.";
}

const TD_GRADE_ESH: Record<string, [number, number][]> = {
  TD_sistolik: [[140, 159], [160, 179]],
  TD_diastolik: [[90, 99], [100, 109]],
};
function labelBand(key: string | undefined, nilai: string | number | null | undefined, band: string | null | undefined): string {
  if (!band) return '—';
  const grades = key ? TD_GRADE_ESH[key] : undefined;
  if (grades && band === 'borderline' && typeof nilai === 'number') {
    for (let g = 0; g < grades.length; g++) {
      const [min, max] = grades[g];
      if (nilai >= min && nilai <= max) return `Hipertensi ${g + 1}`;
    }
  }
  return BAND_LABEL[band] || band;
}

// Penjelasan singkat "kenapa abnormal" utk tiap parameter pemeriksaan fisik
// (Tabel 1) — disesuaikan dengan definisi contoh_abnormal di
// kegawatdaruratanReference.js (backend). Dipakai di dialog popup yang
// muncul saat verifikator klik parameter ber-status Abnormal (sama pola
// dengan dialog "Parameter Kritis" di Nilai Vital / Tabel 2).
const PARAMETER_ABNORMAL_INFO: Record<string, string> = {
  ronkhi: 'Temuan ronkhi menandakan adanya cairan/sekret di saluran napas — contoh abnormal: (+/+) kesan tidak normal mlm paru.',
  wheezing: 'Temuan wheezing menandakan obstruksi jalan napas — contoh abnormal: (+/+).',
  sdv: 'Suara napas dasar (SDV) menurun/menghilang dari bunyi vesikuler normal.',
  retraksi: 'Retraksi dinding dada menandakan distres napas. Retraksi interkostal lebih berat daripada subkostal.',
  sianosis: 'Sianosis menandakan penurunan saturasi oksigen (perioral/perifer/sentral).',
  akral: 'Akral dingin/basah/pucat menandakan gangguan perfusi perifer.',
  crt: 'CRT (capillary refill time) memanjang (>=2 detik) menandakan gangguan sirkulasi/perfusi.',
  edema: 'Edema ekstremitas menandakan kelebihan cairan/gangguan sirkulasi.',
  bunyi_jantung: 'Bunyi jantung tambahan (gallop/murmur) menandakan kelainan kardiovaskular.',
  kesadaran_kualitatif: 'Kesadaran menurun (somnolen/sopor/koma) menandakan gangguan neurologis.',
  deformitas_luka: 'Adanya deformitas/luka menandakan temuan trauma yang perlu ditindaklanjuti.',
  // 5 parameter KEADAAN baru (fix item 6, 19 Sep 2026) -- lihat PARAMETER_TABLE
  // di kegawatdaruratanReference.js (backend).
  kepala: 'Temuan abnormal kepala/wajah (mis. mukosa kering/pucat/ikterik, deformitas) bisa jadi tanda dehidrasi atau trauma.',
  leher: 'Pembesaran KGB/tiroid atau kaku kuduk menandakan temuan yang perlu ditindaklanjuti.',
  thorak: 'Thorak asimetris/ada jejas/retraksi/nyeri tekan menandakan kemungkinan trauma atau distres napas.',
  abdomen: 'Abdomen distensi/nyeri tekan/bising usus abnormal menandakan kemungkinan gangguan gastrointestinal.',
  ekstremitas: 'Kelainan bentuk/gerak/kelemahan ekstremitas menandakan temuan yang perlu ditindaklanjuti.',
};

function QuoteCell({ kutipan, page_number }: { kutipan: string | null | undefined; page_number: number | null | undefined }) {
  if (!kutipan) return <span className="italic text-muted-foreground">Tidak tercatat di formulir</span>;
  return <>&ldquo;{kutipan}&rdquo;{page_number ? <span className="ml-1 text-[10px] text-muted-foreground">(hal. {page_number})</span> : null}</>;
}

function KegawatdaruratanTable({ recordData }: { recordData: Record<string, any> }) {
  // WAJIB dipanggil SEBELUM early-return di bawah (Rules of Hooks) -- record
  // yang sama (key={record.id} tidak berubah) bisa transisi dari "belum ada
  // assessment" ke "assessment valid" lewat "Baca Ulang" TANPA remount, jadi
  // early-return-nya sendiri bisa berubah antar-render utk instance yang
  // sama; kalau useState dipanggil SETELAH early return, urutan hook call
  // bisa beda antar-render utk record yang sama -> React error.
  const [showFullDetail, setShowFullDetail] = useState(false);
  const [showUndocumented, setShowUndocumented] = useState(false);

  const assessment = parseAiReview(recordData)?.kegawatdaruratan_assessment;
  // PENTING: record yang diproses SEBELUM restrukturisasi 10-11 Sep 2026 masih
  // menyimpan kegawatdaruratan_assessment bentuk LAMA (array 5 kriteria a-e
  // freeform) di DB -- assessment bentuk lama itu truthy (array non-kosong)
  // tapi TIDAK PUNYA properti .kriteria/.ringkasan dst, jadi destructuring +
  // .filter() di bawah akan crash (Cannot read properties of undefined)
  // kalau tidak dijaga di sini. Data lama TIDAK bisa dikonversi tanpa proses
  // ulang AI, jadi render null (sama seperti sebelum fitur ini ada) daripada
  // memaksa tampilkan/crash -- verifikator tinggal klik "Baca Ulang" record
  // itu untuk dapat tampilan baru.
  if (!assessment || Array.isArray(assessment) || !Array.isArray(assessment.kriteria)) return null;
  const { ringkasan, parameter_findings, vital_findings, kriteria, age_group } = assessment;

  const yaCount = kriteria.filter(k => k.status === 'ya').length;
  const borderlineCount = kriteria.filter(k => k.status === 'borderline').length;

  // ─── Mode ringkas: banner + chip/list, versus toggle "Tampilkan tabel
  // lengkap" yang membuka Tabel 1/2/3 ASLI apa adanya (di bawah, tidak
  // diubah sama sekali) -- lihat prinsip di SimplifiedFieldAccordion. State
  // showFullDetail/showUndocumented dideklarasikan di atas (sebelum early-
  // return), bukan di sini -- lihat komentar Rules of Hooks di awal fungsi.
  const documentedParams = parameter_findings.filter(p => p.ditemukan);
  const undocumentedParams = parameter_findings.filter(p => !p.ditemukan);
  const abnormalParams = documentedParams.filter(p => p.status === 'abnormal');

  const vitalEntries = Object.entries(VITAL_LABELS).map(([key, meta]) => {
    const vf = vital_findings?.[key];
    const isEmpty = vf?.nilai === null || vf?.nilai === undefined;
    return { key, meta, vf, isEmpty, tercatatNol: !!vf?.tercatat_nol, level: (isEmpty ? 'missing' : (vf?.band || 'normal')) as 'normal' | 'borderline' | 'gawat' | 'missing' };
  });
  const vitalPresentCount = vitalEntries.filter(v => !v.isEmpty).length;
  // Tabel 2 menampilkan HANYA vital yang benar-benar tercatat, mengikuti pola
  // Tabel 1 (documentedParams). Sebelumnya semua parameter dirender apa adanya,
  // jadi berkas yang cuma punya beberapa tanda vital memunculkan deretan kartu
  // "KOSONG" yang memenuhi layar tanpa memberi informasi apa pun.
  // TD yang di dokumen tertulis 0 ikut ditampilkan meski nilainya dikosongkan:
  // kartunya yang memuat penjelasan kenapa angka itu tidak dipakai.
  // SpO2 SELALU ditampilkan walau kosong (23 Sep 2026, permintaan klien).
  // Ia satu-satunya vital yang punya peringatan tersendiri di halaman ini
  // -- kalau kartunya ikut hilang saat kosong, justru parameter yang paling
  // perlu dikejar verifikator yang tidak kelihatan.
  const vitalPresentEntries = vitalEntries.filter(
    v => !v.isEmpty || v.tercatatNol || v.key === 'SpO2',
  );
  const vitalGawatCount = vitalEntries.filter(v => v.level === 'gawat').length;
  const vitalBorderlineCount = vitalEntries.filter(v => v.level === 'borderline').length;
  const vitalMissingCount = vitalEntries.length - vitalPresentCount;
  // SpO2 tidak tercatat = parameter kunci gangguan pernapasan, paling langsung
  // dicek verifikator BPJS. FIX ITEM 4 (19 Sep 2026): HANYA tampilkan warning
  // kalau kolom SpO2 ADA di form Triase IGD tapi kosong (empty_on_form) --
  // BUKAN kalau form-nya memang tidak punya kolom SpO2 sama sekali
  // (not_in_form, lihat form_status tri-state) -- reused oleh ActionChecklist
  // (lihat RecordFieldsTable) dari sumber yang sama.
  const spo2Entry = vitalEntries.find(v => v.key === 'SpO2');
  const spo2Missing = !!spo2Entry?.isEmpty && spo2Entry?.vf?.form_status !== 'not_in_form';

  const toggleButton = (
    <Button variant="outline" size="sm" onClick={() => setShowFullDetail(v => !v)} className="text-[10px] h-7 shrink-0 font-headline-sm">
      {showFullDetail ? '▴ Ringkasan' : 'Detail →'}
    </Button>
  );

  return (
    <div className="mt-6 rounded-xl bg-white/[0.02]est border border-white/10 shadow-sm overflow-hidden dark:border-white/10">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-surface-container via-surface to-surface-container-low px-6 py-4 border-b border-white/10">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/15 text-emerald-400 flex items-center justify-center">
            </div>
            <div>
              <h2 className="text-sm text-gray-100 font-semibold">Kegawatdaruratan</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] font-label-sm px-2.5 py-1.5',
                yaCount > 0 ? 'border-red-900/50 bg-red-950/40 text-red-400 dark:text-red-400'
                  : borderlineCount > 0 ? 'border-amber-900/50 bg-amber-950/40 text-amber-500 dark:text-amber-500'
                    : 'border-primary/40 bg-emerald-900/30 text-emerald-400 dark:text-emerald-400'
              )}
            >
              {yaCount} Ya
            </Badge>
            {toggleButton}
          </div>
        </div>
      </div>

      {/* Ringkasan Section */}
      <div className="px-6 py-4 bg-white/[0.02] border-b border-white/10">
        <p className="text-sm text-gray-300 font-medium leading-relaxed">{ringkasan}</p>
      </div>

      {!showFullDetail ? (
        <div className="px-6 py-6 space-y-8">

          {/* ── Section 1: Parameter Pemeriksaan Fisik ── */}
          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-emerald-900/40 text-emerald-400 flex items-center justify-center text-[12px] font-bold">1</div>
                <h3 className="text-sm text-gray-100 font-semibold">Parameter Pemeriksaan Fisik</h3>
              </div>
              <span className={cn(
                'text-[11px] font-medium px-2.5 py-1 rounded-full border',
                abnormalParams.length > 0
                  ? 'bg-red-950/40 border-red-900/50 text-red-400'
                  : 'bg-emerald-900/30 border-emerald-800/50 text-emerald-400'
              )}>
                {documentedParams.length}/{parameter_findings.length} tercatat
                {abnormalParams.length > 0 ? ` · ${abnormalParams.length} abnormal` : ''}
              </span>
            </div>

            {documentedParams.length > 0 ? (
              <div className="flex flex-col gap-2">
                {documentedParams.map(p => {
                  const paramCard = (
                    <div
                      className={cn(
                        'flex items-center justify-between py-2 px-3 rounded border',
                        p.status === 'abnormal'
                          ? 'border-red-900/30 bg-red-950/20 cursor-pointer hover:bg-red-950/30 transition-colors'
                          : 'border-white/10 bg-white/[0.02]'
                      )}
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          {p.status === 'abnormal'
                            ? <XCircle className="size-3.5 text-red-400 shrink-0" />
                            : <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />}
                          <span className={cn(
                            'font-medium text-sm',
                            p.status === 'abnormal' ? 'text-red-400' : 'text-gray-200'
                          )}>
                            {p.label}
                          </span>
                          {p.sumber_dokumen === 'resume_medis' && (
                            <span className="text-[10px] text-gray-500 ml-1">(Resume Medis)</span>
                          )}
                          {p.retraksi_grade && (
                            <span className="text-[10px] text-red-400">({p.retraksi_grade})</span>
                          )}
                        </div>
                        {p.kutipan && (
                          <p className="text-[11px] text-gray-400 italic pl-5">
                            "{p.kutipan}"
                            {p.page_number ? <span className="not-italic ml-1 opacity-70">hal. {p.page_number}</span> : null}
                          </p>
                        )}
                      </div>
                      <span className={cn(
                        'text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0',
                        p.status === 'abnormal'
                          ? 'bg-red-950/60 text-red-400 border border-red-900/50'
                          : 'bg-emerald-900/30 text-emerald-400 border border-emerald-800/50'
                      )}>
                        {p.nilai || (p.status === 'abnormal' ? 'Abnormal' : 'Normal')}
                      </span>
                    </div>
                  );

                  if (p.status === 'abnormal') {
                    return (
                      <Dialog key={p.key}>
                        <DialogTrigger asChild>
                          {paramCard}
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md bg-gray-900 border-gray-800 text-gray-100">
                          <DialogHeader>
                            <DialogTitle className="text-red-400">Parameter Abnormal: {p.label}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-2">
                            <ul className="space-y-3 list-none">
                              <li className="flex flex-col gap-1">
                                <span className="text-sm font-semibold text-gray-400">Temuan Tercatat:</span>
                                <span className="text-sm text-gray-100">{p.nilai || 'tercatat abnormal di dokumen'}</span>
                              </li>
                              {p.kutipan && (
                                <li className="flex flex-col gap-1">
                                  <span className="text-sm font-semibold text-gray-400">Kutipan Dokumen:</span>
                                  <span className="text-sm italic text-gray-300">&ldquo;{p.kutipan}&rdquo;{p.page_number ? ` (hal. ${p.page_number})` : ''}</span>
                                </li>
                              )}
                              <li className="flex flex-col gap-1">
                                <span className="text-sm font-semibold text-gray-400">Kenapa Abnormal?</span>
                                <span className="text-sm text-gray-300">
                                  {PARAMETER_ABNORMAL_INFO[p.key] || 'Temuan ini tercatat abnormal dan menjadi salah satu parameter yang diperiksa pada penilaian kegawatdaruratan.'}
                                  {p.retraksi_grade ? <span className="block mt-1">Grade retraksi: <strong className="text-red-400">{p.retraksi_grade}</strong> — retraksi interkostal menandakan distres napas lebih berat dibanding subkostal.</span> : null}
                                </span>
                              </li>
                            </ul>
                          </div>
                        </DialogContent>
                      </Dialog>
                    );
                  }

                  return <Fragment key={p.key}>{paramCard}</Fragment>;
                })}
              </div>
            ) : (
              <div className="rounded border border-white/10 px-4 py-6 text-center text-gray-500 text-sm">
                Tidak ada parameter yang terdokumentasi di formulir
              </div>
            )}

            {undocumentedParams.length > 0 && (
              <div className="mt-3">
                <button
                  type="button"
                  className="text-sm text-emerald-400 font-medium hover:underline transition-colors"
                  onClick={() => setShowUndocumented(v => !v)}
                >
                  📋 {showUndocumented ? 'Sembunyikan' : `Lihat ${undocumentedParams.length} parameter tidak tercatat`} →
                </button>
                {showUndocumented && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {undocumentedParams.map(p => (
                      <span key={p.key} className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-gray-400 bg-white/[0.02]">{p.label}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Section 2: Tanda Vital ── */}
          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-emerald-900/40 text-emerald-400 flex items-center justify-center text-[12px] font-bold">2</div>
                <h3 className="text-sm text-gray-100 font-semibold">
                  Nilai Vital &amp; Ambang Batas
                  {age_group ? <span className="ml-2 font-normal text-gray-400 text-xs">({AGE_GROUP_LABELS[age_group] || age_group})</span> : null}
                </h3>
              </div>
              <span className={cn(
                'text-[11px] font-medium px-2.5 py-1 rounded-full border',
                vitalGawatCount > 0
                  ? 'bg-red-950/40 border-red-900/50 text-red-400 dark:text-red-400'
                  : vitalMissingCount > 0
                    ? 'bg-amber-950/40 border-amber-900/50 text-amber-500 dark:text-amber-500'
                    : 'bg-emerald-900/30 border-emerald-800/50 text-emerald-400 dark:text-emerald-400'
              )}>
                {vitalGawatCount > 0 ? `${vitalGawatCount} kritis` : 'Semua normal'}
                {vitalPresentCount}/{vitalEntries.length} tercatat
              </span>
            </div>

            {spo2Missing && (
              <div className={cn(
                'mb-3 rounded-lg border px-3.5 py-2.5 text-sm font-medium',
                vitalGawatCount > 0
                  ? 'border-red-900/50 bg-red-950/40 dark:bg-red-950/40 text-red-400 dark:text-red-400'
                  : 'border-amber-900/50 bg-amber-950/40 dark:bg-amber-950/40 text-amber-500 dark:text-amber-500'
              )}>
                ⚠️ SpO2 tidak tercatat — parameter kunci gangguan pernapasan
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {vitalPresentEntries.map(({ key, meta, vf, isEmpty, tercatatNol, level }) => {
                const instrumenDiharapkan = key === 'Nyeri' ? vf?.instrumen_diharapkan : undefined;
                const nyeriTip = key === 'Nyeri' && isEmpty
                  ? `Skala nyeri kertas/PDF biasanya diisi dengan melingkari angka pada skala cetak — tidak terbaca sistem.${instrumenDiharapkan ? ` Instrumen: ${instrumenDiharapkan}.` : ''}`
                  : undefined;
                const cardBorder = level === 'gawat'
                  ? 'border-red-900/50 bg-red-950/40 bg-red-950/40'
                  : level === 'borderline'
                    ? 'border-amber-900/50 bg-amber-950/40 bg-amber-950/40'
                    : level === 'missing'
                      ? 'border-white/10 bg-white/[0.02] opacity-60'
                      : 'border-emerald-800/50 bg-emerald-900/30 bg-emerald-900/30';
                const valueColor = level === 'gawat'
                  ? 'text-red-400 dark:text-red-400'
                  : level === 'borderline'
                    ? 'text-amber-500 dark:text-amber-500'
                    : level === 'missing'
                      ? 'text-gray-400 italic'
                      : 'text-gray-100';
                const CardContent = (
                  <div className={cn('rounded-xl border p-3 flex flex-col gap-1', cardBorder, (level === 'gawat' || level === 'borderline') && 'cursor-pointer hover:bg-[color:inherit]/60 transition-colors')} title={nyeriTip}>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider truncate">{meta.label}</span>
                      <SeverityDot level={level} />
                    </div>
                    <div className={cn('text-2xl font-light leading-none mt-0.5', valueColor)}>
                      {isEmpty ? '—' : vf!.nilai}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      {!isEmpty && (
                        <span className="text-[10px] text-gray-400">{meta.unit}</span>
                      )}
                      <span className={cn(
                        'text-[9px] font-bold px-1.5 py-0.5 rounded ml-auto',
                        level === 'gawat' ? 'bg-red-950/60 text-red-400 border border-red-900/50'
                          : level === 'borderline' ? 'bg-amber-950/60 text-amber-500 dark:text-amber-500 border border-amber-900/50'
                            : level === 'missing' ? 'bg-white/[0.05] text-gray-400 border border-white/10'
                              : 'bg-emerald-900/40 text-emerald-400 border border-emerald-800/50'
                      )}>
                        {level === 'gawat' ? 'KRITIS' : level === 'borderline' ? labelBand(key, vf?.nilai, 'borderline').toUpperCase() : level === 'missing' ? (tercatatNol ? 'TIDAK DIUKUR' : 'KOSONG') : '✓ Normal'}
                      </span>
                    </div>
                    {tercatatNol && (
                      <div
                        className="mt-1 text-[9px] leading-snug text-gray-400"
                        title={penjelasanTercatatNol(key)}
                      >
                        {key === "GCS" ? "Nilai di dokumen tidak mungkin — tidak dihitung sebagai kondisi gawat." : "Di dokumen tertulis 0 — tidak dihitung sebagai kondisi gawat."}
                      </div>
                    )}
                  </div>
                );

                if (level === 'gawat') {
                  return (
                    <Dialog key={key}>
                      <DialogTrigger asChild>
                        {CardContent}
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md bg-gray-900 border-gray-800 text-gray-100">
                        <DialogHeader>
                          <DialogTitle className="text-red-400">Parameter Kritis: {meta.label}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                          <ul className="space-y-3 list-none">
                            <li className="flex flex-col gap-1">
                              <span className="text-sm font-semibold text-gray-400">Nilai Tercatat:</span>
                              <span className="text-lg font-mono text-red-400">{vf!.nilai} {meta.unit}</span>
                            </li>
                            {vf!.kutipan && (
                              <li className="flex flex-col gap-1">
                                <span className="text-sm font-semibold text-gray-400">Kutipan Dokumen:</span>
                                <span className="text-sm italic text-gray-300">"{vf!.kutipan}" {vf!.page_number && `(hal. ${vf!.page_number})`}</span>
                              </li>
                            )}
                            <li className="flex flex-col gap-1">
                              <span className="text-sm font-semibold text-gray-400">Kenapa Kritis?</span>
                              <span className="text-sm text-gray-300">
                                Berdasarkan aturan medis untuk kategori umur <strong>{age_group ? AGE_GROUP_LABELS[age_group] || age_group : 'pasien ini'}</strong>, nilai <span className="text-red-400 font-mono">{vf!.nilai} {meta.unit}</span> berada di luar batas aman (di zona kritis).
                              </span>
                            </li>
                          </ul>
                        </div>
                      </DialogContent>
                    </Dialog>
                  );
                }

                return <Fragment key={key}>{CardContent}</Fragment>;
              })}
            </div>

            <button
              type="button"
              className="mt-3 text-sm text-emerald-400 dark:text-emerald-400 font-medium hover:underline transition-colors"
              onClick={() => setShowFullDetail(true)}
            >
              📄 Lihat detail lengkap →
            </button>
          </div>

          {/* ── Section 3: Kriteria K1–K5 ── */}
          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-emerald-900/40 text-emerald-400 flex items-center justify-center text-[12px] font-bold">3</div>
                <h3 className="text-sm text-gray-100 font-semibold">Agregasi Kriteria (K1–K5)</h3>
              </div>
              <span className={cn(
                'text-[11px] font-medium px-2.5 py-1 rounded-full border',
                yaCount > 0
                  ? 'bg-red-950/40 border-red-900/50 text-red-400 dark:text-red-400'
                  : borderlineCount > 0
                    ? 'bg-amber-950/40 border-amber-900/50 text-amber-500 dark:text-amber-500'
                    : 'bg-emerald-900/30 border-emerald-800/50 text-emerald-400 dark:text-emerald-400'
              )}>
                {yaCount > 0 ? `${yaCount} terpenuhi` : borderlineCount > 0 ? `${borderlineCount} borderline` : 'Tidak ada'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {kriteria.map(k => {
                const CardContent = (
                  <div
                    className={cn(
                      'rounded-xl border-l-[3px] border border-l-current p-3.5 flex flex-col gap-2',
                      k.status === 'ya'
                        ? 'border-red-900/50 border-l-red-500 bg-red-950/40 cursor-pointer hover:bg-red-950/60 transition-colors'
                        : k.status === 'borderline'
                          ? 'border-amber-900/50 border-l-amber-500 bg-amber-950/40'
                          : 'border-emerald-800/50 border-l-emerald-500 bg-emerald-900/30'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {k.status === 'ya'
                          ? <XCircle className="size-4 text-red-400 shrink-0" />
                          : k.status === 'borderline'
                            ? <AlertTriangle className="size-4 text-amber-500 dark:text-amber-500 shrink-0" />
                            : <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />}
                        <span className="text-sm font-medium font-bold text-gray-100">{k.kriteria}</span>
                      </div>
                      <span className={cn(
                        'text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0',
                        k.status === 'ya' ? 'bg-red-950/60 text-red-400 border border-red-900/50'
                          : k.status === 'borderline' ? 'bg-amber-950/60 text-amber-500 dark:text-amber-500 border border-amber-900/50'
                            : 'bg-emerald-900/40 text-emerald-400 border border-emerald-800/50'
                      )}>
                        {k.status === 'ya' ? 'TERPENUHI' : k.status === 'borderline' ? 'BORDERLINE' : 'TIDAK'}
                      </span>
                    </div>
                    <p className="text-[11px] font-semibold text-gray-100 leading-snug">{KRITERIA_SHORT_LABEL[k.kriteria] || k.label}</p>
                    {k.catatan && (
                      <p className="text-[10px] text-gray-400 leading-relaxed border-t border-white/10 pt-1.5">{k.catatan}</p>
                    )}
                  </div>
                );

                if (k.status === 'ya') {
                  return (
                    <Dialog key={k.kriteria}>
                      <DialogTrigger asChild>
                        {CardContent}
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md bg-gray-900 border-gray-800 text-gray-100">
                        <DialogHeader>
                          <DialogTitle className="text-red-400">Kriteria Kritis: {k.kriteria}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                          <ul className="space-y-3 list-none">
                            <li className="flex flex-col gap-1">
                              <span className="text-sm font-semibold text-gray-400">Definisi Kriteria:</span>
                              <span className="text-sm text-gray-100">{k.label}</span>
                            </li>
                            <li className="flex flex-col gap-1">
                              <span className="text-sm font-semibold text-gray-400">Status Sistem:</span>
                              <span className="text-sm text-red-400 font-medium">TERPENUHI (KRITIS)</span>
                            </li>
                            {k.catatan && k.catatan.trim() && k.catatan.toLowerCase() !== 'null' && k.catatan.toLowerCase() !== 'undefined' && (
                              <li className="flex flex-col gap-1">
                                <span className="text-sm font-semibold text-gray-400">Alasan / Bukti:</span>
                                <span className="text-sm text-gray-300">- {k.catatan}</span>
                              </li>
                            )}
                          </ul>
                        </div>
                      </DialogContent>
                    </Dialog>
                  );
                }

                return <Fragment key={k.kriteria}>{CardContent}</Fragment>;
              })}
            </div>
          </div>

        </div>
      ) : (
        <>
          {/* Tabel 1: Parameter pemeriksaan fisik */}
          <div className="px-6 py-4 border-b border-white/10">
            <div className="mb-4 flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-emerald-900/40 text-emerald-400 flex items-center justify-center text-[12px] font-bold">1</div>
              <h3 className="text-sm text-gray-100 font-semibold">Parameter Pemeriksaan Fisik</h3>
            </div>
            <div className="rounded-xl border border-white/10 overflow-hidden overflow-x-auto dark:border-white/10">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-white/[0.02] border-b border-white/10">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium font-semibold text-gray-400 uppercase tracking-wider">Parameter</th>
                    <th className="text-left px-4 py-3 text-sm font-medium font-semibold text-gray-400 uppercase tracking-wider w-[100px]">Status</th>
                    <th className="text-left px-4 py-3 text-sm font-medium font-semibold text-gray-400 uppercase tracking-wider">Kutipan Dokumen</th>
                  </tr>
                </thead>
                <tbody>
                  {parameter_findings.map((p, idx) => (
                    <tr key={p.key} className={cn('border-b last:border-0 align-top', idx % 2 === 1 && 'bg-white/[0.02]')}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-100">{p.label}</td>
                      <td className="px-4 py-3 text-sm" style={p.status ? BAND_COLOR[p.status === 'abnormal' ? 'gawat' : 'normal'] : { color: 'var(--on-surface-variant)' }}>
                        {p.status === 'abnormal' ? (
                          <Dialog>
                            <DialogTrigger asChild>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 font-semibold cursor-pointer underline underline-offset-2 hover:opacity-80"
                                style={{ color: 'var(--destructive)' }}
                              >
                                Abnormal
                                <AlertTriangle className="size-3.5" />
                              </button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md bg-gray-900 border-gray-800 text-gray-100">
                              <DialogHeader>
                                <DialogTitle className="text-red-400">Parameter Abnormal: {p.label}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4 py-2">
                                <ul className="space-y-3 list-none">
                                  <li className="flex flex-col gap-1">
                                    <span className="text-sm font-semibold text-gray-400">Temuan Tercatat:</span>
                                    <span className="text-sm text-gray-100">{p.nilai || 'tercatat abnormal di dokumen'}</span>
                                  </li>
                                  {p.kutipan && (
                                    <li className="flex flex-col gap-1">
                                      <span className="text-sm font-semibold text-gray-400">Kutipan Dokumen:</span>
                                      <span className="text-sm italic text-gray-300">&ldquo;{p.kutipan}&rdquo;{p.page_number ? ` (hal. ${p.page_number})` : ''}</span>
                                    </li>
                                  )}
                                  <li className="flex flex-col gap-1">
                                    <span className="text-sm font-semibold text-gray-400">Kenapa Abnormal?</span>
                                    <span className="text-sm text-gray-300">
                                      {PARAMETER_ABNORMAL_INFO[p.key] || 'Temuan ini tercatat abnormal dan menjadi salah satu parameter yang diperiksa pada penilaian kegawatdaruratan.'}
                                      {p.retraksi_grade ? <span className="block mt-1">Grade retraksi: <strong className="text-red-400">{p.retraksi_grade}</strong> — retraksi interkostal menandakan distres napas lebih berat dibanding subkostal.</span> : null}
                                    </span>
                                  </li>
                                </ul>
                              </div>
                            </DialogContent>
                          </Dialog>
                        ) : p.status === 'normal' ? 'Normal' : 'Tidak tercatat'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400 space-y-1">
                        <QuoteCell kutipan={p.kutipan} page_number={p.page_number} />
                        {p.nilai ? <span className="block text-label-md">Nilai: {p.nilai}</span> : null}
                        {p.sumber_dokumen === 'resume_medis' ? (
                          <span
                            className="inline-block rounded border border-amber-900/50 px-2 py-0.5 text-label-md text-amber-500 dark:text-amber-500 bg-amber-950/40"
                            title="Tidak tercatat di formulir Triase IGD — ditampilkan dari Resume Medis Rawat Inap sebagai konteks tambahan. Tidak ikut menentukan Ya/Tidak/Borderline pada Tabel 3 (K1-K5 tetap dihitung khusus dari Triase IGD saja)."
                          >
                            Resume Medis
                          </span>
                        ) : null}
                        {p.retraksi_grade ? (
                          <span
                            className="inline-block rounded border border-red-900/50 px-2 py-0.5 text-label-md text-red-400 dark:text-red-400 bg-red-950/40 ml-1"
                            title="Retraksi interkostal menandakan distres napas lebih berat dibanding subkostal (PNPK Tatalaksana Pneumonia pada Anak IDAI)"
                          >
                            {p.retraksi_grade}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tabel 2: Nilai vital + ambang batas (referensi dewasa + hasil per-record) */}
          <div className="px-6 py-4 border-b border-white/10">
            <div className="mb-4 flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-emerald-900/40 text-emerald-400 flex items-center justify-center text-[12px] font-bold">2</div>
              <h3 className="text-sm text-gray-100 font-semibold">
                Nilai Vital &amp; Ambang Batas
                {age_group ? <span className="ml-2 font-normal text-gray-400 text-label-md">(Usia: {AGE_GROUP_LABELS[age_group] || age_group})</span> : null}
              </h3>
            </div>
            <div className="rounded-xl border border-white/10 overflow-hidden overflow-x-auto dark:border-white/10">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-white/[0.02] border-b border-white/10">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium font-semibold text-gray-400 uppercase tracking-wider">Parameter</th>
                    <th className="text-left px-4 py-3 text-sm font-medium font-semibold text-gray-400 uppercase tracking-wider w-[90px]">Nilai</th>
                    <th className="text-left px-4 py-3 text-sm font-medium font-semibold text-gray-400 uppercase tracking-wider w-[100px]">Band</th>
                    <th className="text-left px-4 py-3 text-sm font-medium font-semibold text-gray-400 uppercase tracking-wider">Ambang (Dewasa)</th>
                    <th className="text-left px-4 py-3 text-sm font-medium font-semibold text-gray-400 uppercase tracking-wider">Dokumen</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(VITAL_LABELS).map(([key, meta], idx) => {
                    const vf = vital_findings?.[key];
                    const isEmpty = vf?.nilai === null || vf?.nilai === undefined;
                    // Skala Nyeri pada formulir kertas/PDF biasanya berupa skala cetak
                    // 0-10 yang diisi dengan MELINGKARI/mencentang satu angka -- tanda
                    // visual itu tidak pernah bisa terbaca oleh pipeline ini (murni
                    // ekstraksi teks, TIDAK ADA analisis gambar/vision di manapun,
                    // baik untuk halaman native maupun hasil OCR) -- jadi "tidak
                    // tercatat" DI SINI KHUSUS bisa berarti "memang kosong" ATAU
                    // "diisi tapi tandanya tidak terbaca teks", beda dari field lain
                    // yang "tidak tercatat"-nya lebih bisa dipercaya sebagai genuinely
                    // kosong. Verifikator perlu tahu ini supaya tidak salah kira bug.
                    // Instrumen skala nyeri yang diharapkan untuk usia pasien ini
                    // (NIPS neonatus / FLACC <3th / Wong-Baker 3-7th / NRS-VAS
                    // >=8th) -- dihitung server-side dari umur, ditempel apa adanya
                    // ke output, dipakai sbg konteks di sini supaya verifikator
                    // tahu notasi apa yang seharusnya dicari di formulir.
                    const instrumenDiharapkan = key === 'Nyeri' ? vf?.instrumen_diharapkan : undefined;
                    const nyeriCaveat = key === 'Nyeri' && isEmpty
                      ? `Skala nyeri pada formulir kertas/PDF biasanya diisi dengan melingkari/mencentang satu angka pada skala tercetak 0-10 -- tanda visual seperti itu tidak dapat terbaca oleh sistem ini (ekstraksi murni berbasis teks, tanpa analisis gambar). "Tidak tercatat" di sini bisa berarti field ini memang kosong, ATAU sudah diisi tapi tandanya tidak terbaca sistem -- cek dokumen asli untuk memastikan.${instrumenDiharapkan ? ` Instrumen yang diharapkan untuk usia pasien ini: ${instrumenDiharapkan}.` : ''}`
                      : undefined;
                    return (
                      <tr key={key} className={cn('border-b last:border-0 align-top', idx % 2 === 1 && 'bg-white/[0.02]')}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-100">{meta.label}</td>
                        <td className="px-4 py-3 text-sm font-mono">{!isEmpty ? `${vf.nilai} ${meta.unit}` : <span className="italic text-gray-400" title={nyeriCaveat}>{nyeriCaveat ? '—' : '—'}</span>}</td>
                        <td className="px-4 py-3 text-sm font-medium" style={vf?.band ? BAND_COLOR[vf.band] : { color: 'var(--on-surface-variant)' }}>
                          {labelBand(key, vf?.nilai, vf?.band)}
                        </td>
                        <td className="px-4 py-3 text-label-md text-gray-400">{meta.referensiDewasa}</td>
                        <td className="px-4 py-3 text-sm text-gray-400 space-y-1">
                          {nyeriCaveat
                            ? <span className="italic text-[12px]" title={nyeriCaveat}>Catatan spesial lihat detail</span>
                            : <>
                              <QuoteCell kutipan={vf?.kutipan} page_number={vf?.page_number} />
                              {instrumenDiharapkan ? <span className="block text-label-md italic">Instrumen: {instrumenDiharapkan}</span> : null}
                            </>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-label-md text-gray-400 italic">
              Ambang untuk Dewasa (Lansia menggunakan ambang sama, kecuali HR &lt;60/&gt;100). Anak/bayi punya ambang per kelompok usia (PALS) — sudah disesuaikan otomatis pada kolom Band berdasarkan usia pasien.
            </p>
          </div>

          {/* Tabel 3: Agregasi kriteria K1-K5 */}
          <div className="px-6 py-4">
            <div className="mb-4 flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-emerald-900/40 text-emerald-400 flex items-center justify-center text-[12px] font-bold">3</div>
              <h3 className="text-sm text-gray-100 font-semibold">Agregasi Kriteria (K1-K5)</h3>
            </div>
            <div className="rounded-xl border border-white/10 overflow-hidden overflow-x-auto dark:border-white/10">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-white/[0.02] border-b border-white/10">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium font-semibold text-gray-400 uppercase tracking-wider w-[240px]">Kriteria</th>
                    <th className="text-left px-4 py-3 text-sm font-medium font-semibold text-gray-400 uppercase tracking-wider w-[120px]">Status</th>
                    <th className="text-left px-4 py-3 text-sm font-medium font-semibold text-gray-400 uppercase tracking-wider">Bukti</th>
                    <th className="text-left px-4 py-3 text-sm font-medium font-semibold text-gray-400 uppercase tracking-wider">Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {kriteria.map((k, idx) => (
                    <tr key={k.kriteria} className={cn('border-b last:border-0 align-top', idx % 2 === 1 && 'bg-white/[0.02]')}>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-100">{k.kriteria} <span className="font-normal text-gray-400">{k.label}</span></td>
                      <td className="px-4 py-3">
                        <Badge className={cn('text-[10px] font-label-sm px-2.5 py-1', KRITERIA_STATUS_STYLE[k.status])} style={KRITERIA_STATUS_COLOR[k.status]}>
                          {KRITERIA_STATUS_LABEL[k.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400 space-y-1">
                        {k.evidence.length === 0
                          ? <span className="italic">Tidak ada</span>
                          : (
                            <ul className="space-y-1">
                              {k.evidence.map((e, i) => (
                                <li key={i} className="text-[12px]">
                                  {e.sumber === 'proclist'
                                    ? <span className="font-mono">Kode {e.kode} — {e.deskripsi}</span>
                                    : e.sumber === 'esi'
                                    ? <span>ESI: {e.skor}{e.signal ? ' (sinyal konsisten dengan kegawatan)' : ' (sinyal pendukung, tidak menentukan status K5)'} <QuoteCell kutipan={e.kutipan} page_number={e.page_number} /></span>
                                    : e.sumber === 'tindakan_segera'
                                    ? <span>Tindakan segera: {e.label} <QuoteCell kutipan={e.kutipan} page_number={e.page_number} /></span>
                                    : <span>{e.label || e.key}{e.nilai !== undefined ? `: ${e.nilai}` : ''}{e.band ? ` (${labelBand(e.key, e.nilai, e.band)})` : ''} <QuoteCell kutipan={e.kutipan} page_number={e.page_number} /></span>}
                                </li>
                              ))}
                            </ul>
                          )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">{k.catatan || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-label-md text-gray-400">
              K2-K5 dihitung otomatis dari Tabel 1 &amp; 2 (ambang baku) — K5 dari PROCLIST. K1 penilaian bahasa (risiko diri/orang/lingkungan). Ini bahan cek klinis sebelum submit, bukan keputusan final.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Loading ────────────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="space-y-4">
      <div>
        <Skeleton className="h-7 w-56" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <Card className="p-4 grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i}>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2 h-6 w-12" />
          </div>
        ))}
      </Card>
      <Card className="p-5 space-y-3">
        <Skeleton className="h-5 w-48" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </Card>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

// Bagian RV-20 disembunyikan 19 Sep 2026 atas permintaan klien. Anotasi
// `: boolean` WAJIB -- kalau ditulis literal `false`, sisa ekspresi jadi
// unreachable dan TypeScript berhenti menyempitkan `selectedRecord` di
// dalamnya (TS18049), sehingga `npm run build` gagal.
const SHOW_RV20: boolean = false;

export default function ResultsPage() {
  const params = useParams();
  const fileId = params.fileId as string;
  // ?sep=... (dari link Pending BPJS atau hasil pencarian Riwayat Upload) —
  // pra-isi pencarian & langsung loncat ke record yang cocok, bukan selalu
  // record pertama (penting untuk file legacy TXT/Excel yang berisi ratusan
  // record dalam 1 file).
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('sep') || '';
  // ?highlight=DIAGLIST,TOTAL_TARIF (dari link Pending BPJS) — kolom vClaim
  // yang jadi penyebab pending (diekstrak AI, lihat kolom_penyebab di
  // routes/bpjsPending.js), disorot di RecordFieldsTable supaya staf langsung
  // tahu penyebabnya tanpa harus baca ulang teks alasan pending.
  const highlightFields = useMemo(
    () => new Set((searchParams.get('highlight') || '').split(',').map(s => s.trim()).filter(Boolean)),
    [searchParams]
  );
  const { toasts, addToast, removeToast } = useToast();
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [records, setRecords] = useState<ClaimRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');
  const [filteredOutCount, setFilteredOutCount] = useState(0);
  const [search, setSearch] = useState(initialSearch);
  const [loading, setLoading] = useState(true);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [isSavingRecord, setIsSavingRecord] = useState(false);
  const [isRereading, setIsRereading] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const [maximizeData, setMaximizeData] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedValues, setEditedValues] = useState<Record<string, any>>({});
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [listCollapsed, setListCollapsed] = useState(false);
  const [rv20ConfirmedRecordIds, setRv20ConfirmedRecordIds] = useState<Set<string>>(new Set());
  const [suratKlarifikasiOpen, setSuratKlarifikasiOpen] = useState(false);

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

      // Filter: Hide data dengan umur > 17 tahun (fokus pediatric cases ≤17 tahun)
      const filteredRecords = d.records.filter((rec: any) => {
        const umurValue = rec.umur_tahun;
        // Skip filter jika umur tidak ada/empty (keep ambiguous records)
        if (umurValue === null || umurValue === undefined || umurValue === '') return true;
        const umur = Number(umurValue);
        // Keep only if umur ≤ 17 (atau jika parsing failed — NaN)
        return !(umur > 17);
      });
      const hiddenCount = d.records.length - filteredRecords.length;
      setFilteredOutCount(hiddenCount);

      setRecords(filteredRecords);
      setTotal(d.total);
      if (filteredRecords && filteredRecords.length > 0) {
        const firstErrorRecord = filteredRecords.find((r: any) => r.error_count > 0);
        setSelectedRecordId(prev => {
          if (prev && filteredRecords.some((r: any) => r.id === prev)) return prev;
          return firstErrorRecord ? firstErrorRecord.id : filteredRecords[0].id;
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

  // RV-20 (kriteria kegawatan IGD, non-blocking) — kalau record ini kena RV-20
  // dan BELUM pernah dikonfirmasi, tampilkan checklist inline di bawah tabel
  // (bukan modal lagi — supaya tidak menghalangi verifikator melihat data).
  // Dicek ke server (bukan cuma local state) supaya tidak muncul ulang kalau
  // verifikator sebelumnya sudah konfirmasi lalu buka lagi halaman ini nanti.
  useEffect(() => {
    const rec = selectedRecordId ? records.find(r => r.id === selectedRecordId) : null;
    const hasRv20 = rec?.errors?.some(e => e.rule_id === 'RV-20');
    if (!rec || !hasRv20 || rv20ConfirmedRecordIds.has(rec.id)) return;
    let cancelled = false;
    api.getRv20Confirmation(rec.id).then(res => {
      if (cancelled || !res.confirmed) return;
      setRv20ConfirmedRecordIds(prev => new Set(prev).add(rec.id));
    }).catch(() => { });
    return () => { cancelled = true; };
  }, [selectedRecordId, records, rv20ConfirmedRecordIds]);


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

  // "Baca Ulang" — jalankan ulang ekstraksi + AI review dari PDF asli, dipakai
  // saat ada field kosong/error yang dicurigai sebenarnya ada di dokumen tapi
  // terlewat oleh AI di percobaan pertama (lihat reprocessExistingRecord di
  // backend). Menimpa hasil ekstraksi record ini, jadi minta konfirmasi kalau
  // sedang ada perubahan manual yang belum disimpan.
  const handleReread = async () => {
    if (!selectedRecordId) return;
    if (isEditing && Object.keys(editedValues).length > 0
      && !confirm('Ada perubahan manual yang belum disimpan — baca ulang akan menimpa data ini dengan hasil ekstraksi baru. Lanjutkan?')) {
      return;
    }
    setIsRereading(true);
    try {
      await api.rereadRecord(selectedRecordId);
      addToast('Berkas berhasil dibaca ulang', 'success');
      setEditedValues({});
      setIsEditing(false);
      await loadRecords();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Gagal membaca ulang berkas', 'error');
    } finally {
      setIsRereading(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!fileInfo) return (
    <div className="flex items-center justify-center py-24 text-muted-foreground">
      <h3 className="text-base font-semibold">File tidak ditemukan</h3>
    </div>
  );

  const totalPages = Math.ceil(total / 30);
  // Dibungkus try/catch — sebelumnya JSON.parse langsung tanpa guard, beda
  // dari SEMUA tempat lain yang baca localStorage 'user' (sidebar.tsx,
  // header.tsx, useRequireRole.ts semuanya guarded). Nilai localStorage yang
  // rusak/corrupt akan throw saat render dan menjatuhkan seluruh halaman ini
  // (ditangkap ErrorBoundary dashboard, tapi tetap bikin halaman tidak
  // terpakai) — bukan skenario yang seharusnya terjadi kalau field ini aman.
  let user: { role?: string } = {};
  if (typeof window !== 'undefined') {
    try { user = JSON.parse(localStorage.getItem('user') || '{}'); } catch { /* biarkan {} */ }
  }
  const canApprove = ['supervisor', 'admin', 'superadmin'].includes(user.role || '') && fileInfo.status === 'completed';

  const selectedRecord = selectedRecordId ? records.find(r => r.id === selectedRecordId) : null;

  const kategori = JENIS_KLAIM_OPTIONS.find(o => o.value === fileInfo.jenis_klaim);

  return (
    <div className="animate-fade-in space-y-4">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <Header
        title="Hasil Validasi"
        description=""
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
            {canApprove && (
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleApprove}>Setujui</Button>
            )}
          </>
        }
      />

      {/* ─── Filter notification: pediatric cases only (umur ≤17 tahun) ─────────────────────────── */}
      {filteredOutCount > 0 && (
        <SummaryBanner tone="info">
          Data dengan umur &gt; 17 tahun disembunyikan ({filteredOutCount} pasien) — tampil hanya pediatric cases (≤17 tahun)
        </SummaryBanner>
      )}

      {/* ─── Statistik keseluruhan file ─────────────────────────── */}
      {/* "Pending" di sini = error_count + pending_count digabung, konsisten dengan
          kolom "Pending" di halaman Riwayat Upload — bagi verifikator RS, keduanya
          sama-sama berarti "belum valid, perlu ditindaklanjuti", severity internal
          (error/pending) tetap dipakai untuk logika lain (mis. gating approve). */}
      <Card className="p-4 grid grid-cols-3 gap-4">
        <div>
          <div className="text-caption">Total Data</div>
          <div className="font-mono-data text-xl font-bold">{fileInfo.total_records}</div>
        </div>
        <div>
          <div className="text-caption">Valid</div>
          <div className="font-mono-data text-xl font-bold text-emerald-600 dark:text-emerald-400">{((fileInfo.valid_count / fileInfo.total_records) * 100).toFixed(0)}%</div>
          <div className="font-mono-data text-xs text-muted-foreground">{fileInfo.valid_count} records</div>
        </div>
        <div>
          <div className="text-caption">Pending</div>
          <div className="font-mono-data text-xl font-bold text-amber-600 dark:text-amber-400">{(((fileInfo.error_count + fileInfo.pending_count) / fileInfo.total_records) * 100).toFixed(0)}%</div>
          <div className="font-mono-data text-xs text-muted-foreground">{fileInfo.error_count + fileInfo.pending_count} records</div>
        </div>
      </Card>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Status:</span>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={filter}
              onChange={e => { setFilter(e.target.value); setPage(1); }}
            >
              <option value="all">Semua Rekam</option>
              <option value="valid">Valid</option>
              <option value="error">Pending - Wajib Revisi</option>
              <option value="pending">Pending - Perlu Dicek</option>
            </select>
          </div>

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
                            <th className="text-left px-3 py-2 text-xs font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {records.length === 0 ? (
                            <tr><td colSpan={3} className="text-center py-6 text-muted-foreground">Tidak ada data</td></tr>
                          ) : records.map(rec => (
                            <tr
                              key={rec.id}
                              className={cn('cursor-pointer border-b last:border-0 hover:bg-muted/40', selectedRecordId === rec.id && 'bg-emerald-900/40')}
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
            <div className="space-y-4">
              {/* ─── Card Detail Pasien ─────────────────────────── */}
              <Card className="p-5">
                <div className="flex flex-col gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h3 className="text-h2 text-foreground">{selectedRecord.nama_pasien}</h3>
                      {kategori && (
                        <Badge
                          className="text-[11px] border-transparent"
                          style={{ background: `color-mix(in srgb, ${kategori.accent} 14%, transparent)`, color: kategori.accent }}
                        >
                          {kategori.icon} {kategori.label}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      MRN: <span className="font-mono-data">{selectedRecord.mrn || '-'}</span> · Status:
                      <span className="ml-1"><RecordStatusBadge status={selectedRecord.validation_status} /></span>
                      {parseRawData(selectedRecord).JENIS_KUNJUNGAN_SEP && (
                        <span className="ml-1.5">· Jenis Kunjungan: {parseRawData(selectedRecord).JENIS_KUNJUNGAN_SEP}</span>
                      )}
                    </div>
                  </div>

                  {/* ─── Alasan Status Pending ─── beda dari "Pola Pending Risk" di
                      bawah (itu pola heuristik AI, mis. kegawatan_lemah) — ini
                      alasan RESMI dari rule engine: field mana yang gagal validasi.
                      Ditampilkan untuk KEDUA status 'pending' (minor, non-blocking)
                      MAUPUN 'error' (major/critical, blocking) — badge/label di
                      halaman ini sama-sama tampil "PENDING" untuk keduanya (lihat
                      RecordStatusBadge), jadi alasannya juga harus tampil untuk
                      keduanya, bukan cuma severity minor. Konsisten dengan kolom
                      "Alasan Pending" di halaman Riwayat Upload (semua severity). ─── */}
                  {(selectedRecord.validation_status === 'pending' || selectedRecord.validation_status === 'error') && (selectedRecord.errors?.length ?? 0) > 0 && (() => {
                    // Pakai catatan AI (field_notes) yang lebih detail & manusiawi
                    // kalau tersedia untuk field itu — jauh lebih jelas buat
                    // verifikator dibanding error_message rule engine yang singkat
                    // (mis. "Tindakan Rehab Medik terdeteksi. Pastikan dokumen
                    // lengkap." vs catatan AI yang menyebut kode prosedur, temuan
                    // dokumen aktual, dan langkah perbaikan spesifik). Fallback ke
                    // error_message kalau field itu tidak punya catatan AI.
                    const fieldNotes = parseAiReview(selectedRecord)?.field_notes;
                    return (
                      <div className="px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs space-y-1.5">
                        <div className="font-display font-semibold text-amber-700 dark:text-amber-400">
                          Kenapa Status Pending?
                        </div>
                        {selectedRecord.errors.map((err, i) => (
                          <div key={i} className="text-muted-foreground">
                            <strong className="text-foreground">{getFieldLabel(err.field_name)}:</strong>{' '}
                            {/* whitespace-pre-wrap: catatan AI berformat bullet point (baris "- ..."
                                dipisah \n) -- tanpa ini, newline-nya collapse jadi satu baris panjang */}
                            <span className="whitespace-pre-wrap">{fieldNotes?.[err.field_name] || err.error_message}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* ─── Pola Pending Risk ───────────────────── */}
                  {(() => {
                    const pendingRisks = parseAiReview(selectedRecord)?.pending_risk_notes;
                    if (!pendingRisks || pendingRisks.length === 0) return null;
                    return (
                      <div className="px-3 py-2.5 rounded-lg bg-violet-500/10 border border-violet-500/30 text-xs space-y-2">
                        <div className="font-display font-semibold text-violet-700 dark:text-violet-300">
                          <Sparkles className="size-3 inline mr-1" />
                          Alasan Bisa Pending
                        </div>
                        <div className="space-y-1.5">
                          {pendingRisks.map((risk, i) => (
                            <div key={i}>
                              <strong className="text-foreground">{PENDING_RISK_LABELS[risk.pattern] || risk.pattern}:</strong>
                              <ul className="mt-0.5 list-disc pl-4 space-y-0.5">
                                {toBulletPoints(risk.note).map((pt, j) => (
                                  <li key={j} className="text-muted-foreground" title={pt}>{truncatePoint(pt)}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ─── AI Review Tidak Tersedia ─────────────
                      Sebelumnya kalau pipeline AI review gagal saat upload
                      (best-effort, di-catch diam-diam di backend), record ini
                      cuma tampil TANPA field_notes/code_evidence/pending_risk
                      tanpa penjelasan apa pun — verifikator tidak tahu apakah
                      memang tidak ada catatan, atau AI review-nya gagal total.
                      Sekarang dibedakan eksplisit. ─── */}
                  {!parseAiReview(selectedRecord) && (
                    <div className="px-3 py-2.5 rounded-lg bg-muted border border-border text-xs space-y-1.5">
                      <div className="font-display font-semibold text-foreground">
                        AI Review Tidak Tersedia
                      </div>
                      <p className="text-muted-foreground">
                        Analisis AI untuk record ini gagal dibuat saat upload (bukan berarti tidak ada
                        catatan — datanya memang belum pernah berhasil dianalisis). Klik &ldquo;Baca Ulang&rdquo;
                        di bawah untuk mencoba lagi.
                      </p>
                    </div>
                  )}

                  {/* ─── Controls ──────────────────────────── */}
                  <div className="flex gap-2 items-center flex-wrap">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input type="checkbox" checked={onlyIssues} onChange={e => setOnlyIssues(e.target.checked)} />
                      Tampilkan hanya yang bermasalah
                    </label>
                    {SHOW_RV20 && selectedRecord.errors?.some(e => e.rule_id === 'RV-20') && (
                      <Button variant="outline" size="sm" onClick={() => setSuratKlarifikasiOpen(true)}>
                        Buat Surat Klarifikasi
                      </Button>
                    )}
                    {(selectedRecord.error_count > 0 || !parseAiReview(selectedRecord)) && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isRereading}
                        onClick={handleReread}
                        title="Ekstraksi ulang dari PDF asli — dipakai kalau ada field kosong/error yang dicurigai sebenarnya ada di dokumen, atau kalau AI review gagal dibuat"
                      >
                        {isRereading ? 'Membaca ulang...' : 'Baca Ulang'}
                      </Button>
                    )}
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
              </Card>

              {/* ─── Card Data Klaim ────────────────────────── */}
              <Card className="p-5">

                {/* ─── RV-13 s/d RV-16: silent-valid ────────────────────────
                  Prinsip (disepakati dengan user): "tidak ada data terkait"
                  = otomatis VALID, TIDAK tampilkan apapun — sebelumnya di sini
                  ada banner besar "Cek manual diperlukan" untuk kasus data
                  riwayat episode kosong, yang justru melanggar prinsip itu
                  (menampilkan peringatan untuk kasus yang seharusnya diam).
                  Rule engine (ruleEngine.js) sendiri sudah silent-valid dari
                  sananya — cuma push ke errors[] kalau BENAR-BENAR ada
                  masalah. Baris ringkas ini HANYA utk kasus datanya ADA
                  (hasEpisodeTrackingData true) dan keempat rule itu bersih —
                  bukan checklist per-rule, bukan peringatan. */}
                {hasEpisodeTrackingData(selectedRecord) &&
                  !selectedRecord.errors?.some(e => ['RV-13', 'RV-14', 'RV-15', 'RV-16'].includes(e.rule_id)) && (
                    <p className="mb-4 text-xs text-muted-foreground">
                      RV-13 s/d RV-16: tidak ada isu terdeteksi.
                    </p>
                  )}

                {/* ─── RV-20 (kegawatan IGD): referensi padanan kode, baca saja ── */}
                {SHOW_RV20 && selectedRecord.errors?.some(e => e.rule_id === 'RV-20') && (
                  <div className="mb-4">
                    <PadananKodeNyeriCard />
                  </div>
                )}

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

                {/* ─── The single 60-column table (side-by-side dengan PDF saat dibuka)
                    DAN Tabel Kegawatdaruratan — urutan render KEDUANYA ditukar
                    KONDISIONAL (bukan cuma CSS `order`, supaya tab order/screen
                    reader juga ikut benar) khusus utk GAWAT_DARURAT (IGD):
                    Kegawatdaruratan paling relevan buat kasus IGD, jadi
                    dimunculkan PALING ATAS. Utk RAWAT_INAP/RAWAT_JALAN, urutan
                    lama dipertahankan (tabel 60-kolom dulu, Kegawatdaruratan
                    tetap ada di bawah -- TIDAK dihapus total krn sebagian
                    RAWAT_INAP masih masuk lewat IGD dulu). ─── */}
                {(() => {
                  const fieldsTable = showPdf ? (
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
                            onEdit={(col, val) => { setIsEditing(true); setEditedValues(prev => ({ ...prev, [col]: val })); }}
                            onlyIssues={onlyIssues}
                            jenisKlaim={fileInfo.jenis_klaim}
                            highlightFields={highlightFields}
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
                      highlightFields={highlightFields}
                    />
                  );

                  // Tabel Kegawatdaruratan — muncul kalau ada halaman Triase IGD
                  // di dokumen (IGD murni ATAU rawat inap yang masuk lewat IGD dulu),
                  // ditentukan backend (kegawatdaruratan_assessment terisi/tidak),
                  // bukan dari jenis_klaim. Komponennya sendiri return null kalau
                  // kosong, jadi tidak perlu gating tambahan di sini.
                  const kegawatdaruratanTable = (
                    <KegawatdaruratanTable key={`kegawatdaruratan-${selectedRecord.id}`} recordData={selectedRecord} />
                  );

                  // INA-CBG & Tarif card — now integrated with clinical coherence validation (19 Sep 2026)
                  const inacbgCard = (
                    <div className="mt-4">
                      <div className="mb-2">
                        <h3 className="text-sm font-semibold text-foreground">INA-CBG & Tarif</h3>
                      </div>
                      <InaCbgCoherenceDisplay key={`inacbg-${selectedRecord.id}`} recordData={selectedRecord} />
                    </div>
                  );
                  
                  // Ketentuan Klaim Tipe 3 (aturan kombinasi kode) — dievaluasi backend
                  // di ketentuanKlaimService.js, kartunya hanya menampilkan. Tidak
                  // dirender sama sekali kalau tidak ada aturan yang terpicu.
                  const ketentuanCard = (
                    <KetentuanKlaimCard
                      key={`ketentuan-${selectedRecord.id}`}
                      temuan={parseAiReview(selectedRecord)?.kombinasi_kode}
                    />
                  );

                  // Identitas antar halaman — menangkap berkas yang ketumpangan
                  // halaman milik pasien lain. Tidak dirender sama sekali kalau
                  // tidak ada temuan.
                  const identitasCard = (
                    <IdentitasHalamanCard
                      key={`identitas-${selectedRecord.id}`}
                      temuan={parseAiReview(selectedRecord)?.identitas_halaman ?? []}
                    />
                  );

                  // Syarat penunjang diagnosis — hanya dirender kalau ada
                  // diagnosis pemicu, sama seperti blok kegawatdaruratan.
                  const syaratCard = (
                    <SyaratPenunjangCard
                      key={`syarat-${selectedRecord.id}`}
                      temuan={parseAiReview(selectedRecord)?.syarat_penunjang}
                    />
                  );

                  // Tindakan yang terbaca dari berkas — terpisah dari Daftar
                  // Prosedur, yang memuat kode final koder.
                  const tindakanCard = (
                    <TemuanTindakanCard
                      key={`tindakan-${selectedRecord.id}`}
                      temuan={parseAiReview(selectedRecord)?.temuan_tindakan}
                      silang={parseAiReview(selectedRecord)?.silang_tindakan}
                    />
                  );

                  // Konsistensi antar data — data yang diklaim harus punya
                  // pendukungnya di berkas.
                  const konsistensiCard = (
                    <KonsistensiDataCard
                      key={`konsistensi-${selectedRecord.id}`}
                      temuan={parseAiReview(selectedRecord)?.konsistensi_data}
                    />
                  );

                  return (
                    <>
                      {fieldsTable}
                      {inacbgCard}
                      {ketentuanCard}
                      {identitasCard}
                      {syaratCard}
                      {tindakanCard}
                      {konsistensiCard}
                      {kegawatdaruratanTable}
                    </>
                  );
                })()}

                {/* ─── RV-20: checklist konfirmasi INLINE di bawah tabel ─── */}
                {SHOW_RV20 && selectedRecord.errors?.some(e => e.rule_id === 'RV-20') && !rv20ConfirmedRecordIds.has(selectedRecord.id) && (
                  <div className="mt-4">
                    <Rv20ConfirmationModal
                      recordId={selectedRecord.id}
                      onConfirmed={() => setRv20ConfirmedRecordIds(prev => new Set(prev).add(selectedRecord.id))}
                    />
                  </div>
                )}
              </Card>
            </div>
          ) : (
            <Card className="p-10 text-center text-muted-foreground">
              Pilih data dari tabel untuk melihat detail validasi
            </Card>
          )}
        </div>
      </div>

      {selectedRecord && (
        <SuratKlarifikasiModal
          open={suratKlarifikasiOpen}
          onOpenChange={setSuratKlarifikasiOpen}
          record={selectedRecord}
        />
      )}

    </div>
  );
}
