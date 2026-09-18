// Mirror TypeScript dari `fieldTypeRegistry.js` di repo backend
// (eclaim-pro-be/src/services/fieldTypeRegistry.js) — DUA repo terpisah,
// TIDAK ada mekanisme sync otomatis, jadi kalau registry backend diubah,
// file ini WAJIB diupdate manual biar tidak divergen. Dipakai buildFieldMap()
// di page.tsx untuk badge status field yang lebih akurat dari sekadar
// "Valid untuk semua field yang tidak kosong":
//
// - salin        : disalin apa adanya dari dokumen. Kosong = OCR/ekstraksi bermasalah.
// - turunan      : dihitung dari field lain. Kosong = bug perhitungan.
// - konfigurasi  : dari Profil RS, sama untuk semua klaim. Tidak pernah dari dokumen.
// - koding       : kalimat klinis -> kode ICD/prosedur. Wajib persetujuan koder + kutipan.
// - fakta_nol    : nilainya memang 0, itu informasi valid -- beda dari kosong.
// - wajar_kosong : memang tidak berlaku untuk klaim jenis ini.

export type FieldJenis = 'salin' | 'turunan' | 'konfigurasi' | 'koding' | 'fakta_nol' | 'wajar_kosong';

export interface FieldTypeEntry {
  jenis: FieldJenis | null;
  catatan?: string;
  perlu_konfirmasi?: boolean;
}

export const FIELD_TYPE_REGISTRY: Record<string, FieldTypeEntry> = {
  NAMA_PASIEN: { jenis: 'salin' },
  MRN: { jenis: 'salin' },
  BIRTH_DATE: { jenis: 'salin' },
  SEP: { jenis: 'salin' },
  NOKARTU: { jenis: 'salin' },
  DPJP: { jenis: 'salin' },
  ADMISSION_DATE: { jenis: 'salin' },

  SEX: { jenis: 'turunan' },
  KELAS_RAWAT: { jenis: 'turunan' },
  UMUR_TAHUN: { jenis: 'turunan' },
  UMUR_HARI: { jenis: 'turunan' },
  DISCHARGE_DATE: { jenis: 'turunan' },
  DISCHARGE_STATUS: { jenis: 'turunan' },
  LOS: { jenis: 'turunan' },
  DESKRIPSI_INACBG: { jenis: 'turunan' },
  TARIF_INACBG: { jenis: 'turunan' },
  TOTAL_TARIF: { jenis: 'turunan' },

  KODE_RS: { jenis: 'konfigurasi' },
  KELAS_RS: { jenis: 'konfigurasi' },
  PAYOR_ID: { jenis: 'konfigurasi' },

  DIAGLIST: { jenis: 'koding' },
  PROCLIST: { jenis: 'koding' },
  INACBG: { jenis: 'koding' },

  ICU_INDIKATOR: { jenis: 'fakta_nol' },
  ICU_LOS: { jenis: 'fakta_nol' },
  VENT_HOUR: { jenis: 'fakta_nol' },
  TARIF_POLI_EKS: { jenis: 'fakta_nol' },

  BIRTH_WEIGHT: { jenis: 'wajar_kosong', catatan: 'Cuma berlaku untuk neonatus.' },
  ADL1: { jenis: 'wajar_kosong' },
  ADL2: { jenis: 'wajar_kosong' },
  SP: { jenis: 'wajar_kosong' },
  SR: { jenis: 'wajar_kosong' },
  SI: { jenis: 'wajar_kosong' },
  SD: { jenis: 'wajar_kosong' },
  DESKRIPSI_SP: { jenis: 'wajar_kosong' },
  DESKRIPSI_SR: { jenis: 'wajar_kosong' },
  DESKRIPSI_SI: { jenis: 'wajar_kosong' },
  DESKRIPSI_SD: { jenis: 'wajar_kosong' },
  TARIF_SP: { jenis: 'wajar_kosong' },
  TARIF_SR: { jenis: 'wajar_kosong' },
  TARIF_SI: { jenis: 'wajar_kosong' },
  TARIF_SD: { jenis: 'wajar_kosong' },
  IN_SP: { jenis: 'wajar_kosong' },
  IN_SR: { jenis: 'wajar_kosong' },
  IN_SI: { jenis: 'wajar_kosong' },
  IN_SD: { jenis: 'wajar_kosong' },
  SUBACUTE: { jenis: 'wajar_kosong' },
  CHRONIC: { jenis: 'wajar_kosong' },
  TARIF_SUBACUTE: { jenis: 'wajar_kosong' },
  TARIF_CHRONIC: { jenis: 'wajar_kosong' },
  KODE_TARIF: { jenis: 'wajar_kosong', catatan: 'Hanya ada di lembar hasil grouper.' },

  // TARIF_RS/CODER_ID/VERSI_INACBG/VERSI_GROUPER/C1-C4 sudah punya jalur
  // sendiri di frontend (VCLAIM_FILLED_COLUMNS -> status 'system', badge
  // "Otomatis vClaim") -- TIDAK perlu jenis di sini, dicek duluan di
  // buildFieldMap sebelum registry ini dibaca.

  PTD: {
    jenis: null,
    perlu_konfirmasi: true,
    catatan: 'Nilainya SELALU 1 di semua klaim yang diperiksa sejauh ini -- kemungkinan tidak pernah benar-benar diekstrak dari dokumen. Jenisnya belum dikonfirmasi, jangan ditebak. (Field ini disembunyikan dari tampilan tabel, lihat ALWAYS_HIDDEN_FIELDS.)',
  },

  // BERAT_BADAN: field baru (raw_data-only, lihat FIELD_CATEGORIES) -- salin
  // apa adanya dari dokumen kalau tercatat, boleh kosong (tidak semua dokumen
  // mencatatnya).
  BERAT_BADAN: { jenis: 'salin' },
};
