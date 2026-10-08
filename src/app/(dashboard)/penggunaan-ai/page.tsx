'use client';
import { useDeferredEffect } from '@/lib/useDeferredEffect';
import Link from "next/link"
import { useEffect, useState, type ReactNode } from "react"
import { RefreshCw, Download, Info, Coins, Hash, Activity, DollarSign } from "lucide-react"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"

type Metrics = {
  calls: number; failed_calls: number; measured_calls: number; priced_calls: number
  input_tokens: number; output_tokens: number; total_tokens: number
  cached_tokens: number; reasoning_tokens: number; unmeasured_calls: number; unpriced_calls: number
  estimated_usd: number | null; estimated_idr: number | null
}
type Report = {
  month: string; timezone: string; updated_at: string; exchange_rate: number; summary: Metrics
  models: (Metrics & { provider: string; model: string; effort: string | null })[]
  days: (Metrics & { day: string })[]
  tasks: (Metrics & { task: string })[]
  claim_types: (Metrics & { claim_type: string | null })[]
}
const angka = (n: number) => n.toLocaleString("id-ID")
const rupiah = (n: number | null) => n === null ? "Belum tersedia" : n.toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 2 })
const dolar = (n: number | null) => n === null ? "Belum tersedia" : n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 4, maximumFractionDigits: 6 })
const namaModel = (model: string) => model === "gpt-6-luna" ? "Luna 6.0" : model === "gpt-6.1-sol" ? "Sol 6.1" : model || "Model tidak tercatat"
const namaTugas: Record<string, string> = {
  ekstrak_pdf: "Membaca PDF", baca_berkas: "Analisis berkas", tinjauan_diagnosis: "Meninjau diagnosis",
  tinjauan_lanjutan: "Pemeriksaan lanjutan", analisis_pending: "Analisis pending",
  putuskan_pending: "Menilai risiko pending", tinjau_kasus_lanjutan: "Pemeriksaan lanjutan Sol", baca_kedua: "Memeriksa bukti",
  petakan_alasan_pending: "Mencari alasan pending", rancang_jawaban_pending: "Menyusun jawaban pending",
  baca_regulasi: "Membaca aturan", petakan_diagnosis_who: "Memeriksa diagnosis WHO",
  kodekan_tindakan_baru: "Menilai prosedur", audit_berkas_field: "Memeriksa data berkas", ringkas_training_pending: "Merangkum contoh pending",
}
function bulanKini() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).formatToParts(new Date())
  return `${parts.find(p => p.type === "year")?.value}-${parts.find(p => p.type === "month")?.value}`
}
function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <section className="rounded-xl border border-border bg-card overflow-hidden">
    <div className="px-5 py-4 border-b border-border"><h2 className="font-semibold">{title}</h2>{description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}</div>
    {children}
  </section>
}
const th = "px-5 py-3 text-left text-xs font-medium text-muted-foreground whitespace-nowrap"
const td = "px-5 py-3 text-sm whitespace-nowrap"

type FileReport = {
  month: string; page: number; page_size: number; total_files: number;
  policy: { target_idr: number; batas_normal_idr: number; batas_maksimum_idr: number };
  files: { file_id: string; file_name: string; calls: number; priced_calls: number; total_tokens: number | null; estimated_idr: number | null;
    budget: { terpakai_idr: number; dicadangkan_idr: number; belum_pasti_idr: number; gagal_idr: number; tambahan_alasan: string[] } | null }[];
}
function BiayaBerkas({ month, refresh }: { month: string; refresh: number }) {
  const [page, setPage] = useState(1)
  const [state, setState] = useState<{ key: string; data?: FileReport; error?: string } | null>(null)
  const key = `${month}:${page}:${refresh}`
  useDeferredEffect(() => { setPage(1) }, [month])
  useEffect(() => {
    let active = true
    api.getAiFileCosts<FileReport>(month, page).then((data: FileReport) => { if (active) setState({ key, data }) })
      .catch((error: Error) => { if (active) setState({ key, error: error.message }) })
    return () => { active = false }
  }, [month, page, refresh, key])
  const data = state?.key === key ? state.data : undefined
  const error = state?.key === key ? state.error : undefined
  return <Section title="Biaya AI per berkas" description="Catatan yang terkait berkas tersimpan ditampilkan di sini. Catatan tanpa berkas tetap masuk ringkasan bulanan.">
    {error ? <p role="alert" className="p-5 text-sm text-destructive">{error}</p> : !data ? <p role="status" className="p-5 text-sm text-muted-foreground">Memuat biaya berkas…</p> : <>
      <div className="px-5 py-4 text-sm text-muted-foreground space-y-1 border-b border-border">
        <p className="font-medium text-foreground">Analisis tinggi · biaya adaptif</p>
        <p>Target {rupiah(data.policy.target_idr)}–{rupiah(data.policy.batas_normal_idr)} per PDF. Batas pengaman kasus kompleks {rupiah(data.policy.batas_maksimum_idr)}.</p>
        <p>Tambahan hanya digunakan bila pemeriksaan klinis memerlukannya. Hasil tersimpan dipakai kembali; gangguan tidak membuka tambahan anggaran otomatis.</p>
      </div>
      {!data.files.length ? <p className="p-5 text-sm text-muted-foreground">Belum ada berkas pada bulan ini.</p> : <div className="overflow-x-auto"><table className="w-full"><thead className="bg-muted/30"><tr>{["Berkas", "Panggilan", "Token", "Biaya bulan ini", "Catatan tersimpan"].map(h => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead><tbody className="divide-y divide-border">
        {data.files.map(f => <tr key={f.file_id}>
          <td className={`${td} max-w-xs`}><Link href={`/results/${f.file_id}`} className="text-primary hover:underline block truncate" title={f.file_name}>{f.file_name}</Link></td>
          <td className={td}>{angka(f.calls)}</td><td className={td}>{f.total_tokens == null ? "Belum tercatat" : angka(f.total_tokens)}</td>
          <td className={td}>{rupiah(f.estimated_idr)}{f.priced_calls < f.calls && <p className="mt-1 text-xs text-amber-600">{f.calls - f.priced_calls} panggilan belum memiliki estimasi</p>}</td>
          <td className="px-5 py-3 text-sm min-w-64">{f.budget ? <details><summary className="cursor-pointer text-primary">Rincian anggaran berkas</summary><div className="mt-2 text-xs text-muted-foreground space-y-1">
            <p>Total tersimpan lintas bulan: {rupiah(f.budget.terpakai_idr)}</p>
            <p>Dicadangkan: {rupiah(f.budget.dicadangkan_idr)} · Belum terkonfirmasi: {rupiah(f.budget.belum_pasti_idr)}</p>
            {f.budget.gagal_idr > 0 && <p>Biaya tahap gagal {rupiah(f.budget.gagal_idr)} sudah termasuk total; permintaan yang sama ditahan agar tidak berulang.</p>}
            {f.budget.tambahan_alasan.map((a, i) => <p key={i}>{a}</p>)}
            <p>Anggaran mengikuti isi PDF yang sama; unggahan salinan dapat berbagi anggaran ini. Jangan menjumlahkan total anggaran sebagai biaya bulanan.</p>
          </div></details> : <span className="text-xs text-muted-foreground">Anggaran per PDF belum tercatat; riwayat biaya tetap disimpan.</span>}</td>
        </tr>)}
      </tbody></table></div>}
      <div className="flex items-center justify-between gap-3 p-4 border-t border-border text-sm"><span>{angka(data.total_files)} berkas · Halaman {page}</span><div className="flex gap-2"><Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Sebelumnya</Button><Button variant="outline" disabled={page * data.page_size >= data.total_files} onClick={() => setPage(p => p + 1)}>Berikutnya</Button></div></div>
    </>}
  </Section>
}

export default function PenggunaanAiPage() {
  const [month, setMonth] = useState(bulanKini)
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState("")
  const [refresh, setRefresh] = useState(0)
  useDeferredEffect(() => {
    try { setAllowed(["admin", "superadmin"].includes(JSON.parse(localStorage.getItem("user") || "{}").role)) }
    catch { setAllowed(false) }
  }, [])
  useDeferredEffect(() => {
    if (!allowed) return
    let active = true
    setBusy(true); setError(""); setReport(null)
    api.getAiUsage<Report>(month).then((data: Report) => { if (active) setReport(data) })
      .catch((err: Error) => { if (active) setError(err.message) })
      .finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [month, allowed, refresh])
  function unduh() {
    if (!report) return
    const lines = [["Tanggal (WIB)", "Panggilan", "Token tercatat", "Input", "Output", "Panggilan dengan token", "Panggilan dengan estimasi", "Estimasi USD", "Estimasi IDR"],
      ...report.days.map(d => [d.day, d.calls, d.total_tokens, d.input_tokens, d.output_tokens, d.measured_calls, d.priced_calls, d.estimated_usd ?? "", d.estimated_idr ?? ""])]
    const blob = new Blob(["\uFEFF" + lines.map(line => line.join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob), a = document.createElement("a")
    a.href = url; a.download = `penggunaan-ai-${report.month}.csv`
    document.body.appendChild(a); a.click(); a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const s = report?.summary
  return <div className="space-y-6">
    <Header title="Penggunaan AI" description="Pantau token dan biaya analisis untuk rumah sakit Anda." />
    {allowed === false ? <p role="alert" className="rounded-xl border border-border p-5">Halaman ini hanya dapat dibuka oleh admin.</p> : <>
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div><label htmlFor="bulan-ai" className="block text-sm font-medium mb-2">Bulan penggunaan</label>
          <input id="bulan-ai" type="month" min="2000-01" max="2099-12" value={month} onChange={e => { if (e.target.value) setMonth(e.target.value) }} className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <p className="mt-2 text-xs text-muted-foreground">Mengikuti waktu pemakaian AI (WIB).</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setRefresh(r => r + 1)} disabled={busy || !allowed}><RefreshCw aria-hidden="true" className={`h-4 w-4 mr-2 ${busy ? "animate-spin" : ""}`} />Perbarui</Button>
          <Button variant="outline" onClick={unduh} disabled={!report || busy}><Download aria-hidden="true" className="h-4 w-4 mr-2" />Unduh CSV</Button>
        </div>
      </div>
      {busy && <p role="status" className="py-8 text-center text-muted-foreground">Memuat penggunaan AI…</p>}
      {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">{error}</p>}
      {allowed && <BiayaBerkas month={month} refresh={refresh} />}
      {report && s && <>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: "Estimasi biaya tercatat", value: rupiah(s.estimated_idr), note: `${angka(s.priced_calls)} panggilan memiliki estimasi`, icon: Coins },
            { label: "Estimasi dalam dolar", value: dolar(s.estimated_usd), note: `Kurs saat ini ${rupiah(report.exchange_rate)} / USD`, icon: DollarSign },
            { label: "Total token tercatat", value: s.calls && !s.measured_calls ? "Belum tersedia" : angka(s.total_tokens), note: `Input ${angka(s.input_tokens)} · Output ${angka(s.output_tokens)}`, icon: Hash },
            { label: "Panggilan AI", value: angka(s.calls), note: `${angka(s.failed_calls)} gagal · termasuk percobaan ulang`, icon: Activity },
          ].map(card => <div key={card.label} className="rounded-xl border border-border bg-card p-5"><div className="flex items-center justify-between gap-2"><p className="text-sm text-muted-foreground">{card.label}</p><card.icon className="h-4 w-4 text-primary" aria-hidden="true" /></div><p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums break-words">{card.value}</p><p className="mt-2 text-xs text-muted-foreground leading-relaxed">{card.note}</p></div>)}
        </div>
        {(s.unmeasured_calls > 0 || s.unpriced_calls > 0) && <div role="status" className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"><Info aria-hidden="true" className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" /><div className="text-sm"><p className="font-medium">Catatan penggunaan belum lengkap</p><p className="mt-1 text-muted-foreground">{angka(s.unmeasured_calls)} panggilan belum memiliki jumlah token dan {angka(s.unpriced_calls)} belum memiliki estimasi biaya. Ini dapat berasal dari catatan lama atau permintaan yang gagal sebelum ada jawaban. Total di atas hanya mencakup angka yang sudah tercatat.</p></div></div>}
        {!s.calls ? <div className="rounded-xl border border-border bg-card p-10 text-center"><p className="font-medium">Belum ada penggunaan AI pada bulan ini</p><p className="mt-2 text-sm text-muted-foreground">Jumlah token akan tercatat saat aplikasi memanggil AI.</p></div> : <>
          <Section title="Penggunaan per model" description="Lihat model yang digunakan pada setiap pemeriksaan dan estimasi biayanya.">
            <div className="overflow-x-auto"><table className="w-full"><thead className="bg-muted/30"><tr>{["Model / effort", "Panggilan", "Input", "Output", "Total token", "Estimasi biaya"].map(h => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead><tbody className="divide-y divide-border">{report.models.map((m, i) => <tr key={i}><td className={td}><p className="font-medium">{namaModel(m.model)}</p><p className="mt-1 text-xs text-muted-foreground">{m.effort || "Effort tidak tercatat"} · {m.provider}</p></td><td className={td}>{angka(m.calls)}</td><td className={td}>{m.measured_calls ? angka(m.input_tokens) : "—"}</td><td className={td}>{m.measured_calls ? angka(m.output_tokens) : "—"}</td><td className={`${td} font-medium`}>{m.measured_calls ? angka(m.total_tokens) : "—"}</td><td className={td}><p>{rupiah(m.estimated_idr)}</p><p className="text-xs text-muted-foreground mt-1">{dolar(m.estimated_usd)} · {m.priced_calls}/{m.calls} tercatat</p></td></tr>)}</tbody></table></div>
          </Section>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Section title="Rawat jalan & rawat inap"><div className="divide-y divide-border">{report.claim_types.map((t, i) => <div key={i} className="flex justify-between gap-4 p-5"><div><p className="font-medium text-sm">{t.claim_type === "RAWAT_INAP" ? "Rawat inap" : t.claim_type === "RAWAT_JALAN" ? "Rawat jalan" : "Jenis belum tercatat"}</p><p className="text-xs text-muted-foreground mt-1">{angka(t.calls)} panggilan · {t.measured_calls ? `${angka(t.total_tokens)} token` : "Token belum tercatat"}</p></div><p className="text-sm tabular-nums">{rupiah(t.estimated_idr)}</p></div>)}</div></Section>
            <Section title="Pemakaian per tugas"><div className="divide-y divide-border">{report.tasks.map(t => <div key={t.task} className="flex justify-between gap-4 px-5 py-3"><div><p className="text-sm font-medium">{namaTugas[t.task] || t.task.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-muted-foreground">{angka(t.calls)} panggilan · {t.measured_calls ? `${angka(t.total_tokens)} token` : "Token belum tercatat"}</p></div><p className="text-sm tabular-nums">{rupiah(t.estimated_idr)}</p></div>)}</div></Section>
          </div>
          <Section title="Rincian harian" description="Percobaan ulang dan jawaban yang gagal diproses tetap dihitung jika penyedia melaporkan token.">
            <div className="overflow-x-auto"><table className="w-full"><thead className="bg-muted/30"><tr>{["Tanggal (WIB)", "Panggilan", "Total token", "Cakupan token", "Estimasi biaya"].map(h => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead><tbody className="divide-y divide-border">{report.days.map(d => <tr key={d.day}><td className={td}>{new Date(`${d.day}T12:00:00+07:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</td><td className={td}>{angka(d.calls)}</td><td className={td}>{d.measured_calls ? angka(d.total_tokens) : "—"}</td><td className={td}>{d.measured_calls}/{d.calls} panggilan</td><td className={td}>{rupiah(d.estimated_idr)}</td></tr>)}</tbody></table></div>
          </Section>
        </>}
        <div className="rounded-xl border border-border p-4 text-xs text-muted-foreground leading-relaxed space-y-1.5">
          <p>Biaya ini merupakan estimasi, bukan tagihan resmi penyedia. Nilai rupiah memakai kurs saat setiap panggilan dicatat.</p>
          <p>Token cache ({angka(s.cached_tokens)}) sudah termasuk input. Token penalaran ({angka(s.reasoning_tokens)}) sudah termasuk output, sehingga tidak dihitung dua kali.</p>
          <p>Satu berkas dapat memicu beberapa panggilan AI. Laporan mengikuti bulan pemakaian, bukan periode klaim.</p>
          <p>Diperbarui {new Date(report.updated_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB.</p>
        </div>
      </>}
    </>}
  </div>
}
