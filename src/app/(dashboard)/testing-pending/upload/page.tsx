"use client"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Upload, Loader2, CheckCircle2, ArrowRight } from "lucide-react"
import { Header } from "@/components/dashboard/header"
import { HistoryTabs } from "@/components/dashboard/history-tabs"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"

const field = "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
type Result = { label_saved: boolean; warning?: string; prediction?: { status: string; ringkasan: string } }
export default function UploadTestingPage() {
  const [category, setCategory] = useState("RAWAT_JALAN")
  const fileInput = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [label, setLabel] = useState({ actual_result: "", reference_source: "BPJS", actual_reason: "", notes: "" })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<Result | null>(null)
  useEffect(() => {
    if (!busy) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [busy])
  async function upload(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !label.actual_result || busy) return
    setBusy(true); setError(""); setResult(null)
    try { setResult(await api.uploadTestingPdf(file, category, label)) }
    catch (err) { setError(err instanceof Error ? err.message : "Upload testing belum berhasil.") }
    finally { setBusy(false) }
  }
  return <div className="space-y-5">
    <Header title="Upload Testing" description="Uji PDF klaim yang hasil ACC atau pending-nya sudah diketahui." />
    {!busy && <HistoryTabs />}
    <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
      <form onSubmit={upload} className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-5">
        <fieldset disabled={busy || !!result} className="space-y-5 disabled:opacity-70">
          <legend className="text-lg font-semibold mb-4">Berkas dan hasil acuan</legend>
          <div><label htmlFor="testing-category" className="block text-sm font-medium mb-2">Jenis pelayanan</label><select id="testing-category" className={field} value={category} onChange={e => setCategory(e.target.value)}><option value="RAWAT_JALAN">Rawat Jalan</option><option value="RAWAT_INAP">Rawat Inap</option></select></div>
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-5"><label htmlFor="testing-file" className="block font-medium text-sm mb-2">PDF klaim asli</label><p className="text-xs text-muted-foreground mb-3">Satu PDF per pengujian, maksimal 20 MB. Gunakan berkas sebelum hasil verifikasi; pisahkan surat ACC atau alasan pending dari PDF.</p><input ref={fileInput} id="testing-file" type="file" accept=".pdf,application/pdf" required className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-foreground" onChange={e => {
            const chosen = e.target.files?.[0] || null
            setError(""); setFile(null)
            if (chosen && (!chosen.name.toLowerCase().endsWith(".pdf") || chosen.size > 20 * 1024 * 1024)) { setError("Pilih PDF dengan ukuran maksimal 20 MB."); e.target.value = ""; return }
            setFile(chosen)
          }} />{file && <p className="text-xs text-muted-foreground mt-3 break-all">{file.name} · {(file.size / 1024 / 1024).toLocaleString("id-ID", { maximumFractionDigits: 2 })} MB</p>}</div>
          <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="testing-outcome" className="block text-sm font-medium mb-2">Hasil yang sudah diketahui</label><select id="testing-outcome" required className={field} value={label.actual_result} onChange={e => setLabel(l => ({ ...l, actual_result: e.target.value, actual_reason: "" }))}><option value="" disabled>Pilih hasil acuan</option><option value="diterima">ACC / diterima</option><option value="pending">Pending</option></select></div><div><label htmlFor="testing-source" className="block text-sm font-medium mb-2">Sumber hasil</label><select id="testing-source" className={field} value={label.reference_source} onChange={e => setLabel(l => ({ ...l, reference_source: e.target.value }))}><option value="BPJS">Hasil BPJS</option><option value="VERIFIKATOR">Verifikator (simulasi)</option></select></div></div>
          {label.actual_result === "pending" && <div><label htmlFor="testing-reason" className="block text-sm font-medium mb-2">Alasan pending dari acuan</label><textarea id="testing-reason" rows={3} maxLength={4000} className={field} placeholder="Salin alasan pending yang sebenarnya, jika tersedia." value={label.actual_reason} onChange={e => setLabel(l => ({ ...l, actual_reason: e.target.value }))} /></div>}
          <div><label htmlFor="testing-notes" className="block text-sm font-medium mb-2">Catatan pengujian (opsional)</label><textarea id="testing-notes" rows={2} maxLength={4000} className={field} value={label.notes} onChange={e => setLabel(l => ({ ...l, notes: e.target.value }))} /></div>
        </fieldset>
        {error && <div role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}<p className="mt-2">Jika proses terputus, periksa daftar Testing Pending sebelum mengunggah ulang.</p><Link href={`/testing-pending?jenis_klaim=${category}`} className="underline">Periksa daftar testing</Link></div>}
        {busy && <div role="status" className="rounded-lg bg-primary/5 border border-primary/20 p-4 text-sm"><p className="font-medium flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Menganalisis berkas testing…</p><p className="mt-2 text-muted-foreground">Membaca PDF, memeriksa aturan, lalu menjalankan analisis AI. Tunggu di halaman ini sampai selesai; berkas rawat inap bisa membutuhkan waktu lebih lama.</p></div>}
        {result ? <div role="status" className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3"><p className="font-semibold flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" />Berkas testing selesai dianalisis</p><p className="text-sm">{result.warning || (result.prediction?.status === "pending" ? "Aplikasi menemukan risiko pending." : result.prediction?.status === "tidak_pending" ? "Aplikasi tidak menemukan risiko pending." : "Hasil aplikasi masih perlu ditinjau.")}</p><p className="text-sm text-muted-foreground">{result.prediction?.ringkasan}</p><div className="flex flex-wrap gap-2"><Button asChild><Link href={`/testing-pending?jenis_klaim=${category}`}>Lihat kecocokan hasil<ArrowRight className="h-4 w-4 ml-2" /></Link></Button><Button type="button" variant="outline" onClick={() => { setResult(null); setFile(null); if (fileInput.current) fileInput.current.value = ""; setLabel(l => ({ ...l, actual_result: "", actual_reason: "", notes: "" })) }}>Uji berkas berikutnya</Button></div></div> : <Button type="submit" disabled={!file || !label.actual_result || busy}><Upload className="h-4 w-4 mr-2" />{busy ? "Sedang diproses…" : "Upload dan uji berkas"}</Button>}
      </form>
      <aside className="rounded-xl border border-border bg-card p-5 sm:p-6 h-fit space-y-4"><h2 className="font-semibold">Cara membaca hasil testing</h2><ol className="space-y-4 text-sm text-muted-foreground list-decimal pl-5"><li>Upload PDF asli dan pilih hasil acuan yang sudah diketahui.</li><li>Aplikasi menganalisis dokumen dengan alur AI yang sama. Pilihan ACC, pending, dan alasan acuan tidak diberikan kepada AI.</li><li>Prediksi awal disimpan sebagai patokan, lalu dibandingkan dengan hasil acuan.</li><li>Di Testing Pending, periksa apakah status dan alasan pending sesuai. Rekap rawat jalan dan rawat inap tersedia terpisah.</li></ol><p className="text-sm border-t border-border pt-4">Berkas testing tidak masuk riwayat kerja atau rekap klaim operasional. Proses analisis tetap memakai token AI dan tercatat dalam Penggunaan AI.</p></aside>
    </div>
  </div>
}
