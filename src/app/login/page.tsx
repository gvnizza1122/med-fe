'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';

/* ─── SVG Icon Components ─── */
const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const ShieldCheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

const FileCheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <polyline points="9 15 11 17 15 13" />
  </svg>
);

const ActivityIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const SunIcon = () => (
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

const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const AlertCircleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const InfoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/* ─── Animation Variants ─── */
const panelLeftVariants = {
  hidden: { opacity: 0, x: -80 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

const panelRightVariants = {
  hidden: { opacity: 0, x: 80 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] as const, delay: 0.15 },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.35 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

const featureStagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.6 },
  },
};

const featureItem = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

const errorVariants = {
  hidden: { opacity: 0, x: -20, scale: 0.95 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { duration: 0.3, ease: 'easeOut' as const },
  },
  exit: { opacity: 0, x: 20, scale: 0.95, transition: { duration: 0.2 } },
};

const shakeAnimation = {
  x: [0, -8, 8, -6, 6, -3, 3, 0],
  transition: { duration: 0.5, ease: 'easeInOut' as const },
};

/* ─── Password Strength Helper ─── */
function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: '', color: 'transparent' };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score: 1, label: 'Lemah', color: '#ef4444' };
  if (score <= 2) return { score: 2, label: 'Cukup', color: '#f59e0b' };
  if (score <= 3) return { score: 3, label: 'Baik', color: '#3b82f6' };
  if (score <= 4) return { score: 4, label: 'Kuat', color: '#10b981' };
  return { score: 5, label: 'Sangat Kuat', color: '#059669' };
}

/* ─── Ripple Effect Hook ─── */
interface Ripple {
  x: number;
  y: number;
  id: number;
}

function useRipple() {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const nextId = useRef(0);

  const addRipple = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = nextId.current++;
    setRipples((prev) => [...prev, { x, y, id }]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 600);
  }, []);

  return { ripples, addRipple };
}

/* ─── Main Component ─── */
export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [errorKey, setErrorKey] = useState(0);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const { ripples, addRipple } = useRipple();

  const images: string[] = [
    '/images/login/DSC_7432.jpg',
    '/images/login/DSC_7510.jpg',
    '/images/login/DSC_7560-copy.jpg'
  ];
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const passwordStrength = getPasswordStrength(password);

  useEffect(() => {
    const saved = localStorage.getItem('theme') || 'dark';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => {
      setActiveImageIndex((prev) => (prev + 1) % images.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [images.length]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.login(username, password);
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login gagal. Periksa username dan password Anda.';
      setError(msg);
      setErrorKey((k) => k + 1);
      console.error('[Login Error]', err);
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: <ShieldCheckIcon />, text: 'Validasi klaim BPJS otomatis' },
    { icon: <FileCheckIcon />, text: 'Pre-validasi sebelum ke vClaim' },
    { icon: <ActivityIcon />, text: 'Monitoring real-time' },
  ];

  if (!mounted) return null;

  return (
    <main className="login-root">
      {/* ═══ LEFT: Slideshow Panel ═══ */}
      <motion.section
        className="login-left"
        variants={panelLeftVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Animated gradient background layer */}
        <motion.div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            background: 'linear-gradient(135deg, #1a7ec2, #0da094, #6b6ef7, #1a7ec2)',
            backgroundSize: '400% 400%',
          }}
          animate={{
            backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'],
          }}
          transition={{
            duration: 15,
            ease: 'linear' as const,
            repeat: Infinity,
          }}
        />

        {/* Image slideshow with crossfade + scale + parallax */}
        <AnimatePresence mode="sync">
          {images.map((src, i) => (
            i === activeImageIndex && (
              <motion.div
                key={src}
                className="login-left-slide"
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 1,
                }}
                initial={{ opacity: 0, scale: 1.08 }}
                animate={{ opacity: 1, scale: 1.04 }}
                exit={{ opacity: 0, scale: 1 }}
                transition={{ duration: 1.4, ease: [0.25, 0.46, 0.45, 0.94] as const }}
              >
                <img
                  src={src}
                  alt="RS Lestari Raharja"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center',
                  }}
                />
              </motion.div>
            )
          ))}
        </AnimatePresence>

        <div className="login-left-overlay" />

        <div className="login-left-content">
          <motion.div
            className="login-left-brand"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            <img src="/images/login/logo.png" alt="RS Lestari Raharja" />
            <div>
              <div className="login-left-brand-name">RS Lestari Raharja</div>
              <div className="login-left-subtitle">Sistem Manajemen Klaim BPJS</div>
            </div>
          </motion.div>

          <div className="login-left-body">
            <motion.div
              className="login-left-badge"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.4, type: 'spring', stiffness: 200 }}
            >
              <div className="login-left-badge-dot" />
              Sistem Aktif
            </motion.div>

            <motion.h2
              className="login-left-heading"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
            >
              Validasi Klaim BPJS<br />Lebih Cepat & Akurat
            </motion.h2>

            <motion.p
              className="login-left-subtext"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.5 }}
            >
              Platform pre-validasi klaim BPJS RS Lestari Raharja. Validasi dan verifikasi data klaim secara otomatis sebelum pengiriman ke vClaim.
            </motion.p>

            <motion.div
              className="login-features"
              variants={featureStagger}
              initial="hidden"
              animate="visible"
            >
              {features.map((f, i) => (
                <motion.div
                  key={i}
                  className="login-feature-item"
                  variants={featureItem}
                  whileHover={{ x: 4, transition: { duration: 0.2 } }}
                >
                  <div className="login-feature-icon">{f.icon}</div>
                  <span>{f.text}</span>
                </motion.div>
              ))}
            </motion.div>

            <motion.div
              className="login-slide-dots"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.5 }}
            >
              {images.map((_, i) => (
                <motion.button
                  key={i}
                  className={`login-slide-dot ${i === activeImageIndex ? 'active' : ''}`}
                  onClick={() => setActiveImageIndex(i)}
                  aria-label={`Slide ${i + 1}`}
                  whileHover={{ scale: 1.3 }}
                  whileTap={{ scale: 0.9 }}
                />
              ))}
            </motion.div>
          </div>
        </div>
      </motion.section>

      <motion.section
        className="login-right"
        variants={panelRightVariants}
        initial="hidden"
        animate="visible"
      >

        <motion.button
          onClick={toggleTheme}
          className="login-theme-toggle"
          title={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
          whileHover={{ scale: 1.05, rotate: 15 }}
          whileTap={{ scale: 0.95 }}
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={theme}
              initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
              transition={{ duration: 0.25 }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </motion.span>
          </AnimatePresence>
        </motion.button>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <motion.div className="login-form-header" variants={staggerItem}>
            <img src="/images/login/logo.png" alt="Logo RS Lestari Raharja" />
            <div>
              <div className="login-form-title">RS Lestari Raharja</div>
              <div className="login-form-subtitle">Sistem Pre-Validasi Klaim BPJS</div>
            </div>
          </motion.div>

          <motion.h1 className="login-form-greeting" variants={staggerItem}>
            Selamat Datang
          </motion.h1>

          <motion.p className="login-form-desc" variants={staggerItem}>
            Masuk untuk mengakses sistem validasi klaim.
          </motion.p>

          {/* Error message with shake + slide-in */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key={`error-${errorKey}`}
                className="login-error-form"
                variants={errorVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                {...shakeAnimation}
              >
                <span className="login-error-icon">
                  <AlertCircleIcon />
                </span>
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.form
            className="login-form"
            onSubmit={handleLogin}
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {/* Username field */}
            <motion.div className="form-group" variants={staggerItem}>
              <label className="form-label" htmlFor="username">Username</label>
              <motion.div
                className="form-input-wrap"
                animate={focusedField === 'username' ? { scale: 1.01 } : { scale: 1 }}
                transition={{ duration: 0.2 }}
              >
                <span className="form-icon-left">
                  <UserIcon />
                </span>
                <input
                  id="username"
                  type="text"
                  className="form-input has-prefix"
                  placeholder="Masukkan username Anda"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => setFocusedField(null)}
                  required
                  autoFocus
                  autoComplete="username"
                />
              </motion.div>
            </motion.div>

            {/* Password field */}
            <motion.div className="form-group" variants={staggerItem}>
              <label className="form-label" htmlFor="password">Password</label>
              <motion.div
                className="form-input-wrap"
                animate={focusedField === 'password' ? { scale: 1.01 } : { scale: 1 }}
                transition={{ duration: 0.2 }}
              >
                <span className="form-icon-left">
                  <LockIcon />
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input has-prefix has-suffix"
                  placeholder="Masukkan password Anda"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  required
                  autoComplete="current-password"
                />
                <motion.button
                  type="button"
                  className="form-icon-right"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  tabIndex={-1}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={showPassword ? 'eye-off' : 'eye-on'}
                      initial={{ opacity: 0, rotate: -30 }}
                      animate={{ opacity: 1, rotate: 0 }}
                      exit={{ opacity: 0, rotate: 30 }}
                      transition={{ duration: 0.15 }}
                      style={{ display: 'flex' }}
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </motion.span>
                  </AnimatePresence>
                </motion.button>
              </motion.div>

              {/* Password strength indicator */}
              <AnimatePresence>
                {password.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    transition={{ duration: 0.25 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: 3, flex: 1 }}>
                        {[1, 2, 3, 4, 5].map((level) => (
                          <motion.div
                            key={level}
                            style={{
                              height: 3,
                              flex: 1,
                              borderRadius: 2,
                              background: level <= passwordStrength.score
                                ? passwordStrength.color
                                : 'var(--hairline, #e5e7eb)',
                            }}
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ duration: 0.3, delay: level * 0.05 }}
                          />
                        ))}
                      </div>
                      <motion.span
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: passwordStrength.color,
                          minWidth: 65,
                          textAlign: 'right',
                        }}
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        {passwordStrength.label}
                      </motion.span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Submit button with ripple effect */}
            <motion.div variants={staggerItem}>
              <motion.button
                type="submit"
                className="login-submit"
                disabled={loading}
                onClick={addRipple}
                whileHover={!loading ? { scale: 1.01, boxShadow: '0 6px 20px rgba(26, 126, 194, 0.4)' } : {}}
                whileTap={!loading ? { scale: 0.98 } : {}}
                style={{ position: 'relative', overflow: 'hidden' }}
              >
                {/* Ripple effects */}
                {ripples.map((ripple) => (
                  <motion.span
                    key={ripple.id}
                    style={{
                      position: 'absolute',
                      left: ripple.x - 50,
                      top: ripple.y - 50,
                      width: 100,
                      height: 100,
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,0.3)',
                      pointerEvents: 'none',
                    }}
                    initial={{ scale: 0, opacity: 0.6 }}
                    animate={{ scale: 4, opacity: 0 }}
                    transition={{ duration: 0.6, ease: 'easeOut' as const }}
                  />
                ))}

                <AnimatePresence mode="wait">
                  {loading ? (
                    <motion.span
                      key="loading"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      <motion.div
                        className="login-spinner"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' as const }}
                      />
                      <span>Memproses...</span>
                    </motion.span>
                  ) : (
                    <motion.span
                      key="idle"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      <span>Masuk ke Sistem</span>
                      <motion.span
                        animate={{ x: [0, 3, 0] }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' as const }}
                        style={{ display: 'flex' }}
                      >
                        <ArrowRightIcon />
                      </motion.span>
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </motion.div>
          </motion.form>

          <motion.div className="login-info-strip" variants={staggerItem}>
            <span className="login-info-icon">
              <InfoIcon />
            </span>
            <span>Hubungi administrator IT jika mengalami kesulitan login atau akun dikunci.</span>
          </motion.div>

          <motion.footer className="login-footer" variants={staggerItem}>
            <span>&copy; 2026 RS Lestari Raharja</span>
            <div className="login-footer-links">
              <a href="#">Kebijakan Privasi</a>
              <a href="#">Bantuan</a>
            </div>
          </motion.footer>
        </motion.div>
      </motion.section>
    </main>
  );
}
