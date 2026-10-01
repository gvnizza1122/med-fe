"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { FlaskConical, History } from "lucide-react"

export function HistoryTabs() {
  const pathname = usePathname()
  return <nav aria-label="Riwayat dan testing klaim" className="flex flex-wrap gap-2 border-b border-border pb-3">
    {[{ href: "/history", label: "Riwayat Upload", icon: History }, { href: "/testing-pending", label: "Testing Pending", icon: FlaskConical }].map(item =>
      <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined}
        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${pathname === item.href ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
        <item.icon aria-hidden="true" className="h-4 w-4" />{item.label}
      </Link>)}
  </nav>
}
