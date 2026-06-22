'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface User {
  id: string; email: string; full_name: string; role: string;
}

const NAV_ITEMS = [
  { section: 'Menu Utama', items: [
    { path: '/dashboard', icon: '📊', label: 'Dashboard', roles: ['admin', 'supervisor', 'verifikator'] },
    { path: '/upload', icon: '📤', label: 'Upload File', roles: ['admin', 'supervisor', 'verifikator'] },
    { path: '/history', icon: '📁', label: 'Riwayat Upload', roles: ['admin', 'supervisor', 'verifikator'] },
  ]},
  { section: 'Administrasi', items: [
    { path: '/users', icon: '👥', label: 'Manajemen User', roles: ['admin'] },
    { path: '/rules', icon: '⚙️', label: 'Aturan Validasi', roles: ['admin'] },
    { path: '/audit', icon: '📋', label: 'Audit Log', roles: ['admin', 'supervisor'] },
  ]},
];

export default function Sidebar() {
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

  return (
    <>
      <button className="sidebar-toggle" onClick={() => setIsOpen(!isOpen)} aria-label="Toggle sidebar">
        <span className={`hamburger ${isOpen ? 'open' : ''}`}>
          <span /><span /><span />
        </span>
      </button>

      {isOpen && <div className="sidebar-overlay" onClick={() => setIsOpen(false)} />}

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">E</div>
          <div>
            <h1>E-Claim</h1>
            <span>Pre-Validasi BPJS</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(section => {
            const visibleItems = section.items.filter(item =>
              !user || item.roles.includes(user.role)
            );
            if (visibleItems.length === 0) return null;
            return (
              <div key={section.section} className="nav-section">
                <div className="nav-section-title">{section.section}</div>
                {visibleItems.map(item => (
                  <button
                    key={item.path}
                    className={`nav-item ${pathname === item.path || pathname?.startsWith(item.path + '/') ? 'active' : ''}`}
                    onClick={() => router.push(item.path)}
                  >
                    <span className="nav-item-icon">{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">
              {user?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="sidebar-user-info">
              <p>{user?.full_name || 'Pengguna'}</p>
              <span>{user?.role || 'tidak diketahui'}</span>
            </div>
          </div>
        <button className="nav-item" onClick={toggleTheme} style={{ marginTop: 4, color: 'var(--text-secondary)' }}>
          <span className="nav-item-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
          {theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
        </button>
        <button className="nav-item" style={{ marginTop: 4, color: 'var(--accent-red)' }} onClick={handleLogout}>
          <span className="nav-item-icon">🚪</span> Keluar
        </button>
        </div>
      </aside>
    </>
  );
}
