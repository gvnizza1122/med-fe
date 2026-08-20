'use client';
// Modal konfirmasi RV-20 (kriteria kegawatan IGD) — muncul saat record IGD
// terdeteksi cuma punya kode diagnosis nyeri generik tanpa kode kegawatan
// pendamping. RV-20 sifatnya WARNING (tidak blocking submit), tapi
// verifikator tetap wajib centang checklist ini sekali sebagai audit trail
// kalau BPJS mempertanyakan klaim ini nanti — bukan gerbang otomatis yang
// menyimpulkan kegawatan, cuma bukti sudah dicek manual.
import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

const CHECKLIST_ITEMS: { key: string; label: string }[] = [
  { key: 'ttv_abnormal', label: 'TTV abnormal terdokumentasi' },
  { key: 'tampak_sakit_berat', label: 'Kondisi umum tampak sakit berat' },
  { key: 'skala_nyeri_sesuai', label: 'Skala nyeri anak: FLACC / Wong-Baker (kalau pasien anak)' },
  { key: 'pemeriksaan_penunjang', label: 'Ada pemeriksaan penunjang (lab/radiologi)' },
  { key: 'alasan_tidak_fktp', label: 'Ada alasan medis tidak bisa ditangani di FKTP' },
];

export function Rv20ConfirmationModal({
  open, recordId, onConfirmed, onEditInstead,
}: {
  open: boolean;
  recordId: string;
  onConfirmed: () => void;
  onEditInstead: () => void;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggle = (key: string) => setChecked(prev => ({ ...prev, [key]: !prev[key] }));

  const handleConfirm = async () => {
    setSaving(true); setError('');
    try {
      await api.confirmRv20(recordId, checked);
      onConfirmed();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan konfirmasi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Kriteria Kegawatan IGD (RV-20)</DialogTitle>
          <DialogDescription>
            Diagnosis pada klaim ini hanya kode nyeri generik tanpa kode kegawatan pendamping — BPJS sering menolak klaim seperti ini dengan alasan &ldquo;tidak memenuhi kriteria gawat darurat&rdquo;. Centang yang sudah dipastikan sebelum lanjut.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5 py-1">
          {CHECKLIST_ITEMS.map(item => (
            <label key={item.key} className="flex items-start gap-2.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={!!checked[item.key]}
                onChange={() => toggle(item.key)}
                className="mt-0.5 size-4 rounded border-input"
              />
              <span className="text-foreground">{item.label}</span>
            </label>
          ))}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter className="pt-2">
          <Button type="button" variant="outline" onClick={onEditInstead}>Kembali ke Edit</Button>
          <Button type="button" onClick={handleConfirm} disabled={saving}>
            {saving ? 'Menyimpan...' : 'Konfirmasi & Lanjutkan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
