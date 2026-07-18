'use client';
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';

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
      setSuccess(`✅ Berhasil import ${result.records_count || 1} rekam SIMRS`);
      setJsonInput('');
      onSuccess?.(result);
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal import JSON');
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
      setSuccess(`✅ Berhasil upload ${pdfFiles.length} file PDF`);
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

  if (!isOpen) return null;

  return (
    <motion.div
      className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full max-w-2xl max-h-96"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold">⬆️ Import SIMRS Data</h2>
          <motion.button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-2xl"
            whileHover={{ rotate: 90 }}
            whileTap={{ scale: 0.9 }}
          >
            ✕
          </motion.button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
          {(['json', 'pdf'] as const).map(t => (
            <motion.button
              key={t}
              onClick={() => { setTab(t); setError(''); setSuccess(''); }}
              className={`px-4 py-2 rounded font-medium transition-all ${
                tab === t
                  ? 'bg-blue-500 text-white'
                  : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {t === 'json' ? '📄 JSON Import' : '📑 PDF Upload'}
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
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Paste JSON SIMRS data:
                </label>
                <textarea
                  value={jsonInput}
                  onChange={e => setJsonInput(e.target.value)}
                  placeholder='{"data": [...], "metadata": {...}}'
                  className="w-full h-32 p-3 border border-slate-300 dark:border-slate-600 rounded font-mono text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <motion.div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
                    dragOverRef.current
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-slate-300 dark:border-slate-600 hover:border-slate-400'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="text-3xl mb-2">📤</div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">Drag & drop PDF di sini</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">atau klik untuk pilih file</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </motion.div>

                {pdfFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      📁 {pdfFiles.length} file dipilih:
                    </p>
                    {pdfFiles.map((f, idx) => (
                      <motion.div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-slate-100 dark:bg-slate-800 rounded text-sm"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                      >
                        <span className="truncate text-slate-900 dark:text-slate-100">
                          📄 {f.name} ({(f.size / 1024).toFixed(0)}KB)
                        </span>
                        <motion.button
                          onClick={() => removePdfFile(idx)}
                          className="text-red-500 hover:text-red-700 font-bold ml-2"
                          whileHover={{ scale: 1.2 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          ✕
                        </motion.button>
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
              <motion.div
                className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm"
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                ❌ {error}
              </motion.div>
            )}
            {success && (
              <motion.div
                className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-green-700 dark:text-green-300 text-sm"
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {success}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
          <motion.button
            onClick={onClose}
            className="px-4 py-2 rounded font-medium bg-slate-300 dark:bg-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-400 dark:hover:bg-slate-600"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Batal
          </motion.button>
          <motion.button
            onClick={tab === 'json' ? handleJsonProcess : handlePdfProcess}
            disabled={loading || (tab === 'json' ? !jsonInput.trim() : pdfFiles.length === 0)}
            className={`ml-auto px-4 py-2 rounded font-medium text-white transition-all ${
              loading || (tab === 'json' ? !jsonInput.trim() : pdfFiles.length === 0)
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
            whileHover={loading ? {} : { scale: 1.02 }}
            whileTap={loading ? {} : { scale: 0.98 }}
          >
            {loading ? '⏳ Proses...' : tab === 'json' ? '🚀 Import JSON' : '🚀 Upload PDF'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
