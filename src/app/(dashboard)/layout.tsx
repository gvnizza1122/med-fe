'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from '@/components/dashboard/sidebar';
import ErrorBoundary from '@/components/ErrorBoundary';
import { UploadJobProvider } from '@/contexts/UploadJobContext';

const progressBarVariants = {
  initial: { scaleX: 0, opacity: 1 },
  animate: {
    scaleX: [0, 0.7, 1],
    opacity: [1, 1, 1, 0],
  },
};

const progressTransition = {
  duration: 0.8,
  ease: [0.22, 1, 0.36, 1] as const,
  opacity: { duration: 0.8, times: [0, 0.6, 0.8, 1] },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);

  // Auth guard — redirect to /login if no token
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) router.replace('/login');
  }, [router]);

  // Trigger progress bar on every route change
  useEffect(() => {
    setIsNavigating(true);
    const timer = setTimeout(() => setIsNavigating(false), 850);
    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <UploadJobProvider>
    <div className="flex min-h-screen bg-background relative">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* ── Top progress bar indicator ── */}
      <AnimatePresence>
        {isNavigating && (
          <motion.div
            key={`progress-${pathname}`}
            variants={progressBarVariants}
            initial="initial"
            animate="animate"
            transition={progressTransition}
            aria-hidden="true"
            className="fixed top-0 left-0 right-0 h-[3px] z-50 rounded-r"
            style={{
              background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #06b6d4 100%)',
              transformOrigin: 'left',
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Page content ──
          Sebelumnya dibungkus AnimatePresence mode="wait" + key={pathname}
          untuk transisi antar halaman — pola ini rawan bikin halaman jadi
          blank total di Next.js App Router: exit animation halaman lama
          kadang tidak pernah selesai/ke-interrupt saat navigasi cepat
          (misal Extract PDF -> Upload File), dan mode="wait" menahan
          konten baru sampai itu selesai, jadi macet di antara dua halaman
          tanpa render apapun. Animasi masuk tiap halaman sudah ditangani
          sendiri di masing-masing page (fade-in/motion.div internal),
          jadi wrapper ini aman dihapus. */}
      {/* ── Jaring pengaman terakhir ──
          Sebelum ini TIDAK ADA ErrorBoundary sama sekali di aplikasi — crash
          React di mana pun (misal PdfViewer/pdf.js gagal di browser lama)
          menjalar sampai layar putih total ala Next.js, minta reload penuh.
          Sidebar sengaja di LUAR boundary supaya navigasi ke halaman lain
          tetap bisa dipakai walau halaman yang sedang dibuka crash.
          key={pathname}: pindah halaman otomatis reset status crash-nya. */}
      <main className="flex-1 p-3 md:p-4 lg:p-5 lg:ml-64">
        <ErrorBoundary key={pathname}>
          {children}
        </ErrorBoundary>
      </main>
    </div>
    </UploadJobProvider>
  );
}
