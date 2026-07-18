import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "RS Lestari Raharja - Pre-Validasi Klaim BPJS",
  description: "Aplikasi Pre-Validasi Klaim BPJS RS Lestari Raharja. Validasi data klaim sebelum dikirim ke vClaim.",
  icons: {
    icon: '/logo.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <Script id="theme-init" strategy="beforeInteractive">
          {`
            try {
              var t = localStorage.getItem('theme');
              if (!t) {
                var m = window.matchMedia('(prefers-color-scheme: light)');
                t = m.matches ? 'light' : 'dark';
              }
              document.documentElement.setAttribute('data-theme', t);
            } catch(e) {}
          `}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  );
}
