'use client';
import { useDeferredEffect } from '@/lib/useDeferredEffect';

// Generator draft Surat Klarifikasi ke BPJS — dipakai saat klaim IGD kena
// RV-20 (kegawatan lemah) dan verifikator perlu menjawab pertanyaan BPJS
// "kriteria kegawatan apa?". Auto-terisi HANYA dari data yang benar-benar
// ada di sistem (SEP, nama, tanggal, diagnosis, DPJP, checklist RV-20 kalau
// sudah dikonfirmasi) — bagian naratif klinis (kondisi umum, pemeriksaan
// fisik, tindakan) dibiarkan placeholder [isi ...] karena app ini tidak
// menyimpan data granular itu; mengarang isinya melanggar prinsip
// anti-halusinasi yang dipegang di seluruh aplikasi ini.
import { Button } from '@/components/ui/button';
import {
Dialog,
DialogContent,
DialogDescription,
DialogFooter,
DialogHeader,
DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { useState } from 'react';

const CHECKLIST_LABELS: Record<string, string> = {
  ttv_abnormal: 'TTV abnormal terdokumentasi',
  tampak_sakit_berat: 'Kondisi umum tampak sakit berat',
  skala_nyeri_sesuai: 'Skala nyeri anak: FLACC / Wong-Baker (kalau pasien anak)',
  pemeriksaan_penunjang: 'Ada pemeriksaan penunjang (lab/radiologi)',
  alasan_tidak_fktp: 'Ada alasan medis tidak bisa ditangani di FKTP',
};

function formatTanggal(iso?: string | null): string {
  if (!iso) return '[isi tanggal pelayanan]';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '[isi tanggal pelayanan]';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

function buildTemplate(record: Record<string, unknown>, checklist: Record<string, boolean> | null): string {
  const checklistLines = Object.entries(CHECKLIST_LABELS)
    .map(([key, label]) => `   ${checklist?.[key] ? '[x]' : '[ ]'} ${label}`)
    .join('\n');

  return `Kepada Yth.
Tim Verifikasi Klaim BPJS Kesehatan
[Kantor Cabang BPJS]

Perihal: Klarifikasi Klaim IGD

Nomor SEP   : ${record.sep || '[isi nomor SEP]'}
Nama Pasien : ${record.nama_pasien || '[isi nama pasien]'}
MRN         : ${record.mrn || '[isi MRN]'}
Tanggal     : ${formatTanggal(typeof record.admission_date === 'string' ? record.admission_date : null)}
Diagnosis   : ${record.diagnosa_list || '[isi kode ICD-10]'}
DPJP        : ${record.dpjp_name || '[isi nama DPJP]'}

Klarifikasi Kriteria Kegawatan:

Bersama surat ini kami sampaikan penjelasan klinis mengenai klaim IGD
yang dipertanyakan kriteria kegawatannya.

1. KONDISI UMUM PASIEN SAAT DATANG:
   [isi kondisi umum — mis. tampak kesakitan, gelisah, tidak bisa
   bergerak, dll]

2. PENGUKURAN NYERI:
   [isi skala nyeri yang dipakai dan hasilnya — FLACC untuk anak <7
   tahun, VAS untuk dewasa]

3. PEMERIKSAAN FISIK RELEVAN:
   [isi temuan pemeriksaan fisik yang relevan]

4. ALASAN TIDAK DAPAT DITANGANI DI FKTP:
   [isi alasan medis]

5. TINDAKAN YANG DILAKUKAN DI IGD:
   [isi tindakan — infus, lab, USG/X-Ray, obat, dll]

Kriteria kegawatan yang sudah diverifikasi tim kami (lihat checklist
RV-20 di sistem):
${checklistLines}

Demikian klarifikasi ini kami sampaikan. Terima kasih atas perhatiannya.

Hormat kami,


[Nama Dokter IGD + Tanda Tangan]
[Nama Kepala Casemix / Koder]
RS Lestari Raharja`;
}

export function SuratKlarifikasiModal({
  open, onOpenChange, record,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: Record<string, unknown>;
}) {
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useDeferredEffect(() => {
    if (!open) return;
    setCopied(false);
    setLoading(true);
    api.getRv20Confirmation<{confirmation?: {checklist_items?:string|Record<string,boolean>}}>(String(record.id))
      .then(res => setText(buildTemplate(record, res.confirmation?.checklist_items ? JSON.parse(
        // Backend simpan checklist_items sebagai TEXT (JSON.stringify) — parse balik.
        typeof res.confirmation.checklist_items === 'string' ? res.confirmation.checklist_items : JSON.stringify(res.confirmation.checklist_items)
      ) : null)))
      .catch(() => setText(buildTemplate(record, null)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record.id]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API bisa gagal di context non-HTTPS/permission ditolak —
      // biarkan pengguna select-all manual dari textarea sebagai fallback.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Surat Klarifikasi BPJS — Kriteria Kegawatan IGD</DialogTitle>
          <DialogDescription>
            Draft otomatis dari data klaim ini. Bagian bertanda <code>[isi ...]</code> perlu dilengkapi manual sebelum dikirim — sistem tidak menyimpan catatan klinis naratif, cuma data terstruktur.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Memuat...</p>
        ) : (
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={22}
            className="w-full rounded-md border border-input bg-background px-3 py-2.5 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring/50"
          />
        )}

        <DialogFooter className="pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
          <Button type="button" onClick={handleCopy} disabled={loading}>
            {copied ? '✓ Tersalin' : 'Salin ke Clipboard'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
