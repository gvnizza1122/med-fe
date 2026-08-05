'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { io, type Socket } from 'socket.io-client';
import { api } from '@/lib/api';

const JENIS_KLAIM_OPTIONS = [
  { value: 'RAWAT_JALAN', label: 'Rawat Jalan', icon: '🚶', desc: 'Pasien tidak menginap', accent: '#2563eb' },
  { value: 'RAWAT_INAP', label: 'Rawat Inap', icon: '🛏️', desc: 'Pasien menginap di ruangan', accent: '#6366f1' },
  { value: 'GAWAT_DARURAT', label: 'IGD / Gawat Darurat', icon: '🚨', desc: 'Pelayanan gawat darurat', accent: '#dc2626' },
];

const MAX_BATCH_FILES = 30; // harus sinkron dengan MAX_BATCH_PDF_FILES di backend (claimFiles.js)

interface BatchFileStatus {
  fileName: string;
  status: 'waiting' | 'processing' | 'done' | 'failed';
  error?: string | null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function ExtractPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [jenisKlaim, setJenisKlaim] = useState('');
  const [dragover, setDragover] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Mode single
  const [file, setFile] = useState<File | null>(null);

  // Mode batch
  const [files, setFiles] = useState<File[]>([]);
  const [batchStatuses, setBatchStatuses] = useState<BatchFileStatus[]>([]);
  const [batchDone, setBatchDone] = useState<{ successful: number; failed: number } | null>(null);

  const validateFile = (f: File): string | null => {
    const ext = f.name.toLowerCase().split('.').pop();
    if (ext !== 'pdf') return `${f.name}: hanya file PDF yang diperbolehkan.`;
    if (f.size > 20 * 1024 * 1024) return `${f.name}: ukuran melebihi 20MB.`;
    return null;
  };

  const handleFile = (f: File) => {
    const err = validateFile(f);
    if (err) { setError(err); return; }
    setFile(f);
    setError('');
  };

  const addBatchFiles = (incoming: FileList | File[]) => {
    const incomingArr = Array.from(incoming);
    const errs: string[] = [];
    const valid: File[] = [];
    for (const f of incomingArr) {
      const err = validateFile(f);
      if (err) { errs.push(err); continue; }
      // Hindari duplikat (nama + ukuran sama) kalau user pilih file yang sama 2x
      if (files.some(existing => existing.name === f.name && existing.size === f.size)) continue;
      valid.push(f);
    }
    const combined = [...files, ...valid];
    if (combined.length > MAX_BATCH_FILES) {
      setError(`Maksimal ${MAX_BATCH_FILES} file per batch. ${combined.length - MAX_BATCH_FILES} file terakhir tidak ditambahkan.`);
      setFiles(combined.slice(0, MAX_BATCH_FILES));
    } else {
      setFiles(combined);
      setError(errs.length > 0 ? errs.join(' ') : '');
    }
  };

  const removeBatchFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const switchMode = (next: 'single' | 'batch') => {
    if (uploading) return;
    setMode(next);
    setFile(null);
    setFiles([]);
    setBatchStatuses([]);
    setBatchDone(null);
    setError('');
  };

  const handleUploadSingle = async () => {
    if (!file) return;
    if (!jenisKlaim) { setError('Pilih kategori pelayanan (Rawat Jalan/Rawat Inap/IGD) terlebih dahulu.'); return; }
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

  // Socket cuma dibuka selagi batch benar-benar berjalan — supaya tidak ada
  // koneksi menganggur saat user berada di mode batch tapi belum upload.
  const batchSocketRef = useRef<Socket | null>(null);
  useEffect(() => {
    return () => { batchSocketRef.current?.disconnect(); };
  }, []);

  const handleUploadBatch = useCallback(async () => {
    if (files.length === 0) return;
    if (!jenisKlaim) { setError('Pilih kategori pelayanan terlebih dahulu — berlaku untuk semua file dalam batch ini.'); return; }
    setUploading(true);
    setError('');
    setBatchDone(null);
    setBatchStatuses(files.map(f => ({ fileName: f.name, status: 'waiting' })));

    const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000');
    batchSocketRef.current = socket;
    socket.on('pdf-batch:file-done', (data: { fileName: string; success: boolean; error?: string | null }) => {
      setBatchStatuses(prev => prev.map(s =>
        s.fileName === data.fileName ? { ...s, status: data.success ? 'done' : 'failed', error: data.error } : s
      ));
    });

    try {
      const res = await api.uploadPdfBatch(files, jenisKlaim);
      setBatchDone({ successful: res.successful, failed: res.failed });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Batch gagal diunggah. Silakan coba lagi.');
    } finally {
      socket.disconnect();
      batchSocketRef.current = null;
      setUploading(false);
    }
  }, [files, jenisKlaim]);

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
        {/* ── Mode toggle: Single / Batch ── */}
        <div className="upload-mode-toggle" role="tablist" aria-label="Mode upload">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'single'}
            className={`upload-mode-tab ${mode === 'single' ? 'active' : ''}`}
            onClick={() => switchMode('single')}
            disabled={uploading}
          >
            📄 Satu File
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'batch'}
            className={`upload-mode-tab ${mode === 'batch' ? 'active' : ''}`}
            onClick={() => switchMode('batch')}
            disabled={uploading}
          >
            📚 Banyak File (Batch)
          </button>
        </div>

        <div className="form-group" style={{ marginBottom: 20, marginTop: 18 }}>
          <label className="form-label">Kategori Pelayanan</label>
          <div className="category-picker" role="radiogroup" aria-label="Kategori Pelayanan">
            {JENIS_KLAIM_OPTIONS.map(opt => {
              const isSelected = jenisKlaim === opt.value;
              return (
                <motion.button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={`category-card ${isSelected ? 'selected' : ''}`}
                  style={{ ['--category-accent' as string]: opt.accent }}
                  onClick={() => { setJenisKlaim(opt.value); setError(''); }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <span className="category-card-icon">{opt.icon}</span>
                  <span className="category-card-label">{opt.label}</span>
                  <span className="category-card-desc">{opt.desc}</span>
                  <AnimatePresence>
                    {isSelected && (
                      <motion.span
                        className="category-card-check"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                      >
                        ✓
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '8px 0 0' }}>
            {mode === 'batch'
              ? 'Berlaku untuk SEMUA file dalam batch ini — pastikan file yang dipilih sudah dipisah per kategori pelayanan.'
              : 'Dipakai supaya AI tidak salah memberi saran (mis. saran ruangan rawat inap untuk klaim rawat jalan) dan untuk memudahkan pencarian di Riwayat Upload.'}
          </p>
        </div>

        {mode === 'single' ? (
          <>
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
          </>
        ) : (
          <>
            <div
              className={`upload-zone ${dragover ? 'dragover' : ''}`}
              onClick={() => !uploading && fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); if (!uploading) setDragover(true); }}
              onDragLeave={() => setDragover(false)}
              onDrop={e => { e.preventDefault(); setDragover(false); if (!uploading && e.dataTransfer.files.length) addBatchFiles(e.dataTransfer.files); }}
              style={{ cursor: uploading ? 'default' : 'pointer' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div className="upload-zone-icon" style={{ fontSize: 48 }}>📚</div>
                <h3 style={{ margin: 0 }}>Klik atau drag beberapa berkas PDF ke sini</h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Maks {MAX_BATCH_FILES} file, masing-masing maks 20MB — 1 kategori pelayanan untuk semua file</p>
              </div>
            </div>
            <input
              ref={fileInputRef} type="file" accept=".pdf" multiple hidden
              onChange={e => { if (e.target.files?.length) addBatchFiles(e.target.files); e.target.value = ''; }}
            />

            {files.length > 0 && (
              <div className="batch-file-list" style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  {files.length} file dipilih ({formatFileSize(files.reduce((s, f) => s + f.size, 0))})
                </div>
                <AnimatePresence>
                  {files.map((f, i) => {
                    const status = batchStatuses.find(s => s.fileName === f.name);
                    return (
                      <motion.div
                        key={`${f.name}-${f.size}-${i}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="batch-file-row"
                      >
                        <span className="batch-file-icon">📄</span>
                        <span className="batch-file-name" title={f.name}>{f.name}</span>
                        <span className="batch-file-size">{formatFileSize(f.size)}</span>
                        {status && (
                          <span className={`badge batch-file-status-badge badge-${
                            status.status === 'done' ? 'valid' : status.status === 'failed' ? 'error' : status.status === 'processing' ? 'pending' : 'secondary'
                          }`}>
                            {status.status === 'done' ? '✓ Selesai' : status.status === 'failed' ? '✗ Gagal' : status.status === 'processing' ? 'Memproses...' : 'Menunggu'}
                          </span>
                        )}
                        {!uploading && (
                          <button type="button" className="batch-file-remove" onClick={() => removeBatchFile(i)} aria-label={`Hapus ${f.name}`}>✕</button>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}

            {batchDone && (
              <div className="card-accent-blue" style={{ marginTop: 14, padding: '12px 16px', borderRadius: 10, background: 'var(--surface-low)', fontSize: 13 }}>
                Batch selesai — <strong style={{ color: 'var(--green)' }}>{batchDone.successful} berhasil</strong>
                {batchDone.failed > 0 && <> · <strong style={{ color: 'var(--red)' }}>{batchDone.failed} gagal</strong></>}.{' '}
                <button type="button" className="btn btn-secondary btn-sm" style={{ marginLeft: 8 }} onClick={() => router.push('/history')}>
                  Lihat di Riwayat Upload →
                </button>
              </div>
            )}
          </>
        )}

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
          {mode === 'single' ? (
            <>
              <button
                className="btn btn-primary btn-lg"
                style={{ flex: 1, justifyContent: 'center', alignItems: 'center', display: 'flex' }}
                onClick={handleUploadSingle}
                disabled={!file || !jenisKlaim || uploading}
              >
                {uploading ? (<><span className="btn-spinner" />Memproses...</>) : '🚀 Upload & Ekstrak'}
              </button>
              {file && !uploading && (
                <button className="btn btn-secondary" onClick={() => { setFile(null); setError(''); }}>Batal</button>
              )}
            </>
          ) : (
            <>
              <button
                className="btn btn-primary btn-lg"
                style={{ flex: 1, justifyContent: 'center', alignItems: 'center', display: 'flex' }}
                onClick={handleUploadBatch}
                disabled={files.length === 0 || !jenisKlaim || uploading}
              >
                {uploading ? (<><span className="btn-spinner" />Memproses {batchStatuses.filter(s => s.status === 'done' || s.status === 'failed').length}/{files.length}...</>) : `🚀 Upload & Ekstrak Semua (${files.length} file)`}
              </button>
              {files.length > 0 && !uploading && (
                <button className="btn btn-secondary" onClick={() => { setFiles([]); setBatchStatuses([]); setBatchDone(null); setError(''); }}>Kosongkan</button>
              )}
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
