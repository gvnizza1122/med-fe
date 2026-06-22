import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "E-Claim BPJS Validator - Pre-Validasi Klaim BPJS Kesehatan",
  description: "Aplikasi Pre-Validasi Klaim BPJS untuk Rumah Sakit. Validasi data klaim sebelum dikirim ke vClaim.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            try {
              var t = localStorage.getItem('theme');
              if (!t) {
                var m = window.matchMedia('(prefers-color-scheme: light)');
                t = m.matches ? 'light' : 'dark';
              }
              document.documentElement.setAttribute('data-theme', t);
            } catch(e) {}
          `
        }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
