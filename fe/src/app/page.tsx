'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    router.replace(token ? '/dashboard' : '/login');
  }, [router]);
  return (
    <div className="loading" style={{ minHeight: '100vh' }}>
      <div className="spinner" />
    </div>
  );
}
