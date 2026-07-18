'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { api } from '@/lib/api';
import { io } from 'socket.io-client';

// Animation variants
const pageVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.3 } }
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 }
  }
};

const staggerItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

const uploadZoneVariants: Variants = {
  idle: {
    scale: 1,
    transition: { duration: 0.3 }
  },
  dragover: {
    scale: 1.02,
    boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.3)',
    transition: { duration: 0.2, ease: 'easeInOut' as const }
  }
};

const borderAnimation: Variants = {
  animate: {
    backgroundPosition: ['0% 0%', '100% 100%'],
    transition: { duration: 3, repeat: Infinity, ease: 'linear' as const }
  }
};

const fileIconVariants: Variants = {
  hidden: { scale: 0, rotate: -180 },
  visible: {
    scale: 1,
    rotate: 0,
    transition: { type: 'spring', stiffness: 200, damping: 15 }
  },
  bounce: {
    y: [0, -10, 0],
    transition: { duration: 0.6, repeat: Infinity, repeatType: 'reverse' as const }
  }
};

const progressSteps = [
  { key: 'upload', label: 'Upload', icon: '📤' },
  { key: 'parse', label: 'Parse', icon: '📄' },
  { key: 'validate', label: 'Validate', icon: '✓' },
  { key: 'complete', label: 'Complete', icon: '🎉' }
];

const getActiveStep = (statusMsg: string, progress: number): string => {
  if (progress >= 100) return 'complete';
  if (statusMsg.includes('AI Medical') || statusMsg.includes('Rule Engine')) return 'validate';
  if (statusMsg.includes('Membaca') || statusMsg.includes('memproses')) return 'parse';
  return 'upload';
};

const shimmerVariants: Variants = {
  animate: {
    x: ['-100%', '200%'],
    transition: { duration: 1.5, repeat: Infinity, ease: 'linear' as const }
  }
};

const successVariants: Variants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { type: 'spring', stiffness: 200, damping: 20, delay: 0.1 }
  }
};

const confettiPiece = (i: number): Variants => ({
  initial: { y: -20, opacity: 0, scale: 0 },
  animate: {
    y: [0, -100 - Math.random() * 50, 50],
    x: (Math.random() - 0.5) * 200,
    rotate: Math.random() * 720,
    opacity: [0, 1, 0],
    scale: [0, 1, 0.5],
    transition: { duration: 1.5 + Math.random() * 0.5, delay: i * 0.05, ease: 'easeOut' as const }
  }
});

const buttonHover = {
  scale: 1.02,
  transition: { duration: 0.2 }
};

const buttonTap = {
  scale: 0.98,
  transition: { duration: 0.1 }
};

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [period, setPeriod] = useState('');
  const [dragover, setDragover] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('Mengunggah file...');
  const [result, setResult] = useState<{ file_id: string; summary: { total_records: number; valid: number; error: number; pending: number } } | null>(null);
  const [error, setError] = useState('');

  const handleFile = (f: File) => {
    const ext = f.name.toLowerCase().split('.').pop();
    if (!['txt', 'tsv', 'csv'].includes(ext || '')) {
      setError('Hanya file TXT, TSV, atau CSV yang diperbolehkan.');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('Ukuran file maksimal 10MB.');
      return;
    }
    setFile(f);
    setError('');
    setResult(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    setProgress(5);
    setStatusMsg('Mengunggah file ke server...');

    const generatedFileId = 'UP-' + Math.random().toString(36).substring(2, 10).toUpperCase() + '-' + Date.now().toString().substring(5);
    const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000');

    socket.on('validation:status', (data) => {
      if (data.fileId === generatedFileId) {
        setProgress(data.progress);
        if (data.message) {
          setStatusMsg(data.message);
        } else {
          if (data.status === 'parsing') setStatusMsg('Membaca dan memproses format file...');
          else if (data.status === 'validating') setStatusMsg('Menjalankan Rule Engine BPJS...');
          else if (data.status === 'ai_auditing') setStatusMsg('Menjalankan AI Medical Auditor...');
          else if (data.status === 'completed') setStatusMsg('Proses validasi selesai!');
        }
      }
    });

    socket.on('validation:error', (data: { fileId?: string; errors?: Array<{ message: string }> }) => {
      if (data.fileId === generatedFileId) {
        setError(data.errors?.map((e) => e.message).join('; ') || 'Gagal memproses file.');
      }
    });

    try {
      const data = await api.uploadFile(file, period, generatedFileId);
      setProgress(100);
      setStatusMsg('Selesai!');
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload gagal');
      console.error('[Upload Error]', err);
    } finally {
      socket.disconnect();
      setUploading(false);
    }
  };

  const activeStep = getActiveStep(statusMsg, progress);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (filename: string): string => {
    const ext = filename.toLowerCase().split('.').pop();
    if (ext === 'csv') return '📊';
    if (ext === 'tsv') return '📋';
    return '📄';
  };

  return (
    <motion.div
      className="fade-in"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <div className="page-header">
        <div>
          <h2>Upload File Klaim</h2>
          <p>Upload file TXT/TSV dari SIMRS untuk divalidasi</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!result ? (
          <motion.div
            key="upload-form"
            className="card"
            style={{ maxWidth: 700, margin: '0 auto' }}
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, x: -50 }}
          >
            {/* Upload Zone */}
            <motion.div
              variants={staggerItem}
              className={`upload-zone ${dragover ? 'dragover' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragover(true); }}
              onDragLeave={() => setDragover(false)}
              onDrop={e => { e.preventDefault(); setDragover(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
              animate={dragover ? 'dragover' : 'idle'}
              style={{
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer'
              }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              {/* Animated dashed border overlay */}
              <motion.div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 'inherit',
                  border: '2px dashed var(--accent-blue)',
                  opacity: dragover ? 0.8 : 0.3,
                  pointerEvents: 'none'
                }}
                animate={{
                  borderColor: dragover
                    ? ['rgba(59,130,246,0.8)', 'rgba(59,130,246,0.4)', 'rgba(59,130,246,0.8)']
                    : ['rgba(59,130,246,0.3)', 'rgba(59,130,246,0.15)', 'rgba(59,130,246,0.3)']
                }}
                transition={{ duration: 2, repeat: Infinity }}
              />

              {/* Pulse effect on dragover */}
              <AnimatePresence>
                {dragover && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1, repeat: Infinity }}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: 'inherit',
                      border: '2px solid var(--accent-blue)',
                      pointerEvents: 'none'
                    }}
                  />
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait">
                {file ? (
                  <motion.div
                    key="file-selected"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3 }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
                  >
                    {/* File preview card */}
                    <motion.div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        padding: '16px 24px',
                        background: 'var(--bg-card, rgba(59,130,246,0.05))',
                        borderRadius: 12,
                        border: '1px solid rgba(59,130,246,0.2)'
                      }}
                    >
                      <motion.div
                        style={{ fontSize: 40 }}
                        variants={fileIconVariants}
                        initial="hidden"
                        animate="visible"
                      >
                        {getFileIcon(file.name)}
                      </motion.div>
                      <div style={{ textAlign: 'left' }}>
                        <motion.h3
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2 }}
                          style={{ margin: 0, fontSize: 16, fontWeight: 600, wordBreak: 'break-all' }}
                        >
                          {file.name}
                        </motion.h3>
                        <motion.p
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 }}
                          style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}
                        >
                          {formatFileSize(file.size)}
                        </motion.p>
                      </div>
                    </motion.div>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}
                    >
                      Klik atau drag untuk mengganti file
                    </motion.p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty-state"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
                  >
                    <motion.div
                      className="upload-zone-icon"
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' as const }}
                      style={{ fontSize: 48 }}
                    >
                      📤
                    </motion.div>
                    <h3 style={{ margin: 0 }}>Klik atau drag file ke sini</h3>
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Mendukung file .TXT, .TSV, .CSV (maks 10MB)</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
            <input ref={fileInputRef} type="file" accept=".txt,.tsv,.csv" hidden onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />

            {/* Period Input */}
            <motion.div className="form-group" style={{ marginTop: 20 }} variants={staggerItem}>
              <label className="form-label">Periode Klaim (Opsional)</label>
              <input type="month" className="form-input" value={period} onChange={e => setPeriod(e.target.value)} placeholder="YYYY-MM" />
            </motion.div>

            {/* Error Message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  className="login-error"
                  style={{ marginTop: 16 }}
                  initial={{ opacity: 0, y: -10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  ⚠️ {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Progress Section */}
            <AnimatePresence>
              {uploading && (
                <motion.div
                  style={{ marginTop: 16 }}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  {/* Progress Steps */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 8 }}>
                    {progressSteps.map((step, i) => {
                      const isActive = activeStep === step.key;
                      const isCompleted = progressSteps.findIndex(s => s.key === activeStep) > i;
                      return (
                        <motion.div
                          key={step.key}
                          style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 4,
                            padding: '8px 4px',
                            borderRadius: 8,
                            background: isActive ? 'rgba(59,130,246,0.1)' : isCompleted ? 'rgba(34,197,94,0.08)' : 'transparent',
                            transition: 'background 0.3s'
                          }}
                          animate={isActive ? { scale: [1, 1.05, 1] } : {}}
                          transition={{ duration: 1, repeat: isActive ? Infinity : 0 }}
                        >
                          <motion.span
                            style={{ fontSize: 18 }}
                            animate={isActive ? { rotate: [0, 10, -10, 0] } : {}}
                            transition={{ duration: 0.5, repeat: isActive ? Infinity : 0, repeatDelay: 0.5 }}
                          >
                            {isCompleted ? '✅' : step.icon}
                          </motion.span>
                          <span style={{
                            fontSize: 11,
                            fontWeight: isActive ? 700 : 500,
                            color: isActive ? 'var(--accent-blue)' : isCompleted ? 'var(--accent-green)' : 'var(--text-secondary)'
                          }}>
                            {step.label}
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Progress Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                    <motion.span
                      style={{ fontWeight: 600, color: 'var(--accent-blue)' }}
                      key={statusMsg}
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                    >
                      {statusMsg}
                    </motion.span>
                    <motion.span
                      key={progress}
                      initial={{ scale: 1.2 }}
                      animate={{ scale: 1 }}
                      style={{ fontWeight: 600 }}
                    >
                      {progress}%
                    </motion.span>
                  </div>
                  <div className="progress-bar" style={{ position: 'relative', overflow: 'hidden', borderRadius: 8 }}>
                    <motion.div
                      className="progress-bar-fill"
                      style={{
                        height: '100%',
                        borderRadius: 8,
                        background: 'linear-gradient(90deg, var(--accent-blue), #818cf8, var(--accent-blue))',
                        backgroundSize: '200% 100%',
                        position: 'relative'
                      }}
                      initial={{ width: '0%' }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' as const }}
                    >
                      {/* Shimmer effect */}
                      <motion.div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '50%',
                          height: '100%',
                          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                          borderRadius: 8
                        }}
                        variants={shimmerVariants}
                        animate="animate"
                      />
                    </motion.div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action Buttons */}
            <motion.div style={{ display: 'flex', gap: 12, marginTop: 20 }} variants={staggerItem}>
              <motion.button
                className="btn btn-primary btn-lg"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={handleUpload}
                disabled={!file || uploading}
                whileHover={!(!file || uploading) ? buttonHover : {}}
                whileTap={!(!file || uploading) ? buttonTap : {}}
              >
                {uploading ? '⏳ Memproses...' : '🚀 Upload & Validasi'}
              </motion.button>
              <AnimatePresence>
                {file && !uploading && (
                  <motion.button
                    className="btn btn-secondary"
                    onClick={() => { setFile(null); setError(''); }}
                    initial={{ opacity: 0, scale: 0.8, width: 0 }}
                    animate={{ opacity: 1, scale: 1, width: 'auto' }}
                    exit={{ opacity: 0, scale: 0.8, width: 0 }}
                    whileHover={buttonHover}
                    whileTap={buttonTap}
                  >
                    Batal
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="success"
            className="card"
            style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.5, type: 'spring' }}
          >
            {/* Confetti-like celebration */}
            <div style={{ position: 'relative', height: 80, overflow: 'visible' }}>
              {Array.from({ length: 20 }).map((_, i) => (
                <motion.div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: 8,
                    height: 8,
                    borderRadius: i % 2 === 0 ? '50%' : 2,
                    background: ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][i % 6]
                  }}
                  initial="initial"
                  animate="animate"
                  variants={confettiPiece(i)}
                />
              ))}
            </div>

            {/* Success checkmark */}
            <motion.div
              style={{ fontSize: 64, marginBottom: 16 }}
              variants={successVariants}
              initial="hidden"
              animate="visible"
            >
              ✅
            </motion.div>

            <motion.h3
              style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              File Berhasil Divalidasi!
            </motion.h3>
            <motion.p
              style={{ color: 'var(--text-secondary)', marginBottom: 24 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              {file?.name}
            </motion.p>

            {/* Stats Grid */}
            <motion.div
              className="stats-grid"
              style={{ maxWidth: 500, margin: '0 auto 24px' }}
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
            >
              <motion.div className="stat-card blue" variants={staggerItem} whileHover={{ scale: 1.05, y: -2 }}>
                <div className="stat-card-label">Total</div>
                <motion.div
                  className="stat-card-value"
                  style={{ fontSize: 24 }}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5, type: 'spring' }}
                >
                  {result.summary.total_records}
                </motion.div>
              </motion.div>
              <motion.div className="stat-card green" variants={staggerItem} whileHover={{ scale: 1.05, y: -2 }}>
                <div className="stat-card-label">Valid</div>
                <motion.div
                  className="stat-card-value"
                  style={{ fontSize: 24, color: 'var(--accent-green)' }}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.6, type: 'spring' }}
                >
                  {result.summary.valid}
                </motion.div>
              </motion.div>
              <motion.div className="stat-card red" variants={staggerItem} whileHover={{ scale: 1.05, y: -2 }}>
                <div className="stat-card-label">Error</div>
                <motion.div
                  className="stat-card-value"
                  style={{ fontSize: 24, color: 'var(--accent-red)' }}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.7, type: 'spring' }}
                >
                  {result.summary.error}
                </motion.div>
              </motion.div>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
              style={{ display: 'flex', gap: 12, justifyContent: 'center' }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              <motion.button
                className="btn btn-primary"
                onClick={() => router.push(`/results/${result.file_id}`)}
                whileHover={buttonHover}
                whileTap={buttonTap}
              >
                📋 Lihat Detail
              </motion.button>
              <motion.button
                className="btn btn-secondary"
                onClick={() => { setFile(null); setResult(null); setProgress(0); }}
                whileHover={buttonHover}
                whileTap={buttonTap}
              >
                📤 Upload Lagi
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
