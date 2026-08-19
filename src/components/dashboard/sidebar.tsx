"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
  LayoutDashboard,
  Upload,
  FileText,
  History,
  Users,
  ShieldCheck,
  Sun,
  Moon,
  LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"

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

const NAV_SECTIONS: NavSection[] = [
  {
    section: "Menu Utama",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", roles: ["admin", "supervisor", "verifikator"] },
      { href: "/upload", icon: Upload, label: "Upload File", roles: ["admin", "supervisor", "verifikator"] },
      { href: "/extract", icon: FileText, label: "Extract PDF", roles: ["admin", "supervisor", "verifikator"] },
      { href: "/history", icon: History, label: "Riwayat Upload", roles: ["admin", "supervisor", "verifikator"] },
    ],
  },
  {
    section: "Administrasi",
    items: [
      { href: "/users", icon: Users, label: "Manajemen User", roles: ["admin"] },
      { href: "/rules", icon: ShieldCheck, label: "Aturan Validasi", roles: ["admin"] },
    ],
  },
]

export function Sidebar() {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
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
    <aside className="fixed top-0 left-0 w-64 bg-card border-r border-border p-4 h-screen overflow-y-auto flex flex-col">
      <div className="flex items-center gap-2 mb-6 group cursor-pointer">
        <Link href="/dashboard" className="flex items-center gap-2">
          <img src="/logo.png" alt="RS Lestari Raharja" className="w-8 h-8 rounded-full object-contain transition-transform group-hover:scale-110 duration-300" />
          <div className="leading-tight">
            <span className="text-sm font-semibold text-foreground block">RS Lestari Raharja</span>
            <span className="text-[10px] text-muted-foreground block">Sistem Validasi BPJS</span>
          </div>
        </Link>
      </div>

      <div className="space-y-4 flex-1">
        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter((item) => !user || item.roles.includes(user.role))
          if (visibleItems.length === 0) return null
          return (
            <div key={section.section}>
              <p className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                {section.section}
              </p>
              <nav className="space-y-0.5">
                {visibleItems.map((item) => {
                  const active = isActive(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onMouseEnter={() => setHoveredItem(item.href)}
                      onMouseLeave={() => setHoveredItem(null)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-300",
                        active
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                        hoveredItem === item.href && !active && "translate-x-1",
                      )}
                    >
                      <item.icon className="w-4 h-4" />
                      <span className="text-sm">{item.label}</span>
                    </Link>
                  )
                })}
              </nav>
            </div>
          )
        })}
      </div>

      <div className="pt-3 border-t border-border space-y-0.5">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-all duration-300"
        >
          {mounted && resolvedTheme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          <span className="text-sm">{mounted && resolvedTheme === "dark" ? "Mode Terang" : "Mode Gelap"}</span>
        </button>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-300"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm">Keluar</span>
        </button>

        <div className="flex items-center gap-2 pt-2 mt-1">
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
            {user?.full_name?.charAt(0) || "U"}
          </div>
          <div className="text-xs leading-tight">
            <p className="font-semibold text-foreground">{user?.full_name || "Pengguna"}</p>
            <p className="text-muted-foreground text-[10px] capitalize">{user?.role || "tidak diketahui"}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
