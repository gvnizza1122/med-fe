import type { Metadata } from "next";
import Script from "next/script";
import { ThemeProvider } from "@/components/theme-provider";
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
              var t = localStorage.getItem('tasko-theme') || 'light';
              document.documentElement.classList.toggle('dark', t === 'dark');
            } catch(e) {}
          `}
        </Script>
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" storageKey="tasko-theme" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
