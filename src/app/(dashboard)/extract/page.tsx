'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';

const JENIS_KLAIM_OPTIONS = [
  { value: 'RAWAT_JALAN', label: 'Rawat Jalan' },
  { value: 'RAWAT_INAP', label: 'Rawat Inap' },
  { value: 'GAWAT_DARURAT', label: 'IGD / Gawat Darurat' },
];

export default function ExtractPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [jenisKlaim, setJenisKlaim] = useState('');
  const [dragover, setDragover] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = (f: File) => {
    const ext = f.name.toLowerCase().split('.').pop();
    if (ext !== 'pdf') {
      setError('Hanya file PDF yang diperbolehkan.');
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setError('Ukuran file maksimal 20MB.');
      return;
    }
    setFile(f);
    setError('');
  };

  const handleUpload = async () => {
    if (!file) return;
    if (!jenisKlaim) {
      setError('Pilih kategori pelayanan (Rawat Jalan/Rawat Inap/IGD) terlebih dahulu.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const res = await api.uploadPdf(file, jenisKlaim);
      // Langsung ke halaman hasil lengkap (rule engine + OCR bukti + audit AI +
      // edit field) — satu alur yang sama untuk semua PDF, sudah teruji.
      router.push(`/results/${res.file_id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Berkas gagal diunggah. Silakan coba lagi.');
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <motion.div className="fade-in" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="page-header">
        <div>
          <h2>Ekstrak PDF Klaim</h2>
          <p>Upload berkas PDF klaim dari SIMRS — sistem mengekstrak datanya secara otomatis untuk diperiksa dan divalidasi</p>
        </div>
      </div>

      <motion.div
        className="card"
        style={{ maxWidth: 700, margin: '0 auto' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label">Kategori Pelayanan</label>
          <select
            className="form-select"
            value={jenisKlaim}
            onChange={e => { setJenisKlaim(e.target.value); setError(''); }}
          >
            <option value="">Pilih kategori...</option>
            {JENIS_KLAIM_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '6px 0 0' }}>
            Dipakai supaya AI tidak salah memberi saran (mis. saran ruangan rawat inap untuk klaim rawat jalan) dan untuk memudahkan pencarian di Riwayat Upload.
          </p>
        </div>

        <div
          className={`upload-zone ${dragover ? 'dragover' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragover(true); }}
          onDragLeave={() => setDragover(false)}
          onDrop={e => { e.preventDefault(); setDragover(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
          style={{ cursor: 'pointer' }}
        >
          <AnimatePresence mode="wait">
            {file ? (
              <motion.div
                key="file-selected"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
              >
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px',
                  background: 'var(--bg-card, rgba(59,130,246,0.05))', borderRadius: 12,
                  border: '1px solid rgba(59,130,246,0.2)',
                }}>
                  <div style={{ fontSize: 40 }}>📄</div>
                  <div style={{ textAlign: 'left' }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, wordBreak: 'break-all' }}>{file.name}</h3>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>Klik atau drag untuk mengganti file</p>
              </motion.div>
            ) : (
              <motion.div
                key="empty-state"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
              >
                <div className="upload-zone-icon" style={{ fontSize: 48 }}>📁</div>
                <h3 style={{ margin: 0 }}>Klik atau drag berkas PDF ke sini</h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Mendukung file .PDF (maks 20MB)</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <input ref={fileInputRef} type="file" accept=".pdf" hidden onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />

        <AnimatePresence>
          {error && (
            <motion.div
              className="login-error"
              style={{ marginTop: 16 }}
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -10, height: 0 }}
            >
              ⚠️ {error}
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <button
            className="btn btn-primary btn-lg"
            style={{ flex: 1, justifyContent: 'center', alignItems: 'center', display: 'flex' }}
            onClick={handleUpload}
            disabled={!file || !jenisKlaim || uploading}
          >
            {uploading ? (
              <>
                <span className="btn-spinner" />
                Memproses...
              </>
            ) : '🚀 Upload & Ekstrak'}
          </button>
          {file && !uploading && (
            <button className="btn btn-secondary" onClick={() => { setFile(null); setError(''); }}>
              Batal
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
