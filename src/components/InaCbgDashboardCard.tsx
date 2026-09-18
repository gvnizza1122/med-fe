import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertTriangle, FileText } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

function isBlankValue(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  const s = String(v).trim().toLowerCase();
  return s === '' || s === 'none' || s === 'null';
}

function parseAiReview(recordData: any) {
  try {
    return typeof recordData?.ai_review === 'string'
      ? JSON.parse(recordData.ai_review) : (recordData?.ai_review || {});
  } catch (e) { return {}; }
}

/** Pecah string kode seperti "J18.0;K30;I10" jadi array ["J18.0","K30","I10"] */
function splitCodes(val: unknown): string[] {
  if (!val || isBlankValue(val)) return [];
  return String(val).split(/[;,]/).map(s => s.trim()).filter(Boolean);
}

function CodeChip({ code, className }: { code: string; className?: string }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-mono font-semibold border',
      className ?? 'bg-emerald-900/40 text-emerald-400 border-emerald-800/60'
    )}>
      {code}
    </span>
  );
}

export function InaCbgDashboardCard({
  recordData,
}: {
  recordData: Record<string, any>;
}) {
  const inacbgRawValue = recordData?.INACBG;
  const inacbgFilled = !isBlankValue(inacbgRawValue);

  const diagListRaw = recordData?.DIAGLIST ?? recordData?.diaglist ?? '';
  const procListRaw = recordData?.PROCLIST ?? recordData?.proclist ?? '';
  const diagCodes = splitCodes(diagListRaw);
  const procCodes = splitCodes(procListRaw);

  const totalTarif = recordData?.TOTAL_TARIF ?? recordData?.total_tarif;
  const tarifInacbg = recordData?.TARIF_INACBG ?? recordData?.tarif_inacbg;

  const aiReview = parseAiReview(recordData);
  const suggestedCodes = aiReview?.suggested_codes || [];
  const hasSuggestedCodes = suggestedCodes.length > 0;

  // Suggested codes grouped by type
  const suggestedDiag = suggestedCodes.filter((c: any) => c.type === 'diagnosis');
  const suggestedProc = suggestedCodes.filter((c: any) => c.type === 'procedure');

  const suggestedInacbg = aiReview?.suggested_inacbg;
  const suggestedTarif = aiReview?.suggested_tarif;

  // State A: ada data diaglist/proclist (dari grouper atau entri manual)
  // State B: tidak ada diaglist/proclist tapi ada suggested codes dari AI
  // State C: tidak ada sama sekali
  let state: 'A' | 'B' | 'C' = 'C';
  if (diagCodes.length > 0 || procCodes.length > 0) state = 'A';
  else if (hasSuggestedCodes) state = 'B';

  const themeClass = state === 'A'
    ? 'border-emerald-900/50 bg-emerald-950/10'
    : state === 'B'
    ? 'border-amber-700/50 bg-amber-950/20'
    : 'border-red-900/50 bg-red-950/20';

  const headerBgClass = state === 'A'
    ? 'bg-emerald-950/30'
    : state === 'B'
    ? 'bg-amber-900/30'
    : 'bg-red-950/40';

  const titleClass = state === 'A'
    ? 'text-emerald-400'
    : state === 'B'
    ? 'text-amber-500'
    : 'text-red-400';

  const titleText = state === 'A'
    ? `${diagCodes.length} diagnosis · ${procCodes.length} prosedur ✓`
    : state === 'B'
    ? 'butuh konfirmasi koder'
    : 'tidak ada data kode';

  return (
    <div className={cn("rounded-lg overflow-hidden border mb-6", themeClass)}>
      <Accordion type="single" collapsible defaultValue="inacbg-content">
        <AccordionItem value="inacbg-content" className="border-0">
          <AccordionTrigger className={cn("px-4 py-3 hover:no-underline", headerBgClass)}>
            <div className="flex items-center justify-between w-full pr-4">
              <div className="flex items-center gap-2">
                <span className={cn("text-xs font-bold tracking-wider", titleClass)}>
                  INA-CBG &amp; TARIF
                </span>
              </div>
              <div className={cn("text-xs font-semibold", titleClass)}>
                {titleText}
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="p-0">

            {/* ── State A: Data diagnosa & prosedur tersedia ── */}
            {state === 'A' && (
              <div className="flex flex-col text-sm text-gray-300">

                {/* Daftar Diagnosis */}
                <div className="px-4 py-3 border-b border-white/5 items-start">
                  <div className="grid grid-cols-12 items-start gap-2">
                    <div className="col-span-3 font-semibold text-gray-100 pt-0.5">Daftar Diagnosis</div>
                    <div className="col-span-7 flex flex-wrap gap-1.5">
                      {diagCodes.length > 0
                        ? diagCodes.map(code => <CodeChip key={code} code={code} />)
                        : <span className="text-gray-500 text-xs">—</span>
                      }
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-900/60 text-emerald-400 border border-emerald-800">
                        {diagCodes.length > 0 ? 'VALID' : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Daftar Prosedur */}
                <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02] items-start">
                  <div className="grid grid-cols-12 items-start gap-2">
                    <div className="col-span-3 font-semibold text-gray-100 pt-0.5">Daftar Prosedur</div>
                    <div className="col-span-7 flex flex-wrap gap-1.5">
                      {procCodes.length > 0
                        ? procCodes.map(code => (
                            <CodeChip
                              key={code}
                              code={code}
                              className="bg-blue-900/40 text-blue-400 border-blue-800/60"
                            />
                          ))
                        : <span className="text-gray-500 text-xs">—</span>
                      }
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-900/60 text-emerald-400 border border-emerald-800">
                        {procCodes.length > 0 ? 'VALID' : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tarif & INA-CBG (secondary info) */}
                <div className="flex items-center justify-between px-4 py-3 bg-black/20">
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    {inacbgFilled && (
                      <span>Kode INA-CBG: <span className="font-mono text-gray-300">{inacbgRawValue}</span></span>
                    )}
                    {!isBlankValue(tarifInacbg) && Number(tarifInacbg) > 0 && (
                      <span>Tarif: <span className="font-mono text-gray-300">
                        {Number(tarifInacbg).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })}
                      </span></span>
                    )}
                    {!isBlankValue(totalTarif) && Number(totalTarif) > 0 && (
                      <span>Total: <span className="font-mono text-gray-200 font-semibold">
                        {Number(totalTarif).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })}
                      </span></span>
                    )}
                    {isBlankValue(tarifInacbg) && isBlankValue(totalTarif) && !inacbgFilled && (
                      <span>Top-Up Special CMG — tidak ada</span>
                    )}
                  </div>
                  <button className="text-[10px] font-bold text-blue-400 bg-blue-950/40 border border-blue-900/50 px-2 py-1 rounded">
                    {(diagCodes.length + procCodes.length)} KODE DICEK ▸
                  </button>
                </div>
              </div>
            )}

            {/* ── State B: Tidak ada data, ada usulan AI ── */}
            {state === 'B' && (
              <div className="flex flex-col text-sm text-gray-300">
                <div className="px-4 py-3 bg-blue-950/20 border-b border-blue-900/30">
                  <p className="text-xs text-blue-200">
                    <span className="font-semibold text-blue-400">Lembar hasil grouper tidak ada di berkas ini.</span>{' '}
                    Sistem menyusun usulan dari resume medis —{' '}
                    <span className="font-semibold text-blue-400">belum tersimpan</span>, perlu diperiksa dan disetujui koder.
                  </p>
                </div>

                {/* Usulan Diagnosis */}
                {suggestedDiag.length > 0 && (
                  <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                    <div className="grid grid-cols-12 items-start gap-2">
                      <div className="col-span-3 font-semibold text-gray-100 pt-0.5">Usulan Diagnosis</div>
                      <div className="col-span-7 flex flex-wrap gap-1.5">
                        {suggestedDiag.map((c: any) => (
                          <span
                            key={c.code}
                            title={c.quotation ? `Hal. ${c.page_number}: "${c.quotation}"` : c.reasoning}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-mono font-semibold border bg-emerald-900/30 text-emerald-400 border-emerald-800/50 cursor-help"
                          >
                            {c.code}
                          </span>
                        ))}
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-blue-400 border border-blue-800/60 border-dashed bg-blue-950/30">USULAN</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Usulan Prosedur */}
                {suggestedProc.length > 0 && (
                  <div className="px-4 py-3 border-b border-white/5">
                    <div className="grid grid-cols-12 items-start gap-2">
                      <div className="col-span-3 font-semibold text-gray-100 pt-0.5">Usulan Prosedur</div>
                      <div className="col-span-7 flex flex-wrap gap-1.5">
                        {suggestedProc.map((c: any) => (
                          <span
                            key={c.code}
                            title={c.quotation ? `Hal. ${c.page_number}: "${c.quotation}"` : c.reasoning}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-mono font-semibold border bg-blue-900/30 text-blue-400 border-blue-800/50 cursor-help"
                          >
                            {c.code}
                          </span>
                        ))}
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-blue-400 border border-blue-800/60 border-dashed bg-blue-950/30">USULAN</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Estimasi Tarif INA-CBG */}
                {suggestedInacbg && (
                  <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                    <div className="grid grid-cols-12 items-start gap-2">
                      <div className="col-span-3 font-semibold text-gray-100 pt-0.5">Estimasi INA-CBG</div>
                      <div className="col-span-7 flex flex-wrap gap-3 items-center">
                        <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-mono font-bold border bg-purple-900/30 text-purple-400 border-purple-800/50">
                          {suggestedInacbg}
                        </span>
                        {suggestedTarif && (
                          <span className="text-sm font-mono text-gray-200">
                            {Number(suggestedTarif).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })}
                          </span>
                        )}
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-blue-400 border border-blue-800/60 border-dashed bg-blue-950/30">ESTIMASI</span>
                      </div>
                    </div>
                  </div>
                )}



                <div className="flex items-center justify-between px-4 py-3 bg-black/20 border-t border-white/5">
                  <span className="text-xs text-gray-400">Top-Up Special CMG — tidak ada</span>
                  <button className="text-[10px] font-bold text-blue-400 bg-blue-950/40 border border-blue-900/50 px-2 py-1 rounded">4 JENIS DICEK ▸</button>
                </div>
              </div>
            )}

            {/* ── State C: Tidak ada data sama sekali ── */}
            {state === 'C' && (
              <div className="flex flex-col text-sm text-gray-300">
                <div className="px-4 py-3 bg-amber-950/30 border-b border-amber-900/30">
                  <p className="text-xs text-amber-200/90 font-medium">
                    <span className="font-bold text-amber-500">Lembar grouper tidak ada, dan resume medis tidak memuat diagnosa yang bisa dikoding.</span>{' '}
                    Sistem tidak bisa menyusun usulan. Pindai ulang berkas dengan menyertakan lembar hasil grouper atau resume medis yang lengkap, lalu jalankan Baca Ulang.
                  </p>
                </div>
                <div className="grid grid-cols-12 px-4 py-3 items-center border-b border-white/5">
                  <div className="col-span-3 font-semibold text-gray-100">Daftar Diagnosis</div>
                  <div className="col-span-4 text-gray-500">—</div>
                  <div className="col-span-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-amber-500 border border-amber-900 bg-amber-950/40">TIDAK DITEMUKAN</span>
                  </div>
                  <div className="col-span-3 text-xs text-gray-400">Sumber: lembar grouper</div>
                </div>
                <div className="grid grid-cols-12 px-4 py-3 items-center border-b border-white/5 bg-white/[0.02]">
                  <div className="col-span-3 font-semibold text-gray-100">Daftar Prosedur</div>
                  <div className="col-span-4 text-gray-500">—</div>
                  <div className="col-span-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-gray-500 border border-gray-700/50 bg-gray-800/30">MENUNGGU KODE</span>
                  </div>
                  <div className="col-span-3 text-xs text-gray-400">3 baris, terisi otomatis dari kode</div>
                </div>
                <div className="flex items-center justify-between px-4 py-3 bg-black/20 border-t border-white/5">
                  <span className="text-xs text-gray-400">Top-Up Special CMG — tidak ada</span>
                  <button className="text-[10px] font-bold text-blue-400 bg-blue-950/40 border border-blue-900/50 px-2 py-1 rounded">4 JENIS DICEK ▸</button>
                </div>
              </div>
            )}

          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
