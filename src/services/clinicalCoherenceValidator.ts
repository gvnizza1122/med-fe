/**
 * Clinical Coherence Validator
 *
 * Sanity-check kesesuaian logis antar-field data medis HASIL EKSTRAKSI
 * (diagnosis, prosedur, alasan masuk, tanda vital, temuan klinis) SEBELUM
 * data tsb dipakai untuk grouping INA-CBG + lookup tarif.
 *
 * Prinsip fail-safe: kalau ADA kecurigaan inkonsistensi apa pun, record
 * ditandai PENDING (butuh review manusia) -- bukan diblokir, cuma ditahan.
 * Ini heuristik pattern-matching (regex + threshold tanda vital), BUKAN
 * validasi medis definitif -- false positive itu wajar & memang tujuannya
 * (lebih baik salah minta review daripada lolos tanpa cek).
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface VitalSigns {
  hr?: number | null; // heart rate (bpm)
  rr?: number | null; // respiratory rate (x/menit)
  bp?: string | null; // tekanan darah, mis. "90/60" atau "120/80 mmHg"
  temp?: number | null; // suhu tubuh (°C)
  spo2?: number | null; // saturasi oksigen (%)
}

export interface ClinicalCoherenceInput {
  diagnosis_utama: string;
  diagnosis_sekunder?: string;
  prosedur: string;
  alasan_masuk: string;
  vital_signs: VitalSigns;
  clinical_findings: string;
}

export interface ClinicalCoherenceResult {
  isCoherent: boolean;
  issues: string[];
  severity: 'high' | 'medium' | 'low';
}

type IssueWeight = 'high' | 'medium' | 'low';

interface WeightedIssue {
  message: string;
  weight: IssueWeight;
}

// ============================================================================
// KEYWORD / PATTERN DICTIONARIES
// ============================================================================

// Diagnosis berat -- butuh dukungan tanda vital abnormal supaya koheren.
const SEVERE_DIAGNOSIS_PATTERN =
  /syok|shock|sepsis|gagal\s*napas|distres\s*napas|respiratory\s*distress|gawat\s*napas|henti\s*jantung|cardiac\s*arrest|\bkoma\b|\bcoma\b|gagal\s*(multi\s*)?organ|multiple\s*organ\s*failure|\bards\b/i;

// Diagnosis yang secara khas ditangani medikamentosa (tanpa tindakan bedah).
const MEDICAL_DIAGNOSIS_PATTERN =
  /\bispa\b|common\s*cold|gastritis|hipertensi|hypertension|diabetes|demam\s*(typhoid|tifoid)|\btifoid\b|\bdiare\b|diarrhea|\basma\b|asthma|bronkitis|bronchitis|pneumonia|faringitis|pharyngitis|influenza|dispepsia|migrain|migraine|vertigo/i;

// Diagnosis yang secara khas butuh tindakan bedah/invasif.
const SURGICAL_DIAGNOSIS_PATTERN =
  /apendisitis|appendicitis|\bhernia\b|fraktur|fracture|katarak|cataract|\btumor\b|\bkanker\b|\bcancer\b|kolelitiasis|batu\s*empedu|batu\s*ginjal|nefrolitiasis|\bkista\b|perforasi|obstruksi\s*usus|\bileus\b|luka\s*robek|trauma\s*tajam/i;

// Kata kunci prosedur bedah/invasif pada field `prosedur`.
const SURGICAL_PROCEDURE_PATTERN =
  /\boperasi\b|\bbedah\b|\binsisi\b|\beksisi\b|laparotomi|laparoskopi|sectio\s*caesarea|\bsc\b|apendektomi|appendectomy|kolesistektomi|cholecystectomy|\borif\b|reposisi|debridement|kuretase|amputasi|tonsilektomi|histerektomi|reseksi|\bgraft\b|pemasangan\s*pen|reduction/i;

// Nilai `prosedur` yang secara efektif berarti "tidak ada tindakan".
const EMPTY_PROCEDURE_PATTERN = /^(-|tidak ada|tanpa tindakan|none|null|n\/a)$/i;

const INFECTION_FINDING_PATTERN =
  /infeksi|infection|purulen|purulent|\babses\b|\bpus\b|sepsis|pneumonia|selulitis|cellulitis|infeksi saluran kemih|\bisk\b|demam|febris/i;

const RESPIRATORY_DISTRESS_FINDING_PATTERN =
  /distres\s*napas|respiratory\s*distress|\bsesak\b|dyspnea|retraksi|ronchi|wheezing|\brales\b|crackles|desaturasi|hipoksia/i;

const NORMAL_FINDING_PATTERN =
  /dalam batas normal|tidak ada keluhan|normal semua|tanpa keluhan|\bdbn\b/i;

// Peta kata kunci alasan masuk (keluhan utama) -> kata kunci diagnosis yang
// secara klinis wajar berkaitan. Dipakai sebagai fallback kalau tidak ada
// overlap kata langsung antara alasan_masuk dan diagnosis_utama.
const CHIEF_COMPLAINT_DIAGNOSIS_MAP: { complaint: RegExp; relatedDiagnosis: RegExp }[] = [
  { complaint: /\bsesak\b|sesak\s*napas|shortness of breath/i, relatedDiagnosis: /asma|asthma|pneumonia|bronkitis|bronchitis|distres\s*napas|gagal\s*napas|jantung|heart|\bppok\b|copd/i },
  { complaint: /nyeri\s*perut|sakit\s*perut|abdominal\s*pain/i, relatedDiagnosis: /apendisitis|appendicitis|gastritis|dispepsia|kolelitiasis|batu\s*empedu|ileus|obstruksi/i },
  { complaint: /demam|febris|fever/i, relatedDiagnosis: /infeksi|infection|tifoid|typhoid|sepsis|\bispa\b|pneumonia|\bdbd\b|dengue|malaria/i },
  { complaint: /nyeri\s*dada|chest\s*pain/i, relatedDiagnosis: /jantung|heart|angina|infark|myocard|\bacs\b|koroner/i },
  { complaint: /penurunan\s*kesadaran|tidak\s*sadar|unconscious/i, relatedDiagnosis: /stroke|cedera\s*kepala|head\s*injury|hipoglikemia|hypoglycemia|\bkoma\b|coma/i },
  { complaint: /trauma|kecelakaan|jatuh|accident/i, relatedDiagnosis: /fraktur|fracture|cedera|injury|luka|trauma/i },
  { complaint: /batuk|cough/i, relatedDiagnosis: /\bispa\b|pneumonia|bronkitis|bronchitis|\btb\b|tuberculosis/i },
  { complaint: /\bmual\b|muntah|vomit|nausea/i, relatedDiagnosis: /gastritis|dispepsia|\bdiare\b|diarrhea|keracunan|poisoning/i },
];

// Stopword sederhana Bahasa Indonesia/Inggris untuk overlap kata kunci.
const STOPWORDS = new Set([
  'dengan', 'yang', 'akan', 'dari', 'pada', 'atas', 'oleh', 'tanpa', 'dan',
  'atau', 'untuk', 'sejak', 'hari', 'dalam', 'juga', 'serta', 'this', 'that',
  'with', 'from', 'have', 'been', 'since', 'sudah', 'belum', 'masih', 'akibat',
]);

// ============================================================================
// VITAL SIGN HELPERS
// ============================================================================

function parseBloodPressure(bp?: string | null): { systolic: number; diastolic: number } | null {
  if (!bp) return null;
  const match = bp.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  if (!match) return null;
  return { systolic: Number(match[1]), diastolic: Number(match[2]) };
}

type VitalSeverity = 'severe' | 'moderate' | 'normal';

/**
 * Nilai keparahan berdasarkan tanda vital saja (bukan diagnosis).
 * Mengembalikan 'normal' kalau tidak ada data tanda vital sama sekali
 * (tidak cukup bukti untuk menandai abnormal).
 */
function assessVitalSeverity(vitals: VitalSigns): { level: VitalSeverity; details: string[] } {
  const details: string[] = [];
  let level: VitalSeverity = 'normal';

  const bumpTo = (candidate: VitalSeverity) => {
    const order: Record<VitalSeverity, number> = { normal: 0, moderate: 1, severe: 2 };
    if (order[candidate] > order[level]) level = candidate;
  };

  const bp = parseBloodPressure(vitals.bp);
  if (bp) {
    if (bp.systolic < 90) {
      bumpTo('severe');
      details.push(`TD ${bp.systolic}/${bp.diastolic} (hipotensi)`);
    } else if (bp.systolic < 100) {
      bumpTo('moderate');
      details.push(`TD ${bp.systolic}/${bp.diastolic} (batas rendah)`);
    }
  }

  if (typeof vitals.hr === 'number') {
    if (vitals.hr > 140 || vitals.hr < 50) {
      bumpTo('severe');
      details.push(`HR ${vitals.hr} x/mnt (ekstrem)`);
    } else if (vitals.hr > 100 || vitals.hr < 60) {
      bumpTo('moderate');
      details.push(`HR ${vitals.hr} x/mnt (abnormal)`);
    }
  }

  if (typeof vitals.rr === 'number') {
    if (vitals.rr > 30) {
      bumpTo('severe');
      details.push(`RR ${vitals.rr} x/mnt (takipnea berat)`);
    } else if (vitals.rr > 24) {
      bumpTo('moderate');
      details.push(`RR ${vitals.rr} x/mnt (takipnea)`);
    }
  }

  if (typeof vitals.spo2 === 'number') {
    if (vitals.spo2 < 90) {
      bumpTo('severe');
      details.push(`SpO2 ${vitals.spo2}% (hipoksia berat)`);
    } else if (vitals.spo2 < 95) {
      bumpTo('moderate');
      details.push(`SpO2 ${vitals.spo2}% (hipoksia ringan)`);
    }
  }

  if (typeof vitals.temp === 'number') {
    if (vitals.temp >= 39) {
      bumpTo('moderate');
      details.push(`Suhu ${vitals.temp}°C (demam tinggi)`);
    } else if (vitals.temp >= 38) {
      bumpTo('moderate');
      details.push(`Suhu ${vitals.temp}°C (demam)`);
    } else if (vitals.temp < 35) {
      bumpTo('severe');
      details.push(`Suhu ${vitals.temp}°C (hipotermia)`);
    }
  }

  return { level, details };
}

function hasAnyVitalData(vitals: VitalSigns): boolean {
  return (
    typeof vitals.hr === 'number' ||
    typeof vitals.rr === 'number' ||
    typeof vitals.spo2 === 'number' ||
    typeof vitals.temp === 'number' ||
    Boolean(vitals.bp)
  );
}

// ============================================================================
// TEXT HELPERS
// ============================================================================

function significantWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

function hasWordOverlap(a: string, b: string): boolean {
  const wordsA = significantWords(a);
  const wordsB = significantWords(b);
  if (wordsA.length === 0 || wordsB.length === 0) return true; // tidak cukup data, jangan tandai issue
  return wordsA.some((w) => wordsB.some((v) => v.includes(w) || w.includes(v)));
}

// ============================================================================
// COHERENCE CHECKS
// ============================================================================

function checkDiagnosisVitals(
  diagnosisText: string,
  vitals: VitalSigns
): WeightedIssue | null {
  if (!SEVERE_DIAGNOSIS_PATTERN.test(diagnosisText)) return null;
  if (!hasAnyVitalData(vitals)) return null;

  const { level } = assessVitalSeverity(vitals);
  if (level === 'normal') {
    return {
      message:
        'Diagnosis mengindikasikan kondisi berat (mis. syok/sepsis/distres napas), tetapi tanda vital yang tercatat (HR/RR/TD/SpO2/suhu) berada dalam batas normal.',
      weight: 'high',
    };
  }
  return null;
}

function checkDiagnosisProcedure(diagnosisText: string, prosedur: string): WeightedIssue | null {
  const prosedurTrimmed = (prosedur || '').trim();
  const prosedurEmpty = prosedurTrimmed.length === 0 || EMPTY_PROCEDURE_PATTERN.test(prosedurTrimmed);
  const surgicalDx = SURGICAL_DIAGNOSIS_PATTERN.test(diagnosisText);
  const medicalDx = !surgicalDx && MEDICAL_DIAGNOSIS_PATTERN.test(diagnosisText);
  const surgicalProcedure = SURGICAL_PROCEDURE_PATTERN.test(prosedurTrimmed);

  if (surgicalDx && prosedurEmpty) {
    return {
      message:
        'Diagnosis utama mengarah ke kondisi yang lazimnya butuh tindakan bedah/invasif, tetapi field prosedur kosong/tidak tercatat.',
      weight: 'high',
    };
  }

  if (medicalDx && surgicalProcedure) {
    return {
      message:
        'Prosedur yang tercatat bersifat bedah/invasif, padahal diagnosis utama bersifat medis (biasanya ditangani non-bedah).',
      weight: 'high',
    };
  }

  return null;
}

function checkVitalsFindings(vitals: VitalSigns, clinicalFindings: string): WeightedIssue | null {
  const findings = (clinicalFindings || '').trim();
  if (!findings) return null;

  if (typeof vitals.temp === 'number' && vitals.temp >= 38 && !INFECTION_FINDING_PATTERN.test(findings)) {
    return {
      message: `Demam tercatat (suhu ${vitals.temp}°C) tetapi temuan klinis tidak menyebutkan indikasi infeksi.`,
      weight: 'medium',
    };
  }

  const { level } = assessVitalSeverity(vitals);
  if (level !== 'normal' && NORMAL_FINDING_PATTERN.test(findings)) {
    return {
      message: 'Tanda vital abnormal, tetapi catatan temuan klinis menyatakan kondisi normal/tanpa keluhan.',
      weight: 'medium',
    };
  }

  const tachypnea = typeof vitals.rr === 'number' && vitals.rr > 24;
  const tachycardia = typeof vitals.hr === 'number' && vitals.hr > 100;
  if (tachypnea && tachycardia && !RESPIRATORY_DISTRESS_FINDING_PATTERN.test(findings)) {
    return {
      message: 'Takikardia dan takipnea tercatat, tetapi temuan klinis tidak menyebutkan tanda distres napas.',
      weight: 'medium',
    };
  }

  return null;
}

function checkAlasanMasukDiagnosis(alasanMasuk: string, diagnosisUtama: string): WeightedIssue | null {
  const alasan = (alasanMasuk || '').trim();
  const diagnosis = (diagnosisUtama || '').trim();
  if (!alasan || !diagnosis) return null;

  if (hasWordOverlap(alasan, diagnosis)) return null;

  const mapped = CHIEF_COMPLAINT_DIAGNOSIS_MAP.some(
    ({ complaint, relatedDiagnosis }) => complaint.test(alasan) && relatedDiagnosis.test(diagnosis)
  );
  if (mapped) return null;

  return {
    message: 'Alasan masuk (keluhan utama) tidak tampak berkaitan dengan diagnosis utama berdasarkan kata kunci yang ditemukan.',
    weight: 'low',
  };
}

function checkSeverityMatch(diagnosisText: string, vitals: VitalSigns): WeightedIssue | null {
  if (!hasAnyVitalData(vitals)) return null;
  const isMildDiagnosis = !SEVERE_DIAGNOSIS_PATTERN.test(diagnosisText) && MEDICAL_DIAGNOSIS_PATTERN.test(diagnosisText);
  if (!isMildDiagnosis) return null;

  const { level, details } = assessVitalSeverity(vitals);
  if (level === 'severe') {
    return {
      message: `Tanda vital menunjukkan kondisi berat (${details.join(', ')}), tetapi diagnosis utama tercatat sebagai kondisi ringan/rutin -- kemungkinan diagnosis belum diperbarui sesuai kondisi klinis terkini.`,
      weight: 'high',
    };
  }

  return null;
}

// ============================================================================
// MAIN VALIDATION FUNCTION
// ============================================================================

export function validateClinicalCoherence(record: ClinicalCoherenceInput): ClinicalCoherenceResult {
  const diagnosisText = [record.diagnosis_utama, record.diagnosis_sekunder].filter(Boolean).join(' | ');
  const vitals = record.vital_signs || {};

  const checks: (WeightedIssue | null)[] = [
    checkDiagnosisVitals(diagnosisText, vitals),
    checkDiagnosisProcedure(diagnosisText, record.prosedur || ''),
    checkVitalsFindings(vitals, record.clinical_findings || ''),
    checkAlasanMasukDiagnosis(record.alasan_masuk || '', record.diagnosis_utama || ''),
    checkSeverityMatch(diagnosisText, vitals),
  ];

  const foundIssues = checks.filter((c): c is WeightedIssue => c !== null);

  const weightOrder: Record<IssueWeight, number> = { low: 0, medium: 1, high: 2 };
  const severity: IssueWeight = foundIssues.reduce<IssueWeight>(
    (acc, issue) => (weightOrder[issue.weight] > weightOrder[acc] ? issue.weight : acc),
    'low'
  );

  return {
    isCoherent: foundIssues.length === 0,
    issues: foundIssues.map((i) => i.message),
    severity,
  };
}
