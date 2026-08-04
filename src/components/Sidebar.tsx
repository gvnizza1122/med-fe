'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ────────────────────────────────────────────
   Types
   ──────────────────────────────────────────── */
interface User {
  id: string; email: string; full_name: string; role: string;
}

/* ────────────────────────────────────────────
   Lucide-style SVG Icons (24×24 viewBox, stroke)
   ──────────────────────────────────────────── */
const IconDashboard = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const IconUpload = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const IconHistory = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    <polyline points="12 11 12 17" />
    <polyline points="9 14 12 11 15 14" />
  </svg>
);

const IconUsers = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconRules = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const IconSun = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const IconMoon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const IconLogout = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const IconChevronLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

/* ────────────────────────────────────────────
   Navigation Items (same structure & roles)
   ──────────────────────────────────────────── */
interface NavItem {
  path: string;
  icon: ReactNode;
  label: string;
  roles: string[];
}

interface NavSection {
  section: string;
  items: NavItem[];
}

const NAV_ITEMS: NavSection[] = [
  {
    section: 'Menu Utama',
    items: [
      { path: '/dashboard', icon: <IconDashboard />, label: 'Dashboard', roles: ['admin', 'supervisor', 'verifikator'] },
      { path: '/upload', icon: <IconUpload />, label: 'Upload File', roles: ['admin', 'supervisor', 'verifikator'] },
      { path: '/extract', icon: <IconUpload />, label: 'Extract PDF', roles: ['admin', 'supervisor', 'verifikator'] },
      { path: '/history', icon: <IconHistory />, label: 'Riwayat Upload', roles: ['admin', 'supervisor', 'verifikator'] },
    ],
  },
  {
    section: 'Administrasi',
    items: [
      { path: '/users', icon: <IconUsers />, label: 'Manajemen User', roles: ['admin'] },
      { path: '/rules', icon: <IconRules />, label: 'Aturan Validasi', roles: ['admin'] },
    ],
  },
];

/* ────────────────────────────────────────────
   Animation Variants
   ──────────────────────────────────────────── */
const sidebarVariants = {
  hidden: { x: -280, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { type: 'spring' as const, stiffness: 260, damping: 28, staggerChildren: 0.04, delayChildren: 0.08 },
  },
};

const navItemVariants = {
  hidden: { x: -16, opacity: 0 },
  visible: { x: 0, opacity: 1 },
};

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

/* ────────────────────────────────────────────
   Sidebar Component
   ──────────────────────────────────────────── */
interface SidebarProps {
  isCollapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export default function Sidebar({ isCollapsed = false, onToggleCollapsed }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) setUser(JSON.parse(u));
    const saved = localStorage.getItem('theme') || 'dark';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    ['access_token', 'refresh_token', 'user'].forEach(k => localStorage.removeItem(k));
    router.push('/login');
  };

  const isActive = (path: string) =>
    pathname === path || pathname?.startsWith(path + '/');

  return (
    <>
      {/* ── Mobile Toggle ── */}
      <button className="sidebar-toggle" onClick={() => setIsOpen(!isOpen)} aria-label="Toggle sidebar">
        <span className={`hamburger ${isOpen ? 'open' : ''}`}>
          <span /><span /><span />
        </span>
      </button>

      {/* ── Mobile Overlay ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="sidebar-overlay"
            onClick={() => setIsOpen(false)}
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.25 }}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ── */}
      <motion.aside
        className={`sidebar ${isOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`}
        variants={sidebarVariants}
        initial="hidden"
        animate="visible"
        style={{
          backdropFilter: 'blur(16px) saturate(180%)',
          WebkitBackdropFilter: 'blur(16px) saturate(180%)',
        }}
      >
        {/* ── Collapse/expand toggle (desktop only) ── */}
        {onToggleCollapsed && (
          <button
            className="sidebar-collapse-toggle"
            onClick={onToggleCollapsed}
            aria-label={isCollapsed ? 'Perluas sidebar' : 'Perkecil sidebar'}
            title={isCollapsed ? 'Perluas sidebar' : 'Perkecil sidebar'}
          >
            <motion.span
              style={{ display: 'flex' }}
              animate={{ rotate: isCollapsed ? 180 : 0 }}
              transition={{ duration: 0.25 }}
            >
              <IconChevronLeft />
            </motion.span>
          </button>
        )}

        {/* ── Brand ── */}
        <div className="sidebar-brand">
          <img src="/logo.png" alt="RS Lestari Raharja" />
          <div className="sidebar-brand-text">
            <div className="sidebar-brand-name">RS Lestari Raharja</div>
            <div className="sidebar-brand-sub">Sistem Validasi BPJS</div>
          </div>
        </div>

        {/* ── Navigation ── */}
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((section) => {
            const visibleItems = section.items.filter(item =>
              !user || item.roles.includes(user.role)
            );
            if (visibleItems.length === 0) return null;
            return (
              <div key={section.section} className="nav-section">
                <div className="nav-section-title">{section.section}</div>
                {visibleItems.map((item) => {
                  const active = isActive(item.path);
                  return (
                    <motion.div
                      key={item.path}
                      variants={navItemVariants}
                      style={{ position: 'relative' }}
                    >
                      {/* Active indicator bar */}
                      <AnimatePresence>
                        {active && (
                          <motion.div
                            layoutId="activeNavIndicator"
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: '20%',
                              bottom: '20%',
                              width: 3,
                              borderRadius: '0 3px 3px 0',
                              background: 'var(--primary)',
                            }}
                            initial={{ scaleY: 0, opacity: 0 }}
                            animate={{ scaleY: 1, opacity: 1 }}
                            exit={{ scaleY: 0, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                          />
                        )}
                      </AnimatePresence>

                      <motion.button
                        className={`nav-item ${active ? 'active' : ''}`}
                        onClick={() => router.push(item.path)}
                        title={isCollapsed ? item.label : undefined}
                        whileHover={{ x: 4, transition: { duration: 0.15 } }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <span className="nav-item-icon">{item.icon}</span>
                        <span className="nav-label">{item.label}</span>
                      </motion.button>
                    </motion.div>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* ── Footer ── */}
        <div className="sidebar-footer">
          {/* User info */}
          <div className="sidebar-user">
            <motion.div
              className="sidebar-user-avatar"
              animate={{
                boxShadow: [
                  '0 0 0 0px rgba(78, 168, 222, 0.4)',
                  '0 0 0 6px rgba(78, 168, 222, 0)',
                ],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' as const }}
            >
              {user?.full_name?.charAt(0) || 'U'}
            </motion.div>
            <div className="sidebar-user-info">
              <p>{user?.full_name || 'Pengguna'}</p>
              <span>{user?.role || 'tidak diketahui'}</span>
            </div>
          </div>

          {/* Subtle divider */}
          <div style={{
            height: 1,
            background: 'var(--hairline)',
            margin: '8px 10px',
            opacity: 0.5,
          }} />

          {/* Theme toggle */}
          <motion.button
            className="nav-item"
            onClick={toggleTheme}
            style={{ marginTop: 4 }}
            title={isCollapsed ? (theme === 'dark' ? 'Mode Terang' : 'Mode Gelap') : undefined}
            whileHover={{ x: 4, transition: { duration: 0.15 } }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="nav-item-icon">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={theme}
                  initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.2 }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {theme === 'dark' ? <IconSun /> : <IconMoon />}
                </motion.span>
              </AnimatePresence>
            </span>
            <span className="nav-label">{theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}</span>
          </motion.button>

          {/* Logout */}
          <motion.button
            className="nav-item"
            style={{ marginTop: 4, color: 'var(--red)' }}
            onClick={handleLogout}
            title={isCollapsed ? 'Keluar' : undefined}
            whileHover={{ x: 4, transition: { duration: 0.15 } }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="nav-item-icon"><IconLogout /></span>
            <span className="nav-label">Keluar</span>
          </motion.button>
        </div>
      </motion.aside>
    </>
  );
}
