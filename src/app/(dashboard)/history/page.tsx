'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { FileText, FolderOpen, Trash2, Upload, X, ChevronLeft, ChevronRight, Search, Download, Archive, ArchiveRestore, ChevronDown } from 'lucide-react';
import { api } from '@/lib/api';
import { Header } from '@/components/dashboard/header';
import { HistoryTabs } from '@/components/dashboard/history-tabs';
import { ToastContainer, useToast } from '@/components/Toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ClaimFile {
  id: string; file_name: string; period: string; status: string;
  total_records: number; valid_count: number; error_count: number; pending_count: number;
  pending_reason?: string | null;
  created_at: string; uploaded_by_name: string; jenis_klaim?: string | null;
  sep?: string | null; nama_pasien?: string | null;
}

// Aplikasi hanya mengenal dua kategori. Kategori IGD dihapus 21 Sep 2026 —
// kunjungan IGD adalah rawat jalan — dan datanya sudah dimigrasi, jadi pilihan
// GAWAT_DARURAT di sini selalu menghasilkan nol baris.
const JENIS_KLAIM_LABELS: Record<string, string> = {
  RAWAT_JALAN: 'Rawat Jalan',
  RAWAT_INAP: 'Rawat Inap',
};
const jenisKlaimLabel = (v?: string | null) => (v && JENIS_KLAIM_LABELS[v]) || '-';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 24 } },
};

const pageVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } },
};

const emptyVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

// ── Pengelompokan Periode & Kategori ──

interface Kelompok {
  periode: string | null; jenis_klaim: string | null;
  total: number; perlu: number; siap: number;
}

type Tampilan = 'perlu' | 'bulan_ini' | 'siap' | 'semua';

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

// '2026-08' -> 'Agustus 2026'. Periode yang belum bisa ditentukan diberi label
// jujur, bukan tanggal tebakan yang diam-diam salah bulan.
function labelPeriode(p: string | null): string {
  const [tahun, bulanStr] = String(p || '').split('-');
  const bulan = Number(bulanStr);
  if (!tahun || tahun.length !== 4 || !(bulan >= 1 && bulan <= 12)) return 'Periode belum pasti';
  return `${NAMA_BULAN[bulan - 1]} ${tahun}`;
}

const kunciKelompok = (k: Kelompok) => `${k.periode ?? 'tanpa'}|${k.jenis_klaim ?? '-'}`;

function bulanIni(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const WARNA_KATEGORI: Record<string, string> = {
  RAWAT_JALAN: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400',
  RAWAT_INAP: 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400',
};

export default function HistoryPage() {
  const router = useRouter();
  const [files, setFiles] = useState<ClaimFile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [jenisKlaimFilter, setJenisKlaimFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  // Tampilan arsip terpisah. Tanpa tempat untuk melihat dan mengembalikan,
  // arsip tidak berbeda dari penghapusan.
  const [lihatArsip, setLihatArsip] = useState(false);
  const [rolePengguna, setRolePengguna] = useState('');
  const [samarkanNama, setSamarkanNama] = useState(false);

  // Tampilan tersimpan & pengelompokan. Bawaan mengikuti usulan: yang perlu
  // dikerjakan lebih dulu, dikelompokkan per periode dan kategori.
  const [tampilan, setTampilan] = useState<Tampilan>('perlu');
  const [kelompokkan, setKelompokkan] = useState(true);
  const [kelompok, setKelompok] = useState<Kelompok[]>([]);
  const [terbuka, setTerbuka] = useState<Record<string, boolean>>({});
  const [barisKelompok, setBarisKelompok] = useState<Record<string, { files: ClaimFile[]; total: number }>>({});
  const [memuatKelompok, setMemuatKelompok] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let frame: number | undefined;
    try {
      const saved = JSON.parse(localStorage.getItem('riwayat-upload-tampilan') || 'null');
      if (saved) frame = requestAnimationFrame(() => {
        if (['perlu', 'bulan_ini', 'siap', 'semua'].includes(saved.tampilan)) setTampilan(saved.tampilan);
        if (typeof saved.kelompokkan === 'boolean') setKelompokkan(saved.kelompokkan);
      });
    } catch { /* Penyimpanan lokal tidak tersedia; gunakan tampilan bawaan. */ }
    return () => { if (frame !== undefined) cancelAnimationFrame(frame); };
  }, []);

  // Pencarian dan rentang tanggal mencari ke SELURUH klaim. Kalau tampilan
  // "Perlu dikerjakan" ikut menyaring, mencari klaim yang sudah bersih akan
  // menghasilkan "tidak ditemukan" padahal klaimnya ada.
  const filterAktif = Boolean(search || fromDate || toDate);
  const modeKelompok = kelompokkan && !filterAktif;
  const tampilanEfektif: Tampilan | undefined = lihatArsip || filterAktif ? undefined : tampilan;
  const { toasts, addToast, removeToast } = useToast();

  const loadFiles = useCallback(async () => {
    // Mode kelompok memuat baris per kelompok saat dibuka, bukan daftar datar.
    if (modeKelompok) { setLoading(false); return; }
    try {
      setLoading(true);
      const d = await api.getFiles(page, 15, jenisKlaimFilter || undefined, fromDate || undefined, toDate || undefined, search || undefined, lihatArsip, undefined, tampilanEfektif);
      setFiles(d.files); setTotal(d.total);
    } catch (err) { console.error('[History] Gagal memuat file:', err); } finally { setLoading(false); }
  }, [page, jenisKlaimFilter, fromDate, toDate, search, lihatArsip, modeKelompok, tampilanEfektif]);

  const loadKelompok = useCallback(async () => {
    try {
      const d = await api.getKelompok(lihatArsip, jenisKlaimFilter || undefined);
      setKelompok(d.kelompok || []);
    } catch (err) { console.error('[History] Gagal memuat kelompok:', err); }
  }, [lihatArsip, jenisKlaimFilter]);

  useEffect(() => { loadKelompok(); }, [loadKelompok]);

  // Kelompok yang tampil mengikuti tampilan yang dipilih.
  const kelompokTampil = useMemo(() => kelompok.filter((k) => {
    if (tampilanEfektif === 'siap') return k.siap > 0;
    if (tampilanEfektif === 'bulan_ini') return k.periode === bulanIni();
    return true;
  }).sort((a, b) => {
    // Perlu dikerjakan memprioritaskan kelompok pending, sambil tetap
    // memperlihatkan periode lama yang sudah selesai seperti pada contoh.
    const urutanPeriode = (b.periode || '').localeCompare(a.periode || '');
    if (urutanPeriode) return urutanPeriode;
    if (tampilanEfektif === 'perlu' && Boolean(a.perlu) !== Boolean(b.perlu)) return a.perlu ? -1 : 1;
    return (a.jenis_klaim === 'RAWAT_JALAN' ? 0 : 1) - (b.jenis_klaim === 'RAWAT_JALAN' ? 0 : 1);
  }), [kelompok, tampilanEfektif]);

  const muatBarisKelompok = useCallback(async (k: Kelompok) => {
    const key = kunciKelompok(k);
    setMemuatKelompok((m) => ({ ...m, [key]: true }));
    try {
      const filterBaris = tampilanEfektif === 'siap' ? 'siap' : undefined;
      const d = await api.getFiles(1, 100, k.jenis_klaim || undefined, undefined, undefined, undefined, lihatArsip, k.periode || 'tanpa', filterBaris);
      // Berkas tanpa kategori tidak bisa disaring di server, jadi disaring di sini.
      // Tampilan prioritas tetap memperlihatkan klaim siap di bawah yang pending.
      const baris = (d.files as ClaimFile[])
        .filter((f) => (f.jenis_klaim || null) === k.jenis_klaim)
        .sort((a, b) => tampilanEfektif === 'perlu'
          ? Number((b.pending_count + b.error_count) > 0) - Number((a.pending_count + a.error_count) > 0)
          : 0);
      setBarisKelompok((b) => ({ ...b, [key]: { files: baris, total: d.total } }));
    } catch (err) {
      console.error('[History] Gagal memuat baris kelompok:', err);
      // Dicatat kosong supaya efek pemuat tidak mengulang tanpa henti.
      setBarisKelompok((b) => ({ ...b, [key]: { files: [], total: 0 } }));
    } finally {
      setMemuatKelompok((m) => ({ ...m, [key]: false }));
    }
  }, [lihatArsip, tampilanEfektif]);

  // Ganti tampilan/arsip/kategori -> baris yang sudah dimuat tidak berlaku lagi.
  useEffect(() => { setBarisKelompok({}); }, [lihatArsip, tampilanEfektif, jenisKlaimFilter]);

  // Bulan terakhir terbuka, sisanya terlipat.
  useEffect(() => {
    if (!modeKelompok || kelompokTampil.length === 0) return;
    const key = kunciKelompok(kelompokTampil[0]);
    setTerbuka((t) => (t[key] === undefined ? { ...t, [key]: true } : t));
  }, [modeKelompok, kelompokTampil]);

  useEffect(() => {
    if (!modeKelompok) return;
    for (const k of kelompokTampil) {
      const key = kunciKelompok(k);
      if (terbuka[key] && !barisKelompok[key] && !memuatKelompok[key]) muatBarisKelompok(k);
    }
  }, [modeKelompok, kelompokTampil, terbuka, barisKelompok, memuatKelompok, muatBarisKelompok]);

  const muatUlang = () => { setBarisKelompok({}); loadKelompok(); loadFiles(); };

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || 'null');
      setRolePengguna(typeof user?.role === 'string' ? user.role : '');
    } catch {
      setRolePengguna('');
    }
  }, []);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  // Debounce input pencarian nama pasien/SEP supaya tidak request per-ketikan.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const [mengexport, setMengexport] = useState(false);
  const [mengexportSiap, setMengexportSiap] = useState(false);
  const [mengexportPending, setMengexportPending] = useState(false);
  // Bulan klaim untuk ekspor pending bulanan; default bulan lalu (bulan yang
  // biasanya sedang dikerjakan casemix).
  const [bulanPending, setBulanPending] = useState(() => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const unduhPendingBulanan = async () => {
    if (!bulanPending) { addToast('Pilih bulan klaim dulu.', 'error'); return; }
    setMengexportPending(true);
    try {
      const res = await api.exportPendingBulanan(bulanPending);
      if (!res.ok) throw new Error(`Server menolak (${res.status})`);
      const disposisi = res.headers.get('Content-Disposition') || '';
      const cocok = disposisi.match(/filename=([^;]+)/);
      const namaBerkas = cocok ? cocok[1].trim().replace(/"/g, '') : `pending-${bulanPending}.xlsx`;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = namaBerkas;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      addToast(`Pending bulanan diunduh: ${namaBerkas}`, 'success');
    } catch (err) {
      console.error('[History] Gagal export pending bulanan:', err);
      addToast('Gagal menyiapkan ekspor pending bulanan. Silakan coba lagi.', 'error');
    } finally {
      setMengexportPending(false);
    }
  };

  const unduhDaftarKerja = async () => {
    setMengexport(true);
    try {
      const res = await api.exportDaftarKerja({
        kategori: jenisKlaimFilter || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        search: search || undefined,
        arsip: lihatArsip,
        samarkan_nama: samarkanNama,
      });
      if (!res.ok) throw new Error(`Server menolak (${res.status})`);

      // Nama berkas diambil dari header server, bukan disusun ulang di sini,
      // supaya nama yang menyebut cakupan tidak bisa berbeda antara keduanya.
      const disposisi = res.headers.get('Content-Disposition') || '';
      const cocok = disposisi.match(/filename=([^;]+)/);
      const namaBerkas = cocok ? cocok[1].trim().replace(/"/g, '') : 'daftar-kerja.xlsx';

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = namaBerkas;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      addToast(`Daftar Kerja diunduh: ${namaBerkas}`, 'success');
    } catch (err) {
      console.error('[History] Gagal export Daftar Kerja:', err);
      addToast('Gagal menyiapkan Daftar Kerja. Silakan coba lagi.', 'error');
    } finally {
      setMengexport(false);
    }
  };

  const unduhSiapSubmit = async () => {
    setMengexportSiap(true);
    try {
      const res = await api.exportSiapSubmit({
        kategori: jenisKlaimFilter || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        search: search || undefined,
        arsip: lihatArsip,
      });
      if (!res.ok) throw new Error(`Server menolak (${res.status})`);
      const disposisi = res.headers.get('Content-Disposition') || '';
      const cocok = disposisi.match(/filename=([^;]+)/);
      const namaBerkas = cocok ? cocok[1].trim().replace(/"/g, '') : 'siap-submit.xlsx';
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = namaBerkas;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      addToast(`Siap Submit diunduh: ${namaBerkas}`, 'success');
    } catch (err) {
      console.error('[History] Gagal export Siap Submit:', err);
      addToast('Gagal menyiapkan Siap Submit. Silakan coba lagi.', 'error');
    } finally {
      setMengexportSiap(false);
    }
  };

  const arsipkan = async (id: string) => {
    try {
      await api.bulkArchive([id]);
      addToast('Berkas dipindahkan ke arsip. Datanya tetap tersimpan.', 'success');
      muatUlang();
    } catch (err) {
      console.error('[History] Gagal mengarsipkan:', err);
      addToast('Gagal mengarsipkan berkas.', 'error');
    }
  };

  const kembalikan = async (id: string) => {
    try {
      await api.bulkRestore([id]);
      addToast('Berkas dikembalikan dari arsip.', 'success');
      muatUlang();
    } catch (err) {
      console.error('[History] Gagal mengembalikan:', err);
      addToast('Gagal mengembalikan berkas.', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try { await api.deleteFile(id); muatUlang(); } catch (err) { console.error('[History] Gagal hapus file:', err); }
  };

  const totalPages = Math.ceil(total / 15);
  const hasActiveFilters = Boolean(jenisKlaimFilter || fromDate || toDate || searchInput);

  const jumlahBerkas = filterAktif ? total : kelompok.reduce((n, k) => n + k.total, 0);

  const renderTabel = (daftar: ClaimFile[]) => (
    <Table className="table-zebra">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Nama Pasien</TableHead>
          <TableHead>Kategori</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Valid</TableHead>
          <TableHead className="text-right">Pending</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Alasan Pending</TableHead>
          <TableHead>Diunggah</TableHead>
          <TableHead className="text-right">Aksi</TableHead>
        </TableRow>
      </TableHeader>
      <motion.tbody variants={containerVariants} initial="hidden" animate="visible">
        <AnimatePresence>
          {daftar.map((f) => (
            <motion.tr
              key={f.id}
              variants={rowVariants}
              layout
              whileHover={{
                backgroundColor: 'var(--muted)',
                transition: { duration: 0.15 },
              }}
              exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
              className="border-b border-border last:border-0"
            >
              <TableCell className="max-w-[200px] truncate font-medium text-foreground">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{f.nama_pasien || '-'}</span>
                </div>
              </TableCell>
              <TableCell>
                {f.jenis_klaim ? (
                  <Badge variant="secondary" className="whitespace-nowrap text-[10px]">
                    {jenisKlaimLabel(f.jenis_klaim)}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="font-mono-data text-right">{f.total_records}</TableCell>
              <TableCell className="font-mono-data text-right font-medium text-primary">{f.valid_count}</TableCell>
              <TableCell className="font-mono-data text-right font-medium text-amber-600 dark:text-amber-400">
                {f.pending_count + f.error_count}
              </TableCell>
              <TableCell>
                {f.pending_count + f.error_count > 0 ? (
                  <Badge variant="outline" className="whitespace-nowrap border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400">Perlu dikerjakan</Badge>
                ) : (
                  <Badge variant="outline" className="whitespace-nowrap border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400">Siap submit</Badge>
                )}
              </TableCell>
              <TableCell className="max-w-[240px] truncate text-xs text-muted-foreground" title={f.pending_reason || undefined}>
                {f.pending_reason || (f.pending_count + f.error_count > 0 ? '-' : '')}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                <div>{f.uploaded_by_name}</div>
                <div>{new Date(f.created_at).toLocaleDateString('id-ID')}</div>
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => router.push(f.sep ? `/results/${f.id}?sep=${encodeURIComponent(f.sep)}` : `/results/${f.id}`)}
                  >
                    <FileText className="size-3.5" />
                    Detail
                  </Button>
                  {lihatArsip ? (
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => kembalikan(f.id)}
                      aria-label="Kembalikan dari arsip"
                      title="Kembalikan dari arsip"
                    >
                      <ArchiveRestore className="size-3.5" />
                    </Button>
                  ) : (
                    // Arsip, bukan hapus: daftar tetap bersih tapi data untuk
                    // mengukur recall tidak ikut hilang.
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => arsipkan(f.id)}
                      aria-label="Arsipkan berkas"
                      title="Arsipkan — data tetap tersimpan"
                    >
                      <Archive className="size-3.5" />
                    </Button>
                  )}
                  {lihatArsip && (
                    <Button
                      variant="destructive"
                      size="icon-sm"
                      onClick={() => setPendingDeleteId(f.id)}
                      aria-label="Hapus permanen"
                      title="Hapus permanen"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </motion.tr>
          ))}
        </AnimatePresence>
      </motion.tbody>
    </Table>
  );

  // Hitungan di chip diambil dari ringkasan kelompok, supaya yang tersembunyi
  // oleh tampilan bawaan tetap kelihatan — klaim yang baru diunggah dan sudah
  // bersih tidak boleh terkesan hilang cuma karena tampilannya "Perlu dikerjakan".
  const hitung = {
    perlu: kelompok.reduce((n, k) => n + k.perlu, 0),
    siap: kelompok.reduce((n, k) => n + k.siap, 0),
    semua: kelompok.reduce((n, k) => n + k.total, 0),
    bulan_ini: kelompok.filter((k) => k.periode === bulanIni()).reduce((n, k) => n + k.total, 0),
  };
  const simpanTampilan = () => {
    try {
      localStorage.setItem('riwayat-upload-tampilan', JSON.stringify({ tampilan, kelompokkan }));
      addToast('Tampilan Riwayat Upload tersimpan di perangkat ini.', 'success');
    } catch {
      addToast('Tampilan belum bisa disimpan di perangkat ini.', 'error');
    }
  };

  const CHIP: { nilai: Tampilan; label: string }[] = [
    { nilai: 'perlu', label: 'Perlu dikerjakan' },
    { nilai: 'bulan_ini', label: 'Bulan ini' },
    { nilai: 'siap', label: 'Siap submit' },
    { nilai: 'semua', label: 'Semua aktif' },
  ];

  const barChip = !lihatArsip && (
    <div className={`${modeKelompok ? 'border-b' : 'rounded-xl border'} border-border bg-muted/40 px-4 py-4 dark:bg-[#1d2929] md:px-6`}>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="mr-1 font-mono-data text-[11px] uppercase tracking-wider text-muted-foreground">Tampilan</span>
        {CHIP.map((c) => (
          <button
            key={c.nilai}
            type="button"
            disabled={filterAktif}
            aria-pressed={!filterAktif && tampilan === c.nilai}
            title={`${c.label}: ${hitung[c.nilai]} klaim`}
            onClick={() => setTampilan(c.nilai)}
            className={`rounded-full border px-4 py-2 text-sm transition-colors disabled:opacity-40 ${
              !filterAktif && tampilan === c.nilai
                ? 'border-teal-600 bg-teal-600 font-semibold text-white dark:border-teal-500 dark:bg-teal-500'
                : 'border-border bg-background/70 text-muted-foreground hover:border-teal-500/50 hover:text-foreground dark:bg-[#172121]'
            }`}
          >
            {c.label}
          </button>
        ))}
        <button
          type="button"
          disabled={filterAktif}
          onClick={simpanTampilan}
          className="rounded-full border border-dashed border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-teal-500 hover:text-foreground disabled:opacity-40 dark:bg-[#172121]"
        >
          + simpan tampilan
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {filterAktif ? 'Pencarian aktif — seluruh hasil ditampilkan.' : 'Bulan terbaru terbuka, sisanya terlipat.'}
        </p>
        <div className="flex items-center gap-2">
          <span className="font-mono-data text-[11px] uppercase tracking-wider text-muted-foreground">Kelompokkan</span>
          <button
            type="button"
            aria-pressed={kelompokkan}
            onClick={() => setKelompokkan((v) => !v)}
            className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
              kelompokkan
                ? 'border-teal-600 bg-teal-600 font-semibold text-white dark:border-teal-500 dark:bg-teal-500'
                : 'border-border bg-background text-muted-foreground hover:text-foreground'
            }`}
          >
            {kelompokkan ? 'Periode & Kategori' : 'Tanpa pengelompokan'}
          </button>
        </div>
      </div>
    </div>
  );

  const tampilanKelompok = kelompokTampil.length === 0 ? (
    <div className="px-6 py-14 text-center">
      <FolderOpen className="mx-auto mb-3 size-7 text-muted-foreground" />
      <h3 className="text-base font-semibold text-foreground">Tidak ada klaim pada tampilan ini</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {hitung.semua > 0 ? 'Coba tampilan "Semua aktif" untuk melihat klaim lainnya.' : 'Upload file klaim untuk memulai validasi.'}
      </p>
    </div>
  ) : (
    <div className="divide-y divide-border">
      {kelompokTampil.map((k) => {
        const key = kunciKelompok(k);
        const buka = Boolean(terbuka[key]);
        const baris = barisKelompok[key];
        return (
          <section key={key}>
            <button
              type="button"
              aria-expanded={buka}
              onClick={() => setTerbuka((t) => ({ ...t, [key]: !t[key] }))}
              className={`flex w-full flex-wrap items-center justify-between gap-3 px-4 py-4 text-left transition-colors md:px-6 ${
                buka ? 'bg-teal-50 hover:bg-teal-100/70 dark:bg-[#0d2927] dark:hover:bg-[#113330]' : 'bg-muted/30 hover:bg-muted/60 dark:bg-[#1d2929] dark:hover:bg-[#243131]'
              }`}
            >
              <span className="flex min-w-0 flex-wrap items-center gap-3 font-display text-base font-bold text-foreground">
                <ChevronDown className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${buka ? '' : '-rotate-90'}`} />
                {labelPeriode(k.periode)}
                {k.jenis_klaim && (
                  <Badge variant="outline" className={`rounded-md px-2.5 py-1 text-xs font-semibold ${WARNA_KATEGORI[k.jenis_klaim] || ''}`}>{jenisKlaimLabel(k.jenis_klaim)}</Badge>
                )}
              </span>
              <span className="font-mono-data flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span><b className="text-foreground">{k.total}</b> klaim</span>
                <span aria-hidden="true">·</span>
                {k.perlu > 0 ? (
                  <>
                    <span className="font-semibold text-amber-600 dark:text-amber-400">{k.perlu} pending</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-emerald-600 dark:text-emerald-400">{k.siap} siap</span>
                  </>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400">semua selesai</span>
                )}
              </span>
            </button>
            {buka && (
              <div className="border-t border-border">
                {!baris ? (
                  <div className="space-y-3 p-5">
                    {Array.from({ length: 3 }).map((_, n) => <Skeleton key={n} className="h-16 w-full" />)}
                  </div>
                ) : baris.files.length === 0 ? (
                  <p className="px-6 py-5 text-sm text-muted-foreground">Tidak ada klaim pada tampilan ini.</p>
                ) : (
                  <>
                    <div className="divide-y divide-border">
                      {baris.files.map((f) => {
                        const perluDikerjakan = f.pending_count + f.error_count > 0;
                        return (
                          <div key={f.id} className="grid gap-3 px-4 py-4 transition-colors hover:bg-muted/40 dark:bg-[#172121] dark:hover:bg-[#1d2b2a] md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_auto] md:items-center md:px-6">
                            <button
                              type="button"
                              onClick={() => router.push(f.sep ? `/results/${f.id}?sep=${encodeURIComponent(f.sep)}` : `/results/${f.id}`)}
                              className="min-w-0 text-left hover:text-teal-700 dark:hover:text-teal-300"
                              aria-label={`Lihat detail klaim ${f.nama_pasien || f.file_name}`}
                            >
                              <span className="block truncate font-semibold text-foreground">{f.nama_pasien || f.file_name}</span>
                              <span className="font-mono-data mt-1 block truncate text-xs text-muted-foreground">{f.sep || f.file_name}</span>
                            </button>
                            <p className="line-clamp-2 min-w-0 text-xs leading-relaxed text-muted-foreground" title={f.pending_reason || undefined}>
                              {f.pending_reason || (perluDikerjakan ? 'Perlu ditinjau' : '—')}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 md:justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push(f.sep ? `/results/${f.id}?sep=${encodeURIComponent(f.sep)}` : `/results/${f.id}`)}
                                className="gap-1.5"
                                aria-label={`Lihat detail berkas ${f.nama_pasien || f.file_name}`}
                              >
                                <FileText className="size-3.5" />
                                Lihat detail
                              </Button>
                              <Badge variant="outline" className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold ${
                                perluDikerjakan
                                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                  : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                              }`}>
                                {perluDikerjakan ? 'Perlu dikerjakan' : 'Siap submit'}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => lihatArsip ? kembalikan(f.id) : arsipkan(f.id)}
                                aria-label={lihatArsip ? 'Kembalikan dari arsip' : 'Arsipkan berkas'}
                                title={lihatArsip ? 'Kembalikan dari arsip' : 'Arsipkan berkas'}
                                className="text-muted-foreground"
                              >
                                {lihatArsip ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
                              </Button>
                              {lihatArsip && (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => setPendingDeleteId(f.id)}
                                  aria-label="Hapus permanen"
                                  title="Hapus permanen"
                                  className="text-destructive"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {baris.total > baris.files.length && (
                      <p className="border-t border-border px-6 py-3 text-xs text-muted-foreground">
                        Menampilkan {baris.files.length} dari {baris.total}. Pakai pencarian untuk menemukan klaim tertentu.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );

  return (
    <motion.div
      className="space-y-4 md:space-y-6"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      <Header
        title="Riwayat Upload"
        description={lihatArsip ? `${jumlahBerkas} berkas di arsip — datanya tetap utuh dan bisa dikembalikan` : `${jumlahBerkas} file telah diupload`}
        actions={
          <Button onClick={() => router.push('/extract')} className="gap-2">
            <Upload className="size-4" />
            Upload Baru
          </Button>
        }
      />

      <HistoryTabs />

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3 md:p-4 animate-slide-in-up">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Cari Nama Pasien / SEP</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Cari nama pasien atau nomor SEP..."
              className="w-full pl-8 sm:w-[240px]"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Kategori</label>
          <Select
            value={jenisKlaimFilter || 'ALL'}
            onValueChange={(v) => { setJenisKlaimFilter(v === 'ALL' ? '' : v); setPage(1); }}
          >
            <SelectTrigger className="w-full sm:w-[190px]">
              <SelectValue placeholder="Semua Kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Kategori</SelectItem>
              {Object.entries(JENIS_KLAIM_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Dari</label>
          <DatePicker
            className="sm:w-[160px]"
            value={fromDate}
            max={toDate || undefined}
            onChange={(v) => { setFromDate(v); setPage(1); }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Sampai</label>
          <DatePicker
            className="sm:w-[160px]"
            value={toDate}
            min={fromDate || undefined}
            onChange={(v) => { setToDate(v); setPage(1); }}
          />
        </div>

        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={() => { setJenisKlaimFilter(''); setFromDate(''); setToDate(''); setSearchInput(''); setPage(1); }}
          >
            <X className="size-3.5" />
            Reset Filter
          </Button>
        )}

        <Button
          type="button"
          variant={lihatArsip ? 'default' : 'outline'}
          size="sm"
          className={`gap-1.5 ${lihatArsip ? '' : 'sm:ml-auto'}`}
          onClick={() => { setLihatArsip(v => !v); setPage(1); }}
        >
          <Archive className="size-3.5" />
          {lihatArsip ? 'Kembali ke Daftar Aktif' : 'Lihat Arsip'}
        </Button>

        {/* Daftar Kerja — lembar kerja harian koder. Cakupannya mengikuti filter
            kategori yang sedang aktif, dan cakupan itu ikut tertulis di nama
            berkas serta lembar Ringkasan supaya tidak ada salah paham ketika
            berkasnya beredar terlepas dari aplikasi. */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={mengexport}
          onClick={unduhDaftarKerja}
        >
          <Download className="size-3.5" />
          {mengexport ? 'Menyiapkan...' : 'Export Daftar Kerja'}
        </Button>
        {rolePengguna === 'supervisor' ? (
          <span className="text-xs text-muted-foreground">Nama pasien otomatis disamarkan untuk role supervisor.</span>
        ) : (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={samarkanNama}
              onChange={event => setSamarkanNama(event.target.checked)}
            />
            Samarkan nama pasien di Daftar Kerja
          </label>
        )}
        {rolePengguna !== 'supervisor' && <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={mengexportSiap}
          onClick={unduhSiapSubmit}
        >
          <Download className="size-3.5" />
          {mengexportSiap ? 'Menyiapkan...' : 'Export Siap Submit'}
        </Button>}
        {rolePengguna !== 'supervisor' && (
          <div className="flex items-center gap-1.5">
            <label htmlFor="bulan-pending" className="text-xs text-muted-foreground">Bulan klaim</label>
            <input
              id="bulan-pending"
              type="month"
              value={bulanPending}
              onChange={event => setBulanPending(event.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={mengexportPending || !bulanPending}
              onClick={unduhPendingBulanan}
              title="Klaim pending pada bulan terpilih, format kolom sama dengan ekspor MIX E-Klaim, plus lembar alasan pending & saran"
            >
              <Download className="size-3.5" />
              {mengexportPending ? 'Menyiapkan...' : 'Export Pending Bulanan'}
            </Button>
          </div>
        )}
      </div>

      {modeKelompok ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {barChip}
          {tampilanKelompok}
        </div>
      ) : (
        <>
          {barChip}
          {loading ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex border-b border-border px-4 py-3 gap-6">
            {['Nama Pasien', 'Kategori', 'Total', 'Pending'].map((h) => (
              <Skeleton key={h} className="h-3.5 w-16" />
            ))}
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-6 border-b border-border px-4 py-3.5 last:border-0">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20 rounded-full" />
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-16 rounded-full" />
            </div>
          ))}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {files.length === 0 ? (
            <motion.div
              key="empty"
              variants={emptyVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.25 } }}
              className="rounded-xl border border-border bg-card"
            >
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <motion.div
                  className="flex size-16 items-center justify-center rounded-full bg-muted"
                  animate={{ y: [0, -8, 0], rotate: [0, 3, -3, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' as const }}
                >
                  <FolderOpen className="size-7 text-muted-foreground" />
                </motion.div>
                <h3 className="text-base font-semibold text-foreground">Belum ada file</h3>
                <p className="text-sm text-muted-foreground">Upload file klaim untuk memulai validasi</p>
                <Button onClick={() => router.push('/extract')} className="mt-2 gap-2">
                  <Upload className="size-4" />
                  Upload Sekarang
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="table"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.3 } }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              className="overflow-hidden rounded-xl border border-border bg-card"
            >
              {renderTabel(files)}
            </motion.div>
          )}
        </AnimatePresence>
          )}
        </>
      )}

      <AnimatePresence>
        {totalPages > 1 && !modeKelompok && (
          <motion.div
            className="flex items-center justify-center gap-3"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ delay: 0.3, duration: 0.35 }}
          >
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="size-4" />
              Sebelumnya
            </Button>
            <AnimatePresence mode="wait">
              <motion.span
                key={page}
                className="text-sm text-muted-foreground"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.2 }}
              >
                Halaman {page} dari {totalPages}
              </motion.span>
            </AnimatePresence>
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Selanjutnya
              <ChevronRight className="size-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <AlertDialog open={pendingDeleteId !== null} onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus permanen berkas ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Berkas beserta seluruh baris klaimnya hilang dan tidak bisa dikembalikan.
              Baris klaim itu dipakai untuk mencocokkan dengan rekap pending BPJS yang
              baru datang sekitar tiga bulan kemudian — kalau dihapus, klaim ini tidak
              bisa lagi dipakai membuktikan apa pun.
              {' '}Untuk sekadar merapikan daftar, arsipkan saja: datanya tetap tersimpan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (pendingDeleteId) handleDelete(pendingDeleteId);
                setPendingDeleteId(null);
              }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </motion.div>
  );
}
