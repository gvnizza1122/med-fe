'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '@/components/Sidebar';

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
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Auth guard — redirect to /login if no token
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) router.replace('/login');
  }, [router]);

  // Sidebar collapse (desktop-only "minimize") — dipertahankan antar sesi.
  useEffect(() => {
    setIsCollapsed(localStorage.getItem('sidebarCollapsed') === '1');
  }, []);

  const toggleCollapsed = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebarCollapsed', next ? '1' : '0');
      return next;
    });
  };

  // Trigger progress bar on every route change
  useEffect(() => {
    setIsNavigating(true);
    const timer = setTimeout(() => setIsNavigating(false), 850);
    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <div className="app-layout">
      <Sidebar isCollapsed={isCollapsed} onToggleCollapsed={toggleCollapsed} />

      <div
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
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
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                background:
                  'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #06b6d4 100%)',
                transformOrigin: 'left',
                zIndex: 50,
                borderRadius: '0 2px 2px 0',
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
        <main className={`main-content ${isCollapsed ? 'content-collapsed' : ''}`} style={{ flex: 1 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
