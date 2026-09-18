'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Upload,
  Inbox,
  RotateCcw,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Header } from '@/components/dashboard/header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface DashboardData {
  total_files: number;
  total_claims: number;
  valid: number;
  error: number;
  pending: number;
  error_by_type: { rule_id: string; rule_name: string; count: number }[];
  recent_files: {
    id: string;
    file_name: string;
    period: string;
    status: string;
    total_records: number;
    valid_count: number;
    error_count: number;
    created_at: string;
    uploaded_by_name: string;
  }[];
  available_periods: string[];
}

/* ─── Animated Counter ──────────────────────────────────────────── */
function AnimatedCounter({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let raf: number;
    const startTime = performance.now();

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setDisplay(Math.round(eased * value));
      if (progress < 1) raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{display.toLocaleString('id-ID')}</>;
}

/* ─── Empty States ───────────────────────────────────────────────── */
function EmptyErrorState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <CheckCircle2 className="h-7 w-7 text-primary" />
      </div>
      <p className="text-sm font-medium text-foreground">Belum ada data error</p>
      <p className="mt-1 text-xs text-muted-foreground">Semua klaim terproses dengan baik</p>
    </div>
  );
}

function EmptyUploadState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Inbox className="h-7 w-7 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">Belum ada file yang diupload</p>
      <p className="mt-1 text-xs text-muted-foreground">Upload file pertama Anda untuk memulai</p>
    </div>
  );
}

/* ─── Animation Variants ────────────────────────────────────────── */
const pageVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
};

const statCardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

const splitLayoutVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.5 } },
};

const columnVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

const ruleStaggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};

const ruleItemVariants = {
  hidden: { opacity: 0, x: -30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

const tableRowVariants = (index: number) => ({
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, delay: index * 0.05, ease: 'easeOut' as const },
  },
});

/* ─── Loading Skeleton ──────────────────────────────────────────── */
function LoadingSkeleton() {
  return (
    <motion.div
      className="space-y-4 md:space-y-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div>
        <Skeleton className="h-7 w-48 rounded-md" />
        <Skeleton className="mt-2 h-4 w-72 rounded-md" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-4">
            <Skeleton className="mb-3 h-10 w-10 rounded-lg" />
            <Skeleton className="mb-2 h-3 w-20 rounded-md" />
            <Skeleton className="h-7 w-16 rounded-md" />
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i} className="h-72 p-5">
            <Skeleton className="mb-4 h-5 w-40 rounded-md" />
            <Skeleton className="h-48 w-full rounded-md" />
          </Card>
        ))}
      </div>
    </motion.div>
  );
}

/* ─── Stat Card Component ───────────────────────────────────────── */
function StatCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  valueColor,
  footer,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  valueColor: string;
  footer: string;
}) {
  return (
    <motion.div
      variants={statCardVariants}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <Card className="gap-3 p-4 shadow-sm transition-shadow duration-200 hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-caption">{label}</span>
          <div
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-lg',
              iconBg,
            )}
          >
            <Icon className={cn('h-4 w-4', iconColor)} />
          </div>
        </div>
        <div className={cn('font-mono-data text-2xl font-bold', valueColor)}>
          <AnimatedCounter value={value} />
        </div>
        <div className="text-xs text-muted-foreground">{footer}</div>
      </Card>
    </motion.div>
  );
}

/* ─── Main Dashboard Page ───────────────────────────────────────── */
export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('');
  const [uploadPage, setUploadPage] = useState(1);
  const [contentKey, setContentKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const d = await api.getDashboard(period || undefined);
      setData(d);
      setContentKey((k) => k + 1);
    } catch (err) {
      console.error('[Dashboard] Gagal memuat data:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [period]);

  // Polling untuk update status validasi otomatis setiap 3 detik
  // (hanya kalau ada file yang masih "validating")
  useEffect(() => {
    if (!autoRefreshEnabled || !data) return;

    const hasValidatingFiles = data.recent_files?.some(f => f.status === 'validating');
    if (!hasValidatingFiles) return;

    const pollingInterval = setInterval(() => {
      loadData();
    }, 3000); // 3 detik

    return () => clearInterval(pollingInterval);
  }, [data, autoRefreshEnabled, loadData]);

  // Load data saat mount atau period berubah
  useEffect(() => {
    loadData();
  }, [period, loadData]);

  if (loading) return <LoadingSkeleton />;
  if (!data)
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-20 text-center">
        <h3 className="text-sm font-semibold text-foreground">Gagal memuat data</h3>
      </div>
    );

  const validPct = data.total_claims > 0 ? ((data.valid / data.total_claims) * 100).toFixed(1) : '0';
  const errorPct = data.total_claims > 0 ? ((data.error / data.total_claims) * 100).toFixed(1) : '0';
  const pendingPct = data.total_claims > 0 ? ((data.pending / data.total_claims) * 100).toFixed(1) : '0';

  const itemsPerPage = 5;
  const totalPages = Math.ceil((data.recent_files?.length || 0) / itemsPerPage);
  const startIndex = (uploadPage - 1) * itemsPerPage;
  const endIndex = uploadPage * itemsPerPage;
  const paginatedFiles = (data.recent_files || []).slice(startIndex, endIndex);

  const totalErrors = data.error_by_type.reduce((sum, x) => sum + x.count, 0);

  return (
    <motion.div
      key={contentKey}
      className="space-y-4 md:space-y-5"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      <Header
        title="Ringkasan"
        description="Metrik validasi klaim real-time"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsRefreshing(true);
                loadData();
              }}
              disabled={isRefreshing}
              className="gap-1.5 h-8"
            >
              <RotateCcw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
              <span className="text-xs">Refresh</span>
            </Button>
            <span className="text-xs font-medium text-muted-foreground">Periode</span>
            <Select
              value={period || 'all'}
              onValueChange={(v) => {
                setPeriod(v === 'all' ? '' : v);
                setUploadPage(1);
              }}
            >
              <SelectTrigger size="sm" className="w-40 bg-card">
                <SelectValue placeholder="Semua Periode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Periode</SelectItem>
                {data.available_periods.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {/* Stats Grid */}
      <motion.div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        <StatCard
          label="Total Klaim"
          value={data.total_claims}
          icon={FileText}
          iconBg="bg-primary/10"
          iconColor="text-primary"
          valueColor="text-foreground"
          footer={`${data.total_files} file diupload`}
        />
        <StatCard
          label="Valid"
          value={data.valid}
          icon={CheckCircle2}
          iconBg="bg-primary/10"
          iconColor="text-primary"
          valueColor="text-primary"
          footer={`${validPct}% dari total`}
        />
        <StatCard
          label="Error"
          value={data.error}
          icon={XCircle}
          iconBg="bg-destructive/10"
          iconColor="text-destructive"
          valueColor="text-destructive"
          footer={`${errorPct}% dari total`}
        />
        <StatCard
          label="Pending"
          value={data.pending}
          icon={Clock}
          iconBg="bg-amber-500/10"
          iconColor="text-amber-600"
          valueColor="text-amber-600"
          footer={`${pendingPct}% dari total`}
        />
      </motion.div>

      {/* Split Layout */}
      <motion.div
        className="grid grid-cols-1 gap-4 lg:grid-cols-2"
        variants={splitLayoutVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Left Column: Top 5 Error Rules */}
        <motion.div variants={columnVariants}>
          <Card className="h-full gap-4 p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display flex items-center gap-2 text-sm font-semibold text-foreground">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                5 Aturan Error Tertinggi
              </h3>
              <button
                className="text-xs font-semibold text-primary hover:underline"
                onClick={() => router.push('/rules')}
              >
                Lihat Semua &rarr;
              </button>
            </div>

            {data.error_by_type.length === 0 ? (
              <EmptyErrorState />
            ) : (
              <motion.div
                className="space-y-3"
                variants={ruleStaggerContainer}
                initial="hidden"
                animate="visible"
              >
                {data.error_by_type.slice(0, 5).map((e, index) => {
                  const pct = totalErrors > 0 ? Math.round((e.count / totalErrors) * 100) : 0;
                  return (
                    <motion.div
                      key={e.rule_id}
                      className="rounded-lg p-2.5 transition-colors hover:bg-muted/50"
                      variants={ruleItemVariants}
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center text-xs font-medium text-foreground">
                          <Badge variant="destructive" className="mr-2 shrink-0 px-1.5 py-0 text-[9px]">
                            {e.rule_id}
                          </Badge>
                          <span className="truncate">{e.rule_name}</span>
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-muted-foreground">{pct}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <motion.div
                          className="h-full rounded-full bg-destructive"
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{
                            duration: 0.8,
                            ease: [0.25, 0.46, 0.45, 0.94] as const,
                            delay: 0.3 + index * 0.08,
                          }}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </Card>
        </motion.div>

        {/* Right Column: Recent Uploads Table */}
        <motion.div variants={columnVariants}>
          <Card className="flex h-full flex-col gap-4 p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display flex items-center gap-2 text-sm font-semibold text-foreground">
                <FileText className="h-4 w-4 text-primary" />
                Upload Terbaru
              </h3>
              <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => router.push('/extract')}>
                <Upload className="h-3.5 w-3.5" />
                Upload Baru
              </Button>
            </div>

            {data.recent_files.length === 0 ? (
              <EmptyUploadState />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table className="table-zebra">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Nama File</TableHead>
                        <TableHead className="text-xs">Tanggal Upload</TableHead>
                        <TableHead className="text-xs">Periode</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-right text-xs">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedFiles.map((f, index) => {
                        const statusText =
                          f.status === 'completed'
                            ? 'Processed'
                            : f.status === 'validating'
                            ? 'Validating'
                            : f.status === 'failed'
                            ? 'Failed'
                            : f.status;
                        const badgeVariant: 'default' | 'destructive' | 'secondary' =
                          f.status === 'completed'
                            ? 'default'
                            : f.status === 'failed'
                            ? 'destructive'
                            : 'secondary';
                        const badgeClassName =
                          f.status === 'completed'
                            ? 'bg-primary/10 text-primary border-transparent'
                            : f.status === 'validating'
                            ? 'bg-amber-500/10 text-amber-600 border-transparent'
                            : f.status === 'failed'
                            ? ''
                            : 'bg-muted text-muted-foreground border-transparent';

                        return (
                          <motion.tr
                            key={f.id}
                            custom={index}
                            variants={tableRowVariants(index)}
                            initial="hidden"
                            animate="visible"
                            className="border-b transition-colors last:border-0 hover:bg-muted/50"
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                                  <FileText className="h-3.5 w-3.5 text-primary" />
                                </div>
                                <span className="max-w-[140px] truncate text-xs font-medium text-foreground">
                                  {f.file_name}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(f.created_at).toLocaleDateString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                              ,{' '}
                              {new Date(f.created_at).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{f.period || '-'}</TableCell>
                            <TableCell>
                              <Badge variant={badgeVariant} className={cn('text-[10px]', badgeClassName)}>
                                {statusText}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {f.status === 'completed' && f.error_count === 0 ? (
                                <button
                                  className="text-xs font-semibold text-primary hover:underline"
                                  onClick={() => router.push(`/results/${f.id}`)}
                                >
                                  Lihat Laporan
                                </button>
                              ) : f.status === 'completed' || f.status === 'failed' ? (
                                <button
                                  className="text-xs font-semibold text-destructive hover:underline"
                                  onClick={() => router.push(`/results/${f.id}`)}
                                >
                                  Lihat Error
                                </button>
                              ) : (
                                <span className="text-xs text-muted-foreground">Memvalidasi...</span>
                              )}
                            </TableCell>
                          </motion.tr>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination Controls */}
                <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
                  <div className="text-xs text-muted-foreground">
                    Menampilkan {startIndex + 1}-{Math.min(endIndex, data.recent_files.length)} dari{' '}
                    {data.recent_files.length}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
                      disabled={uploadPage <= 1}
                      onClick={() => setUploadPage((p) => Math.max(1, p - 1))}
                      title="Halaman Sebelumnya"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
                      disabled={uploadPage >= totalPages}
                      onClick={() => setUploadPage((p) => Math.min(totalPages, p + 1))}
                      title="Halaman Berikutnya"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </Card>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
