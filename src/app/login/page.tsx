'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import { ShieldCheck, FileCheck, Activity, Sun, Moon } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

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

const features = [
  { icon: ShieldCheck, text: 'Validasi klaim BPJS otomatis' },
  { icon: FileCheck, text: 'Pre-validasi sebelum ke vClaim' },
  { icon: Activity, text: 'Monitoring real-time' },
];

const images: string[] = [
  '/images/login/DSC_7432.jpg',
  '/images/login/DSC_7510.jpg',
  '/images/login/DSC_7560-copy.jpg',
];

/* ─── Main Component ─── */
export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const { resolvedTheme, setTheme } = useTheme();

  const passwordStrength = getPasswordStrength(password);
  const toggleTheme = () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => {
      setActiveImageIndex((prev) => (prev + 1) % images.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

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
      console.error('[Login Error]', err);
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <main className="flex min-h-screen bg-background">
      {/* ═══ LEFT: Login form ═══ */}
      <div className="relative flex w-full items-center justify-center px-4 py-12 lg:w-1/2 lg:px-12">
        <button
          onClick={toggleTheme}
          aria-label={resolvedTheme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
          title={resolvedTheme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-all duration-300 hover:scale-110 hover:text-foreground lg:right-6 lg:top-6"
        >
          {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <div className="w-full max-w-md animate-slide-in-up">
          {/* Header / branding */}
          <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
            <img
              src="/logo.png"
              alt="RS Lestari Raharja"
              className="mb-4 h-14 w-14 rounded-xl object-contain"
            />
            <h1 className="text-xl font-semibold text-foreground">RS Lestari Raharja</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sistem Pre-Validasi Klaim BPJS</p>
          </div>

          <div className="mb-6 animate-fade-in text-center lg:text-left">
            <h2 className="text-2xl font-bold text-foreground">Selamat Datang</h2>
            <p className="mt-1 text-sm text-muted-foreground">Masuk untuk mengakses sistem validasi klaim.</p>
          </div>

          {/* Error message */}
          {error && (
            <Alert variant="destructive" className="mb-6 animate-fade-in">
              <AlertCircleIcon />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Username field */}
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Masukkan username Anda"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                autoComplete="username"
                className="h-11 rounded-lg"
              />
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Masukkan password Anda"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-11 rounded-lg pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>

              {/* Password strength indicator */}
              {password.length > 0 && (
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex flex-1 gap-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className="h-[3px] flex-1 rounded-full transition-colors duration-300"
                        style={{
                          background: level <= passwordStrength.score ? passwordStrength.color : 'var(--border)',
                        }}
                      />
                    ))}
                  </div>
                  <span
                    className="min-w-[65px] text-right text-xs font-medium"
                    style={{ color: passwordStrength.color }}
                  >
                    {passwordStrength.label}
                  </span>
                </div>
              )}
            </div>

            {/* Submit button */}
            <Button
              type="submit"
              disabled={loading}
              className={cn(
                'h-11 w-full rounded-lg text-sm font-medium transition-all duration-300',
                'hover:scale-105 hover:shadow-lg hover:shadow-primary/20',
              )}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                  Memproses...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Masuk ke Sistem
                </span>
              )}
            </Button>
          </form>

          <div className="mt-6 flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
            <span className="mt-0.5 shrink-0">
              <InfoIcon />
            </span>
            <span>Hubungi administrator IT jika mengalami kesulitan login atau akun dikunci.</span>
          </div>

          <footer className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
            <span>&copy; 2026 RS Lestari Raharja</span>
            <div className="flex gap-3">
              <a href="#" className="transition-colors hover:text-foreground">Kebijakan Privasi</a>
              <a href="#" className="transition-colors hover:text-foreground">Bantuan</a>
            </div>
          </footer>
        </div>
      </div>

      {/* ═══ RIGHT: Hospital photo slideshow ═══ */}
      <div className="relative hidden overflow-hidden lg:block lg:w-1/2">
        <AnimatePresence mode="sync">
          {images.map((src, i) => (
            i === activeImageIndex && (
              <motion.div
                key={src}
                className="absolute inset-0"
                initial={{ opacity: 0, scale: 1.08 }}
                animate={{ opacity: 1, scale: 1.02 }}
                exit={{ opacity: 0, scale: 1 }}
                transition={{ duration: 1.4, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <img
                  src={src}
                  alt="RS Lestari Raharja"
                  className="h-full w-full object-cover object-center"
                />
              </motion.div>
            )
          ))}
        </AnimatePresence>

        {/* Overlay for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />
        <div className="absolute inset-0 bg-primary/20 mix-blend-multiply" />

        <div className="relative flex h-full flex-col justify-end p-10 text-white">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="mb-6 inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            Sistem Aktif
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="mb-3 text-3xl font-bold leading-tight"
          >
            Validasi Klaim BPJS<br />Lebih Cepat & Akurat
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="mb-6 max-w-md text-sm text-white/80"
          >
            Platform pre-validasi klaim BPJS RS Lestari Raharja. Validasi dan verifikasi data klaim secara otomatis sebelum pengiriman ke vClaim.
          </motion.p>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.1, delayChildren: 0.6 } } }}
            className="mb-8 space-y-3"
          >
            {features.map((f, i) => (
              <motion.div
                key={i}
                variants={{
                  hidden: { opacity: 0, x: -20 },
                  visible: { opacity: 1, x: 0, transition: { duration: 0.5 } },
                }}
                className="flex items-center gap-3 text-sm"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
                  <f.icon className="h-4 w-4" />
                </span>
                <span>{f.text}</span>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.5 }}
            className="flex gap-2"
          >
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveImageIndex(i)}
                aria-label={`Slide ${i + 1}`}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === activeImageIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/60',
                )}
              />
            ))}
          </motion.div>
        </div>
      </div>
    </main>
  );
}
