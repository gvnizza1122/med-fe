'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { io } from 'socket.io-client';

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

    socket.on('validation:error', (data) => {
      if (data.fileId === generatedFileId) {
        setError(data.errors?.map((e: any) => e.message).join('; ') || 'Gagal memproses file.');
      }
    });

    try {
      const data = await api.uploadFile(file, period, generatedFileId);
      setProgress(100);
      setStatusMsg('Selesai!');
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload gagal');
    } finally {
      socket.disconnect();
      setUploading(false);
    }
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h2>Upload File Klaim</h2>
          <p>Upload file TXT/TSV dari SIMRS untuk divalidasi</p>
        </div>
      </div>

      {!result ? (
        <div className="card" style={{ maxWidth: 700, margin: '0 auto' }}>
          <div
            className={`upload-zone ${dragover ? 'dragover' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragover(true); }}
            onDragLeave={() => setDragover(false)}
            onDrop={e => { e.preventDefault(); setDragover(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
          >
            <div className="upload-zone-icon">{file ? '📄' : '📤'}</div>
            {file ? (
              <>
                <h3>{file.name}</h3>
                <p>{(file.size / 1024).toFixed(1)} KB</p>
              </>
            ) : (
              <>
                <h3>Klik atau drag file ke sini</h3>
                <p>Mendukung file .TXT, .TSV, .CSV (maks 10MB)</p>
              </>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept=".txt,.tsv,.csv" hidden onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />

          <div className="form-group" style={{ marginTop: 20 }}>
            <label className="form-label">Periode Klaim (Opsional)</label>
            <input type="month" className="form-input" value={period} onChange={e => setPeriod(e.target.value)} placeholder="YYYY-MM" />
          </div>

          {error && <div className="login-error" style={{ marginTop: 16 }}>⚠️ {error}</div>}

          {uploading && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                <span style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>{statusMsg}</span>
                <span>{progress}%</span>
              </div>
              <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${progress}%`, transition: 'width 0.3s ease' }} /></div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            <button className="btn btn-primary btn-lg" style={{ flex: 1, justifyContent: 'center' }} onClick={handleUpload} disabled={!file || uploading}>
              {uploading ? '⏳ Memproses...' : '🚀 Upload & Validasi'}
            </button>
            {file && !uploading && (
              <button className="btn btn-secondary" onClick={() => { setFile(null); setError(''); }}>Batal</button>
            )}
          </div>
        </div>
      ) : (
        <div className="card fade-in" style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
          <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>File Berhasil Divalidasi!</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>{file?.name}</p>

          <div className="stats-grid" style={{ maxWidth: 500, margin: '0 auto 24px' }}>
            <div className="stat-card blue">
              <div className="stat-card-label">Total</div>
              <div className="stat-card-value" style={{ fontSize: 24 }}>{result.summary.total_records}</div>
            </div>
            <div className="stat-card green">
              <div className="stat-card-label">Valid</div>
              <div className="stat-card-value" style={{ fontSize: 24, color: 'var(--accent-green)' }}>{result.summary.valid}</div>
            </div>
            <div className="stat-card red">
              <div className="stat-card-label">Error</div>
              <div className="stat-card-value" style={{ fontSize: 24, color: 'var(--accent-red)' }}>{result.summary.error}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => router.push(`/results/${result.file_id}`)}>📋 Lihat Detail</button>
            <button className="btn btn-secondary" onClick={() => { setFile(null); setResult(null); setProgress(0); }}>📤 Upload Lagi</button>
          </div>
        </div>
      )}
    </div>
  );
}
