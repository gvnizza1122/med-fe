'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';

type Step = 'upload' | 'review' | 'result';

interface PdfFields {
  [key: string]: string | undefined;
}

interface ValidationError {
  rule_id: string;
  field_name: string;
  severity: string;
  error_message: string;
  expected?: string;
  actual?: string;
}

interface ValidateResult {
  file_id: string;
  status: string;
  error_count: number;
  errors: ValidationError[];
}

export default function UploadPDFPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('upload');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<PdfFields>({});
  const [originalName, setOriginalName] = useState('');
  const [result, setResult] = useState<ValidateResult | null>(null);

  const applyUploadResult = useCallback((data: { fields: PdfFields; original_name: string }) => {
    setFields(data.fields || {});
    setOriginalName(data.original_name || '');
    setStep('review');
    setLoading(false);
  }, []);

  // ponytail: dev-only global for browser testing without native file dialog
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      (window as unknown as Record<string, unknown>).__devUploadResult = applyUploadResult;
      return () => { delete (window as unknown as Record<string, unknown>).__devUploadResult; };
    }
  }, [applyUploadResult]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Hanya file PDF yang diperbolehkan');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await api.uploadPdf(file);
      applyUploadResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal upload PDF');
      setLoading(false);
    }
  };

  const updateField = (key: string, value: string) => {
    setFields(prev => ({ ...prev, [key]: value }));
  };

  const handleValidate = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.validatePdf({ fields, original_name: originalName });
      if (res.file_id) {
        router.push(`/results?id=${res.file_id}`);
      } else {
        setResult(res);
        setStep('result');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal validasi');
      setLoading(false);
    }
  };

  const fieldLabels: Record<string, string> = {
    noRM: 'No. RM',
    noKartu: 'No. Kartu',
    nama: 'Nama Pasien',
    tglLahir: 'Tgl. Lahir',
    tglMasuk: 'Tgl. Masuk',
    tglKeluar: 'Tgl. Keluar',
    kelasRawat: 'Kelas Rawat',
    noSEP: 'No. SEP',
    tglSEP: 'Tgl. SEP',
    dokter: 'Dokter (DPJP)',
    alamat: 'Alamat',
    jenisKelamin: 'Jenis Kelamin',
    jnsRawat: 'Jenis Rawat',
    diagnosaAwal: 'Diagnosa Awal (SEP)',
    diagnosUtama: 'Diagnosa Utama',
    diagnosSekunder: 'Diagnosa Sekunder',
    tindakan: 'Tindakan/Prosedur',
    dischargeStatus: 'Discharge Status',
    tarifRS: 'Tarif RS',
  };

  const autoFields = ['noRM', 'noKartu', 'nama', 'tglLahir', 'tglMasuk', 'tglKeluar', 'kelasRawat', 'noSEP', 'tglSEP', 'dokter', 'alamat', 'jenisKelamin', 'jnsRawat', 'diagnosaAwal'];
  const manualFields = ['diagnosUtama', 'diagnosSekunder', 'tindakan', 'dischargeStatus', 'tarifRS'];

  const severityColor = (s: string) => {
    if (s === 'critical') return '#dc2626';
    if (s === 'major') return '#ea580c';
    return '#ca8a04';
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="page-header">
        <div>
          <h2>Upload PDF SIMRS</h2>
          <p>Upload file PDF dari SIMRS untuk validasi klaim</p>
        </div>
      </div>

      {error && (
        <div style={{ background: 'var(--red-light, #fef2f2)', color: 'var(--red, #dc2626)', padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* Step 1: Upload */}
        {step === 'upload' && (
          <motion.div key="upload" className="card" style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center', padding: 48 }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#128196;</div>
            <h3 style={{ marginBottom: 8 }}>Upload File PDF</h3>
            <p style={{ color: 'var(--body-mid)', marginBottom: 24, fontSize: 14 }}>
              Pilih file PDF dari SIMRS. Sistem akan extract data otomatis.
            </p>
            <label style={{
              display: 'inline-block', padding: '12px 32px', background: 'var(--primary, #2563eb)', color: 'white',
              borderRadius: 8, cursor: loading ? 'wait' : 'pointer', fontWeight: 600, fontSize: 14
            }}>
              {loading ? 'Memproses...' : 'Pilih File PDF'}
              <input type="file" accept=".pdf" onChange={handleUpload} style={{ display: 'none' }} disabled={loading} />
            </label>
          </motion.div>
        )}

        {/* Step 2: Review & Edit */}
        {step === 'review' && (
          <motion.div key="review" className="card" style={{ maxWidth: 900, margin: '0 auto' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <h3 style={{ marginBottom: 4 }}>Review Data: {originalName}</h3>
            <p style={{ color: 'var(--body-mid)', marginBottom: 24, fontSize: 13 }}>
              Data di bawah di-extract otomatis dari PDF. Edit field yang salah atau kosong, lalu klik Validasi.
            </p>

            <h4 style={{ marginBottom: 12, color: 'var(--primary)' }}>Data Auto-Extract (dari PDF)</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
              {autoFields.map(key => (
                <div key={key} className="form-group">
                  <label className="form-label" style={{ fontSize: 12 }}>{fieldLabels[key] || key}</label>
                  <input
                    type="text" className="form-input"
                    value={fields[key] || ''}
                    onChange={e => updateField(key, e.target.value)}
                    style={{ fontSize: 13, background: fields[key] ? undefined : 'var(--red-light, #fef2f2)' }}
                    placeholder={fields[key] ? '' : '(tidak terdeteksi)'}
                  />
                </div>
              ))}
            </div>

            <h4 style={{ marginBottom: 12, color: 'var(--red, #dc2626)' }}>Data Manual (dari Resume Medis / Handwritten)</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginBottom: 24 }}>
              {manualFields.map(key => (
                <div key={key} className="form-group">
                  <label className="form-label" style={{ fontSize: 12 }}>{fieldLabels[key] || key}</label>
                  {key === 'diagnosUtama' || key === 'diagnosSekunder' || key === 'tindakan' ? (
                    <textarea
                      className="form-input"
                      value={fields[key] || ''}
                      onChange={e => updateField(key, e.target.value)}
                      rows={2}
                      style={{ fontSize: 13, resize: 'vertical' }}
                      placeholder={`Isi ${fieldLabels[key]} dari PDF halaman Resume Medis...`}
                    />
                  ) : (
                    <input
                      type="text" className="form-input"
                      value={fields[key] || ''}
                      onChange={e => updateField(key, e.target.value)}
                      style={{ fontSize: 13 }}
                      placeholder={`Isi ${fieldLabels[key]}...`}
                    />
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12, paddingTop: 16, borderTop: '1px solid var(--hairline, #e5e7eb)' }}>
              <button className="btn btn-secondary" onClick={() => { setStep('upload'); setFields({}); }}>
                Upload Ulang
              </button>
              <div style={{ flex: 1 }} />
              <button className="btn btn-primary" onClick={handleValidate} disabled={loading}
                style={{ padding: '10px 32px', fontWeight: 600 }}>
                {loading ? 'Memvalidasi...' : 'Validasi Klaim'}
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Result */}
        {step === 'result' && result && (
          <motion.div key="result" className="card" style={{ maxWidth: 900, margin: '0 auto' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>
                {result.status === 'valid' ? '✅' : result.status === 'error' ? '❌' : '⚠️'}
              </div>
              <h3 style={{ color: result.status === 'valid' ? '#16a34a' : result.status === 'error' ? '#dc2626' : '#ca8a04' }}>
                {result.status === 'valid' ? 'VALID' : result.status === 'error' ? 'ERROR' : 'PENDING'}
              </h3>
              <p style={{ color: 'var(--body-mid)', fontSize: 14 }}>
                {result.error_count} error ditemukan | File: {originalName}
              </p>
            </div>

            {result.errors.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ marginBottom: 12 }}>Daftar Error</h4>
                {result.errors.map((err, idx) => (
                  <div key={idx} style={{
                    padding: '12px 16px', marginBottom: 8, borderRadius: 8,
                    background: 'var(--bg-secondary, #f9fafb)',
                    borderLeft: `4px solid ${severityColor(err.severity)}`,
                    fontSize: 13
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <strong>{err.rule_id}</strong>
                      <span style={{ color: severityColor(err.severity), fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>
                        {err.severity}
                      </span>
                    </div>
                    <div>{err.error_message}</div>
                    {err.actual && (
                      <div style={{ color: 'var(--body-mid)', fontSize: 12, marginTop: 4 }}>
                        Actual: <code>{err.actual}</code> | Expected: <code>{err.expected}</code>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, paddingTop: 16, borderTop: '1px solid var(--hairline, #e5e7eb)' }}>
              <button className="btn btn-secondary" onClick={() => { setStep('upload'); setFields({}); setResult(null); }}>
                Upload PDF Lain
              </button>
              <button className="btn btn-secondary" onClick={() => { setStep('review'); }}>
                Edit & Re-validasi
              </button>
              <div style={{ flex: 1 }} />
              <button className="btn btn-primary" onClick={() => router.push(`/results/${result.file_id}`)}>
                Lihat Detail
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
