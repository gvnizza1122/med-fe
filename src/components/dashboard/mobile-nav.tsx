'use client';
import { useState } from "react"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Sidebar } from "./sidebar"

export function MobileNav() {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden hover:bg-secondary transition-all duration-300">
          <Menu className="w-6 h-6" />
          <span className="sr-only">Buka menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-64">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(value => !value)} />
      </SheetContent>
    </Sheet>
  )
}
