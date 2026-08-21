'use client';
// Checklist konfirmasi RV-20 (kriteria kegawatan IGD) — ditampilkan INLINE di
// bawah tabel data (bukan modal/dialog lagi) saat record IGD terdeteksi cuma
// punya kode diagnosis nyeri generik tanpa kode kegawatan pendamping. RV-20
// sifatnya WARNING (tidak blocking submit), tapi verifikator tetap wajib
// centang checklist ini sekali sebagai audit trail kalau BPJS mempertanyakan
// klaim ini nanti — bukan gerbang otomatis yang menyimpulkan kegawatan, cuma
// bukti sudah dicek manual. Ditaruh di bawah tabel (bukan popup) supaya tidak
// menghalangi verifikator melihat data sambil mengisi checklist.
import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const CHECKLIST_ITEMS: { key: string; label: string }[] = [
  { key: 'ttv_abnormal', label: 'TTV abnormal terdokumentasi' },
  { key: 'tampak_sakit_berat', label: 'Kondisi umum tampak sakit berat' },
  { key: 'skala_nyeri_sesuai', label: 'Skala nyeri anak: FLACC / Wong-Baker (kalau pasien anak)' },
  { key: 'pemeriksaan_penunjang', label: 'Ada pemeriksaan penunjang (lab/radiologi)' },
  { key: 'alasan_tidak_fktp', label: 'Ada alasan medis tidak bisa ditangani di FKTP' },
];

export function Rv20ConfirmationModal({
  recordId, onConfirmed,
}: {
  recordId: string;
  onConfirmed: () => void;
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
    <Card className="mb-4 p-4 border-amber-500/40 bg-amber-500/5">
      <div className="mb-1 text-sm font-semibold text-foreground">Kriteria Kegawatan IGD (RV-20)</div>
      <p className="mb-3 text-xs text-muted-foreground">
        Diagnosis pada klaim ini hanya kode nyeri generik tanpa kode kegawatan pendamping — BPJS sering menolak klaim seperti ini dengan alasan &ldquo;tidak memenuhi kriteria gawat darurat&rdquo;. Centang yang sudah dipastikan sebelum lanjut.
      </p>

      <div className="space-y-2.5">
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

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      <div className="mt-3 flex justify-end">
        <Button type="button" size="sm" onClick={handleConfirm} disabled={saving}>
          {saving ? 'Menyimpan...' : 'Konfirmasi'}
        </Button>
      </div>
    </Card>
  );
}
