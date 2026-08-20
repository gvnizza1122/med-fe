'use client';
// Upload Jawaban Pending BPJS + draft klarifikasi AI (item 9). Alur: koder
// upload PDF surat pending BPJS -> backend ekstrak teks + AI analisis alasan
// pending + generate draft klarifikasi (dengan few-shot dari kasus serupa
// yang sudah pernah disetujui, lihat ai_training_examples) -> koder edit
// draft -> tandai dikirim -> setelah BPJS balas, tandai diterima/ditolak.
// Draft yang diterima otomatis jadi "memori" AI untuk kasus berikutnya.
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { UploadCloud, CheckCircle2, XCircle, Send } from 'lucide-react';

interface PendingItem {
  id: string;
  sep: string | null;
  tanggal_pending: string | null;
  alasan_raw: string;
  alasan_parsed: { kategori?: string; detail?: string; field?: string[]; checklist_dokumen_pendukung?: string[] } | null;
  draft_klarifikasi: string | null;
  status: string;
  outcome: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', dikirim: 'Sudah Dikirim', diterima: 'Diterima', ditolak: 'Ditolak',
};

export function BpjsPendingModal({
  open, onOpenChange, recordId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordId: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [poinKunci, setPoinKunci] = useState<Record<string, string>>({});

  const loadItems = async () => {
    try {
      setLoading(true);
      const res = await api.getBpjsPending(recordId);
      setItems(res.items || []);
    } catch (err) {
      console.error('[BpjsPending] gagal memuat:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) loadItems(); }, [open, recordId]);

  const handleUpload = async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Hanya file PDF yang diperbolehkan.');
      return;
    }
    setError('');
    setUploading(true);
    try {
      await api.uploadBpjsPending(recordId, file);
      await loadItems();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal mengunggah/menganalisis dokumen.');
    } finally {
      setUploading(false);
    }
  };

  const updateDraft = (id: string, draft: string) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, draft_klarifikasi: draft } : it));
  };

  const handleMarkSent = async (item: PendingItem) => {
    try {
      await api.updateBpjsPendingStatus(item.id, { status: 'dikirim', draft_klarifikasi: item.draft_klarifikasi || '' });
      await loadItems();
    } catch (err) {
      console.error('[BpjsPending] gagal tandai dikirim:', err);
    }
  };

  const handleOutcome = async (item: PendingItem, outcome: 'approved' | 'rejected') => {
    try {
      await api.updateBpjsPendingStatus(item.id, {
        status: outcome === 'approved' ? 'diterima' : 'ditolak',
        outcome,
        draft_klarifikasi: item.draft_klarifikasi || '',
        poin_kunci: poinKunci[item.id] || undefined,
      });
      await loadItems();
    } catch (err) {
      console.error('[BpjsPending] gagal simpan outcome:', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Jawaban Pending BPJS</DialogTitle>
          <DialogDescription>
            Upload surat jawaban pending dari BPJS — sistem mengekstrak alasan pending dan menyusun draft klarifikasi otomatis dari data klaim ini. Bagian bertanda <code>[isi ...]</code> perlu dilengkapi manual (argumen klinis tidak dikarang otomatis).
          </DialogDescription>
        </DialogHeader>

        <div
          onClick={() => !uploading && fileInputRef.current?.click()}
          className="flex min-h-[100px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border p-4 text-center hover:border-primary/40 hover:bg-muted/30"
        >
          <UploadCloud className="size-6 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">{uploading ? 'Mengunggah & menganalisis...' : 'Klik untuk upload PDF surat pending BPJS'}</p>
        </div>
        <input
          ref={fileInputRef} type="file" accept=".pdf" hidden
          onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); e.target.value = ''; }}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}

        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Memuat riwayat...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Belum ada jawaban pending yang diunggah untuk klaim ini.</p>
        ) : (
          <div className="space-y-4">
            {items.map(item => (
              <div key={item.id} className="rounded-lg border border-border p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{new Date(item.created_at).toLocaleDateString('id-ID')}</span>
                    {item.alasan_parsed?.kategori && (
                      <Badge variant="secondary" className="text-[10px]">{item.alasan_parsed.kategori}</Badge>
                    )}
                  </div>
                  <Badge variant="outline" className="text-[10px]">{STATUS_LABEL[item.status] || item.status}</Badge>
                </div>

                {item.alasan_parsed?.detail && (
                  <p className="text-xs text-foreground"><strong>Alasan pending:</strong> {item.alasan_parsed.detail}</p>
                )}
                {!item.alasan_parsed && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">AI tidak tersedia saat upload — hanya teks mentah tersimpan, draft di bawah harus diisi manual.</p>
                )}

                <textarea
                  value={item.draft_klarifikasi || ''}
                  onChange={e => updateDraft(item.id, e.target.value)}
                  rows={10}
                  disabled={item.status === 'diterima' || item.status === 'ditolak'}
                  placeholder="Draft klarifikasi..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2.5 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring/50 disabled:opacity-60"
                />

                <div className="flex items-center gap-2 flex-wrap">
                  {item.status === 'draft' && (
                    <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={() => handleMarkSent(item)}>
                      <Send className="size-3.5" /> Tandai Sudah Dikirim
                    </Button>
                  )}
                  {item.status === 'dikirim' && (
                    <>
                      <input
                        type="text"
                        placeholder="Catatan: argumen yang meyakinkan BPJS (opsional)"
                        className="flex-1 min-w-[200px] rounded-md border border-input bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring/50"
                        value={poinKunci[item.id] || ''}
                        onChange={e => setPoinKunci(prev => ({ ...prev, [item.id]: e.target.value }))}
                      />
                      <Button type="button" size="sm" className="gap-1.5" onClick={() => handleOutcome(item, 'approved')}>
                        <CheckCircle2 className="size-3.5" /> Diterima
                      </Button>
                      <Button type="button" size="sm" variant="destructive" className="gap-1.5" onClick={() => handleOutcome(item, 'rejected')}>
                        <XCircle className="size-3.5" /> Ditolak
                      </Button>
                    </>
                  )}
                  {item.status === 'diterima' && (
                    <p className="text-xs text-primary">✓ Diterima BPJS — draft ini tersimpan sebagai contoh untuk kasus serupa berikutnya.</p>
                  )}
                  {item.status === 'ditolak' && (
                    <p className="text-xs text-destructive">✗ Ditolak BPJS.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
