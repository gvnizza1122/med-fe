import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, AlertTriangle, CheckCircle2 } from 'lucide-react';
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
      ? JSON.parse(recordData.ai_review)
      : recordData?.ai_review || {};
  } catch (e) {
    return {};
  }
}

export function InaCbgDashboardCard({
  recordData,
}: {
  recordData: Record<string, any>;
}) {
  const inacbgRawValue = recordData?.INACBG;
  const inacbgFilled = !isBlankValue(inacbgRawValue);
  
  const aiReview = parseAiReview(recordData);
  const suggestedCodes = aiReview?.suggested_codes || [];
  const hasSuggestedCodes = suggestedCodes.length > 0;
  
  // Determine state A, B, or C
  let state: 'A' | 'B' | 'C' = 'C';
  if (inacbgFilled) state = 'A';
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

  const titleText = state === 'A' ? 'lengkap ✓' 
                  : state === 'B' ? 'butuh konfirmasi koder'
                  : '4 masalah - 1 sebab ⚠';

  return (
    <div className={cn("rounded-lg overflow-hidden border mb-6", themeClass)}>
      <Accordion type="single" collapsible defaultValue="inacbg-content">
        <AccordionItem value="inacbg-content" className="border-0">
          <AccordionTrigger className={cn("px-4 py-3 hover:no-underline", headerBgClass)}>
            <div className="flex items-center justify-between w-full pr-4">
              <div className="flex items-center gap-2">
                <span className={cn("text-xs font-bold tracking-wider", titleClass)}>
                  INA-CBG & TARIF
                </span>
              </div>
              <div className={cn("text-xs font-semibold", titleClass)}>
                {titleText}
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="p-0">
            {state === 'A' && (
              <div className="flex flex-col text-sm text-gray-300">
                <div className="grid grid-cols-12 px-4 py-3 border-b border-white/5 items-center">
                  <div className="col-span-3 font-semibold text-gray-100">Kode INA-CBG</div>
                  <div className="col-span-4">{recordData.INACBG}</div>
                  <div className="col-span-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-900/60 text-emerald-400 border border-emerald-800">VALID</span>
                  </div>
                  <div className="col-span-3 text-xs text-gray-400">Disalin dari lembar grouper</div>
                </div>
                <div className="grid grid-cols-12 px-4 py-3 border-b border-white/5 items-center bg-white/[0.02]">
                  <div className="col-span-3 font-semibold text-gray-100">Deskripsi</div>
                  <div className="col-span-4">{recordData.DESKRIPSI_INACBG || '—'}</div>
                  <div className="col-span-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-900/60 text-emerald-400 border border-emerald-800">VALID</span>
                  </div>
                  <div className="col-span-3 text-xs text-gray-400">Cocok dengan tabel referensi</div>
                </div>
                <div className="grid grid-cols-12 px-4 py-3 border-b border-white/5 items-center">
                  <div className="col-span-3 font-semibold text-gray-100">Tarif INA-CBG</div>
                  <div className="col-span-4">{recordData.TARIF_INACBG || '—'}</div>
                  <div className="col-span-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-900/60 text-emerald-400 border border-emerald-800">VALID</span>
                  </div>
                  <div className="col-span-3 text-xs text-gray-400">Sesuai tarif resmi</div>
                </div>
                <div className="flex items-center justify-between px-4 py-3 bg-black/20">
                  <span className="text-xs text-gray-400">Top-Up Special CMG — tidak ada</span>
                  <button className="text-[10px] font-bold text-blue-400 bg-blue-950/40 border border-blue-900/50 px-2 py-1 rounded">4 JENIS DICEK ▸</button>
                </div>
              </div>
            )}
            
            {state === 'B' && (
              <div className="flex flex-col text-sm text-gray-300">
                <div className="px-4 py-3 bg-blue-950/20 border-b border-blue-900/30">
                  <p className="text-xs text-blue-200">
                    <span className="font-semibold text-blue-400">Lembar hasil grouper tidak ada di berkas ini.</span> Sistem menyusun usulan dari resume medis — <span className="font-semibold text-blue-400">belum tersimpan</span>, perlu diperiksa dan disetujui koder.
                  </p>
                </div>
                <div className="grid grid-cols-12 px-4 py-3 items-center border-b border-white/5 bg-white/[0.02]">
                  <div className="col-span-3 font-semibold text-gray-100">Diagnosis</div>
                  <div className="col-span-2">{(suggestedCodes.find((c: any) => c.type === 'diagnosis') || {}).code || '—'}</div>
                  <div className="col-span-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-blue-400 border border-blue-800/60 border-dashed bg-blue-950/30">USULAN</span>
                  </div>
                  <div className="col-span-5 text-xs text-gray-400 italic">← "usulan diagnosis dari resume medis"</div>
                </div>
                <div className="grid grid-cols-12 px-4 py-3 items-center border-b border-white/5">
                  <div className="col-span-3 font-semibold text-gray-100">Prosedur</div>
                  <div className="col-span-2">{(suggestedCodes.find((c: any) => c.type === 'procedure') || {}).code || '—'}</div>
                  <div className="col-span-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-blue-400 border border-blue-800/60 border-dashed bg-blue-950/30">USULAN</span>
                  </div>
                  <div className="col-span-5 text-xs text-gray-400 italic">← "usulan prosedur dari resume medis"</div>
                </div>
                <div className="mx-4 my-3 p-3 bg-emerald-950/20 border border-emerald-900/30 border-dashed rounded-md relative overflow-hidden">
                   <div className="flex justify-between items-start mb-2">
                     <div>
                       <div className="font-bold text-emerald-400 mb-1">{aiReview.suggested_inacbg || 'J-3-13-0'}</div>
                       <div className="text-xs text-emerald-600/80">Prosedur Terapi Saluran Pernafasan (Estimasi)</div>
                     </div>
                     <div className="text-right">
                       <div className="font-bold text-gray-200">Rp 321.700</div>
                       <div className="text-[10px] text-gray-500 mt-1">Reg 1 · D · Swasta · Rawat Jalan</div>
                     </div>
                   </div>
                </div>
                
                <div className="flex items-center gap-3 px-4 pb-4 pt-1">
                  <button className="px-3 py-1.5 text-xs font-semibold rounded bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300">Lihat dokumen asli</button>
                  <button className="px-3 py-1.5 text-xs font-semibold rounded bg-teal-600 hover:bg-teal-500 text-white">Setujui usulan</button>
                  <button className="px-3 py-1.5 text-xs font-semibold rounded bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300">Isi manual</button>
                  <button className="px-3 py-1.5 text-xs font-semibold rounded bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400">Tolak — pindai ulang</button>
                </div>
                
                <div className="flex items-center justify-between px-4 py-3 bg-black/20 border-t border-white/5">
                  <span className="text-xs text-gray-400">Top-Up Special CMG — tidak ada</span>
                  <button className="text-[10px] font-bold text-blue-400 bg-blue-950/40 border border-blue-900/50 px-2 py-1 rounded">4 JENIS DICEK ▸</button>
                </div>
              </div>
            )}
            
            {state === 'C' && (
              <div className="flex flex-col text-sm text-gray-300">
                <div className="px-4 py-3 bg-amber-950/30 border-b border-amber-900/30">
                  <p className="text-xs text-amber-200/90 font-medium">
                    <span className="font-bold text-amber-500">Lembar grouper tidak ada, dan resume medis tidak memuat diagnosa yang bisa dikoding.</span> Sistem tidak bisa menyusun usulan. Pindai ulang berkas dengan menyertakan lembar hasil grouper atau resume medis yang lengkap, lalu jalankan Baca Ulang.
                  </p>
                </div>
                <div className="grid grid-cols-12 px-4 py-3 items-center border-b border-white/5">
                  <div className="col-span-3 font-semibold text-gray-100">Kode INA-CBG</div>
                  <div className="col-span-4 text-gray-500">—</div>
                  <div className="col-span-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-amber-500 border border-amber-900 bg-amber-950/40">TIDAK DITEMUKAN</span>
                  </div>
                  <div className="col-span-3 text-xs text-gray-400">Sumber: lembar grouper</div>
                </div>
                <div className="grid grid-cols-12 px-4 py-3 items-center border-b border-white/5 bg-white/[0.02]">
                  <div className="col-span-3 font-semibold text-gray-100">Deskripsi · Tarif · Total</div>
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
