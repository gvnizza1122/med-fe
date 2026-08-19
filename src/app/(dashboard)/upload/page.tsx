'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { api } from '@/lib/api';
import { io } from 'socket.io-client';
import { Header } from '@/components/dashboard/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  UploadCloud,
  FileText,
  FileSpreadsheet,
  Rocket,
  X,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
    transition: { duration: 0.2, ease: 'easeInOut' as const }
  }
};

const fileIconVariants: Variants = {
  hidden: { scale: 0, rotate: -180 },
  visible: {
    scale: 1,
    rotate: 0,
    transition: { type: 'spring', stiffness: 200, damping: 15 }
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

  const getFileIcon = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop();
    if (ext === 'csv') return FileSpreadsheet;
    if (ext === 'tsv') return ClipboardList;
    return FileText;
  };

  return (
    <motion.div
      className="space-y-4 md:space-y-6"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <Header title="Upload File Klaim" description="Upload file TXT/TSV dari SIMRS untuk divalidasi" />

      <AnimatePresence mode="wait">
        {!result ? (
          <motion.div
            key="upload-form"
            className="mx-auto w-full max-w-2xl"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, x: -50 }}
          >
            <Card className="rounded-2xl">
              <CardContent className="space-y-5">
                {/* Upload Zone */}
                <motion.div
                  animate={dragover ? 'dragover' : 'idle'}
                  variants={uploadZoneVariants}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragover(true); }}
                  onDragLeave={() => setDragover(false)}
                  onDrop={e => { e.preventDefault(); setDragover(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
                  className={cn(
                    'relative cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors duration-300',
                    dragover
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-muted/40'
                  )}
                >
                  <AnimatePresence mode="wait">
                    {file ? (
                      <motion.div
                        key="file-selected"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.3 }}
                        className="flex flex-col items-center gap-2"
                      >
                        <div className="flex items-center gap-4 rounded-xl border bg-card px-6 py-4 shadow-sm">
                          <motion.div
                            variants={fileIconVariants}
                            initial="hidden"
                            animate="visible"
                            className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"
                          >
                            {(() => {
                              const Icon = getFileIcon(file.name);
                              return <Icon className="h-6 w-6" />;
                            })()}
                          </motion.div>
                          <div className="text-left">
                            <motion.h3
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.2 }}
                              className="break-all text-sm font-semibold text-foreground"
                            >
                              {file.name}
                            </motion.h3>
                            <motion.p
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.3 }}
                              className="mt-1 text-xs font-medium text-muted-foreground"
                            >
                              {formatFileSize(file.size)}
                            </motion.p>
                          </div>
                        </div>
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.4 }}
                          className="text-xs text-muted-foreground"
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
                        className="flex flex-col items-center gap-2"
                      >
                        <motion.div
                          animate={{ y: [0, -5, 0] }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' as const }}
                          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"
                        >
                          <UploadCloud className="h-7 w-7" />
                        </motion.div>
                        <h3 className="text-sm font-semibold text-foreground">Klik atau drag file ke sini</h3>
                        <p className="text-xs text-muted-foreground">Mendukung file .TXT, .TSV, .CSV (maks 10MB)</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
                <input ref={fileInputRef} type="file" accept=".txt,.tsv,.csv" hidden onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />

                {/* Period Input */}
                <motion.div variants={staggerItem} className="space-y-1.5">
                  <Label htmlFor="period">Periode Klaim (Opsional)</Label>
                  <Input id="period" type="month" value={period} onChange={e => setPeriod(e.target.value)} placeholder="YYYY-MM" />
                </motion.div>

                {/* Error Message */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, y: -10, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="flex items-center gap-2 overflow-hidden rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
                    >
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Progress Section */}
                <AnimatePresence>
                  {uploading && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.4 }}
                      className="space-y-3"
                    >
                      {/* Progress Steps */}
                      <div className="flex justify-between gap-2">
                        {progressSteps.map((step, i) => {
                          const isActive = activeStep === step.key;
                          const isCompleted = progressSteps.findIndex(s => s.key === activeStep) > i;
                          return (
                            <motion.div
                              key={step.key}
                              animate={isActive ? { scale: [1, 1.05, 1] } : {}}
                              transition={{ duration: 1, repeat: isActive ? Infinity : 0 }}
                              className={cn(
                                'flex flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 transition-colors',
                                isActive ? 'bg-primary/10' : isCompleted ? 'bg-primary/5' : 'bg-transparent'
                              )}
                            >
                              <span className="text-base">{isCompleted ? '✅' : step.icon}</span>
                              <span
                                className={cn(
                                  'text-[11px]',
                                  isActive ? 'font-bold text-primary' : isCompleted ? 'font-medium text-primary/70' : 'font-medium text-muted-foreground'
                                )}
                              >
                                {step.label}
                              </span>
                            </motion.div>
                          );
                        })}
                      </div>

                      {/* Progress Bar */}
                      <div className="flex items-center justify-between text-xs">
                        <motion.span
                          key={statusMsg}
                          initial={{ opacity: 0, x: -5 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="font-semibold text-primary"
                        >
                          {statusMsg}
                        </motion.span>
                        <motion.span key={progress} initial={{ scale: 1.2 }} animate={{ scale: 1 }} className="font-semibold">
                          {progress}%
                        </motion.span>
                      </div>
                      <Progress value={progress} />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Action Buttons */}
                <motion.div variants={staggerItem} className="flex gap-3 pt-1">
                  <motion.div
                    className="flex-1"
                    whileHover={!(!file || uploading) ? buttonHover : {}}
                    whileTap={!(!file || uploading) ? buttonTap : {}}
                  >
                    <Button
                      className="w-full"
                      size="lg"
                      onClick={handleUpload}
                      disabled={!file || uploading}
                    >
                      {uploading ? (
                        <>
                          <span className="mr-1 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          Memproses...
                        </>
                      ) : (
                        <>
                          <Rocket className="h-4 w-4" />
                          Upload &amp; Validasi
                        </>
                      )}
                    </Button>
                  </motion.div>
                  <AnimatePresence>
                    {file && !uploading && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8, width: 0 }}
                        animate={{ opacity: 1, scale: 1, width: 'auto' }}
                        exit={{ opacity: 0, scale: 0.8, width: 0 }}
                        whileHover={buttonHover}
                        whileTap={buttonTap}
                      >
                        <Button variant="outline" size="lg" onClick={() => { setFile(null); setError(''); }}>
                          <X className="h-4 w-4" />
                          Batal
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="success"
            className="mx-auto w-full max-w-2xl"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.5, type: 'spring' }}
          >
            <Card className="rounded-2xl text-center">
              <CardContent>
                {/* Confetti-like celebration */}
                <div className="relative h-20 overflow-visible">
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
                        background: ['var(--primary)', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][i % 6]
                      }}
                      initial="initial"
                      animate="animate"
                      variants={confettiPiece(i)}
                    />
                  ))}
                </div>

                {/* Success checkmark */}
                <motion.div variants={successVariants} initial="hidden" animate="visible" className="mb-4 flex justify-center">
                  <CheckCircle2 className="h-16 w-16 text-primary" />
                </motion.div>

                <motion.h3
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mb-2 text-xl font-bold text-foreground"
                >
                  File Berhasil Divalidasi!
                </motion.h3>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="mb-6 break-all text-sm text-muted-foreground"
                >
                  {file?.name}
                </motion.p>

                {/* Stats Grid */}
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={staggerContainer}
                  className="mx-auto mb-6 grid max-w-md grid-cols-3 gap-3"
                >
                  <motion.div
                    variants={staggerItem}
                    whileHover={{ scale: 1.05, y: -2 }}
                    className="rounded-xl border bg-muted/40 p-4"
                  >
                    <div className="text-xs font-medium text-muted-foreground">Total</div>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.5, type: 'spring' }}
                      className="text-2xl font-bold text-foreground"
                    >
                      {result.summary.total_records}
                    </motion.div>
                  </motion.div>
                  <motion.div
                    variants={staggerItem}
                    whileHover={{ scale: 1.05, y: -2 }}
                    className="rounded-xl border border-primary/30 bg-primary/5 p-4"
                  >
                    <div className="text-xs font-medium text-muted-foreground">Valid</div>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.6, type: 'spring' }}
                      className="text-2xl font-bold text-primary"
                    >
                      {result.summary.valid}
                    </motion.div>
                  </motion.div>
                  <motion.div
                    variants={staggerItem}
                    whileHover={{ scale: 1.05, y: -2 }}
                    className="rounded-xl border border-destructive/30 bg-destructive/5 p-4"
                  >
                    <div className="text-xs font-medium text-muted-foreground">Error</div>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.7, type: 'spring' }}
                      className="text-2xl font-bold text-destructive"
                    >
                      {result.summary.error}
                    </motion.div>
                  </motion.div>
                </motion.div>

                {/* Action Buttons */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  className="flex justify-center gap-3"
                >
                  <motion.div whileHover={buttonHover} whileTap={buttonTap}>
                    <Button onClick={() => router.push(`/results/${result.file_id}`)}>
                      <ClipboardList className="h-4 w-4" />
                      Lihat Detail
                    </Button>
                  </motion.div>
                  <motion.div whileHover={buttonHover} whileTap={buttonTap}>
                    <Button variant="outline" onClick={() => { setFile(null); setResult(null); setProgress(0); }}>
                      <UploadCloud className="h-4 w-4" />
                      Upload Lagi
                    </Button>
                  </motion.div>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
