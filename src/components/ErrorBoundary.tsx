'use client';
import { Component, ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}
interface State {
  hasError: boolean;
  error?: Error;
  versiUsang?: boolean;
}

// Penanda bahwa halaman ini sudah pernah dimuat ulang paksa. Dipakai supaya
// pemuatan ulang otomatis terjadi PALING BANYAK SEKALI — kalau kesalahannya
// ternyata bukan soal versi, halaman tidak boleh berputar memuat ulang tanpa
// henti dan mengunci staf dari pekerjaannya.
const PENANDA_SUDAH_MUAT_ULANG = 'eclaim:sudah-muat-ulang-paksa';

/**
 * Kesalahan yang muncul karena browser masih memegang JavaScript dari versi
 * LAMA sementara server sudah memakai versi baru.
 *
 * Setiap deploy mengganti potongan-potongan JavaScript beserta namanya. Tab
 * yang sudah terbuka sejak sebelum deploy masih meminta potongan lama yang
 * sudah tidak ada, lalu gagal. Ini bukan kerusakan data dan bukan kesalahan
 * staf — tapi dari layar tampak sama saja dengan gangguan sungguhan.
 */
function karenaVersiUsang(error?: Error): boolean {
  const pesan = `${error?.name || ''} ${error?.message || ''}`;
  return /ChunkLoadError|Loading chunk|Failed to find Server Action|dynamically imported module|Loading CSS chunk/i.test(pesan);
}

/**
 * Muat ulang yang benar-benar mengambil ulang berkasnya.
 *
 * window.location.reload() TIDAK cukup: ia memuat ulang dokumennya tapi tetap
 * memakai JavaScript dari cache, sehingga halaman kembali ke kesalahan yang
 * sama. Itulah sebabnya menekan tombol "Muat Ulang Halaman" berkali-kali tidak
 * pernah menolong. Cache dibersihkan dulu, lalu alamatnya diberi penanda waktu
 * supaya browser terpaksa meminta berkas yang baru.
 */
async function muatUlangPaksa() {
  try {
    if (typeof caches !== 'undefined') {
      const kunci = await caches.keys();
      await Promise.all(kunci.map((k) => caches.delete(k)));
    }
  } catch {
    // Cache API bisa diblokir (mis. mode penyamaran). Bukan alasan untuk
    // membatalkan pemuatan ulang — penanda waktu di bawah tetap bekerja.
  }
  try {
    const alamat = new URL(window.location.href);
    alamat.searchParams.set('_v', Date.now().toString(36));
    window.location.replace(alamat.toString());
  } catch {
    window.location.reload();
  }
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, versiUsang: karenaVersiUsang(error) };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);

    // Versi usang bisa dipulihkan sendiri tanpa perlu staf tahu apa-apa soal
    // cache browser. Dilakukan otomatis, sekali saja.
    if (!karenaVersiUsang(error)) return;
    try {
      if (sessionStorage.getItem(PENANDA_SUDAH_MUAT_ULANG)) return;
      sessionStorage.setItem(PENANDA_SUDAH_MUAT_ULANG, '1');
    } catch {
      // sessionStorage diblokir — lewati pemuatan ulang otomatis daripada
      // berisiko berputar tanpa henti. Tombol di layar tetap tersedia.
      return;
    }
    muatUlangPaksa();
  }

  render() {
    if (this.state.hasError) {
      // Detail teknis (pesan asli, komponen mana yang error) TIDAK ditampilkan
      // ke user — staf RS bukan orang teknis, pesan bahasa Inggris/istilah
      // React cuma bikin bingung. Detail lengkapnya tetap ada di console
      // browser lewat componentDidCatch() di atas, jadi IT/developer masih
      // bisa lacak kalau diminta screenshot console.
      const usang = this.state.versiUsang;

      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center w-full py-16 px-6 bg-background text-center">
          <img src="/logo.png" alt="RS Lestari Raharja" className="h-12 w-12 object-contain mb-4 opacity-90" />
          <div className="w-14 h-14 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7" />
          </div>

          {usang ? (
            <>
              <h2 className="text-xl font-semibold text-foreground mb-2">Aplikasi Baru Saja Diperbarui</h2>
              <p className="text-muted-foreground mb-1 max-w-md text-sm">
                Halaman ini masih memakai versi lama yang sudah diganti.
              </p>
              <p className="text-muted-foreground mb-6 max-w-md text-sm">
                Data Anda aman dan tidak ada yang hilang. Tekan tombol di bawah untuk memuat versi terbaru.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-foreground mb-2">Terjadi Kesalahan</h2>
              <p className="text-muted-foreground mb-1 max-w-md text-sm">
                Bagian ini mengalami gangguan yang tidak terduga.
              </p>
              <p className="text-muted-foreground mb-6 max-w-md text-sm">
                Silakan muat ulang halaman. Kalau terus berulang, hubungi petugas IT rumah sakit.
              </p>
            </>
          )}

          <Button onClick={() => { void muatUlangPaksa(); }} className="gap-2">
            <RotateCw className="w-4 h-4" />
            {usang ? 'Muat Versi Terbaru' : 'Muat Ulang Halaman'}
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
