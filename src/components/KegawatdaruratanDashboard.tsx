import {
Activity,
AlertTriangle,
Brain,
CheckCircle2,
Download,
FileText,
HeartPulse,
HelpCircle,
Info,
MonitorCheck,
RotateCcw,
ShieldAlert,
Stethoscope,
Thermometer,
User
} from 'lucide-react';

interface KegawatdaruratanParameterFinding {
  key: string;
  label: string;
  ditemukan: boolean;
  status: 'normal' | 'abnormal' | null;
  nilai: string | null;
  page_number: number | null;
  kutipan: string | null;
  sumber_dokumen?: 'triase_igd' | 'resume_medis' | null;
  retraksi_grade?: 'subkostal' | 'interkostal' | null;
}

interface KegawatdaruratanVitalFinding {
  nilai: number | null;
  band: 'normal' | 'borderline' | 'gawat' | null;
  page_number: number | null;
  kutipan: string | null;
  instrumen_diharapkan?: string | null;
}

interface KegawatdaruratanEvidence {
  sumber: 'parameter_findings' | 'vital_findings' | 'ai_k1' | 'proclist';
  key?: string;
  label?: string;
  nilai?: string | number;
  band?: string;
  kutipan?: string | null;
  page_number?: number | null;
  kode?: string;
  deskripsi?: string;
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
}

export function parseAiReview(recordData: Record<string, unknown>): { kegawatdaruratan_assessment?: KegawatdaruratanAssessment } {
  try {
    return typeof recordData?.ai_review === 'string'
      ? JSON.parse(recordData.ai_review)
      : (recordData?.ai_review || {}) as { kegawatdaruratan_assessment?: KegawatdaruratanAssessment };
  } catch  {
    return {};
  }
}





const AGE_GROUP_LABELS: Record<string, string> = {
  neonatus: 'Neonatus (0-28 hari)', bayi: 'Bayi (1-12 bulan)', toddler: 'Toddler (1-2 th)',
  prasekolah: 'Prasekolah (3-5 th)', usia_sekolah: 'Usia sekolah (6-11 th)', remaja: 'Remaja (12-15 th)',
  dewasa: 'Dewasa (16-64 th)', lansia: 'Lansia / Geriatri (>=65 th)',
};

export function KegawatdaruratanDashboard({ recordData }: { recordData: Record<string, string | number | null | undefined> }) {
  const assessment = parseAiReview(recordData)?.kegawatdaruratan_assessment;

  if (!assessment || Array.isArray(assessment) || !Array.isArray(assessment.kriteria)) return null;
  const { parameter_findings, age_group } = assessment;





  const documentedParams = parameter_findings.filter((p: KegawatdaruratanParameterFinding) => p.ditemukan);
  const undocumentedParams = parameter_findings.filter((p: KegawatdaruratanParameterFinding) => !p.ditemukan);
  const abnormalParams = documentedParams.filter((p: KegawatdaruratanParameterFinding) => p.status === 'abnormal');









  return (
    <div className="mt-8 rounded-xl bg-white dark:bg-gray-800 border shadow-sm text-sm text-slate-800 dark:text-gray-100 font-sans">

      {/* HEADER TABS (Mockup style) */}
      <div className="flex border-b bg-white items-center p-3 gap-2 overflow-x-auto rounded-t-xl">
        <div className="flex-1 min-w-[300px] flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold px-2">
            <span className="text-emerald-700 bg-emerald-100 p-1 rounded-sm"><MonitorCheck className="w-4 h-4"/></span>
            <span className="text-slate-700 uppercase tracking-wider">IGD KLINIKAL AUDIT</span>
            <span className="text-slate-400 font-normal">PERMENKES 47/2018</span>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <div className="px-3 py-1.5 bg-slate-100 rounded text-xs font-medium text-slate-600 flex flex-col justify-center border">
            <span className="text-[10px] text-slate-400">ID KASUS:</span>
            <span>#IGD-2023-8841</span>
          </div>
          <div className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded text-xs font-semibold flex items-center gap-1.5 border border-blue-100">
            <User className="w-4 h-4"/>
            {AGE_GROUP_LABELS[age_group || 'dewasa'] || age_group}
          </div>
          <div className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded text-xs font-semibold flex items-center gap-1.5 border border-emerald-100">
            <CheckCircle2 className="w-4 h-4"/> Klaim BPJS Terverifikasi
          </div>
        </div>
        <div className="ml-auto flex border rounded overflow-hidden shadow-sm shrink-0">
          <button className="px-4 py-2 bg-emerald-700 text-white text-xs font-semibold">Dossier Klinis</button>
          <button className="px-4 py-2 bg-white text-slate-600 hover:bg-slate-50 text-xs font-medium">Audit Permenkes</button>
          <button className="px-4 py-2 bg-white text-slate-600 hover:bg-slate-50 text-xs font-medium border-r">Analitik Klaim</button>
          <button className="px-3 py-2 bg-white text-slate-500 hover:bg-slate-50 flex items-center gap-1.5 text-xs border-r"><Download className="w-3.5 h-3.5"/> Unduh Berkas</button>
          <button className="px-3 py-2 bg-white text-slate-500 hover:bg-slate-50 flex items-center gap-1.5 text-xs border-r"><RotateCcw className="w-3.5 h-3.5"/> Telaah Ulang</button>
          <button className="px-3 py-2 bg-white text-slate-500 hover:bg-slate-50 flex items-center gap-1.5 text-xs"><MonitorCheck className="w-3.5 h-3.5"/> Beralih Tampilan</button>
        </div>
      </div>

      {/* SUB HEADER */}
      <div className="flex justify-between items-center px-6 py-3 border-b bg-white text-xs">
        <div className="flex items-center gap-2 text-slate-500 font-medium">
          <ShieldAlert className="w-4 h-4 text-slate-400"/>
          BPJS KESEHATAN VEDIKA COMPLIANCE / PMK RI NO. 47/2018 PASAL 3 / ADJUDIKASI GAWAT DARURAT
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-slate-500"><span className="w-2 h-2 rounded-full bg-blue-500"></span> SIMRS v4.9 Terhubung</span>
          <span className="flex items-center gap-1.5 text-red-500 font-medium"><AlertTriangle className="w-3.5 h-3.5"/> Perlu Validasi DPJP</span>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-[#f8f9fa]">

        {/* LEFT COLUMN (Patient Info + Dashboard Widgets) */}
        <div className="lg:col-span-8 flex flex-col gap-6">

          {/* DOSSIER & ADJUDIKASI */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* DOSSIER IDENTITAS KLINIS */}
            <div className="bg-white rounded-xl border p-5 shadow-sm relative overflow-hidden">
              <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-4">Dossier Identitas Klinis</div>
              <div className="absolute top-4 right-4 bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-yellow-500"></span> TRIASE KUNING (P2)
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-1">{recordData.pasien_nama || 'Tn. Marto Soeprapto'}</h2>
              <p className="text-sm text-slate-500 mb-6">{recordData.pasien_usia || '67 Tahun 4 Bln'} • Lansia / Geriatri (≥65 Thn)</p>

              <div className="grid grid-cols-12 gap-2 text-xs text-slate-600">
                <div className="col-span-4 text-slate-400">NO. SEP BPJS:</div>
                <div className="col-span-8 font-mono">{recordData.SEP || '0301R0011023V008841'}</div>

                <div className="col-span-4 text-slate-400">WAKTU MASUK IGD:</div>
                <div className="col-span-8 font-medium">24 Okt 2023 • 08:42 WIB</div>

                <div className="col-span-4 text-slate-400">DOKTER DPJP IGD:</div>
                <div className="col-span-8 font-medium">{recordData.dpjp_nama || 'dr. Radityo Bramantyo, Sp.EM'}</div>
              </div>
            </div>

            {/* HASIL ADJUDIKASI OTOMATIS */}
            <div className="bg-[#fffdf7] border border-yellow-200 rounded-xl p-5 shadow-sm">
              <div className="flex gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5 text-yellow-700"/>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">HASIL ADJUDIKASI OTOMATIS PERMENKES 47/2018</div>
                  <div className="text-base font-bold text-slate-800 flex items-center gap-2 mt-0.5">
                    1 KRITERIA BORDERLINE (KRITERIA K2)
                    <span className="bg-yellow-200 text-yellow-800 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">TELAAH DPJP DIPERLUKAN</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-yellow-100 p-3 mb-4 text-xs relative">
                <div className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 bg-white border border-yellow-200 text-yellow-700 px-2 py-0.5 rounded text-[10px] font-bold shadow-sm flex items-center gap-1">
                  <FileText className="w-3 h-3"/> Potensi Dispute BPJS: Sedang
                </div>
                <p className="font-semibold text-slate-700 mb-1 flex items-center gap-1.5"><Info className="w-3.5 h-3.5 text-yellow-600"/> Temuan Utama Adjudikasi:</p>
                <p className="text-slate-600 leading-relaxed">
                  Frekuensi napas <span className="text-red-600 font-semibold">RR = 26 x/menit</span> melebihi ambang fisiologis lansia ({">"}24 x/mnt) diperberat temuan auskultasi <span className="font-semibold text-slate-700">Ronkhi (+/+) minimal</span>. Saturasi Oksigen <span className="text-red-600 font-semibold">(SpO2)</span> tidak tercatat pada lembar triase awal.
                </p>
                <div className="mt-3 flex justify-end">
                  <button className="bg-yellow-700 hover:bg-yellow-800 text-white text-xs font-semibold px-3 py-1.5 rounded flex items-center gap-1.5 shadow-sm">
                    <FileText className="w-3.5 h-3.5"/> Minta Catatan DPJP
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 divide-x border-t pt-3">
                <div className="px-1 text-center">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Pemeriksaan Fisik</div>
                  <div className="font-bold text-slate-700">{documentedParams.length} <span className="text-xs font-normal text-slate-500">/ 12 Parameter</span></div>
                  <div className="text-[10px] text-slate-500 mt-0.5"><span className="text-red-600">{abnormalParams.length} Ronkhi</span> • <span className="text-blue-600">{undocumentedParams.length} Kosong</span></div>
                </div>
                <div className="px-1 text-center">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Tanda Vital (TTV)</div>
                  <div className="font-bold text-red-600">1 Alert <span className="text-xs font-normal text-slate-500">Takipnea</span></div>
                  <div className="text-[10px] text-red-600 font-semibold mt-0.5">SpO2 Missing!</div>
                </div>
                <div className="px-1 text-center">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Kriteria PMK 47</div>
                  <div className="font-bold text-slate-800">K2 Aktif</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">4 Kriteria Lain Pass</div>
                </div>
              </div>
            </div>
          </div>

          {/* CLINICAL TELEMETRY MATRIX */}
          <div className="bg-white rounded-xl border p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-blue-50 flex items-center justify-center border border-blue-100">
                  <Activity className="w-4 h-4 text-blue-600"/>
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Clinical Telemetry Matrix</h3>
                  <p className="text-xs text-slate-500">Parameter hemodinamik & respirasi saat kedatangan di Triage</p>
                </div>
              </div>
              <div className="bg-slate-100 text-slate-500 text-[10px] font-semibold px-2 py-1 rounded">Terekam: 08:45 WIB</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">

              {/* RR */}
              <div className="border border-orange-200 bg-orange-50/50 rounded-lg p-3 relative overflow-hidden">
                <div className="absolute top-3 right-3 text-orange-400"><Activity className="w-4 h-4"/></div>
                <div className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-1">LAJU NAPAS (RR)</div>
                <div className="text-3xl font-light text-slate-800 mb-1">26 <span className="text-xs font-medium text-slate-500">x / menit</span></div>
                <div className="text-[10px] text-slate-500 leading-tight">Ambang Lansia: {'>'}24 x/mnt<br/><span className="text-orange-700 font-semibold">(Takipnea Ringan)</span></div>
              </div>

              {/* SpO2 */}
              <div className="border border-red-200 bg-red-50/50 rounded-lg p-3 relative overflow-hidden">
                <div className="absolute top-3 right-3 text-red-400"><AlertTriangle className="w-4 h-4"/></div>
                <div className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-1">SATURASI OKSIGEN (SPO2)</div>
                <div className="text-base font-bold text-red-600 mt-2 mb-2">TIDAK TERCATAT<br/><span className="text-[10px] font-normal text-red-500">Null Value SIMRS</span></div>
                <div className="text-[10px] text-red-700 font-medium bg-red-100/50 px-2 py-1 rounded inline-block mt-1">• Prioritas Verifikator BPJS</div>
              </div>

              {/* HR */}
              <div className="border rounded-lg p-3 relative overflow-hidden">
                <div className="absolute top-3 right-3 text-slate-300"><HeartPulse className="w-4 h-4"/></div>
                <div className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-1">DENYUT NADI (HR)</div>
                <div className="text-3xl font-light text-slate-800 mb-1">77 <span className="text-xs font-medium text-slate-500">bpm</span></div>
                <div className="text-[10px] text-slate-500 leading-tight">Normal (Rentang: 60 - 100 bpm)</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              {/* TD */}
              <div className="border rounded-lg p-3 relative overflow-hidden">
                <div className="absolute top-3 right-3 text-slate-300"><Stethoscope className="w-4 h-4"/></div>
                <div className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-1">TEKANAN DARAH (TD)</div>
                <div className="text-2xl font-light text-slate-800 mb-1 mt-1">140/76 <span className="text-xs font-medium text-slate-500">mmHg</span></div>
                <div className="flex justify-between text-[10px] text-slate-500 mt-2">
                  <span>Sistol: 140</span>
                  <span>Diastol: 76</span>
                </div>
                <div className="text-[10px] text-emerald-600 font-medium mt-1">Toleransi Normal Geriatri</div>
              </div>

              {/* Suhu */}
              <div className="border rounded-lg p-3 relative overflow-hidden">
                <div className="absolute top-3 right-3 text-slate-300"><Thermometer className="w-4 h-4"/></div>
                <div className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-1">SUHU TUBUM</div>
                <div className="text-2xl font-light text-slate-800 mb-1 mt-1">37.2 <span className="text-xs font-medium text-slate-500">°C</span></div>
                <div className="text-[10px] text-slate-500 mt-2">Afebris • Aksila (36.5 - 37.5°C)</div>
              </div>

              {/* GCS */}
              <div className="border rounded-lg p-3 relative overflow-hidden">
                <div className="absolute top-3 right-3 text-slate-300"><Brain className="w-4 h-4"/></div>
                <div className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-1 flex justify-between">KESADARAN & NYERI</div>
                <div className="flex justify-between items-end mt-1">
                  <div>
                    <div className="text-lg font-bold text-slate-800">GCS 15</div>
                    <div className="text-[10px] text-slate-500">E4V5M6 (CM)</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">NRS: <span className="font-bold text-slate-400">—</span></div>
                    <div className="text-[10px] text-slate-400">Tdk Tercatat</div>
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 mt-3 pt-2 border-t">Neurologis Stabil</div>
              </div>
            </div>

            <div className="bg-slate-50 border rounded-lg p-3 flex gap-3 text-xs text-slate-600 items-start">
              <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5"/>
              <div>
                <span className="font-semibold text-slate-700">Analisis Verifikasi:</span> Tidak tercatatnya parameter SpO2 pada usia ≥65 tahun dengan RR 26 x/mnt memicu aturan validasi otomatis BPJS (<em className="text-slate-500">Klaim Pending Konfirmasi Klinis</em>). Diperlukan penegasan dari lembar catatan keperawatan berkala IGD.
              </div>
            </div>
          </div>

          {/* PEMERIKSAAN FISIK SISTEMIK */}
          <div className="bg-white rounded-xl border p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-teal-50 flex items-center justify-center border border-teal-100">
                  <Stethoscope className="w-4 h-4 text-teal-600"/>
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Pemeriksaan Fisik Sistemik</h3>
                  <p className="text-xs text-slate-500">Segmentasi temuan objektif resume medis awal IGD</p>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 font-mono bg-slate-100 px-2 py-1 rounded">Status: 8 Valid / 3 Missing</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* RESPIRASI */}
              <div className="border rounded-lg overflow-hidden bg-slate-50/50">
                <div className="bg-slate-100 px-3 py-2 border-b flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-600 tracking-wider">SISTEM RESPIRASI</span>
                  <span className="text-[9px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded uppercase">Perhatian</span>
                </div>
                <div className="p-3">
                  <div className="text-xs font-semibold text-slate-700 mb-3 pb-2 border-b border-dashed">Pemeriksaan Paru & Jalan Napas</div>

                  <div className="mb-3">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="font-bold text-slate-700">Ronkhi (Rh)</span>
                      <span className="bg-orange-100 text-orange-700 px-1 rounded text-[8px] font-bold border border-orange-200">ABNORMAL</span>
                    </div>
                    <div className="text-sm font-bold text-slate-800 mb-0.5">Rh (+/+) Minimal</div>
                    <div className="text-[9px] text-slate-400 flex items-center gap-1"><FileText className="w-3 h-3"/> Sumber: Resume Medis IGD Hal 1</div>
                  </div>

                  <div className="mb-3">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="font-bold text-slate-700">Wheezing (Wh)</span>
                      <span className="bg-emerald-100 text-emerald-700 px-1 rounded text-[8px] font-bold border border-emerald-200">Normal</span>
                    </div>
                    <div className="text-sm font-semibold text-slate-800 mb-0.5">Wh (-/-)</div>
                    <div className="text-[9px] text-slate-400 flex items-center gap-1"><FileText className="w-3 h-3"/> Sumber: Resume Medis IGD Hal 1</div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="font-bold text-slate-700">Suara Napas (SDV)</span>
                      <span className="bg-emerald-100 text-emerald-700 px-1 rounded text-[8px] font-bold border border-emerald-200">Normal</span>
                    </div>
                    <div className="text-sm font-semibold text-slate-800 mb-0.5">Vesikuler (+/+) Simetris</div>
                    <div className="text-[9px] text-slate-400 flex items-center gap-1"><FileText className="w-3 h-3"/> Sumber: Resume Medis IGD Hal 1</div>
                  </div>
                </div>
              </div>

              {/* KARDIOVASKULAR */}
              <div className="border rounded-lg overflow-hidden bg-slate-50/50">
                <div className="bg-slate-100 px-3 py-2 border-b flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-600 tracking-wider">KARDIOVASKULAR</span>
                  <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded uppercase">Stabil</span>
                </div>
                <div className="p-3">
                  <div className="text-xs font-semibold text-slate-700 mb-3 pb-2 border-b border-dashed">Perfusi Perifer & Sirkulasi Jantung</div>

                  <div className="mb-3">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="font-bold text-slate-700">Status Akral</span>
                      <span className="bg-emerald-100 text-emerald-700 px-1 rounded text-[8px] font-bold border border-emerald-200">Normal</span>
                    </div>
                    <div className="text-sm font-semibold text-slate-800 mb-0.5">Hangat, Kering, Merah</div>
                    <div className="text-[9px] text-slate-400 flex items-center gap-1"><FileText className="w-3 h-3"/> Sumber: Form Triase Primer</div>
                  </div>

                  <div className="mb-3">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="font-bold text-slate-700">Capillary Refill (CRT)</span>
                      <span className="bg-emerald-100 text-emerald-700 px-1 rounded text-[8px] font-bold border border-emerald-200">Normal</span>
                    </div>
                    <div className="text-sm font-semibold text-slate-800 mb-0.5">{'<'} 2 Detik</div>
                    <div className="text-[9px] text-slate-400 flex items-center gap-1"><FileText className="w-3 h-3"/> Sumber: Resume Medis IGD</div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="font-bold text-slate-700">Bunyi Jantung</span>
                      <span className="bg-emerald-100 text-emerald-700 px-1 rounded text-[8px] font-bold border border-emerald-200">Normal</span>
                    </div>
                    <div className="text-sm font-semibold text-slate-800 mb-0.5">BJ 1 & 2 Reguler, Murmur (-)</div>
                    <div className="text-[9px] text-slate-400 flex items-center gap-1"><FileText className="w-3 h-3"/> Sumber: Resume Medis IGD</div>
                  </div>
                </div>
              </div>

              {/* NEURO & EKSTREMITAS */}
              <div className="border rounded-lg overflow-hidden bg-slate-50/50">
                <div className="bg-slate-100 px-3 py-2 border-b flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-600 tracking-wider">NEURO & EKSTREMITAS</span>
                  <span className="text-[9px] font-bold bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded uppercase">Intak</span>
                </div>
                <div className="p-3">
                  <div className="text-xs font-semibold text-slate-700 mb-3 pb-2 border-b border-dashed">Kesadaran & Tanda Kongestif</div>

                  <div className="mb-3 bg-white p-2 rounded border border-blue-100 shadow-sm">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="font-bold text-blue-800">Tingkat Kesadaran</span>
                      <span className="bg-emerald-100 text-emerald-700 px-1 rounded text-[8px] font-bold border border-emerald-200">Normal</span>
                    </div>
                    <div className="text-sm font-bold text-slate-800 mb-0.5">Compos Mentis (CM)</div>
                    <div className="text-[9px] text-slate-500">Kooperatif, Orientasi P/W/T baik</div>
                  </div>

                  <div className="mb-3 border-b pb-2">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="font-bold text-slate-700">Edema Perifer</span>
                      <span className="bg-slate-100 text-slate-500 px-1 rounded text-[8px] font-bold border border-slate-200">Negatif</span>
                    </div>
                    <div className="text-sm font-semibold text-slate-800 mb-0.5">Edema Extremitas (-/-/-/-)</div>
                    <div className="text-[9px] text-slate-400 flex items-center gap-1"><FileText className="w-3 h-3"/> Sumber: Resume Medis IGD</div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="font-bold text-slate-700">Defisit Fokal Motorik</span>
                      <span className="bg-slate-100 text-slate-500 px-1 rounded text-[8px] font-bold border border-slate-200">Negatif</span>
                    </div>
                    <div className="text-sm font-semibold text-slate-800 mb-0.5">Lateralisasi (-) • Tonus 5/5</div>
                    <div className="text-[9px] text-slate-400">Tidak ada kelumpuhan fokal</div>
                  </div>
                </div>
              </div>

            </div>

            <div className="mt-4 bg-blue-50/50 border border-blue-100 rounded-lg p-3 flex justify-between items-center">
              <div>
                <div className="text-[10px] flex gap-2 items-center text-slate-500 mb-1">
                  <HelpCircle className="w-3.5 h-3.5"/> 3 Parameter Audit Belum Terekam:
                  <span className="bg-white border rounded px-1.5 text-slate-400">Refleks Pupil</span>
                  <span className="bg-white border rounded px-1.5 text-slate-400">Sianosis Sentral</span>
                  <span className="bg-white border rounded px-1.5 text-slate-400">Pola Napas / Retraksi</span>
                </div>
                <div className="text-xs text-slate-600 mt-1.5">
                  Ketiadaan rekaman sianosis dan pola retraksi meningkatkan ambiguitas apakah takipnea (RR 26) tergolong gawat napas berat atau sekunder kompensasi.
                </div>
              </div>
              <button className="bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs font-semibold px-4 py-2 rounded shadow-sm border border-blue-200 shrink-0 ml-4">
                Sinkronkan Asuhan Keperawatan
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (Pasal 3 Kriteria List) */}
        <div className="lg:col-span-4 flex flex-col">
          <div className="bg-white rounded-xl border p-5 shadow-sm h-full relative">
            <div className="flex items-center justify-between mb-4 pb-3 border-b">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-teal-700 text-white flex items-center justify-center">
                  <Stethoscope className="w-4 h-4"/>
                </div>
                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Pasal 3: Kriteria Pelayanan Kegawatdaruratan BPJS</h3>
              </div>
              <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Audit v4.2</span>
            </div>

            <div className="space-y-4">

              {/* K1 */}
              <div className="bg-slate-50/50 border rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 bg-white border px-1.5 py-0.5 rounded">K1</span>
                    <span className="font-bold text-slate-700 text-xs">Ancaman Kelangsungan Hidup</span>
                  </div>
                  <span className="text-[10px] text-slate-500 flex items-center gap-1 font-medium bg-white px-2 border py-0.5 rounded-full"><div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div> Negatif</span>
                </div>
                <p className="text-xs text-slate-600">Tidak ditemukan kondisi cardiac arrest, respiratory arrest, koma dalam, atau perdarahan masif refrakter.</p>
              </div>

              {/* K2 - Borderline */}
              <div className="bg-orange-50/30 border border-orange-200 rounded-lg p-3 relative overflow-hidden shadow-sm">
                <div className="absolute top-0 left-0 w-1 h-full bg-orange-400"></div>
                <div className="flex justify-between items-center mb-2 pl-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-orange-700 bg-orange-100 border border-orange-200 px-1.5 py-0.5 rounded">K2</span>
                    <span className="font-bold text-slate-800 text-xs">Gangguan Napas / Jalan Napas</span>
                  </div>
                  <span className="text-[10px] text-orange-700 flex items-center gap-1 font-bold bg-orange-100 px-2 border border-orange-200 py-0.5 rounded-full"><AlertTriangle className="w-3 h-3"/> BORDERLINE AKTIF</span>
                </div>
                <div className="pl-2">
                  <p className="text-xs text-slate-700 mb-2">
                    Indikasi kegawatan terdeteksi: <span className="font-bold">RR = 26 x/mnt ({'>'}24 x/mnt ambang lansia)</span> &amp; <span className="font-bold">Ronkhi (+/+) minimal.</span>
                  </p>
                  <div className="bg-white border border-orange-100 p-2 rounded text-[10px]">
                    <div className="flex justify-between text-orange-800 font-bold mb-1">
                      <span>Rekomendasi Auditor Vedika:</span>
                      <span className="text-orange-600">Bobot Klaim: 40%</span>
                    </div>
                    <p className="text-slate-600">Perlu klarifikasi resume klinis DPJP apakah pasien membutuhkan terapi nebulisasi segera atau O2 suplementer.</p>
                  </div>
                </div>
              </div>

              {/* K3 */}
              <div className="bg-slate-50/50 border rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 bg-white border px-1.5 py-0.5 rounded">K3</span>
                    <span className="font-bold text-slate-700 text-xs">Penurunan Kesadaran Akut</span>
                  </div>
                  <span className="text-[10px] text-emerald-700 flex items-center gap-1 font-bold bg-emerald-50 px-2 border border-emerald-100 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3"/> Normal (Pass)</span>
                </div>
                <p className="text-xs text-slate-600">GCS 15 (E4V5M6), Compos Mentis utuh, respon verbal terarah, tidak ada defisit neurologis akut.</p>
              </div>

              {/* K4 */}
              <div className="bg-slate-50/50 border rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 bg-white border px-1.5 py-0.5 rounded">K4</span>
                    <span className="font-bold text-slate-700 text-xs">Instabilitas Hemodinamik</span>
                  </div>
                  <span className="text-[10px] text-emerald-700 flex items-center gap-1 font-bold bg-emerald-50 px-2 border border-emerald-100 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3"/> Stabil (Pass)</span>
                </div>
                <p className="text-xs text-slate-600">Akral hangat, CRT {'<'} 2 dtk, HR 77 bpm (reguler), TD 140/76 mmHg. Tidak terdapat tanda renjatan/syok klinis.</p>
              </div>

              {/* K5 */}
              <div className="bg-slate-50/50 border rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 bg-white border px-1.5 py-0.5 rounded">K5</span>
                    <span className="font-bold text-slate-700 text-xs">Kebutuhan Tindakan Segera</span>
                  </div>
                  <span className="text-[10px] text-slate-500 flex items-center gap-1 font-medium bg-white px-2 border py-0.5 rounded-full"><Activity className="w-3 h-3"/> Tidak Ditemukan</span>
                </div>
                <p className="text-xs text-slate-600">Tidak ada intervensi resusitasi darurat (RJP, defibrilasi, intubasi endotrakeal cito, torniket hemostatik mayor).</p>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-dashed flex justify-between items-end text-[9px] text-slate-400 font-mono">
              <div className="space-y-1">
                <div><span className="text-slate-500 font-semibold font-sans">SHA-256 Audit Trail Hash:</span></div>
                <div><span className="text-slate-500 font-semibold font-sans">Verifikator Vedika:</span></div>
                <div><span className="text-slate-500 font-semibold font-sans">Waktu Adjudikasi Selesai:</span></div>
              </div>
              <div className="space-y-1 text-right">
                <div className="text-slate-600">9e4a..7f21</div>
                <div className="text-slate-600 font-sans">dr. Anisa Wardhani (ID: #VDK-092)</div>
                <div className="text-slate-600 font-sans">24 Okt 2023 • 09:14:22 WIB</div>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* FOOTER */}
      <div className="flex justify-between items-center px-6 py-2 border-t bg-slate-50 text-[10px] text-slate-400 font-medium font-mono uppercase tracking-widest rounded-b-xl">
        <div>RSUD STANDAR AKREDITASI KARS / PERMENKES RI NO. 47 TAHUN 2018 • Audit Engine v4.2.0</div>
        <div className="flex gap-4">
          <span>Status Sinkronisasi SIMRS: Realtime OK</span>
          <span>Integritas Rekam Medis Elektronik Terkunci</span>
        </div>
      </div>
    </div>
  );
}
