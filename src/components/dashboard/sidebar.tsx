"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
  LayoutDashboard,
  FileText,
  History,
  Users,
  ShieldCheck,
  ClipboardList,
  ListChecks,
  ScrollText,
  ChartNoAxesCombined,
  Sun,
  Moon,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { UploadProgressWidget } from "@/components/dashboard/upload-progress-widget"

interface User {
  id: string
  email: string
  full_name: string
  role: string
}

interface NavItem {
  href: string
  icon: typeof LayoutDashboard
  label: string
  roles: string[]
}

interface NavSection {
  section: string
  items: NavItem[]
}

// 'superadmin' ditambahkan eksplisit di tiap item yang punya 'admin' (superadmin
// mewarisi semua akses admin, sama seperti ROLE_INHERITANCE di backend
// middleware/auth.js) — KECUALI "Manajemen User" yang sengaja HANYA
// superadmin, admin biasa tidak lagi bisa membukanya.
const NAV_SECTIONS: NavSection[] = [
  {
    section: "Menu Utama",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", roles: ["superadmin", "admin", "supervisor", "verifikator"] },
      { href: "/extract", icon: FileText, label: "Extract PDF", roles: ["superadmin", "admin", "supervisor", "verifikator"] },
      { href: "/katalog-pedoman", icon: ScrollText, label: "Katalog Pedoman", roles: ["superadmin", "admin", "supervisor", "verifikator"] },
      { href: "/history", icon: History, label: "Riwayat Upload", roles: ["superadmin", "admin", "supervisor", "verifikator"] },
      { href: "/pending-bpjs", icon: ClipboardList, label: "Pending BPJS", roles: ["superadmin", "admin", "supervisor", "verifikator"] },
      { href: "/pending-jawaban", icon: ListChecks, label: "Alur Jawab Pending", roles: ["superadmin", "admin", "supervisor", "verifikator"] },
    ],
  },
  {
    section: "Administrasi",
    items: [
      { href: "/users", icon: Users, label: "Manajemen User", roles: ["superadmin"] },
      { href: "/rules", icon: ShieldCheck, label: "Aturan Validasi", roles: ["superadmin", "admin"] },
      { href: "/penggunaan-ai", icon: ChartNoAxesCombined, label: "Penggunaan AI", roles: ["superadmin", "admin"] },
      { href: "/audit-log", icon: ScrollText, label: "Audit Log", roles: ["superadmin", "admin"] },
    ],
  },
]

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const [user, setUser] = useState<User | null>(null)
  const [mounted, setMounted] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
    const u = localStorage.getItem("user")
    if (u) {
      try {
        setUser(JSON.parse(u))
      } catch {
        // ignore malformed cache
      }
    }
  }, [])

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }

  const handleLogout = () => {
    ;["access_token", "refresh_token", "user"].forEach((k) => localStorage.removeItem(k))
    router.push("/login")
  }

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + "/")

  return (
    <aside className={cn("fixed top-0 left-0 z-30 h-screen overflow-y-auto border-r border-border bg-card flex flex-col", collapsed ? "w-16 p-2" : "w-64 p-4")}>
      <div className={cn("mb-6 flex items-center gap-2", collapsed ? "flex-col" : "justify-between")}>
        <Link href="/dashboard" aria-label="Ke Dashboard" title={collapsed ? "Dashboard" : undefined} className="flex min-w-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <img src="/logo.png" alt="" className="h-8 w-8 shrink-0 rounded-full object-contain" />
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-semibold text-foreground">RS Lestari Raharja</span>
              <span className="block truncate text-[10px] text-muted-foreground">Sistem Validasi BPJS</span>
            </div>
          )}
        </Link>
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Perluas menu samping" : "Perkecil menu samping"}
          title={collapsed ? "Perluas menu samping" : "Perkecil menu samping"}
          aria-expanded={!collapsed}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {collapsed ? <PanelLeftOpen className="h-5 w-5" aria-hidden="true" /> : <PanelLeftClose className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>

      <div className="space-y-4 flex-1">
        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter((item) => !user || item.roles.includes(user.role))
          if (visibleItems.length === 0) return null
          return (
            <div key={section.section}>
              <p className={cn("mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground", collapsed && "sr-only")}>
                {section.section}
              </p>
              <nav aria-label={section.section} className="space-y-0.5">
                {visibleItems.map((item) => {
                  const active = isActive(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-label={collapsed ? item.label : undefined}
                      title={collapsed ? item.label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-10 w-full items-center rounded-lg text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        collapsed ? "justify-center px-2" : "gap-2.5 px-2.5",
                        active
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {!collapsed && <span className="text-sm">{item.label}</span>}
                    </Link>
                  )
                })}
              </nav>
            </div>
          )
        })}
      </div>

      <UploadProgressWidget compact={collapsed} />

      <div className="pt-3 border-t border-border space-y-0.5">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={mounted && resolvedTheme === "dark" ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
          title={collapsed ? (mounted && resolvedTheme === "dark" ? "Mode Terang" : "Mode Gelap") : undefined}
          className={cn("flex min-h-10 w-full items-center rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", collapsed ? "justify-center px-2" : "gap-2.5 px-2.5")}
        >
          {mounted && resolvedTheme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {!collapsed && <span className="text-sm">{mounted && resolvedTheme === "dark" ? "Mode Terang" : "Mode Gelap"}</span>}
        </button>

        <button
          type="button"
          onClick={handleLogout}
          aria-label="Keluar"
          title={collapsed ? "Keluar" : undefined}
          className={cn("flex min-h-10 w-full items-center rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", collapsed ? "justify-center px-2" : "gap-2.5 px-2.5")}
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span className="text-sm">Keluar</span>}
        </button>

        <div className={cn("flex items-center gap-2 pt-2 mt-1", collapsed && "justify-center")} title={collapsed ? `${user?.full_name || "Pengguna"} · ${user?.role || "tidak diketahui"}` : undefined}>
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
            {user?.full_name?.charAt(0) || "U"}
          </div>
          {!collapsed && (
            <div className="min-w-0 text-xs leading-tight">
              <p className="truncate font-semibold text-foreground">{user?.full_name || "Pengguna"}</p>
              <p className="truncate text-[10px] capitalize text-muted-foreground">{user?.role || "tidak diketahui"}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
