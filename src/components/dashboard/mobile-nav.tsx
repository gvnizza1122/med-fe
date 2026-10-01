"use client"

import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Sidebar } from "./sidebar"

export function MobileNav() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden hover:bg-secondary transition-all duration-300">
          <Menu className="w-6 h-6" />
          <span className="sr-only">Buka menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-64">
        {/* Sidebar.collapsed ditambahkan untuk mode lipat di layar desktop --
            di drawer mobile ini tidak relevan (lebarnya sudah tetap w-64 dari
            SheetContent), jadi selalu diperlakukan tidak terlipat. */}
        <Sidebar collapsed={false} onToggle={() => {}} />
      </SheetContent>
    </Sheet>
  )
}
