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
import { SaranKodingPanel } from '@/components/SaranKodingPanel';
import { TarifGandaCard } from '@/components/TarifGandaCard';
import { PemeriksaanPenunjangPanel } from '@/components/PemeriksaanPenunjangPanel';
import { KodingReadinessNotice, type KesiapanKoding } from '@/components/KodingReadinessNotice';
import { InaCbgTarifDisplay, InaCbgTarifPending } from '@/components/InaCbgTarifDisplay';
import type { TemuanKombinasiKode } from '@/components/KetentuanKlaimCard';
import type { TemuanIdentitasHalaman } from '@/components/IdentitasHalamanCard';
import type { TemuanSyaratPenunjang } from '@/components/SyaratPenunjangCard';
import type { TemuanTindakan, SilangTindakan } from '@/components/TemuanTindakanCard';
import type { TemuanKonsistensi } from '@/components/KonsistensiDataCard';
import type { PutusanPending } from '@/components/PutusanPendingCard';
import { RingkasanTemuanCard } from '@/components/RingkasanTemuanCard';
import { AnalisisKritisCard, type AnalisisKritis } from '@/components/AnalisisKritisCard';
import { AgenCasemixPanel } from '@/components/AgenCasemixPanel';
import { validateClinicalCoherence, type VitalSigns, type ClinicalCoherenceInput } from '@/services/clinicalCoherenceValidator';
// import { InaCbgDashboardCard } from '@/components/InaCbgDashboardCard'; // disembunyikan sementara (18 Sep 2026)

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { FIELD_TYPE_REGISTRY } from '@/lib/fieldTypeRegistry';
import { ChevronDown, Search, CheckCircle2, XCircle, ChevronLeft, ChevronRight, FileText, Sparkles, Lightbulb, AlertTriangle, PanelLeftOpen, Users } from 'lucide-react';

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
  evidence_found?: boolean;
  dictionary_status?: 'valid' | 'not_found' | 'unavailable';
  coding_review_status?: 'VALID' | 'PENDING';
  diganti_menjadi?: string;
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
  has_data?: boolean;
  ringkasan: string;
  parameter_findings: KegawatdaruratanParameterFinding[];
  vital_findings: Record<string, KegawatdaruratanVitalFinding>;
  kriteria: KegawatdaruratanKriteria[];
  age_group: string | null;
  // Ditambah 19 Sep 2026 (fix item 5) -- tindakan keperawatan segera (teks
  // bebas, quote-validated) & skor ESI dari Triase IGD.
  tindakan_keperawatan?: { quotation: string; page_number: number }[];
  esi?: { skor: number | null; page_number: number | null; kutipan: string | null };
  // false = bukan kunjungan IGD (poli/ranap terencana): K1-K5 & tanda vital
  // bukan fokus penilaian dan disembunyikan secara bawaan.
  kunjungan_igd?: boolean;
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
  kesiapan_koding?: KesiapanKoding;
  penjaminan?: { jenis: string; dasar: string; catatan: string } | null;
  // Tipe 3 ketentuan klaim (aturan kombinasi kode) -- diisi backend di
  // aiReviewService.js, kosong kalau tidak ada aturan yang terpicu.
  kombinasi_kode?: TemuanKombinasiKode[];
  identitas_halaman?: TemuanIdentitasHalaman[];
  syarat_penunjang?: TemuanSyaratPenunjang[];
  temuan_tindakan?: TemuanTindakan[];
  silang_tindakan?: SilangTindakan[];
  konsistensi_data?: TemuanKonsistensi[];
  putusan_pending?: PutusanPending | null;
  field_notes?: Record<string, string>;
  code_evidence?: CodeEvidence[];
  suggested_codes?: SuggestedCode[];
  pending_risk_notes?: PendingRiskNote[];
  kegawatdaruratan_assessment?: KegawatdaruratanAssessment | null;
  analisis_kritis?: AnalisisKritis | null;
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
  return lines;
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
  // "Error" di sini = data kolom perlu diperbaiki, bukan kegagalan aplikasi.
  if (status === 'error') return <Badge variant="destructive" className="text-xs">Perlu diperbaiki</Badge>;
  if (status === 'empty') return <Badge className="text-xs border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">Kosong</Badge>;
  if (status === 'system') return <Badge variant="secondary" className="text-xs">Otomatis vClaim</Badge>;
  // wajar_kosong: netral (bukan hijau "aman diperiksa", bukan kuning "perlu
  // ditindak") -- field ini memang tidak berlaku untuk klaim ini, kosongnya
  // itu sendiri sudah informasi lengkap, tidak ikut hitungan masalah (lihat
  // isIssueStatus).
  if (status === 'wajar_kosong') return <Badge className="text-xs border-transparent bg-muted text-muted-foreground">Wajar kosong</Badge>;
  // usulan: garis putus-putus sengaja beda dari badge lain (semua solid) --
  // koder harus bisa bedakan sekilas mana yang disalin dari dokumen vs
  // disusun sistem & masih menunggu verifikasi manual.
  if (status === 'usulan') return <Badge className="text-xs border-dashed border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">Usulan</Badge>;
  // 'review' ditambah 19 Sep 2026 (fix item 8/9) -- isinya SUDAH ada (bukan
  // kosong) tapi backend menandai perlu dicek manual (lab rutin, konsistensi
  // diagnosis, atau evidence yang gagal terverifikasi) -- warna amber beda
  // dari 'error' (merah, jelas salah) supaya urgensinya tidak disamakan.
  if (status === 'review') return <Badge className="text-xs border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">Perlu Review</Badge>;
  return <Badge className="text-xs border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">Valid</Badge>;
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
    success: 'border-emerald-500/25 bg-emerald-500/[0.06]',
    info: 'border-blue-500/25 bg-blue-500/[0.06]',
    warning: 'border-amber-600/25 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/[0.06]',
    danger: 'border-red-200 bg-red-50 dark:border-destructive/30 dark:bg-destructive/[0.06]',
  };
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-4 rounded-xl border p-4 text-sm text-foreground sm:p-5', toneClass[tone])}>
      <div className="min-w-0 flex-1">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
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
  field, editing, editedValues, onEdit, autofilledFrom, isHighlighted, isZebra, rowRef, recordData, compact = false,
}: {
  compact?: boolean;
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
  const codeType = field.column_name === 'DIAGLIST' ? 'diagnosis' : field.column_name === 'PROCLIST' ? 'procedure' : null;
  const valueCodes = codeType ? String(currentValue ?? '').split(/[;,]/).map(code => code.trim().toUpperCase()).filter(Boolean) : [];
  const visibleSuggestions = (field.suggestedCodes ?? []).filter(s => !compact || !valueCodes.includes(s.code.trim().toUpperCase()));
  const allCodes = [...new Set([...valueCodes, ...(field.suggestedCodes ?? []).map(item => item.code.trim().toUpperCase())])].slice(0, 50);
  const codeRequestKey = codeType && allCodes.length ? `${codeType}:${allCodes.join(';')}` : '';
  const [codeLookup, setCodeLookup] = useState<{ key: string; descriptions: Record<string, string>; error: boolean } | null>(null);

  useEffect(() => {
    if (!codeRequestKey) return;
    const [requestType, codesText] = codeRequestKey.split(':') as ['diagnosis' | 'procedure', string];
    const requestedCodes = codesText.split(';');
    let active = true;
    api.lookupCodeDescriptions(requestType === 'diagnosis' ? requestedCodes : [], requestType === 'procedure' ? requestedCodes : [])
      .then(result => {
        if (active) setCodeLookup({ key: codeRequestKey, descriptions: result[requestType], error: false });
      })
      .catch(() => {
        if (active) setCodeLookup({ key: codeRequestKey, descriptions: {}, error: true });
      });
    return () => { active = false; };
  }, [codeRequestKey]);

  const codeDescription = (code: string) => {
    if (codeLookup?.key !== codeRequestKey) return 'Memuat keterangan…';
    if (codeLookup.error) return 'Keterangan belum dapat dimuat';
    return codeLookup.descriptions[code.toUpperCase()] || 'Keterangan belum tersedia di kamus aplikasi';
  };

  return (
    <tr
      ref={rowRef}
      className={cn(
        compact ? 'grid grid-cols-[minmax(0,1fr)_auto] rounded-lg border border-border bg-background/40 p-4' : 'border-b last:border-0 hover:bg-muted/30 align-top',
        isZebra && !isHighlighted && 'bg-muted/25',
        isHighlighted && 'bg-amber-500/15 ring-1 ring-inset ring-amber-500/40'
      )}
    >
      <td className={cn("text-sm font-semibold leading-relaxed text-foreground", compact ? "col-start-1 row-start-1 pb-3 text-base" : "px-4 py-3")}>{compact ? (codeType === 'diagnosis' ? 'Diagnosis' : 'Prosedur') : getFieldLabel(field.column_name)}{compact && <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{codeType === 'diagnosis' ? 'ICD-10 · Kamus SATUSEHAT' : 'ICD-9-CM · Kamus SATUSEHAT'}</span>}</td>
      <td className={cn(compact ? "col-span-2 row-start-2 min-w-0" : "px-4 py-3")}>
        {editing && !isSystem ? (
          <input
            type="text"
            aria-label={getFieldLabel(field.column_name)}
            value={String(currentValue ?? '')}
            onChange={e => onEdit(field.column_name, e.target.value)}
            className={cn(
              'w-full rounded-md border bg-background px-3 py-2 font-mono text-sm',
              'focus:outline-none focus:ring-2 focus:ring-ring/50',
              isChanged ? 'border-blue-500' : 'border-input',
            )}
          />
        ) : codeType && valueCodes.length > 0 ? (
          <div className="space-y-2" aria-label={codeType === 'diagnosis' ? 'Daftar diagnosis ICD-10' : 'Daftar prosedur ICD-9-CM'}>
            {valueCodes.map((code, index) => (
              <div key={`${code}-${index}`} className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm leading-relaxed", compact && "border-t border-border/60 py-3 first:border-0 first:pt-0")}>
                <code className={cn("shrink-0 font-mono font-semibold text-foreground", compact && "rounded-md bg-muted px-2.5 py-1 text-lg font-bold")}>{code}</code>
                {compact && codeType === 'diagnosis' && <span className="text-sm font-medium text-foreground/85">{index === 0 ? 'Diagnosis utama' : 'Diagnosis sekunder'}</span>}
                <span className={cn("min-w-0 break-words text-foreground", compact ? "w-full text-base leading-relaxed" : "flex-1")}>{codeDescription(code)}</span>
                {compact && field.codeEvidence?.filter(ev => ev.code.toUpperCase() === code).map((ev, i) => (
                  <span key={i} className={cn('w-full text-sm leading-relaxed', ev.found ? 'text-foreground/80' : 'text-destructive')}>
                    {ev.found
                      ? `${ev.document_type ? DOCUMENT_TYPE_LABELS[ev.document_type] || 'Dokumen' : 'Dokumen'}${ev.page_number ? ` · Hal. ${ev.page_number}` : ''}${ev.quotation ? `: “${ev.quotation}”` : ' · Bukti tercatat'}`
                      : 'Bukti dokumen belum ditemukan. Periksa manual.'}
                  </span>
                ))}
                {compact && !field.codeEvidence?.some(ev => ev.code.toUpperCase() === code) && field.suggestedCodes?.filter(item => item.code.trim().toUpperCase() === code && item.quotation).map((item, i) => (
                  <span key={`usulan-${i}`} className="w-full text-sm leading-relaxed text-foreground/80">
                    Referensi usulan{item.page_number ? ` · Hal. ${item.page_number}` : ''}: “{item.quotation}”
                  </span>
                ))}
              </div>
            ))}
            {!compact && <span className="text-xs text-muted-foreground">{codeType === 'diagnosis' ? 'ICD-10' : 'ICD-9-CM'} · Keterangan kamus SATUSEHAT</span>}
          </div>
        ) : (
          <span className={cn('font-mono text-sm leading-relaxed break-words whitespace-pre-wrap', field.status === 'error' ? 'text-destructive' : 'text-foreground')}>
            {currentValue === null || currentValue === undefined || currentValue === ''
              ? <span className="text-muted-foreground italic">(kosong)</span>
              : field.column_name === 'DISCHARGE_STATUS' && DISCHARGE_STATUS_LABELS[String(currentValue)]
                ? `${currentValue} - ${DISCHARGE_STATUS_LABELS[String(currentValue)]}`
                : String(currentValue)}
          </span>
        )}
        {editing && codeType && valueCodes.length > 0 && (
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            {valueCodes.map((code, index) => <div key={`${code}-${index}`}><code className="mr-2 font-mono font-semibold text-foreground">{code}</code>{codeDescription(code)}</div>)}
          </div>
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
      <td className={cn(compact ? "col-start-2 row-start-1 pl-3" : "px-4 py-3")}>
        {compact && !isIssueStatus(field.status)
          ? <span className="rounded-md bg-muted px-2 py-1 text-xs text-foreground/80" title="Kode terbaca dan lolos pemeriksaan kolom. Kesiapan upload ditampilkan terpisah.">Kode terbaca</span>
          : <StatusBadge status={field.status} />}
      </td>
      <td className={cn("text-sm leading-relaxed text-muted-foreground break-words", compact ? "col-span-2 row-start-3 min-w-0 pt-2" : "px-4 py-3")}>
        {field.status === 'error' && field.error_message && (
          <div>
            <div className="text-destructive mb-1">
              <strong>{field.rule_id}:</strong> {field.error_message}
            </div>
            {field.suggestion && (
              <div className="bg-blue-500/10 border-l-2 border-blue-500 px-2.5 py-1.5 rounded-r-md mt-1">
                <strong>Perbaiki menjadi:</strong>{' '}
                <code className="font-mono text-sm">{field.suggestion}</code>
              </div>
            )}
          </div>
        )}
        {field.status === 'empty' && !field.codeEvidence && (
          <span className="text-amber-600 dark:text-amber-400">
            {(field.column_name === 'KODE_RS' || field.column_name === 'KELAS_RS')
              ? <>Data rumah sakit tidak tercantum di dokumen pasien. Isi sekali melalui <strong>Aturan Validasi &gt; Profil Rumah Sakit</strong>; klaim berikutnya terisi otomatis.</>
              : 'Data tidak ditemukan di dokumen PDF. Periksa dan isi manual.'}
          </span>
        )}
        {field.aiNote && (
          <div className={cn('bg-violet-500/10 border-l-2 border-violet-500 px-2.5 py-1.5 rounded-r-md', field.status === 'error' ? 'mt-1.5' : '')}>
            <strong className="inline-flex items-center gap-1"><Sparkles className="size-3" /> AI:</strong> {field.aiNote}
          </div>
        )}
        {!compact && field.codeEvidence && field.codeEvidence.length > 0 && (
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
              const needsReview = ev.dictionary_status === 'not_found' || ev.dictionary_status === 'unavailable';
              const dictionaryLabel = ev.dictionary_status === 'not_found'
                ? 'Tercantum di dokumen; perlu verifikasi kode'
                : ev.dictionary_status === 'unavailable' ? 'Validasi kamus belum tersedia' : null;
              const docLabel = ev.document_type ? DOCUMENT_TYPE_LABELS[ev.document_type] : 'dokumen';
              const reasonText = ev.review_flags?.map(f => f.reason).join(' ');
              const title = !ev.found
                ? 'Tidak ada bukti dokumen — periksa manual'
                : ev.quotation
                ? `${docLabel} hal. ${ev.page_number}: "${ev.quotation}"${reasonText ? ` — ${reasonText}` : ''}`
                : reasonText;
              return (
                <span
                  key={`evidence-${ev.type}-${ev.code}-${ev.page_number}`}
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
                  {ev.found && !needsReview ? <CheckCircle2 className="size-3" /> : <AlertTriangle className="size-3" />} {ev.code}
                  {dictionaryLabel && <span className="font-sans">{dictionaryLabel}</span>}
                  {ev.diganti_menjadi && <span className="font-sans">Diganti menjadi {ev.diganti_menjadi}</span>}
                </span>
              );
            })}
          </div>
        )}
        {/* Penjelasan Kode untuk DIAGLIST/PROCLIST — tampil bila ada nilai, status apapun */}
        {(field.column_name === 'DIAGLIST' || field.column_name === 'PROCLIST') &&
          !isBlankValue(currentValue) && (
            <CodingExplanationPanel
              showStatusBadge={!compact}
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
        {visibleSuggestions.length > 0 && (
          <div className="mt-3 rounded-lg border border-blue-500/25 bg-blue-500/5 p-3 text-foreground">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
              <Lightbulb className="size-3.5" /> {codeType === 'diagnosis' ? 'Saran diagnosis AI (ICD-10)' : 'Saran prosedur AI (ICD-9-CM)'} · periksa dengan dokumen sebelum digunakan
            </div>
            <div className="space-y-2">
              {visibleSuggestions.map((suggestion, index) => {
                const code = suggestion.code.trim().toUpperCase();
                const alreadyApplied = valueCodes.includes(code);
                return (
                  <div key={`${code}-${index}`} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 rounded-md border border-border/70 bg-background/70 px-3 py-2">
                    <div className="min-w-0 flex-1 text-sm leading-relaxed">
                      <code className="mr-2 font-mono font-semibold text-foreground">{code}</code>
                      <span className="break-words text-foreground/85">{codeDescription(code)}</span>
                      <div className="mt-1 text-xs text-muted-foreground" title={suggestion.reasoning || undefined}>
                        {suggestion.page_number ? `Usulan dari dokumen hal. ${suggestion.page_number}` : 'Usulan AI'}
                        {suggestion.quotation ? ` · “${suggestion.quotation}”` : ''}
                      </div>
                    </div>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {alreadyApplied ? 'Sudah tercantum' : 'Belum diterapkan'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {field.status !== 'error' && field.status !== 'empty' && !field.aiNote && !field.codeEvidence?.length && !field.suggestedCodes?.length && (
          isSystem ? 'Diisi otomatis saat kirim ke vClaim' : <span className="sr-only">Tidak ada catatan</span>
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

  // Hanya minta verifikasi manual kalau MASIH ADA saran yang belum tercermin
  // di nilai field saat ini -- bukan sekadar "field ini punya saran". Kode
  // yang sudah terisi otomatis lewat backend (isiKodeDariSaranTervalidasi,
  // WHO-valid) dan cocok persis dengan salah satu saran (badge "✓ Diterapkan
  // (sebelum fix)" di FieldRowTr, logika alreadyApplied yang sama disalin di
  // sini) TIDAK butuh dikerjakan apa-apa lagi. Sebelumnya kotak ini tetap
  // muncul walau DIAGLIST/PROCLIST sudah valid dan sama persis dengan saran
  // AI-nya -- ditemukan pada SEP 0170R0110826V003045 (SUMIDAH): DIAGLIST=R10.4
  // sudah valid & sudah "Diterapkan", tapi tetap disuruh "verifikasi & ketik
  // manual". Tombol Terapkan sendiri tetap nonaktif (lihat komentar di
  // FieldRowTr) -- ini cuma soal kapan checklist ini ditampilkan.
  if (allFields.some(f => {
    const suggested = f.suggestedCodes ?? [];
    if (suggested.length === 0) return false;
    const currentCodes = String(f.value ?? '').split(';').map(c => c.trim()).filter(Boolean);
    return suggested.some(s => !currentCodes.includes(s.code));
  })) {
    actions.push('Cocokkan saran kode yang belum tercantum dengan isi berkas');
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
  const bukanIgd = parseAiReview(recordData)?.kegawatdaruratan_assessment?.kunjungan_igd === false;
  if (spo2Missing && !spo2NotInForm && !bukanIgd) {
    actions.push('Lengkapi/cek SpO2');
  }

  // Kode diagnosis/prosedur yang backend tandai perlu review (fix item 8/9:
  // lab rutin, konsistensi diagnosis O21.x, evidence tak terverifikasi) --
  // BUKAN error, tapi tetap perlu tindakan verifikator sebelum submit.
  // Butir "Cek kode ..." dihapus 21 Sep 2026 bersama status "Perlu Review".

  if (actions.length === 0) return null;

  return (
    <section aria-label="Langkah perbaikan" className="rounded-xl border border-blue-500/25 bg-blue-500/[0.04] p-4 sm:p-5">
      <h3 className="text-base font-semibold text-foreground">Langkah perbaikan</h3>
      <ol className="mt-3 grid gap-2 sm:grid-cols-2">
        {actions.map((action, index) => (
          <li key={`${index}-${action}`} className="flex min-w-0 items-start gap-3 rounded-lg border border-border/70 bg-card/70 px-3 py-3 text-sm leading-relaxed text-foreground">
            <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-xs font-bold text-blue-700 dark:text-blue-300">{index + 1}</span>
            <span className="min-w-0 break-words">{action}</span>
          </li>
        ))}
      </ol>
    </section>
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
      // Data Rawatan tidak ditampilkan (permintaan klien 1 Okt 2026), termasuk
      // di mode edit dan hitungan "perlu diperiksa". Validasi backend tetap jalan.
      if (category === 'Data Rawatan') return false;
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
        // Kolom yang sengaja dihapus dari fieldMap (mis. SEP/NOKARTU saat
        // has_bpjs_page=false) dilewati -- dulu menjadi undefined dan halaman
        // detail crash (YETY NOVIATI, 0170R0111225V003427).
        .filter((f): f is FieldRow => Boolean(f))
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
    <Button variant="outline" size="sm" onClick={() => setShowFullTable(v => !v)} className="min-h-10 px-4 text-sm">
      {showFullTable ? 'Lihat ringkasan' : 'Lihat tabel lengkap'}
    </Button>
  );

  return (
    <div className="space-y-4">
      {!onlyIssues && (
        <SummaryBanner tone={totalIssueFields === 0 ? 'success' : hasErrorField ? 'danger' : 'warning'} action={toggleButton}>
          <div className="flex items-start gap-3">
            {totalIssueFields === 0
              ? <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              : <AlertTriangle aria-hidden="true" className={cn('mt-0.5 size-5 shrink-0', hasErrorField ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400')} />}
            <div className="min-w-0 space-y-1">
              <p className="text-base font-semibold leading-snug text-foreground">
                {totalIssueFields === 0
                  ? `Semua ${totalRows} kolom data tidak bermasalah`
                  : `${totalIssueFields} dari ${totalRows} kolom perlu diperiksa`}
              </p>
              {totalIssueFields > 0 && <p className="text-sm leading-relaxed text-foreground/75">Bagian terkait: {issueCategories.map(category => category.category).join(', ')}.</p>}
            </div>
          </div>
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
        <div className="max-h-[560px] overflow-auto rounded-xl border border-border">
          <table className="w-full min-w-[800px] table-fixed border-collapse text-sm">
            <colgroup><col className="w-[20%]" /><col className="w-[29%]" /><col className="w-[16%]" /><col className="w-[35%]" /></colgroup>
            <thead className="sticky top-0 z-10 bg-muted">
              <tr className="border-b">
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Kolom</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Nilai</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Catatan / Saran</th>
              </tr>
            </thead>
            <tbody>
              {totalRows === 0 && onlyIssues ? (
                <tr>
                  <td colSpan={4} className="text-center py-6 text-muted-foreground">
                    <strong className="text-foreground">Tidak ada kolom yang perlu diperiksa.</strong> Matikan &ldquo;Hanya tampilkan masalah&rdquo; untuk melihat seluruh data klaim.
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
                        <td colSpan={4} className="bg-muted/60 px-4 py-3 text-sm font-semibold text-foreground">
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
      {(onlyIssues || showFullTable) && <InaCbgCoherenceDisplay recordData={recordData} />}
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
  // Tab di bagian Diagnosis & Prosedur: data berkas (tabel) atau Saran AI.
  const [tabDiagnosis, setTabDiagnosis] = useState<'berkas' | 'saran' | 'tarif'>('berkas');
  // Reset override expand/collapse saat pindah record (tidak pakai key-based
  // remount, lihat catatan di RecordFieldsTable) supaya kategori yang di-expand
  // manual utk record A tidak "bocor" ke record B.
  useEffect(() => {
    setExpandOverride({});
    setTabDiagnosis('berkas');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordData.id]);
  // Diagnosis & Prosedur selalu terbuka: keterangan kamus ICD-10/ICD-9-CM
  // per kode harus langsung terlihat, bukan hanya saat ada masalah.
  const isExpanded = (category: string) =>
    expandOverride[category] !== undefined
      ? expandOverride[category]
      : !!categoryHasIssue[category] || category === 'Diagnosis & Prosedur';
  const toggleCategory = (category: string) => setExpandOverride(prev => ({ ...prev, [category]: !isExpanded(category) }));

  let rowParity = 0;
  return (
    <div className="space-y-3">
      {categories.map(({ category, rows }) => {
        if (rows.length === 0) return null;
        const expanded = isExpanded(category);
        const issueCount = rows.filter(f => isIssueStatus(f.status)).length;
        const validCount = rows.length - issueCount;
        const kesiapan = category === 'Diagnosis & Prosedur' ? parseAiReview(recordData)?.kesiapan_koding : undefined;
        const risikoKoding = kesiapan?.status === 'berisiko_pending';
        return (
          <section key={category} className={cn('overflow-hidden rounded-xl border', risikoKoding ? 'border-red-500/40' : issueCount > 0 ? 'border-amber-500/30' : 'border-border')}>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => toggleCategory(category)}
              className={cn(
                'flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:text-base',
                issueCount > 0 ? 'bg-amber-500/[0.06]' : 'bg-muted/35'
              )}
            >
              <span className="flex min-w-0 items-center gap-2.5"><ChevronDown aria-hidden="true" className={cn('size-4 shrink-0 text-muted-foreground transition-transform', !expanded && '-rotate-90')} />{category}</span>
              <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold sm:text-sm', risikoKoding ? 'bg-red-500/15 text-red-800 dark:text-red-200' : issueCount > 0 ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300' : category === 'Diagnosis & Prosedur' ? 'bg-muted text-foreground/80' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400')}>
                {risikoKoding ? 'Berisiko pending' : issueCount > 0 ? `${issueCount} perlu diperiksa` : category === 'Diagnosis & Prosedur' ? 'Data kode' : `${validCount}/${rows.length} valid`}
              </span>
            </button>
            {expanded && category === 'Diagnosis & Prosedur' && (
              <Tabs value={tabDiagnosis} onValueChange={value => setTabDiagnosis(value as typeof tabDiagnosis)} className="gap-0 border-t border-border">
                <div className="border-b border-border bg-muted/10 px-4 py-3">
                  <TabsList aria-label="Tampilan diagnosis, prosedur, dan tarif" className="h-auto w-full flex-wrap justify-start gap-1 sm:w-fit">
                    <TabsTrigger value="berkas" className="min-h-10 px-3">Data klaim</TabsTrigger>
                    <TabsTrigger value="saran" className="min-h-10 px-3">Saran AI</TabsTrigger>
                    <TabsTrigger value="tarif" className="min-h-10 px-3">Tarif INA-CBG & iDRG</TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="berkas" className="space-y-3 p-4 sm:p-5">
                  <KodingReadinessNotice kesiapan={kesiapan} />
                  {editing && <p className="rounded-md bg-blue-500/10 px-3 py-2 text-sm text-blue-700 dark:text-blue-300">Pisahkan kode dengan titik koma (;). Perubahan tersimpan setelah menekan Simpan.</p>}
                  <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))]">
                  {rows.map(field => (
                    <table key={field.column_name} aria-label={getFieldLabel(field.column_name)} className="block w-full">
                      <tbody className="block">
                        <FieldRowTr field={field} editing={editing} editedValues={editedValues} onEdit={onEdit}
                          autofilledFrom={parseRawData(recordData)[`_autofill_${field.column_name}`]}
                          isHighlighted={!!highlightFields?.has(field.column_name)} isZebra={false}
                          rowRef={highlightFields?.has(field.column_name) ? highlightRowRef : undefined}
                          recordData={recordData} compact />
                      </tbody>
                    </table>
                  ))}
                  </div>
                </TabsContent>
                <TabsContent value="saran"><SaranKodingPanel recordId={recordData.id} /></TabsContent>
                <TabsContent value="tarif" className="p-4 sm:p-5">
                  <TarifGandaCard recordId={recordData.id} />
                  <div className="mt-4 border-t border-border pt-4">
                    <SaranKodingPanel recordId={recordData.id} mode="tarif" />
                  </div>
                  <section aria-label="Detail grouping data klaim" className="mt-4 border-t border-border pt-4">
                    <h4 className="text-sm font-medium">Detail grouping dan kesesuaian klinis data klaim</h4>
                    <div className="mt-3"><InaCbgCoherenceDisplay recordData={recordData} /></div>
                  </section>
                </TabsContent>
              </Tabs>
            )}
            {expanded && category !== 'Diagnosis & Prosedur' && (
              <div className="overflow-x-auto border-t border-border">
              <table className="w-full min-w-[800px] table-fixed border-collapse text-sm">
                <colgroup><col className="w-[20%]" /><col className="w-[29%]" /><col className="w-[16%]" /><col className="w-[35%]" /></colgroup>
                <thead className="bg-muted/25 text-xs font-semibold text-muted-foreground">
                  <tr className="border-b border-border"><th scope="col" className="px-4 py-2.5 text-left">Kolom</th><th scope="col" className="px-4 py-2.5 text-left">Nilai</th><th scope="col" className="px-4 py-2.5 text-left">Status</th><th scope="col" className="px-4 py-2.5 text-left">Catatan</th></tr>
                </thead>
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
              </div>
            )}
          </section>
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
// Label singkat utk mode ringkas Tabel 3 (mis. "K2 · Napas / sirkulasi") --
// istilah resmi lengkap (k.label dari backend) tetap ada via tooltip/title,
// tidak pernah dihilangkan, cuma tidak jadi teks utama supaya cepat dipindai.
const KRITERIA_SHORT_LABEL: Record<string, string> = {
  K1: 'Ancaman nyawa', K2: 'Napas / sirkulasi', K3: 'Kesadaran',
  K4: 'Hemodinamik', K5: 'Tindakan segera',
};

const VITAL_LABELS: Record<string, { label: string; unit: string }> = {
  GCS: { label: 'GCS Total', unit: 'poin' },
  Nyeri: { label: 'Skala Nyeri', unit: '0-10' },
  TD_sistolik: { label: 'TD Sistolik', unit: 'mmHg' },
  TD_diastolik: { label: 'TD Diastolik', unit: 'mmHg' },
  HR: { label: 'Nadi (HR)', unit: 'x/mnt' },
  RR: { label: 'Laju Napas (RR)', unit: 'x/mnt' },
  SpO2: { label: 'Saturasi O2 (SpO2)', unit: '%' },
  Suhu: { label: 'Suhu', unit: '°C' },
};

const AGE_GROUP_LABELS: Record<string, string> = {
  neonatus: 'Neonatus (0-28 hari)', bayi: 'Bayi (1-12 bulan)', toddler: 'Toddler (1-2 th)',
  prasekolah: 'Prasekolah (3-5 th)', usia_sekolah: 'Usia sekolah (6-11 th)', remaja: 'Remaja (12-15 th)',
  dewasa: 'Dewasa (16-64 th)', lansia: 'Lansia (>=65 th)',
};
const BAND_LABEL: Record<string, string> = { normal: 'Normal', borderline: 'Perlu ditinjau', gawat: 'Gawat' };
const BAND_COLOR: Record<string, CSSProperties> = {
  normal: { color: 'var(--muted-foreground)' },
  borderline: { color: 'var(--color-amber-600, #b45309)' },
  gawat: { color: 'var(--destructive)', fontWeight: 600 },
};

// Label tekanan darah dewasa/lansia mengikuti kategori yang sudah dipakai aplikasi.
// Kelompok anak tetap menampilkan status hasil aturan usia dari backend.
// Penjelasan angka nol dipakai untuk membedakan nilai tidak diukur dari hasil pemeriksaan.
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
function labelBand(key: string | undefined, nilai: string | number | null | undefined, band: string | null | undefined, ageGroup?: string | null): string {
  if (!band) return 'Belum dinilai';
  const grades = key ? TD_GRADE_ESH[key] : undefined;
  if (grades && (ageGroup === 'dewasa' || ageGroup === 'lansia') && band === 'borderline' && typeof nilai === 'number') {
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
  konjungtiva_anemis: 'Konjungtiva anemis tampak pada pemeriksaan mata dan perlu dicocokkan dengan dokumen klinis.',
  nyeri_tekan_epigastrium: 'Nyeri tekan epigastrium ditemukan saat pemeriksaan palpasi abdomen.',
  bising_usus: 'Bising usus dinilai abnormal jika tidak terdengar, meningkat, atau menurun sesuai catatan pemeriksaan.',
  timpani: 'Temuan timpani dinilai abnormal hanya jika dokumen menyebut konteks patologis, misalnya distensi.',
  kepala: 'Temuan abnormal kepala/wajah (mis. mukosa kering/pucat/ikterik, deformitas) bisa jadi tanda dehidrasi atau trauma.',
  leher: 'Pembesaran KGB/tiroid atau kaku kuduk menandakan temuan yang perlu ditindaklanjuti.',
  thorak: 'Thorak asimetris/ada jejas/retraksi/nyeri tekan menandakan kemungkinan trauma atau distres napas.',
  abdomen: 'Abdomen distensi/nyeri tekan/bising usus abnormal menandakan kemungkinan gangguan gastrointestinal.',
  ekstremitas: 'Kelainan bentuk/gerak/kelemahan ekstremitas menandakan temuan yang perlu ditindaklanjuti.',
};

// Urutan anatomi untuk ringkasan dan tabel rinci pemeriksaan fisik.
// Label di sini juga melengkapi assessment lama yang belum punya empat parameter baru.
const PEMERIKSAAN_KELOMPOK = [
  { nama: 'Kepala & leher', items: [
    ['kepala', 'Kepala/wajah (termasuk mukosa)'],
    ['konjungtiva_anemis', 'Konjungtiva anemis (CA)'],
    ['sianosis', 'Sianosis'],
    ['leher', 'Leher'],
    ['kesadaran_kualitatif', 'Kesadaran kualitatif'],
  ] },
  { nama: 'Thoraks & jantung', items: [
    ['thorak', 'Thoraks'],
    ['ronkhi', 'Ronkhi (Rh)'],
    ['wheezing', 'Wheezing (Wh)'],
    ['sdv', 'Suara napas dasar (SDV)'],
    ['retraksi', 'Retraksi dinding dada'],
    ['bunyi_jantung', 'Bunyi jantung (S1/S2, irama)'],
  ] },
  { nama: 'Abdomen', items: [
    ['abdomen', 'Abdomen'],
    ['nyeri_tekan_epigastrium', 'Nyeri tekan epigastrium'],
    ['bising_usus', 'Bising usus (BU)'],
    ['timpani', 'Perkusi timpani'],
  ] },
  { nama: 'Kaki & ekstremitas', items: [
    ['ekstremitas', 'Ekstremitas'],
    ['edema', 'Edema'],
    ['akral', 'Akral (hangat/dingin)'],
    ['crt', 'CRT (capillary refill time)'],
    ['deformitas_luka', 'Deformitas/luka'],
  ] },
  // Pemeriksaan khusus: hanya parameter yang tercatat yang tampil (status
  // neurologis, status lokalis bedah/kulit/ortopedi, obstetri/ginekologi).
  { nama: 'Pemeriksaan khusus', opsional: true, items: [
    ['status_neurologis', 'Status neurologis'],
    ['status_lokalis', 'Status lokalis'],
    ['obstetri_ginekologi', 'Status obstetri/ginekologi'],
  ] },
] as const;

type VitalRange = {
  normal?: [number, number];
  borderline?: [number, number] | [number, number][] | null;
  gawatUnder?: number;
  gawatOver?: number;
  catatan?: string;
};
type VitalReferences = Record<string, { unit: string } & Record<string, VitalRange | string>>;

function VitalRangeText({ references, parameter, ageGroup }: {
  references: VitalReferences | null; parameter: string; ageGroup: string | null;
}) {
  const table = references?.[parameter];
  const range = (table?._all || (ageGroup ? table?.[ageGroup] : undefined)) as VitalRange | undefined;
  if (!range) return <span className="text-muted-foreground">{!references ? 'Rentang belum tersedia' : !ageGroup ? 'Usia belum diketahui' : 'Rentang usia belum tersedia'}</span>;
  const interval = (r: [number, number]) => r[0] === r[1] ? String(r[0]) : `${r[0]}–${r[1]}`;
  const review = range.borderline
    ? (Array.isArray(range.borderline[0]) ? range.borderline as [number, number][] : [range.borderline as [number, number]]).map(interval).join(' atau ')
    : null;
  // Keep the strict operators used by backend lookupBand (do not invent inclusive limits).
  const urgent = [range.gawatUnder !== undefined ? `< ${range.gawatUnder}` : null, range.gawatOver !== undefined ? `> ${range.gawatOver}` : null].filter(Boolean).join(' atau ');
  return <div className="space-y-1 text-sm leading-relaxed">
    {range.normal && <p>Normal: <strong className="font-medium text-foreground">{interval(range.normal)} {table?.unit}</strong></p>}
    {review && <p>Perlu ditinjau: {review} {table?.unit}</p>}
    {urgent && <p>Gawat: {urgent} {table?.unit}</p>}
    {!review && range.normal && (range.gawatUnder === undefined || range.gawatUnder < range.normal[0] || range.gawatOver === undefined || range.gawatOver > range.normal[1]) && <p className="text-muted-foreground">Nilai di luar rentang normal yang belum melewati ambang gawat perlu ditinjau.</p>}
    {range.catatan && <details><summary className="cursor-pointer text-primary">Catatan rentang</summary><p className="mt-1">{range.catatan}</p></details>}
  </div>;
}

function QuoteCell({ kutipan, page_number, onOpenPdf }: {
  kutipan: string | null | undefined; page_number: number | null | undefined;
  onOpenPdf?: (page: number) => void;
}) {
  const longQuote = !!kutipan && kutipan.length > 160;
  return <div className="space-y-2 text-sm leading-relaxed" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
    {kutipan ? <>
      <p className="text-muted-foreground">&ldquo;{longQuote ? `${kutipan.slice(0, 160)}…` : kutipan}&rdquo;</p>
      {longQuote && <details><summary className="cursor-pointer text-primary">Kutipan lengkap</summary><p className="mt-2 text-foreground">{kutipan}</p></details>}
    </> : <p className="text-muted-foreground">Kutipan tidak tersedia.</p>}
    {page_number && Number.isInteger(page_number) && page_number > 0 ? (
      onOpenPdf ? <Button type="button" variant="outline" size="sm" className="h-auto min-h-9 whitespace-normal text-sm" onClick={() => onOpenPdf(page_number)}>
        <FileText className="size-4 shrink-0" /> Lihat halaman {page_number} PDF
      </Button> : <span className="text-muted-foreground">Halaman {page_number}</span>
    ) : null}
  </div>;
}

function EmergencyCriteriaList({ criteria, hasData, ageGroup, onOpenPdf }: {
  criteria: KegawatdaruratanKriteria[]; hasData?: boolean; ageGroup: string | null;
  onOpenPdf?: (page: number) => void;
}) {
  const fulfilled = criteria.filter(k => k.status === 'ya').length;
  return <section className="space-y-4" aria-label="Penilaian Kegawatdaruratan K1–K5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-base font-semibold text-foreground">Penilaian Kegawatdaruratan (K1–K5)</h3>
      <span className="rounded-full border border-border bg-muted/30 px-3 py-1 text-sm text-foreground">{fulfilled} dari {criteria.length} kriteria terpenuhi</span>
    </div>
    <p className="text-sm leading-relaxed text-muted-foreground">Buka setiap kriteria untuk melihat alasan dan bukti dari dokumen.</p>
    <div className="space-y-3">
      {[...criteria].sort((a, b) => a.kriteria.localeCompare(b.kriteria)).map(k => {
        // Missing evidence is not itself proof of an incomplete assessment.
        // has_data=false is the explicit backend signal that extraction failed/was unavailable.
        const insufficient = hasData === false && k.status !== 'ya';
        const label = insufficient ? 'Bukti belum cukup' : k.status === 'ya' ? 'Terpenuhi' : k.status === 'borderline' ? 'Perlu ditinjau' : 'Tidak terpenuhi';
        const attention = insufficient || k.status === 'borderline';
        const Icon = k.status === 'ya' || attention ? AlertTriangle : CheckCircle2;
        const color = k.status === 'ya' ? 'text-red-700 dark:text-red-400' : attention ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground';
        return <details key={k.kriteria} open={k.status === 'ya'} className="group rounded-xl border border-border bg-card">
          <summary className="flex min-h-16 cursor-pointer list-none flex-wrap items-center gap-3 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            <Icon className={cn('size-5 shrink-0', color)} />
            <span className="min-w-0 flex-1 text-base font-semibold text-foreground">{k.kriteria} · {KRITERIA_SHORT_LABEL[k.kriteria] || k.label}</span>
            <span className={cn('rounded-full border px-3 py-1 text-sm font-medium', color, k.status === 'ya' ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30' : attention ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30' : 'border-border bg-muted/30')}>{label}</span>
            <span className="flex items-center gap-1 text-sm text-primary"><span className="group-open:hidden">Lihat bukti</span><span className="hidden group-open:inline">Tutup bukti</span><ChevronDown className="size-4 transition-transform group-open:rotate-180" /></span>
          </summary>
          <div className="space-y-4 border-t border-border p-4 text-sm leading-relaxed">
            <p className="text-foreground">{k.label}</p>
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="mb-1 font-semibold text-foreground">Alasan penilaian</p>
              <p className="text-muted-foreground">{insufficient ? 'Pembacaan dokumen belum menghasilkan data yang cukup. Gunakan Baca Ulang untuk memperbarui penilaian.' : k.catatan || 'Tidak ada catatan tambahan dari hasil penilaian.'}</p>
            </div>
            <div className="space-y-3">
              <p className="font-semibold text-foreground">Bukti pendukung</p>
              {k.evidence.length === 0 ? <p className="text-muted-foreground">Belum ada kutipan bukti terlampir pada kriteria ini.</p> : k.evidence.map((e, i) => (
                <div key={i} className="rounded-lg border border-border p-3">
                  <p className="mb-2 font-medium text-foreground">{e.sumber === 'proclist' ? `Kode ${e.kode} · ${e.deskripsi}` : e.sumber === 'esi' ? `ESI: ${e.skor} · sinyal pendukung` : `${e.label || (e.key ? VITAL_LABELS[e.key]?.label || e.key : 'Kutipan dokumen')}${e.nilai !== undefined ? `: ${e.nilai}` : ''}${e.band ? ` · ${labelBand(e.key, e.nilai, e.band, ageGroup)}` : ''}`}</p>
                  {(e.kutipan || e.page_number) && <QuoteCell kutipan={e.kutipan} page_number={e.page_number} onOpenPdf={onOpenPdf} />}
                </div>
              ))}
            </div>
          </div>
        </details>;
      })}
    </div>
  </section>;
}

function KegawatdaruratanTable({ recordData, onOpenPdf }: { recordData: Record<string, any>; onOpenPdf?: (page: number) => void }) {
  // WAJIB dipanggil SEBELUM early-return di bawah (Rules of Hooks) -- record
  // yang sama (key={record.id} tidak berubah) bisa transisi dari "belum ada
  // assessment" ke "assessment valid" lewat "Baca Ulang" TANPA remount, jadi
  // early-return-nya sendiri bisa berubah antar-render utk instance yang
  // sama; kalau useState dipanggil SETELAH early return, urutan hook call
  // bisa beda antar-render utk record yang sama -> React error.
  const [showFullDetail, setShowFullDetail] = useState(false);
  const [tampilkanGawat, setTampilkanGawat] = useState(false);
  const [references, setReferences] = useState<VitalReferences | null>(null);
  const [referenceError, setReferenceError] = useState(false);
  const [referenceAttempt, setReferenceAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    api.getVitalReferences().then(data => {
      if (!cancelled) { setReferences(data.thresholds); setReferenceError(false); }
    }).catch(() => { if (!cancelled) setReferenceError(true); });
    return () => { cancelled = true; };
  }, [referenceAttempt]);


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
  // showFullDetail dideklarasikan di atas (sebelum early return) agar urutan
  // hook tetap sama saat assessment berubah setelah Baca Ulang.
  const parameterByKey = new Map(parameter_findings.map(p => [p.key, p]));
  const groupedParams = PEMERIKSAAN_KELOMPOK.filter(group => !('opsional' in group)
    || group.items.some(([key]) => parameter_findings.some(p => p.key === key && p.ditemukan))).map(group => ({
    nama: group.nama,
    params: group.items.map(([key, label]) => {
      const finding = parameterByKey.get(key);
      return finding
        ? { ...finding, label, perluBacaUlang: false }
        : { key, label, ditemukan: false, status: null, nilai: null, page_number: null, kutipan: null, sumber_dokumen: null, retraksi_grade: null, perluBacaUlang: true };
    }).filter(p => !('opsional' in group) || p.ditemukan),
  }));
  const documentedParams = parameter_findings.filter(p => p.ditemukan);
  const abnormalParams = documentedParams.filter(p => p.status === 'abnormal');
  const belumDiekstrak = groupedParams.flatMap(group => group.params).filter(p => p.perluBacaUlang).length;

  const vitalEntries = Object.entries(VITAL_LABELS).map(([key, meta]) => {
    const vf = vital_findings?.[key];
    const isEmpty = vf?.nilai === null || vf?.nilai === undefined;
    return { key, meta, vf, isEmpty, tercatatNol: !!vf?.tercatat_nol, level: (isEmpty || !vf?.band ? 'missing' : vf.band) as 'normal' | 'borderline' | 'gawat' | 'missing' };
  });
  const vitalPresentCount = vitalEntries.filter(v => !v.isEmpty).length;
  const vitalGawatCount = vitalEntries.filter(v => v.level === 'gawat').length;
  const vitalBorderlineCount = vitalEntries.filter(v => v.level === 'borderline').length;
  // SpO2 tidak tercatat = parameter kunci gangguan pernapasan, paling langsung
  // dicek verifikator BPJS. FIX ITEM 4 (19 Sep 2026): HANYA tampilkan warning
  // kalau kolom SpO2 ADA di form Triase IGD tapi kosong (empty_on_form) --
  // BUKAN kalau form-nya memang tidak punya kolom SpO2 sama sekali
  // (not_in_form, lihat form_status tri-state) -- reused oleh ActionChecklist
  // (lihat RecordFieldsTable) dari sumber yang sama.
  const spo2Entry = vitalEntries.find(v => v.key === 'SpO2');
  const spo2Missing = !!spo2Entry?.isEmpty && spo2Entry?.vf?.form_status !== 'not_in_form';

  // Bukan kunjungan IGD (data lama tanpa penanda tetap dianggap IGD): tanda
  // vital & K1-K5 bukan fokus klaim ini, disembunyikan sampai diminta.
  const fokusGawat = assessment.kunjungan_igd !== false;
  const criteriaPanel = <EmergencyCriteriaList criteria={kriteria} hasData={assessment.has_data} ageGroup={age_group} onOpenPdf={onOpenPdf} />;
  const referenceNotice = referenceError
    ? <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-amber-700 dark:text-amber-400">Rentang usia belum dapat dimuat.<Button variant="outline" size="sm" onClick={() => setReferenceAttempt(n => n + 1)}>Coba lagi</Button></div>
    : <p className="mb-3 text-sm text-muted-foreground">Rentang aturan aplikasi untuk {age_group ? AGE_GROUP_LABELS[age_group] || age_group : 'usia yang belum diketahui'}.</p>;

  const toggleButton = (
    <Button variant="outline" size="sm" onClick={() => setShowFullDetail(v => !v)} className="min-h-9 shrink-0 text-sm">
      {showFullDetail ? '▴ Ringkasan' : 'Detail →'}
    </Button>
  );

  return (
    <div className="mt-6 rounded-xl bg-card border border-border shadow-sm overflow-hidden dark:border-border">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-surface-container via-surface to-surface-container-low px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/15 text-emerald-400 flex items-center justify-center">
            </div>
            <div>
              <h2 className="text-sm text-foreground font-semibold">{fokusGawat ? 'Kegawatdaruratan' : 'Pemeriksaan fisik'}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {fokusGawat && <Badge
              variant="outline"
              className={cn(
                'text-sm font-label-sm px-2.5 py-1.5',
                yaCount > 0 ? 'border-red-900/50 bg-red-950/40 text-red-400 dark:text-red-400'
                  : borderlineCount > 0 ? 'border-amber-900/50 bg-amber-950/40 text-amber-500 dark:text-amber-500'
                    : 'border-primary/40 bg-emerald-900/30 text-emerald-400 dark:text-emerald-400'
              )}
            >
              {yaCount} kriteria terpenuhi
            </Badge>}
            {toggleButton}
          </div>
        </div>
      </div>

      {/* Ringkasan Section */}
      <div className="px-6 py-4 bg-white/[0.02] border-b border-border">
        <p className="text-sm text-muted-foreground font-medium leading-relaxed">{ringkasan}</p>
      </div>

      {!showFullDetail ? (
        <div className="px-6 py-6 space-y-8">

          {/* ── Section 1: Parameter Pemeriksaan Fisik ── */}
          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-emerald-900/40 text-emerald-400 flex items-center justify-center text-sm font-bold">1</div>
                <h3 className="text-sm text-foreground font-semibold">Parameter Pemeriksaan Fisik</h3>
              </div>
              <span className={cn(
                'text-sm font-medium px-2.5 py-1 rounded-full border',
                abnormalParams.length > 0
                  ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-900/50 dark:text-red-400'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800/50 dark:text-emerald-400'
              )}>
                {documentedParams.length} parameter tercatat
                {abnormalParams.length > 0 ? ` · ${abnormalParams.length} abnormal` : ''}
              </span>
            </div>

            {belumDiekstrak > 0 && (
              <p className="mb-3 text-sm text-amber-700 dark:text-amber-400">
                {belumDiekstrak} parameter baru perlu Baca Ulang agar hasilnya dapat diambil dari PDF.
              </p>
            )}
            <div className="space-y-4">
              {groupedParams.map(group => {
                const missing = group.params.filter(p => !p.ditemukan);
                const foundCount = group.params.length - missing.length;
                return (
                  <section key={group.nama} className="rounded-lg border border-border bg-muted/20 p-3 dark:border-border dark:bg-white/[0.015]">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-foreground">{group.nama}</h4>
                      <span className="text-sm text-muted-foreground">{foundCount}/{group.params.length} tercatat</span>
                    </div>
                    <div className="flex flex-col gap-2">
                {group.params.filter(p => p.ditemukan).map(p => {
                  const paramCard = (
                    <div
                      className={cn(
                        'flex flex-wrap items-center justify-between gap-2 py-2 px-3 rounded border',
                        p.status === 'abnormal'
                          ? 'border-red-200 bg-red-50 cursor-pointer hover:bg-red-100 transition-colors dark:border-red-900/30 dark:bg-red-950/20 dark:hover:bg-red-950/30'
                          : 'border-border bg-card dark:border-border dark:bg-white/[0.02]'
                      )}
                    >
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          {p.status === 'abnormal'
                            ? <XCircle className="size-3.5 text-red-600 dark:text-red-400 shrink-0" />
                            : <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                          <span className={cn(
                            'font-medium text-sm',
                            p.status === 'abnormal' ? 'text-red-700 dark:text-red-400' : 'text-foreground'
                          )}>
                            {p.label}
                          </span>
                          {p.sumber_dokumen === 'resume_medis' && (
                            <span className="text-sm text-muted-foreground ml-1">(Resume Medis)</span>
                          )}
                          {p.retraksi_grade && (
                            <span className="text-sm text-red-400">({p.retraksi_grade})</span>
                          )}
                        </div>
                        {p.kutipan && <QuoteCell kutipan={p.kutipan} page_number={p.page_number} onOpenPdf={onOpenPdf} />}
                      </div>
                      <span className={cn(
                        'max-w-full break-words rounded-lg px-2 py-0.5 text-sm font-semibold',
                        p.status === 'abnormal'
                          ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/60 dark:text-red-400 dark:border-red-900/50'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50'
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
                        <DialogContent className="sm:max-w-md bg-card border-border text-foreground">
                          <DialogHeader>
                            <DialogTitle className="text-red-400">Parameter Abnormal: {p.label}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-2">
                            <ul className="space-y-3 list-none">
                              <li className="flex flex-col gap-1">
                                <span className="text-sm font-semibold text-muted-foreground">Temuan Tercatat:</span>
                                <span className="text-sm text-foreground">{p.nilai || 'tercatat abnormal di dokumen'}</span>
                              </li>
                              {p.kutipan && (
                                <li className="flex flex-col gap-1">
                                  <span className="text-sm font-semibold text-muted-foreground">Kutipan Dokumen:</span>
                                  <span className="text-sm italic text-muted-foreground">&ldquo;{p.kutipan}&rdquo;{p.page_number ? ` (hal. ${p.page_number})` : ''}</span>
                                </li>
                              )}
                              <li className="flex flex-col gap-1">
                                <span className="text-sm font-semibold text-muted-foreground">Kenapa Abnormal?</span>
                                <span className="text-sm text-muted-foreground">
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
                    {missing.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {missing.map(p => (
                          <span key={p.key} className="rounded-full border border-border bg-card px-2.5 py-1 text-sm text-muted-foreground dark:border-border dark:bg-white/[0.02]">
                            {p.label} · {p.perluBacaUlang ? 'Perlu Baca Ulang' : 'tidak tercatat'}
                          </span>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </div>

          {/* Pemeriksaan penunjang tepat di bawah pemeriksaan fisik/khusus --
              tampil untuk semua kasus, IGD maupun bukan. */}
          <PemeriksaanPenunjangPanel recordId={recordData.id} onOpenPdf={onOpenPdf} tertanam />

          {!fokusGawat && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-sm text-muted-foreground">Bukan kunjungan IGD. Tanda vital dan kriteria kegawatdaruratan (K1–K5) bukan fokus penilaian klaim ini.</p>
              <Button variant="outline" size="sm" className="min-h-9 shrink-0" aria-expanded={tampilkanGawat} onClick={() => setTampilkanGawat(v => !v)}>
                {tampilkanGawat ? 'Sembunyikan' : 'Tampilkan'}
              </Button>
            </div>
          )}

          {(fokusGawat || tampilkanGawat) && <>
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-foreground">Nilai Vital &amp; Rentang Usia</h3>
              <span className="text-sm text-muted-foreground">{vitalPresentCount}/{vitalEntries.length} tercatat{vitalGawatCount > 0 ? ` · ${vitalGawatCount} gawat` : ''}{vitalBorderlineCount > 0 ? ` · ${vitalBorderlineCount} perlu ditinjau` : ''}</span>
            </div>
            {referenceNotice}
            {spo2Missing && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">SpO₂ belum tersedia. Periksa hasil pengukuran pada dokumen.</p>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {vitalEntries.map(({ key, meta, vf, isEmpty, tercatatNol, level }) => (
                <div key={key} className={cn('min-w-0 rounded-xl border bg-card p-4', level === 'gawat' ? 'border-red-300 dark:border-red-900' : level === 'borderline' ? 'border-amber-300 dark:border-amber-900' : 'border-border')}>
                  <p className="text-sm font-medium text-muted-foreground">{meta.label}</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{isEmpty ? '—' : vf!.nilai}<span className="ml-2 text-sm font-normal text-muted-foreground">{!isEmpty ? meta.unit : ''}</span></p>
                  <p className={cn('mt-2 flex items-center gap-1.5 text-sm font-medium', level === 'gawat' ? 'text-red-700 dark:text-red-400' : level === 'borderline' ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}>
                    {isEmpty || !vf?.band ? <FileText className="size-4" /> : level === 'gawat' || level === 'borderline' ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}
                    {isEmpty ? tercatatNol ? key === 'GCS' ? 'Nilai tidak sah' : 'Tidak diukur' : 'Belum tercatat' : labelBand(key, vf?.nilai, vf?.band, age_group)}
                  </p>
                  {tercatatNol && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{key === 'GCS' ? 'Nilai di dokumen tidak sah untuk GCS.' : 'Dokumen mencatat 0; nilai tidak dipakai untuk penilaian.'}</p>}
                  <details className="mt-3 border-t border-border pt-3">
                    <summary className="cursor-pointer text-sm font-medium text-primary">Rentang &amp; bukti</summary>
                    <div className="mt-3 space-y-3">
                      <VitalRangeText references={references} parameter={key} ageGroup={age_group} />
                      {key === 'Nyeri' && isEmpty && <p className="text-sm text-muted-foreground">Tanda lingkaran atau centang pada skala nyeri mungkin belum terbaca. Periksa PDF asli.</p>}
                      {vf?.instrumen_diharapkan && <p className="text-sm text-muted-foreground">Instrumen: {vf.instrumen_diharapkan}</p>}
                      <QuoteCell kutipan={vf?.kutipan} page_number={vf?.page_number} onOpenPdf={onOpenPdf} />
                    </div>
                  </details>
                </div>
              ))}
            </div>
          </section>

          {criteriaPanel}
          </>}

        </div>
      ) : (
        <>
          {/* Tabel 1: Parameter pemeriksaan fisik */}
          <div className="px-6 py-4 border-b border-border">
            <div className="mb-4 flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-emerald-900/40 text-emerald-400 flex items-center justify-center text-sm font-bold">1</div>
              <h3 className="text-sm text-foreground font-semibold">Parameter Pemeriksaan Fisik</h3>
            </div>
            <div className="rounded-xl border border-border overflow-hidden overflow-x-auto dark:border-border">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-white/[0.02] border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium font-semibold text-muted-foreground uppercase tracking-wider">Parameter</th>
                    <th className="text-left px-4 py-3 text-sm font-medium font-semibold text-muted-foreground uppercase tracking-wider w-[100px]">Status</th>
                    <th className="text-left px-4 py-3 text-sm font-medium font-semibold text-muted-foreground uppercase tracking-wider">Kutipan Dokumen</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedParams.map(group => (
                    <Fragment key={group.nama}>
                      <tr className="bg-white/[0.06] border-b border-border">
                        <th colSpan={3} scope="rowgroup" className="px-4 py-2.5 text-left text-sm font-semibold text-emerald-400">{group.nama}</th>
                      </tr>
                      {group.params.map((p, idx) => (
                    <tr key={p.key} className={cn('border-b last:border-0 align-top', idx % 2 === 1 && 'bg-white/[0.02]')}>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{p.label}</td>
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
                            <DialogContent className="sm:max-w-md bg-card border-border text-foreground">
                              <DialogHeader>
                                <DialogTitle className="text-red-400">Parameter Abnormal: {p.label}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4 py-2">
                                <ul className="space-y-3 list-none">
                                  <li className="flex flex-col gap-1">
                                    <span className="text-sm font-semibold text-muted-foreground">Temuan Tercatat:</span>
                                    <span className="text-sm text-foreground">{p.nilai || 'tercatat abnormal di dokumen'}</span>
                                  </li>
                                  {p.kutipan && (
                                    <li className="flex flex-col gap-1">
                                      <span className="text-sm font-semibold text-muted-foreground">Kutipan Dokumen:</span>
                                      <span className="text-sm italic text-muted-foreground">&ldquo;{p.kutipan}&rdquo;{p.page_number ? ` (hal. ${p.page_number})` : ''}</span>
                                    </li>
                                  )}
                                  <li className="flex flex-col gap-1">
                                    <span className="text-sm font-semibold text-muted-foreground">Kenapa Abnormal?</span>
                                    <span className="text-sm text-muted-foreground">
                                      {PARAMETER_ABNORMAL_INFO[p.key] || 'Temuan ini tercatat abnormal dan menjadi salah satu parameter yang diperiksa pada penilaian kegawatdaruratan.'}
                                      {p.retraksi_grade ? <span className="block mt-1">Grade retraksi: <strong className="text-red-400">{p.retraksi_grade}</strong> — retraksi interkostal menandakan distres napas lebih berat dibanding subkostal.</span> : null}
                                    </span>
                                  </li>
                                </ul>
                              </div>
                            </DialogContent>
                          </Dialog>
                        ) : p.status === 'normal' ? 'Normal' : p.perluBacaUlang ? 'Perlu Baca Ulang' : 'Tidak tercatat'}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground space-y-1">
                        {p.perluBacaUlang
                          ? <span className="italic">Belum diekstrak dari PDF. Klik Baca Ulang untuk memperbarui.</span>
                          : <QuoteCell kutipan={p.kutipan} page_number={p.page_number} onOpenPdf={onOpenPdf} />}
                        {p.nilai ? <span className="block text-sm">Nilai: {p.nilai}</span> : null}
                        {p.sumber_dokumen === 'resume_medis' ? (
                          <span
                            className="inline-block rounded border border-amber-900/50 px-2 py-0.5 text-sm text-amber-500 dark:text-amber-500 bg-amber-950/40"
                            title="Tidak tercatat di formulir Triase IGD — ditampilkan dari Resume Medis Rawat Inap sebagai konteks tambahan. Tidak ikut menentukan Ya/Tidak/Borderline pada Tabel 3 (K1-K5 tetap dihitung khusus dari Triase IGD saja)."
                          >
                            Resume Medis
                          </span>
                        ) : null}
                        {p.retraksi_grade ? (
                          <span
                            className="inline-block rounded border border-red-900/50 px-2 py-0.5 text-sm text-red-400 dark:text-red-400 bg-red-950/40 ml-1"
                            title="Retraksi interkostal menandakan distres napas lebih berat dibanding subkostal (PNPK Tatalaksana Pneumonia pada Anak IDAI)"
                          >
                            {p.retraksi_grade}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tabel 2: Nilai vital + ambang batas (referensi dewasa + hasil per-record) */}
          <div className="px-6 py-4 border-b border-border">
            <div className="mb-4 flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-emerald-900/40 text-emerald-400 flex items-center justify-center text-sm font-bold">2</div>
              <h3 className="text-sm text-foreground font-semibold">
                Nilai Vital &amp; Rentang Usia
                {age_group ? <span className="ml-2 font-normal text-muted-foreground text-sm">(Usia: {AGE_GROUP_LABELS[age_group] || age_group})</span> : null}
              </h3>
            </div>
            <div className="rounded-xl border border-border overflow-hidden overflow-x-auto dark:border-border">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-white/[0.02] border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium font-semibold text-muted-foreground uppercase tracking-wider">Parameter</th>
                    <th className="text-left px-4 py-3 text-sm font-medium font-semibold text-muted-foreground uppercase tracking-wider w-[90px]">Nilai</th>
                    <th className="text-left px-4 py-3 text-sm font-medium font-semibold text-muted-foreground uppercase tracking-wider w-[100px]">Penilaian</th>
                    <th className="text-left px-4 py-3 text-sm font-medium font-semibold text-muted-foreground uppercase tracking-wider">Rentang sesuai usia</th>
                    <th className="text-left px-4 py-3 text-sm font-medium font-semibold text-muted-foreground uppercase tracking-wider">Dokumen</th>
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
                        <td className="px-4 py-3 text-sm font-medium text-foreground">{meta.label}</td>
                        <td className="px-4 py-3 text-sm font-mono">{!isEmpty ? `${vf.nilai} ${meta.unit}` : <span className="italic text-muted-foreground" title={nyeriCaveat}>{nyeriCaveat ? '—' : '—'}</span>}</td>
                        <td className="px-4 py-3 text-sm font-medium" style={vf?.band ? BAND_COLOR[vf.band] : { color: 'var(--on-surface-variant)' }}>
                          {vf?.tercatat_nol ? key === 'GCS' ? 'Nilai tidak sah' : 'Tidak diukur' : isEmpty ? 'Belum tercatat' : labelBand(key, vf?.nilai, vf?.band, age_group)}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground"><VitalRangeText references={references} parameter={key} ageGroup={age_group} /></td>
                        <td className="px-4 py-3 text-sm text-muted-foreground space-y-1">
                          {nyeriCaveat && <p className="text-sm text-muted-foreground">Tanda pada skala nyeri mungkin belum terbaca. Periksa PDF asli.</p>}
                          <QuoteCell kutipan={vf?.kutipan} page_number={vf?.page_number} onOpenPdf={onOpenPdf} />
                          {instrumenDiharapkan && <p className="text-sm text-muted-foreground">Instrumen: {instrumenDiharapkan}</p>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {referenceNotice}
          </div>

          <div className="px-4 py-6 sm:px-6">{criteriaPanel}</div>
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
  const [evidencePdfPage, setEvidencePdfPage] = useState<number | null>(null);
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
    // Prosesnya berat (OCR + beberapa panggilan AI berurutan) dan bisa makan
    // beberapa menit -- tanpa pesan ini orang mengira tombolnya macet dan
    // mengulang klik atau menutup halaman di tengah proses.
    addToast('Membaca ulang berkas — proses OCR dan AI bisa makan beberapa menit, mohon tunggu...', 'info', 6000);
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
  const dataMentahTerpilih = selectedRecord ? parseRawData(selectedRecord) : {};
  const prosedurKosong = selectedRecord
    ? [dataMentahTerpilih.PROCLIST, selectedRecord.PROCLIST, selectedRecord.prosedur_list]
        .every(nilai => !String(nilai ?? '').trim())
    : false;

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
                    <div className="text-sm text-muted-foreground">
                      MRN: <span className="font-mono-data">{selectedRecord.mrn || '-'}</span> · Status:
                      <span className="ml-1"><RecordStatusBadge status={selectedRecord.validation_status} /></span>
                      {parseRawData(selectedRecord).JENIS_KUNJUNGAN_SEP && (
                        <span className="ml-1.5">· Jenis Kunjungan: {parseRawData(selectedRecord).JENIS_KUNJUNGAN_SEP}</span>
                      )}
                    </div>
                  </div>

                  {/* Masalah validasi saat ini ditampilkan lebih dulu agar status klaim
                      tidak tertutup oleh ringkasan risiko yang tersimpan sebelumnya. */}
                  {(selectedRecord.errors?.length ?? 0) > 0 && (() => {
                    const fieldNotes = parseAiReview(selectedRecord)?.field_notes;
                    return (
                      <section aria-label="Masalah validasi data" className="rounded-lg border border-amber-600/25 bg-amber-50 p-4 dark:border-amber-500/40 dark:bg-amber-500/10 sm:p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
                            <div>
                              <h4 className="font-display text-base font-semibold text-amber-900 dark:text-amber-300">Perlu perbaikan data</h4>
                              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-foreground/85">
                                Ditemukan oleh pemeriksaan aturan aplikasi. Periksa data dan dokumen asli sebelum klaim dikirim.
                              </p>
                            </div>
                          </div>
                          <span className="rounded-full border border-amber-600/25 bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                            {selectedRecord.errors.length} masalah
                          </span>
                        </div>
                        <div className="mt-4 divide-y divide-amber-500/20 border-t border-amber-500/20">
                          {selectedRecord.errors.map((err, i) => {
                            const points = toBulletPoints(fieldNotes?.[err.field_name] || err.error_message);
                            return (
                              <div key={`${err.rule_id}-${i}`} className="py-3 last:pb-0">
                                <p className="text-sm font-semibold text-foreground">{getFieldLabel(err.field_name)}</p>
                                <ul className="mt-1.5 max-w-3xl list-disc space-y-1 break-words pl-5 text-sm leading-relaxed text-foreground/85">
                                  {(points.length ? points : ['Periksa kembali nilai pada kolom ini.']).map((point, j) => <li key={j}>{point}</li>)}
                                </ul>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })()}

                  {parseAiReview(selectedRecord)?.penjaminan && <p className="rounded-md border border-border bg-muted/30 px-4 py-3 text-sm text-foreground"><strong>Penjamin BPJS · SEP tersedia.</strong> Label UMUM pada resume tidak menjadi alasan pending.</p>}
                  <RingkasanTemuanCard
                    putusan={parseAiReview(selectedRecord)?.putusan_pending}
                    tindakan={parseAiReview(selectedRecord)?.temuan_tindakan}
                    validationStatus={selectedRecord.validation_status}
                    prosedurKosong={prosedurKosong}
                    currentValidationIssues={selectedRecord.errors?.length ?? 0}
                  />
                  <AnalisisKritisCard
                    analisis={parseAiReview(selectedRecord)?.analisis_kritis}
                    onOpenPdf={String(fileInfo.file_name || '').toLowerCase().endsWith('.pdf') ? setEvidencePdfPage : undefined}
                  />
                  {selectedRecord.id && (
                    <AgenCasemixPanel
                      recordId={String(selectedRecord.id)}
                      onOpenPdf={String(fileInfo.file_name || '').toLowerCase().endsWith('.pdf') ? setEvidencePdfPage : undefined}
                    />
                  )}

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
                  <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                    <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm text-foreground hover:bg-muted/50">
                      <input type="checkbox" className="size-4 accent-primary" checked={onlyIssues} onChange={e => setOnlyIssues(e.target.checked)} />
                      Hanya tampilkan masalah
                    </label>
                    {SHOW_RV20 && selectedRecord.errors?.some(e => e.rule_id === 'RV-20') && (
                      <Button variant="outline" size="sm" className="min-h-10 px-3 text-sm" onClick={() => setSuratKlarifikasiOpen(true)}>
                        Buat Surat Klarifikasi
                      </Button>
                    )}
                    {/* Selalu tampil.
                        Sebelumnya tombol ini hanya muncul kalau error_count > 0
                        atau hasil AI belum ada. Akibatnya pada klaim berstatus
                        VALID dengan kolom kosong — persis keadaan yang paling
                        butuh baca ulang — tombolnya justru hilang. Halaman
                        menulis "1 masalah, wajib dicek" sambil menyembunyikan
                        satu-satunya alat untuk memperbaikinya, karena hitungan
                        masalah di tabel tidak sama dengan error_count dari rule
                        engine.
                        Menampilkannya selalu aman: perubahan manual yang belum
                        disimpan sudah dijaga dialog konfirmasi di handleReread. */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-10 px-3 text-sm"
                      disabled={isRereading}
                      onClick={handleReread}
                      title="Ekstraksi ulang dari PDF asli — dipakai kalau ada field kosong/error yang dicurigai sebenarnya ada di dokumen, atau kalau AI review gagal dibuat"
                    >
                      {isRereading ? 'Membaca ulang...' : 'Baca Ulang'}
                    </Button>
                    {!isEditing ? (
                      <Button variant="secondary" size="sm" className="min-h-10 px-3 text-sm" onClick={() => setIsEditing(true)}>Edit data</Button>
                    ) : (
                      <>
                        <Button variant="secondary" size="sm" className="min-h-10 px-3 text-sm" onClick={() => { setIsEditing(false); setEditedValues({}); }}>Batal</Button>
                        <Button
                          size="sm"
                          className="min-h-10 px-3 text-sm"
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
              <Card className="gap-5 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-foreground sm:text-xl">Data klaim</h2>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Periksa kolom yang perlu ditindaklanjuti dan cocokkan dengan dokumen asli.</p>
                  </div>
                  {String(fileInfo.file_name || '').toLowerCase().endsWith('.pdf') && (
                    <Button variant="outline" size="sm" className="min-h-10 px-3 text-sm" onClick={() => setShowPdf(v => !v)}>
                      <FileText aria-hidden="true" className="size-4" />
                      {showPdf ? 'Sembunyikan PDF' : 'Lihat PDF asli'}
                    </Button>
                  )}
                </div>

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

                {/* ─── Tabel data klaim, INA-CBG, dan kegawatdaruratan ─── */}
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
                          className={cn('min-w-0', maximizeData ? 'order-1' : 'order-2 xl:order-1')}
                          style={{
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
                        <div className={cn('min-w-0', maximizeData ? 'order-2' : 'order-1 xl:order-2')}>
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
                    <KegawatdaruratanTable key={`kegawatdaruratan-${selectedRecord.id}`} recordData={selectedRecord} onOpenPdf={String(fileInfo.file_name || '').toLowerCase().endsWith('.pdf') ? setEvidencePdfPage : undefined} />
                  );

                  return (
                    <>
                      {fieldsTable}
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

      <Dialog open={evidencePdfPage !== null} onOpenChange={open => { if (!open) setEvidencePdfPage(null); }}>
        <DialogContent className="w-[96vw] max-w-none sm:max-w-5xl">
          <DialogHeader><DialogTitle>Bukti dokumen</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Bukti yang dipilih ada di halaman {evidencePdfPage}. Tutup dokumen untuk kembali ke hasil pemeriksaan.</p>
          {evidencePdfPage !== null && fileInfo && <ErrorBoundary key={`${fileId}-${evidencePdfPage}`}>
            <PdfViewer fileId={fileId} fileName={fileInfo.file_name} initialPage={evidencePdfPage} singlePage height="70vh" />
          </ErrorBoundary>}
        </DialogContent>
      </Dialog>

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
