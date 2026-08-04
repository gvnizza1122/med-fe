'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Guard client-side untuk halaman yang cuma boleh diakses role tertentu
 * (mis. admin) — sebelumnya beberapa halaman admin (Manajemen User, Aturan
 * Validasi) cuma disembunyikan dari sidebar untuk role lain, tapi tetap bisa
 * dibuka & render penuh kalau diakses langsung lewat URL. API backend-nya
 * sendiri sudah aman (authorize('admin') middleware), ini lapisan tambahan
 * di frontend supaya non-admin langsung diarahkan pergi, bukan melihat
 * halaman kosong/error dari request yang ditolak backend.
 *
 * Dipanggil sekali saat halaman mount — role user tidak berubah selama
 * halaman terbuka, jadi cukup dicek sekali.
 */
export function useRequireRole(allowedRoles: string[]) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      const user = raw ? JSON.parse(raw) : null;
      if (user?.role && allowedRoles.includes(user.role)) {
        setAllowed(true);
      } else {
        router.replace('/dashboard');
      }
    } catch {
      router.replace('/dashboard');
    } finally {
      setChecking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cek sekali saat mount, role tidak berubah selama halaman terbuka
  }, []);

  return { checking, allowed };
}
