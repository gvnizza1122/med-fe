"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Info, RefreshCw, Search, ChevronLeft, ChevronRight, Upload } from "lucide-react"
import { Header } from "@/components/dashboard/header"
import { HistoryTabs } from "@/components/dashboard/history-tabs"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { api } from "@/lib/api"

type Prediction = { status: string; ringkasan: string; alasan: { kode?: string; ringkas?: string; pesan?: string; nama?: string }[] }
type Evaluation = { prediction: string; prediction_snapshot: Prediction; actual_result: string; reference_source: string; actual_reason: string; reason_match: string; notes: string; snapshot_at: string }
type Claim = { id: string; file_id: string; nama_pasien: string; sep: string; file_name: string; period: string; period_label: string; archived: boolean; current_prediction: Prediction; evaluation: Evaluation | null }
type Summary = { evaluated: number; labeled: number; uncertain: number; correct: number; true_pending: number; true_clear: number; missed_pending: number; false_alarm: number; reason_rated: number; reason_exact: number; reason_partial: number; accuracy: number | null; pending_recall: number | null; reason_accuracy: number | null }
type Report = { testing_storage_available: boolean; records: Claim[]; page: number; limit: number; total: number; summary: Record<string, Summary> }
const predLabel = (status: string) => status === "pending" ? "Berisiko pending" : status === "tidak_pending" ? "Tidak ditemukan risiko" : "Perlu ditinjau"
const actualLabel = (status?: string) => status === "pending" ? "Pending" : status === "diterima" ? "Tidak pending / diterima" : "Belum diuji"
const persen = (n: number | null) => n === null ? "Belum ada acuan" : `${n.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`
const field = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
function hasilCocok(c: Claim) {
  const e = c.evaluation
  if (!e || !["pending", "diterima"].includes(e.actual_result)) return null
  if (!["pending", "tidak_pending"].includes(e.prediction)) return null
  return e.prediction === (e.actual_result === "pending" ? "pending" : "tidak_pending")
}
export default function TestingPendingPage() {
  const [category, setCategory] = useState("RAWAT_JALAN")
  useEffect(() => { if (new URLSearchParams(window.location.search).get("jenis_klaim") === "RAWAT_INAP") setCategory("RAWAT_INAP") }, [])
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [includeArsip, setIncludeArsip] = useState(false)
  const [source, setSource] = useState("BPJS")
  const [report, setReport] = useState<Report | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [refresh, setRefresh] = useState(0)
  const [selected, setSelected] = useState<Claim | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [form, setForm] = useState({ actual_result: "belum_diketahui", reference_source: "VERIFIKATOR", actual_reason: "", reason_match: "belum_dinilai", notes: "" })
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1) }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])
  useEffect(() => {
    let active = true
    setBusy(true); setError(""); setReport(null)
    api.getTestingPending(category, page, search, includeArsip).then((data: Report) => { if (active) setReport(data) })
      .catch((err: Error) => { if (active) setError(err.message) })
      .finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [category, page, search, refresh, includeArsip])
  function mulai(c: Claim) {
    setSelected(c); setSaveError("")
    setForm(c.evaluation ? { actual_result: c.evaluation.actual_result, reference_source: c.evaluation.reference_source, actual_reason: c.evaluation.actual_reason, reason_match: c.evaluation.reason_match, notes: c.evaluation.notes } : { actual_result: "belum_diketahui", reference_source: "VERIFIKATOR", actual_reason: "", reason_match: "belum_dinilai", notes: "" })
  }
  async function simpan() {
    if (!selected) return
    setSaving(true); setSaveError("")
    try {
      await api.saveTestingPending(selected.id, form)
      setSelected(null); setSuccess("Hasil testing tersimpan. Data dan status klaim tetap sama."); setRefresh(r => r + 1)
    } catch (err) { setSaveError(err instanceof Error ? err.message : "Hasil testing belum tersimpan.") }
    finally { setSaving(false) }
  }
  const summary = report?.summary[source]
  const snapshot = selected?.evaluation?.prediction_snapshot || selected?.current_prediction
  const pages = report ? Math.max(1, Math.ceil(report.total / report.limit)) : 1
  return <div className="space-y-5">
    <Header title="Testing Pending" description="Sementara · Bandingkan hasil aplikasi dengan hasil acuan untuk rawat jalan dan rawat inap."
      actions={<Button asChild variant="outline"><Link href="/testing-pending/upload"><Upload className="h-4 w-4 mr-2" aria-hidden="true" />Upload berkas untuk diuji</Link></Button>} />
    <HistoryTabs />
    <div className="rounded-xl border border-blue-500/25 bg-blue-500/5 p-4 flex gap-3 text-sm"><Info className="h-5 w-5 shrink-0 text-blue-500" aria-hidden="true" /><p>Unggah PDF melalui Upload Testing dengan hasil ACC atau pending yang sudah diketahui. Daftar ini khusus berkas pengujian, terpisah dari klaim operasional. Bandingkan prediksi aplikasi dan nilai kecocokan alasannya.</p></div>
    <div role="tablist" aria-label="Kategori testing pending" className="flex gap-2">
      {[{ key: "RAWAT_JALAN", label: "Rawat Jalan" }, { key: "RAWAT_INAP", label: "Rawat Inap" }].map(c => <button id={`tab-${c.key}`} key={c.key} role="tab" aria-selected={category === c.key} aria-controls="kategori-testing" onClick={() => { setCategory(c.key); setPage(1) }} className={`rounded-lg px-5 py-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${category === c.key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>{c.label}</button>)}
    </div>
    <div id="kategori-testing" role="tabpanel" aria-labelledby={`tab-${category}`} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><label htmlFor="sumber-rekap" className="text-sm font-medium mr-3">Acuan rekap</label><select id="sumber-rekap" value={source} onChange={e => setSource(e.target.value)} className={`${field} w-auto`}><option value="BPJS">Hasil BPJS</option><option value="VERIFIKATOR">Verifikator (simulasi)</option></select></div><Button variant="outline" disabled={busy} onClick={() => setRefresh(r => r + 1)}><RefreshCw aria-hidden="true" className={`h-4 w-4 mr-2 ${busy ? "animate-spin" : ""}`} />Perbarui</Button></div>
      {summary && <>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">{[
          { title: "Ketepatan status", value: persen(summary.accuracy), note: `${summary.correct} cocok dari ${summary.evaluated} kasus yang dapat dibandingkan` },
          { title: "Pending terlewat", value: String(summary.missed_pending), note: "Aplikasi tidak menemukan risiko, tetapi acuan pending" },
          { title: "Peringatan berlebih", value: String(summary.false_alarm), note: "Aplikasi memberi risiko pending, tetapi acuan tidak pending" },
          { title: "Kecocokan alasan", value: persen(summary.reason_accuracy), note: `${summary.reason_exact}/${summary.reason_rated} sesuai penuh · ${summary.reason_partial} sesuai sebagian` },
        ].map(card => <div key={card.title} className="rounded-xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">{card.title}</p><p className="text-xl font-semibold mt-3 tabular-nums">{card.value}</p><p className="mt-2 text-xs text-muted-foreground leading-relaxed">{card.note}</p></div>)}</div>
        <p className="text-xs text-muted-foreground">Rekap seluruh {category === "RAWAT_INAP" ? "rawat inap" : "rawat jalan"}, dengan acuan {source === "BPJS" ? "BPJS" : "verifikator (simulasi)"}. {summary.labeled} kasus memiliki acuan; {summary.uncertain} hasil aplikasi belum pasti dan tidak masuk perhitungan ketepatan. Kecocokan alasan dihitung pada kasus yang sama-sama dinilai pending.</p>
      </>}
      {report && !report.testing_storage_available && <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">Daftar dan hasil aplikasi sudah bisa ditinjau. Penyimpanan penilaian testing belum diaktifkan oleh administrator.</p>}
      {success && <p role="status" className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">{success}</p>}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"><Search aria-hidden="true" className="h-4 w-4 text-muted-foreground" /><input aria-label="Cari nama pasien atau SEP" placeholder="Cari nama pasien atau SEP" value={searchInput} onChange={e => setSearchInput(e.target.value)} className="flex-1 min-w-0 bg-transparent text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring rounded" /></div>
      <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={includeArsip} onChange={e => { setIncludeArsip(e.target.checked); setPage(1) }} className="h-4 w-4 accent-primary" />Sertakan arsip</label>
      {busy && <p role="status" className="py-8 text-center text-muted-foreground">Memuat daftar testing…</p>}
      {error && <p role="alert" className="text-sm text-destructive border border-destructive/30 rounded-lg p-4">{error}</p>}
      {report && (!report.records.length ? <div className="rounded-xl border border-border bg-card p-10 text-center"><p className="font-medium">Belum ada klaim {category === "RAWAT_INAP" ? "rawat inap" : "rawat jalan"}{search ? " yang sesuai pencarian" : " untuk diuji"}.</p><p className="text-sm text-muted-foreground mt-2">Pilih Upload Testing untuk mengunggah PDF dengan hasil ACC atau pending sebagai acuan.</p></div> : <>
        <div className="rounded-xl border border-border bg-card overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/30 text-xs text-muted-foreground"><tr>{["Klaim", "Hasil aplikasi (patokan)", "Hasil acuan", "Kecocokan", "Tindakan"].map(h => <th key={h} scope="col" className="px-4 py-3 text-left whitespace-nowrap">{h}</th>)}</tr></thead><tbody className="divide-y divide-border">{report.records.map(c => {
          const prediction = c.evaluation?.prediction_snapshot || c.current_prediction
          const cocok = hasilCocok(c)
          return <tr key={c.id}><td className="px-4 py-4 min-w-48"><p className="font-medium">{c.nama_pasien || "Nama belum tercatat"}</p><p className="mt-1 text-xs text-muted-foreground font-mono">{c.sep || "SEP belum tercatat"}</p><p className="mt-1 text-xs text-muted-foreground">{c.period_label || "Periode belum pasti"}{c.archived ? " · Arsip" : ""}</p><p className="mt-1 text-xs text-muted-foreground max-w-52 truncate" title={c.file_name}>{c.file_name}</p></td><td className="px-4 py-4 min-w-60 max-w-96"><p className={prediction.status === "pending" ? "font-medium text-amber-700 dark:text-amber-400" : "font-medium"}>{predLabel(prediction.status)}</p><p className="mt-1 text-xs text-muted-foreground leading-relaxed">{prediction.ringkasan}</p>{c.evaluation && <p className="mt-1 text-[11px] text-muted-foreground">Patokan {new Date(c.evaluation.snapshot_at).toLocaleDateString("id-ID")}</p>}</td><td className="px-4 py-4 min-w-44"><p>{actualLabel(c.evaluation?.actual_result)}</p>{c.evaluation && <p className="mt-1 text-xs text-muted-foreground">{c.evaluation.reference_source === "BPJS" ? "BPJS" : "Verifikator (simulasi)"}</p>}</td><td className="px-4 py-4 whitespace-nowrap"><span className={cocok === true ? "text-primary font-medium" : cocok === false ? "text-destructive font-medium" : "text-muted-foreground"}>{cocok === true ? "Cocok" : cocok === false ? "Tidak cocok" : "Belum dibandingkan"}</span></td><td className="px-4 py-4"><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" asChild><Link href={`/results/${c.file_id}${c.sep ? `?sep=${encodeURIComponent(c.sep)}` : ""}`}>Lihat berkas</Link></Button><Button size="sm" onClick={() => mulai(c)}>{c.evaluation ? "Edit penilaian" : "Nilai kecocokan"}</Button></div></td></tr>
        })}</tbody></table></div>
        <div className="flex flex-wrap justify-between items-center gap-3 text-sm text-muted-foreground"><p>{report.total} klaim · halaman {page}/{pages}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4 mr-1" />Sebelumnya</Button><Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Berikutnya<ChevronRight className="h-4 w-4 ml-1" /></Button></div></div>
      </>)}
    </div>
    <Dialog open={!!selected} onOpenChange={open => { if (!open && !saving) setSelected(null) }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Nilai kecocokan pending</DialogTitle><DialogDescription>{selected?.nama_pasien} · {selected?.sep || "SEP belum tercatat"}</DialogDescription></DialogHeader>
        {snapshot && <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm"><p className="font-medium">Patokan aplikasi: {predLabel(snapshot.status)}</p><p className="mt-1 text-muted-foreground">{snapshot.ringkasan}</p>{snapshot.alasan?.length > 0 && <ul className="list-disc pl-5 mt-2 space-y-1">{snapshot.alasan.map((a, i) => <li key={i}>{a.kode && `${a.kode} · `}{a.ringkas || a.pesan || a.nama || "Alasan tercatat"}</li>)}</ul>}<p className="mt-2 text-xs text-muted-foreground">Hasil aplikasi dikunci saat penilaian pertama disimpan. Mengedit hasil acuan tidak mengganti patokan ini.</p></div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><label htmlFor="hasil-acuan" className="block text-sm font-medium mb-1.5">Hasil acuan</label><select id="hasil-acuan" className={field} value={form.actual_result} disabled={saving} onChange={e => setForm(f => ({ ...f, actual_result: e.target.value, reason_match: "belum_dinilai" }))}><option value="belum_diketahui">Belum diketahui</option><option value="pending">Pending</option><option value="diterima">Tidak pending / diterima</option></select></div><div><label htmlFor="sumber-acuan" className="block text-sm font-medium mb-1.5">Sumber acuan</label><select id="sumber-acuan" className={field} value={form.reference_source} disabled={saving} onChange={e => setForm(f => ({ ...f, reference_source: e.target.value }))}><option value="VERIFIKATOR">Verifikator (simulasi)</option><option value="BPJS">Hasil BPJS yang sudah diketahui</option></select></div></div>
        <div><label htmlFor="alasan-acuan" className="block text-sm font-medium mb-1.5">Alasan pending pada acuan</label><textarea id="alasan-acuan" value={form.actual_reason} maxLength={4000} disabled={saving} onChange={e => setForm(f => ({ ...f, actual_reason: e.target.value }))} className={field} rows={3} placeholder="Catat alasan dari BPJS atau hasil pemeriksaan verifikator." /></div>
        <div><label htmlFor="kecocokan-alasan" className="block text-sm font-medium mb-1.5">Kecocokan alasan aplikasi dengan acuan</label><select id="kecocokan-alasan" className={field} value={form.reason_match} disabled={saving || form.actual_result !== "pending" || snapshot?.status !== "pending"} onChange={e => setForm(f => ({ ...f, reason_match: e.target.value }))}><option value="belum_dinilai">Belum dinilai</option><option value="sesuai">Sesuai penuh</option><option value="sebagian">Sesuai sebagian</option><option value="tidak_sesuai">Tidak sesuai</option></select></div>
        <div><label htmlFor="catatan-testing" className="block text-sm font-medium mb-1.5">Catatan testing</label><textarea id="catatan-testing" value={form.notes} maxLength={4000} disabled={saving} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={field} rows={2} placeholder="Data pendukung atau bagian analisis yang perlu diperbaiki." /></div>
        {!report?.testing_storage_available && <p role="status" className="text-sm text-amber-700 dark:text-amber-400">Penilaian belum dapat disimpan sampai akses penyimpanan testing diaktifkan.</p>}
        {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
        <div className="flex justify-end gap-2"><Button variant="outline" disabled={saving} onClick={() => setSelected(null)}>Batal</Button><Button disabled={saving || !report?.testing_storage_available} onClick={simpan}>{saving ? "Menyimpan…" : "Simpan penilaian testing"}</Button></div>
      </DialogContent>
    </Dialog>
  </div>
}
