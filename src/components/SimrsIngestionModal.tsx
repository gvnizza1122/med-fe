'use client';
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, FileText, X, Loader2, Rocket } from 'lucide-react';
import { api } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface SimrsIngestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: any) => void;
}

export default function SimrsIngestionModal({ isOpen, onClose, onSuccess }: SimrsIngestionModalProps) {
  const [tab, setTab] = useState<'json' | 'pdf'>('json');
  const [jsonInput, setJsonInput] = useState('');
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragOverRef = useRef(false);

  const validateJson = (text: string): Record<string, unknown> | null => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  };

  const handleJsonProcess = async () => {
    setError('');
    setSuccess('');

    const parsed = validateJson(jsonInput);
    if (!parsed) {
      setError('Format JSON tidak valid. Periksa kembali struktur data.');
      return;
    }

    setLoading(true);
    try {
      const result = await api.ingestSimrsJson(parsed);
      setSuccess(`Berhasil import ${result.records_count || 1} rekam SIMRS`);
      setJsonInput('');
      onSuccess?.(result);
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Data gagal dimasukkan. Periksa kembali berkas Anda.');
    } finally {
      setLoading(false);
    }
  };

  const handlePdfProcess = async () => {
    setError('');
    setSuccess('');

    if (pdfFiles.length === 0) {
      setError('Pilih minimal 1 file PDF');
      return;
    }

    setLoading(true);
    try {
      const results = [];
      for (const file of pdfFiles) {
        const result = await api.ingestSimrsPdf(file);
        results.push(result);
      }
      setSuccess(`Berhasil upload ${pdfFiles.length} file PDF`);
      setPdfFiles([]);
      onSuccess?.(results);
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal upload PDF');
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    dragOverRef.current = true;
  };

  const handleDragLeave = () => {
    dragOverRef.current = false;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragOverRef.current = false;
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
    if (files.length > 0) setPdfFiles(prev => [...prev, ...files as File[]]);
    else setError('Hanya file PDF yang diterima');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.currentTarget.files || []);
    if (files.length > 0) setPdfFiles(prev => [...prev, ...files]);
  };

  const removePdfFile = (idx: number) => {
    setPdfFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const busy = loading || (tab === 'json' ? !jsonInput.trim() : pdfFiles.length === 0);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="flex flex-row items-center justify-between px-6 py-4 border-b border-border space-y-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <UploadCloud className="w-5 h-5 text-primary" />
            Import SIMRS Data
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-2 p-4 border-b border-border bg-muted/40">
          {(['json', 'pdf'] as const).map(t => (
            <motion.button
              key={t}
              onClick={() => { setTab(t); setError(''); setSuccess(''); }}
              className={cn(
                'px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 flex items-center gap-1.5',
                tab === t
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                  : 'bg-card text-muted-foreground hover:text-foreground border border-border',
              )}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <FileText className="w-4 h-4" />
              {t === 'json' ? 'JSON Import' : 'PDF Upload'}
            </motion.button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-64">
          <AnimatePresence mode="wait">
            {tab === 'json' && (
              <motion.div
                key="json"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                <label className="block text-sm font-medium text-foreground">
                  Paste JSON SIMRS data:
                </label>
                <Textarea
                  value={jsonInput}
                  onChange={e => setJsonInput(e.target.value)}
                  placeholder='{"data": [...], "metadata": {...}}'
                  className="h-32 font-mono text-sm"
                />
              </motion.div>
            )}

            {tab === 'pdf' && (
              <motion.div
                key="pdf"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-2xl p-6 text-center cursor-pointer transition-all duration-300 hover:border-primary/50 hover:bg-primary/5"
                >
                  <UploadCloud className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="font-medium text-foreground text-sm">Drag & drop PDF di sini</p>
                  <p className="text-xs text-muted-foreground">atau klik untuk pilih file</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>

                {pdfFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      {pdfFiles.length} file dipilih:
                    </p>
                    {pdfFiles.map((f, idx) => (
                      <motion.div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                      >
                        <span className="truncate text-foreground flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                          {f.name} ({(f.size / 1024).toFixed(0)}KB)
                        </span>
                        <button
                          onClick={() => removePdfFile(idx)}
                          className="text-destructive hover:text-destructive/80 ml-2"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error/Success */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3">
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              </motion.div>
            )}
            {success && (
              <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3">
                <Alert className="border-primary/30 bg-primary/5 text-primary">
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-border bg-muted/40">
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button
            onClick={tab === 'json' ? handleJsonProcess : handlePdfProcess}
            disabled={busy}
            className="ml-auto gap-2 hover:shadow-lg hover:shadow-primary/20 hover:scale-105 transition-all duration-300"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
            {loading ? 'Proses...' : tab === 'json' ? 'Import JSON' : 'Upload PDF'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
