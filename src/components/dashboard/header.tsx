"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { MobileNav } from "./mobile-nav"

interface User {
  full_name: string
  email: string
  role: string
}

interface HeaderProps {
  title: string
  description: string
  actions?: ReactNode
}

export function Header({ title, description, actions }: HeaderProps) {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const u = localStorage.getItem("user")
    if (u) {
      try {
        setUser(JSON.parse(u))
      } catch {
        // ignore malformed cache
      }
    }
  }, [])

  const initials = (user?.full_name || "U")
    .split(" ")
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <header className="space-y-3 md:space-y-4 animate-slide-in-up">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <MobileNav />
        </div>

        <div className="flex items-center gap-1.5 md:gap-2">
          <div className="flex items-center gap-2 pl-2 md:pl-3">
            <Avatar className="w-7 h-7 md:w-8 md:h-8 ring-2 ring-primary/20 transition-all duration-300 hover:ring-primary/40">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="text-xs hidden sm:block">
              <p className="font-semibold text-foreground">{user?.full_name || "Pengguna"}</p>
              <p className="text-muted-foreground text-[10px] capitalize">{user?.role || ""}</p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h1 className="font-display text-xl md:text-2xl lg:text-[1.75rem] font-bold tracking-[-0.015em] text-foreground mb-1">{title}</h1>
        <p className="text-xs md:text-sm text-muted-foreground">{description}</p>
      </div>

      {actions && <div className="flex flex-col sm:flex-row gap-2">{actions}</div>}
    </header>
  )
}
