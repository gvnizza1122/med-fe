/**
 * Service untuk Generate Explanation/Keterangan untuk Diagnosis & Prosedur
 * yang Valid atau Disetujui
 *
 * Alur:
 * 1. Parse kode diagnosis/prosedur dari field value
 * 2. Lookup deskripsi dari kamus ICD-10 WHO
 * 3. Mapping ke temuan klinis dari dokumen (clinical findings)
 * 4. Generate penjelasan terstruktur dengan bullet points
 */

import { getICD10Description } from './icd10Descriptions';

// ─── ICD-10 Reference Dictionary (WHO 2010 untuk BPJS) ──────────────────────
// Subset populer untuk testing + expandable

export interface ICD10Code {
  code: string;
  description: string; // Deskripsi resmi ICD-10
  layman: string; // Istilah awam (mudah dipahami pasien/keluarga)
  category: string; // Kategori besar (e.g., "Penyakit Pernapasan")
}

export const ICD10_DICTIONARY: Record<string, ICD10Code> = {
  'J45.9': {
    code: 'J45.9',
    description: 'Asthma, unspecified (Asma, tidak spesifik)',
    layman: 'Penyakit sesak nafas jangka panjang tanpa penyebab spesifik yang diketahui',
    category: 'Penyakit Sistem Pernapasan'
  },
  'J45.0': {
    code: 'J45.0',
    description: 'Predominantly allergic asthma',
    layman: 'Asma yang dipicu oleh alergi',
    category: 'Penyakit Sistem Pernapasan'
  },
  'J45.1': {
    code: 'J45.1',
    description: 'Nonallergic asthma',
    layman: 'Asma yang tidak dipicu alergi',
    category: 'Penyakit Sistem Pernapasan'
  },
  'J18.9': {
    code: 'J18.9',
    description: 'Pneumonia, unspecified',
    layman: 'Radang paru tanpa penyebab yang jelas',
    category: 'Penyakit Sistem Pernapasan'
  },
  'I10': {
    code: 'I10',
    description: 'Essential (primary) hypertension',
    layman: 'Tekanan darah tinggi yang penyebabnya tidak diketahui',
    category: 'Penyakit Jantung dan Pembuluh Darah'
  },
  'E11.9': {
    code: 'E11.9',
    description: 'Type 2 diabetes mellitus without complications',
    layman: 'Penyakit gula darah tipe 2 tanpa komplikasi',
    category: 'Penyakit Endokrin'
  },
  'F41.1': {
    code: 'F41.1',
    description: 'Generalized anxiety disorder',
    layman: 'Gangguan kecemasan yang terjadi sepanjang waktu',
    category: 'Gangguan Mental'
  },
  'M79.3': {
    code: 'M79.3',
    description: 'Panniculitis, unspecified',
    layman: 'Radang jaringan lemak di bawah kulit',
    category: 'Penyakit Muskuloskeletal'
  },
  'S72.9': {
    code: 'S72.9',
    description: 'Fracture of femur, unspecified',
    layman: 'Patah tulang paha',
    category: 'Cedera dan Keracunan'
  },
  'N18.3': {
    code: 'N18.3',
    description: 'Chronic kidney disease, stage 3',
    layman: 'Penyakit ginjal kronis tahap 3',
    category: 'Penyakit Saluran Kemih'
  }
};

// ─── ICD-9-CM Procedure Codes (Common) ──────────────────────────────────────

export interface ICD9CMProcedure {
  code: string;
  description: string;
  layman: string;
  category: string;
}

export const ICD9CM_PROCEDURES: Record<string, ICD9CMProcedure> = {
  '93.94': {
    code: '93.94',
    description: 'Intermittent positive pressure breathing (IPPB) ventilation',
    layman: 'Terapi napas dengan alat tekanan positif berkala',
    category: 'Prosedur Pernapasan'
  },
  '93.90': {
    code: '93.90',
    description: 'Continuous positive airway pressure (CPAP) ventilation',
    layman: 'Terapi napas dengan tekanan udara berkelanjutan',
    category: 'Prosedur Pernapasan'
  },
  '96.70': {
    code: '96.70',
    description: 'Continuous mechanical ventilation',
    layman: 'Pemakaian mesin bantu napas terus-menerus',
    category: 'Prosedur Pernapasan'
  },
  '88.97': {
    code: '88.97',
    description: 'Diagnostic ultrasound of abdomen',
    layman: 'USG perut untuk diagnostik',
    category: 'Prosedur Diagnostik'
  },
  '87.41': {
    code: '87.41',
    description: 'Chest X-ray, single view',
    layman: 'Rontgen dada satu arah',
    category: 'Prosedur Diagnostik'
  },
  '99.04': {
    code: '99.04',
    description: 'Transfusion of blood and blood components',
    layman: 'Transfusi darah atau komponen darah',
    category: 'Prosedur Terapeutik'
  },
  '99.15': {
    code: '99.15',
    description: 'Parenteral infusion of other substances',
    layman: 'Infus cairan atau obat melalui pembuluh darah',
    category: 'Prosedur Terapeutik'
  }
};

// ─── Clinical Finding Keywords (untuk matching) ─────────────────────────────
// Mapping antara temuan klinis → interpretasi kode

export interface ClinicalFindingMapping {
  keywords: string[];
  supportedCodes: string[]; // ICD-10 codes yang didukung
  interpretation: string; // Penjelasan interpretasi
}

export const CLINICAL_FINDINGS: Record<string, ClinicalFindingMapping> = {
  'sesak_napas_ronchi': {
    keywords: ['sesak', 'ronchi', 'wheezing', 'stridor', 'distres napas'],
    supportedCodes: ['J45.9', 'J45.0', 'J45.1', 'J18.9'],
    interpretation: 'Temuan auskultasi paru menunjukkan obstruksi saluran napas'
  },
  'demam_tinggi': {
    keywords: ['demam', 'fever', 'suhu >38', 'panas badan'],
    supportedCodes: ['J18.9', 'A08.0', 'A09'],
    interpretation: 'Tanda infeksi sistemik'
  },
  'tekanan_darah_tinggi': {
    keywords: ['hipertensi', 'TD tinggi', 'systolic >140', 'hypertension'],
    supportedCodes: ['I10', 'I11', 'I12', 'I13'],
    interpretation: 'Pengukuran tekanan darah konsisten di atas normal'
  },
  'gula_darah_tinggi': {
    keywords: ['diabetes', 'gula darah', 'glucose >200', 'HbA1c'],
    supportedCodes: ['E11.9', 'E10.9', 'E14.9'],
    interpretation: 'Kadar glukosa darah meningkat'
  },
  'kecemasan': {
    keywords: ['cemas', 'anxiety', 'khawatir', 'panic', 'takut'],
    supportedCodes: ['F41.1', 'F41.0', 'F40.9'],
    interpretation: 'Gejala psikologis yang terdokumentasi'
  },
  'patah_tulang': {
    keywords: ['fraktur', 'fracture', 'patah', 'break', 'dislokasi'],
    supportedCodes: ['S72.9', 'S52.9', 'S62.9', 'S92.9'],
    interpretation: 'Bukti radiologi atau klinis cedera tulang'
  },
  'gangguan_ginjal': {
    keywords: ['CKD', 'chronic kidney', 'ginjal', 'uremia', 'kreatinin tinggi'],
    supportedCodes: ['N18.3', 'N18.2', 'N19'],
    interpretation: 'Penurunan fungsi ginjal berdasarkan lab atau klinis'
  }
};

// ─── Types for Explanation ─────────────────────────────────────────────────

export interface CodingExplanation {
  code: string;
  type: 'diagnosis' | 'procedure';
  description: string; // Deskripsi resmi
  layman: string; // Versi awam
  status: 'valid' | 'approved'; // Status validasi
  clinicalFindings?: string[]; // Temuan klinis yang mendukung
  sourceReference?: string; // Referensi dokumen (e.g., "Resume Medis hal. 2")
  explanationBullets: string[]; // Point-point penjelasan
  // Ditambah 19 Sep 2026 (fix item 7/8/9) -- status review per kode dari
  // backend (code_evidence[].review_status), TERPISAH dari `status` field-level
  // di atas (yang datang dari rule engine, bukan dari evidence/rules kode ini).
  reviewStatus?: 'VALID' | 'PENDING';
  reviewFlags?: CodeReviewFlag[];
}

// Tipe dokumen sumber evidence -- HARUS SAMA PERSIS dengan enum yang dihasilkan
// classifyPageDocumentType() di backend (pdfPageClassifier.js). Provenance
// SEKARANG dari metadata halaman (deterministik), BUKAN teks bebas LLM --
// lihat DOCUMENT_TYPE_LABELS di bawah utk label tampilan per tipe (fix item 7:
// SEBELUMNYA label "Dari Resume Medis" di-hardcode utk SEMUA evidence apapun
// sumber aslinya, mis. kutipan dari Rincian Biaya ikut dilabeli Resume Medis).
export type DocumentType = 'rincian_biaya' | 'spri' | 'sep' | 'resume_medis' | 'triase_igd' | 'lab' | 'berkas_eklaim' | 'lainnya';

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  rincian_biaya: 'Rincian Biaya',
  spri: 'SPRI (Surat Perintah Rawat Inap)',
  sep: 'SEP',
  resume_medis: 'Resume Medis',
  triase_igd: 'Triase IGD',
  lab: 'Hasil Laboratorium',
  berkas_eklaim: 'Berkas e-Klaim',
  lainnya: 'dokumen lain',
};

export interface CodeReviewFlag {
  reason: string;
  alternative_code?: string | null;
  action?: string | null;
}

export interface CodeEvidenceEntry {
  code: string;
  type?: string;
  found?: boolean;
  page_number?: number | null;
  quotation?: string | null;
  reasoning?: string | null;
  // Field baru dari backend (fix item 7/8/9, 19 Sep 2026) -- lihat
  // code_evidence[] di aiReviewService.js.
  document_type?: DocumentType | null;
  review_status?: 'VALID' | 'PENDING';
  review_flags?: CodeReviewFlag[];
}

/**
 * "Tercatat di <Tipe Dokumen> hal. N" -- provenance WAJIB dari document_type
 * (metadata halaman deterministik), fallback ke label generik kalau backend
 * belum mengirim document_type (data lama/entry tanpa page_number) supaya
 * TIDAK diam-diam menampilkan label yang salah/menebak.
 */
function describeEvidenceSource(evidenceEntry?: CodeEvidenceEntry | null): string | null {
  if (!evidenceEntry || !evidenceEntry.quotation) return null;
  const typeLabel = evidenceEntry.document_type ? DOCUMENT_TYPE_LABELS[evidenceEntry.document_type] : 'dokumen';
  return evidenceEntry.page_number ? `${typeLabel} hal. ${evidenceEntry.page_number}` : typeLabel;
}

/**
 * Label bullet "Status: ..." -- WAJIB ikut review_status kode ini kalau ada
 * (fix item 8/9: "Valid" TIDAK BOLEH lagi ditampilkan begitu saja untuk kode
 * yang backend sudah tandai perlu_review/evidence_tidak_terverifikasi).
 */
function describeStatusLabel(status: 'valid' | 'approved', evidenceEntry?: CodeEvidenceEntry | null): string {
  // "Perlu Review" dihapus 21 Sep 2026 (permintaan klien) -- evidenceEntry
  // tidak lagi memengaruhi label, disisakan di signature supaya pemanggil
  // tidak ikut berubah.
  void evidenceEntry;
  return status === 'approved' ? 'Disetujui' : 'Valid';
}

export interface CodingExplanationResult {
  codes: CodingExplanation[];
  summary: string; // Ringkasan 1-2 baris
  isComplete: boolean; // Apakah ada temuan klinis untuk semua kode
}

// ─── Main Service Function ──────────────────────────────────────────────────

/**
 * Generate penjelasan untuk diagnosis/prosedur yang valid/disetujui
 * Input: kode (J45.9; I10), status (Valid/Disetujui), clinical findings
 * Output: Penjelasan terstruktur dengan bullets
 */
export function generateCodingExplanation(
  codesString: string, // e.g., "J45.9;I10"
  type: 'diagnosis' | 'procedure',
  status: 'valid' | 'approved',
  clinicalFindings?: Record<string, any>, // Temuan klinis dari record
  pageReference?: string, // e.g., "Resume Medis hal. 2"
  codeEvidence?: CodeEvidenceEntry[] // Data dari ai_review.code_evidence
): CodingExplanationResult {
  const codes = codesString
    .split(/[;,]/)
    .map(c => c.trim())
    .filter(Boolean);

  const explanations: CodingExplanation[] = [];
  const dictionary = type === 'diagnosis' ? ICD10_DICTIONARY : ICD9CM_PROCEDURES;

  for (const code of codes) {
    const codeData = dictionary[code];
    // Cari data dari ai_review.code_evidence jika tersedia
    const evidenceEntry = codeEvidence?.find(e => e.code === code);

    if (!codeData) {
      // Lookup deskripsi resmi ICD-10 WHO dari kamus besar (hanya untuk diagnosis)
      const icd10Description = type === 'diagnosis' ? getICD10Description(code) : null;
      const hasIcd10Description = !!icd10Description && icd10Description !== '—';

      // Bangun bullets dari deskripsi ICD-10 + data resume medis jika ada
      const bullets: string[] = [];
      let hasInformativeBullet = false;

      if (hasIcd10Description) {
        bullets.push(icd10Description as string);
        hasInformativeBullet = true;
      } else if (type === 'procedure') {
        bullets.push('Deskripsi ICD-9-CM tidak tersedia untuk kode ini');
      }
      const sourceLabel = describeEvidenceSource(evidenceEntry);
      if (evidenceEntry?.quotation) {
        // Fix item 7: provenance dari document_type (metadata halaman), BUKAN
        // hardcode "Dari Resume Medis" untuk semua evidence apapun sumbernya.
        bullets.push(`Dari ${sourceLabel}: "${evidenceEntry.quotation}"`);
        hasInformativeBullet = true;
      }
      if (evidenceEntry?.reasoning) {
        bullets.push(evidenceEntry.reasoning);
        hasInformativeBullet = true;
      }
      if (!hasInformativeBullet) {
        bullets.push('Kode ini tidak ada di kamus offline — lihat dokumen sumber untuk konfirmasi');
      }
      // Fix item 8/9: review_flags (mis. lab rutin perlu review, diagnosis
      // consistency perlu klarifikasi DPJP) ditampilkan sebagai bullet
      // terpisah, sebelum bullet Status.
      evidenceEntry?.review_flags?.forEach(flag => {
        let line = flag.reason;
        if (flag.alternative_code) line += ` Pertimbangkan: ${flag.alternative_code}.`;
        if (flag.action) line += ` Aksi: ${flag.action} (kode TIDAK diubah otomatis).`;
        bullets.push(line);
      });
      bullets.push(`Status: ${describeStatusLabel(status, evidenceEntry)}`);

      explanations.push({
        code,
        type,
        description: hasIcd10Description
          ? (icd10Description as string)
          : evidenceEntry?.quotation
          ? `Ditemukan di ${sourceLabel}: "${evidenceEntry.quotation}"`
          : 'Lihat dokumen sumber untuk detail',
        layman: '',
        status,
        reviewStatus: evidenceEntry?.review_status,
        reviewFlags: evidenceEntry?.review_flags,
        explanationBullets: bullets
      });
      continue;
    }

    // Mapping temuan klinis yang relevan
    const supportingFindings: string[] = [];
    if (clinicalFindings) {
      Object.entries(CLINICAL_FINDINGS).forEach(([key, finding]) => {
        // Cek apakah ada keyword dari finding di clinical findings
        const clinicalText = JSON.stringify(clinicalFindings).toLowerCase();
        if (
          finding.keywords.some(kw => clinicalText.includes(kw.toLowerCase())) &&
          finding.supportedCodes.includes(code)
        ) {
          supportingFindings.push(finding.interpretation);
        }
      });
    }

    // Build explanation bullets
    const bullets: string[] = [];
    bullets.push(codeData.description);
    bullets.push(codeData.layman);
    if (supportingFindings.length > 0) {
      supportingFindings.forEach(finding => {
        bullets.push(finding);
      });
    }
    // Fix item 7: provenance WAJIB dari evidenceEntry.document_type (metadata
    // halaman) kalau tersedia -- pageReference (prop statis dari caller) HANYA
    // dipakai sbg fallback terakhir kalau memang tidak ada codeEvidence sama
    // sekali (mis. pemanggil lama yang belum kirim codeEvidence), supaya TIDAK
    // diam-diam menampilkan label dokumen yang salah/menebak.
    const evidenceSourceLabel = describeEvidenceSource(evidenceEntry);
    if (evidenceEntry?.quotation) {
      bullets.push(`Dari ${evidenceSourceLabel}: "${evidenceEntry.quotation}"`);
    } else if (pageReference) {
      bullets.push(`Tercatat di ${pageReference}`);
    }
    if (evidenceEntry?.reasoning) bullets.push(evidenceEntry.reasoning);
    evidenceEntry?.review_flags?.forEach(flag => {
      let line = flag.reason;
      if (flag.alternative_code) line += ` Pertimbangkan: ${flag.alternative_code}.`;
      if (flag.action) line += ` Aksi: ${flag.action} (kode TIDAK diubah otomatis).`;
      bullets.push(line);
    });
    bullets.push(`Status: ${describeStatusLabel(status, evidenceEntry)}`);

    explanations.push({
      code,
      type,
      description: codeData.description,
      layman: codeData.layman,
      status,
      clinicalFindings: supportingFindings,
      sourceReference: evidenceEntry?.quotation ? (evidenceSourceLabel ?? undefined) : pageReference,
      reviewStatus: evidenceEntry?.review_status,
      reviewFlags: evidenceEntry?.review_flags,
      explanationBullets: bullets
    });
  }

  // Jika tidak ada kode sama sekali, isComplete false
  if (explanations.length === 0) {
    return { codes: [], summary: '', isComplete: false };
  }

  const summary = `${explanations.length} kode ${type === 'diagnosis' ? 'diagnosis' : 'prosedur'} dengan penjelasan klinis`;

  return {
    codes: explanations,
    summary,
    isComplete: explanations.length > 0
  };
}

/**
 * Get explanation untuk satu kode saja (utility)
 */
export function getCodeDescription(code: string, type: 'diagnosis' | 'procedure'): ICD10Code | ICD9CMProcedure | null {
  const dictionary = type === 'diagnosis' ? ICD10_DICTIONARY : ICD9CM_PROCEDURES;
  return dictionary[code] || null;
}

/**
 * Format explanation untuk display di UI
 * Returns HTML-ready string atau array of strings
 */
export function formatExplanationForUI(explanation: CodingExplanation): string[] {
  return explanation.explanationBullets;
}

/**
 * Batch generate explanations untuk multiple fields
 */
export function generateBatchExplanations(
  fields: Array<{
    code: string;
    type: 'diagnosis' | 'procedure';
    status: 'valid' | 'approved';
    clinicalFindings?: Record<string, any>;
    pageReference?: string;
  }>
): Record<string, CodingExplanationResult> {
  const results: Record<string, CodingExplanationResult> = {};

  fields.forEach((field, idx) => {
    const key = `${field.type}_${idx}`;
    results[key] = generateCodingExplanation(
      field.code,
      field.type,
      field.status,
      field.clinicalFindings,
      field.pageReference
    );
  });

  return results;
}
