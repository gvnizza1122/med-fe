'use client';
// Detail 1 klaim pending — tampilan tiga kolom berdampingan sesuai kontrak
// GET /item/:pendingId: (1) alasan pending dari BPJS, (2) draf jawaban AI
// dengan poin+bukti berkutipan, (3) info triase kotak A/B/C/D.
//
// Aturan keras yang WAJIB dijaga di halaman ini (lihat instruksi produk):
// - TIDAK PERNAH menampilkan persentase/keyakinan di mana pun.
// - Poin draf tanpa bukti harus tampil literal "bukti tidak ditemukan di
//   berkas" dan tampak beda secara visual (amber) dari poin yang terverifikasi.
//
// Field persis apa saja yang ada di `pending`/`draft`/`riwayat_versi` di luar
// yang eksplisit disebut kontrak (kategori, jenis_rawat, jawaban_rs_manual,
// poin[]) belum bisa dipastikan karena rekap pending masih kosong di produksi
// — halaman ini dibuat toleran (opsional-chaining + fallback tampilan) supaya
// tidak crash kalau field tambahan ternyata tidak ada/beda nama.
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, type Variants } from 'framer-motion';
import {
  ArrowLeft, Sparkles, CheckCircle2, XCircle, AlertTriangle, FileQuestion,
  Quote, Save,
} from 'lucide-react';
import {
  api, type KotakTriase, type PendingJawabanItemDetail,
} from '@/lib/api';
import { Header } from '@/components/dashboard/header';
import { ToastContainer, useToast } from '@/components/Toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

type ApiError = Error & { kode?: string; status?: number };

const KOTAK_INFO: Record<KotakTriase, { label: string; className: string }> = {
  A: { label: 'A — Bisa Dijawab', className: 'bg-primary/10 text-primary border-primary/20' },
  B: { label: 'B — Butuh Dokumen', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400' },
  C: { label: 'C — Revisi Koding', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400' },
  D: { label: 'D — Tidak Dipertahankan', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const STATUS_DRAFT_BADGE: Record<string, string> = {
  draft: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400',
  siap: 'bg-primary/10 text-primary border-primary/20',
  ditolak: 'bg-destructive/10 text-destructive border-destructive/20',
};

const pageVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } },
};

function poinTeks(p: Record<string, unknown>): string {
  return (p.teks as string) || (p.isi as string) || (p.text as string) || '';
}

export default function PendingJawabanItemPage() {
  const router = useRouter();
  const params = useParams();
  const pendingId = String(params.pendingId);
  const { toasts, addToast, removeToast } = useToast();

  const [data, setData] = useState<PendingJawabanItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<ApiError | null>(null);

  const [generating, setGenerating] = useState(false);
  const [pakaiAi, setPakaiAi] = useState(true);

  const [kategoriDraft, setKategoriDraft] = useState('');
  const [savingKategori, setSavingKategori] = useState(false);

  const [kotakDraft, setKotakDraft] = useState<KotakTriase | 'NONE'>('NONE');
  const [catatanKotak, setCatatanKotak] = useState('');
  const [savingKotak, setSavingKotak] = useState(false);

  const [catatanSetuju, setCatatanSetuju] = useState('');
  const [akuiTanpaBukti, setAkuiTanpaBukti] = useState(false);
  const [perluPengakuan, setPerluPengakuan] = useState(false);
  const [approving, setApproving] = useState(false);

  const [showTolak, setShowTolak] = useState(false);
  const [alasanTolak, setAlasanTolak] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await api.getItemPendingJawaban(pendingId);
      setData(res);
      setKategoriDraft(res.pending?.kategori || '');
      setKotakDraft((res.triase?.kotak as KotakTriase) || 'NONE');
      setCatatanKotak('');
      setPerluPengakuan(false);
      setAkuiTanpaBukti(false);
    } catch (err) {
      console.error('[PendingJawabanItem] gagal memuat detail:', err);
      setLoadError(err as ApiError);
    } finally {
      setLoading(false);
    }
  }, [pendingId]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const handleGenerateDraft = async () => {
    setGenerating(true);
    try {
      await api.buatDraftPendingJawaban(pendingId, pakaiAi);
      addToast('Draf jawaban baru berhasil dibuat.', 'success');
      await load();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Gagal membuat draf jawaban.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleSimpanKategori = async () => {
    if (!kategoriDraft.trim()) return;
    setSavingKategori(true);
    try {
      await api.koreksiKategoriAlasanPending(pendingId, kategoriDraft.trim());
      addToast('Kategori diperbarui. Koreksi manual ini tidak akan ditimpa otomatis lagi.', 'success');
      await load();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Gagal menyimpan kategori.', 'error');
    } finally {
      setSavingKategori(false);
    }
  };

  const handleSimpanKotak = async () => {
    setSavingKotak(true);
    try {
      await api.updateTriasePending(pendingId, {
        kotak: kotakDraft === 'NONE' ? null : kotakDraft,
        catatan: catatanKotak || undefined,
      });
      addToast('Putusan kotak triase disimpan.', 'success');
      await load();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Gagal menyimpan putusan kotak.', 'error');
    } finally {
      setSavingKotak(false);
    }
  };

  const draftId = data?.draft?.id;

  const handleSetujui = async () => {
    if (!draftId) return;
    setApproving(true);
    try {
      await api.setujuiDraftPendingJawaban(draftId, {
        catatan: catatanSetuju || undefined,
        akui_poin_tanpa_bukti: akuiTanpaBukti || undefined,
      });
      addToast('Draf jawaban disetujui — status jadi siap kirim.', 'success');
      setCatatanSetuju(''); setAkuiTanpaBukti(false); setPerluPengakuan(false);
      await load();
    } catch (err: unknown) {
      const e = err as ApiError;
      if (e.kode === 'perlu_pengakuan') {
        setPerluPengakuan(true);
        addToast('Ada poin draf tanpa bukti di berkas. Centang "akui tetap disetujui" kalau memang ingin melanjutkan.', 'error');
      } else if (e.kode === 'bukti_gugur') {
        addToast('Tidak bisa disetujui: ada kutipan bukti yang sudah tidak berlaku (berkas berubah). Buat ulang draf.', 'error');
      } else {
        addToast(e.message || 'Gagal menyetujui draf.', 'error');
      }
    } finally {
      setApproving(false);
    }
  };

  const handleTolak = async () => {
    if (!draftId) return;
    setRejecting(true);
    try {
      await api.tolakDraftPendingJawaban(draftId, alasanTolak || undefined);
      addToast('Draf jawaban ditolak.', 'success');
      setShowTolak(false); setAlasanTolak('');
      await load();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Gagal menolak draf.', 'error');
    } finally {
      setRejecting(false);
    }
  };

  if (loading) {
    return (
      <motion.div className="space-y-4 md:space-y-6" variants={pageVariants} initial="hidden" animate="visible">
        <Header title="Detail Klaim Pending" description="Memuat..." />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </motion.div>
    );
  }

  if (loadError || !data) {
    const notFound = loadError?.status === 404;
    return (
      <motion.div className="space-y-4 md:space-y-6" variants={pageVariants} initial="hidden" animate="visible">
        <Header
          title="Detail Klaim Pending"
          description="Terjadi masalah saat memuat data"
          actions={
            <Button variant="secondary" className="gap-2" onClick={() => router.push('/pending-jawaban/daftar')}>
              <ArrowLeft className="size-4" /> Kembali ke Daftar
            </Button>
          }
        />
        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted">
              <FileQuestion className="size-7 text-muted-foreground" />
            </div>
            <h3 className="font-display text-base font-semibold text-foreground">
              {notFound ? 'Klaim pending tidak ditemukan' : 'Gagal memuat detail klaim'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">{loadError?.message || 'Silakan coba lagi.'}</p>
            <Button size="sm" variant="outline" onClick={load}>Coba Lagi</Button>
          </div>
        </div>
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </motion.div>
    );
  }

  const { pending, triase, draft, kolom, riwayat_versi } = data;
  const poin = (draft?.poin || []) as Record<string, unknown>[];
  const statusDraftKey = (draft?.status as string) || 'draft';

  return (
    <motion.div className="space-y-4 md:space-y-6" variants={pageVariants} initial="hidden" animate="visible">
      <Header
        title={`Klaim ${pending.sep || pendingId}`}
        description={`${pending.nama_peserta || 'Nama tidak tersedia'} · ${pending.jenis_rawat === 'RI' ? 'Rawat Inap' : pending.jenis_rawat === 'RJ' ? 'Rawat Jalan' : 'Jenis belum diketahui'}`}
        actions={
          <Button variant="secondary" className="gap-2" onClick={() => router.push('/pending-jawaban/daftar')}>
            <ArrowLeft className="size-4" /> Kembali ke Daftar
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Kolom 1 — Alasan Pending */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alasan Pending (BPJS)</CardTitle>
            <CardDescription className="text-xs">Teks asli dari rekap/surat pending</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm rounded-md border border-border bg-muted/30 p-3 whitespace-pre-wrap leading-relaxed">
              {kolom?.alasan_pending || pending.alasan_raw as string || '-'}
            </p>

            {pending.jawaban_rs_manual && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground mb-1">Jawaban RS (dari rekap manual)</p>
                <p className="text-xs rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 whitespace-pre-wrap">{pending.jawaban_rs_manual as string}</p>
              </div>
            )}

            <div className="border-t border-border pt-3 space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground">Kategori Alasan</label>
              <div className="flex gap-1.5">
                <Input value={kategoriDraft} onChange={e => setKategoriDraft(e.target.value)} placeholder="mis. Berkas Kurang Lengkap" className="text-xs" />
                <Button size="sm" variant="outline" onClick={handleSimpanKategori} disabled={savingKategori || !kategoriDraft.trim()}>
                  <Save className="size-3.5" />
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Koreksi manual di sini tidak akan pernah ditimpa otomatis lagi.</p>
            </div>
          </CardContent>
        </Card>

        {/* Kolom 2 — Draf Jawaban */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Draf Jawaban</CardTitle>
              {draft && (
                <Badge variant="outline" className={`text-[10px] ${STATUS_DRAFT_BADGE[statusDraftKey] || 'bg-muted text-muted-foreground border-border'}`}>
                  {statusDraftKey === 'siap' ? 'Siap Kirim' : statusDraftKey === 'ditolak' ? 'Ditolak' : 'Draf'}
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs">Poin jawaban dengan kutipan halaman berkas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1.5">
                <Checkbox id="pakai-ai-draft" checked={pakaiAi} onCheckedChange={v => setPakaiAi(v === true)} />
                <label htmlFor="pakai-ai-draft" className="text-[11px] text-muted-foreground cursor-pointer select-none">Pakai AI</label>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={handleGenerateDraft} disabled={generating}>
                <Sparkles className="size-3.5" />
                {generating ? 'Membuat draf...' : draft ? 'Buat Ulang Draf' : 'Buat Draf'}
              </Button>
            </div>

            {!draft || poin.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center border border-dashed border-border rounded-md">
                Belum ada draf jawaban untuk klaim ini.
              </p>
            ) : (
              <ul className="space-y-2">
                {poin.map((p, i) => {
                  const bukti = (p.bukti as { topik?: string; halaman?: string | number; kutipan?: string; terverifikasi?: boolean }[]) || [];
                  const tanpaBuktiPoin = Boolean(p.tanpa_bukti) || (bukti.length > 0 && bukti.every(b => !b.terverifikasi));
                  return (
                    <li
                      key={i}
                      className={`rounded-md border p-2.5 text-xs space-y-1.5 ${tanpaBuktiPoin ? 'border-amber-500/40 bg-amber-500/5' : 'border-border bg-muted/20'}`}
                    >
                      <p className="leading-relaxed text-foreground">{poinTeks(p) || '(poin tanpa teks)'}</p>
                      {tanpaBuktiPoin ? (
                        <p className="flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="size-3.5 shrink-0" /> bukti tidak ditemukan di berkas
                        </p>
                      ) : (
                        bukti.map((b, j) => (
                          <p key={j} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                            <Quote className="size-3 shrink-0 mt-0.5" />
                            <span>
                              {b.topik && <span className="font-medium text-foreground">{b.topik}: </span>}
                              &ldquo;{b.kutipan}&rdquo;
                              {b.halaman !== undefined && <span className="text-muted-foreground/70"> (hal. {b.halaman})</span>}
                            </span>
                          </p>
                        ))
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {kolom?.bukti && kolom.bukti.length > 0 && (
              <div className="border-t border-border pt-2 space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground">Kutipan Berkas Terkait</p>
                {kolom.bukti.map((b, i) => (
                  <p key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                    <Quote className="size-3 shrink-0 mt-0.5" />
                    <span>
                      {b.topik && <span className="font-medium text-foreground">{b.topik}: </span>}
                      &ldquo;{b.kutipan}&rdquo; (hal. {b.halaman})
                      {!b.terverifikasi && <span className="ml-1 text-amber-600 dark:text-amber-400">— belum terverifikasi</span>}
                    </span>
                  </p>
                ))}
              </div>
            )}

            {draft && statusDraftKey === 'draft' && (
              <div className="border-t border-border pt-3 space-y-2">
                {perluPengakuan && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2">
                    <AlertTriangle className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div className="flex-1 space-y-1.5">
                      <p className="text-[11px] text-amber-700 dark:text-amber-400">
                        Ada poin draf tanpa bukti di berkas. Centang di bawah kalau tetap ingin disetujui.
                      </p>
                      <div className="flex items-center gap-1.5">
                        <Checkbox id="akui-tanpa-bukti" checked={akuiTanpaBukti} onCheckedChange={v => setAkuiTanpaBukti(v === true)} />
                        <label htmlFor="akui-tanpa-bukti" className="text-[11px] cursor-pointer select-none">Saya akui poin tanpa bukti, tetap setujui</label>
                      </div>
                    </div>
                  </div>
                )}
                <Input
                  placeholder="Catatan persetujuan (opsional)"
                  value={catatanSetuju}
                  onChange={e => setCatatanSetuju(e.target.value)}
                  className="text-xs"
                />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="gap-1.5" onClick={handleSetujui} disabled={approving || (perluPengakuan && !akuiTanpaBukti)}>
                    <CheckCircle2 className="size-3.5" /> {approving ? 'Menyetujui...' : 'Setujui Draf'}
                  </Button>
                  {!showTolak ? (
                    <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => setShowTolak(true)}>
                      <XCircle className="size-3.5" /> Tolak Draf
                    </Button>
                  ) : null}
                </div>
                {showTolak && (
                  <div className="space-y-1.5 rounded-md border border-destructive/30 bg-destructive/5 p-2">
                    <Textarea
                      placeholder="Alasan penolakan (opsional)"
                      value={alasanTolak}
                      onChange={e => setAlasanTolak(e.target.value)}
                      rows={2}
                      className="text-xs"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" onClick={handleTolak} disabled={rejecting}>
                        {rejecting ? 'Menolak...' : 'Konfirmasi Tolak'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setShowTolak(false); setAlasanTolak(''); }}>Batal</Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {statusDraftKey === 'siap' && (
              <p className="text-[11px] text-primary border-t border-border pt-2">✓ Draf sudah disetujui, siap dikirim ke BPJS.</p>
            )}
            {statusDraftKey === 'ditolak' && (
              <p className="text-[11px] text-destructive border-t border-border pt-2">✗ Draf ini ditolak koder. Buat draf baru bila perlu.</p>
            )}

            {riwayat_versi && riwayat_versi.length > 0 && (
              <div className="border-t border-border pt-2 space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground">Riwayat Versi Draf</p>
                {riwayat_versi.map((v, i) => (
                  <div key={v.id || i} className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Versi {v.versi ?? riwayat_versi.length - i} — {v.status || '-'}</span>
                    <span>{v.created_at ? new Date(v.created_at).toLocaleString('id-ID') : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Kolom 3 — Triase */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Triase</CardTitle>
            <CardDescription className="text-xs">A = bisa dijawab, B = butuh dokumen, C = revisi koding, D = tidak dipertahankan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!triase || !triase.kotak ? (
              <p className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border rounded-md">
                Belum dihitung. Jalankan &quot;Hitung Triase&quot; di halaman Ringkasan.
              </p>
            ) : (
              <>
                <Badge variant="outline" className={`text-xs ${KOTAK_INFO[triase.kotak].className}`}>
                  {triase.label || KOTAK_INFO[triase.kotak].label}
                </Badge>
                {triase.alasan_kotak && (
                  <p className="text-xs leading-relaxed text-muted-foreground">{triase.alasan_kotak}</p>
                )}
                {triase.kriteria && triase.kriteria.length > 0 && (
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground mb-1">Kriteria</p>
                    <ul className="list-disc list-inside space-y-0.5 text-xs text-muted-foreground">
                      {triase.kriteria.map((k, i) => <li key={i}>{k}</li>)}
                    </ul>
                  </div>
                )}
                {triase.dokumen_dibutuhkan && triase.dokumen_dibutuhkan.length > 0 && (
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground mb-1">Dokumen Dibutuhkan</p>
                    <ul className="list-disc list-inside space-y-0.5 text-xs text-muted-foreground">
                      {triase.dokumen_dibutuhkan.map((d, i) => <li key={i}>{d}</li>)}
                    </ul>
                  </div>
                )}
              </>
            )}

            <div className="border-t border-border pt-3 space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground">Putusan Kotak Manual</label>
              <Select value={kotakDraft} onValueChange={(v) => setKotakDraft(v as KotakTriase | 'NONE')}>
                <SelectTrigger className="w-full text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Tidak ada / kosongkan</SelectItem>
                  {(['A', 'B', 'C', 'D'] as KotakTriase[]).map(k => (
                    <SelectItem key={k} value={k}>{KOTAK_INFO[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                placeholder="Catatan putusan kotak (opsional)"
                value={catatanKotak}
                onChange={e => setCatatanKotak(e.target.value)}
                rows={2}
                className="text-xs"
              />
              <Button size="sm" variant="outline" className="gap-1.5" onClick={handleSimpanKotak} disabled={savingKotak}>
                <Save className="size-3.5" /> {savingKotak ? 'Menyimpan...' : 'Simpan Putusan Kotak'}
              </Button>
              <p className="text-[11px] text-muted-foreground">Putusan manual koder menimpa hasil hitung otomatis untuk klaim ini saja.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </motion.div>
  );
}
