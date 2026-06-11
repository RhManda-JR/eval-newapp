import { Link, Outlet } from "react-router-dom"
import { LayoutGridIcon, PanelLeftIcon } from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import { Button } from "@/components/ui/button"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

export function AppLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0 overflow-x-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card/80 px-4 backdrop-blur-sm">
          <SidebarTrigger className="-ml-1">
            <PanelLeftIcon />
            <span className="sr-only">Menu</span>
          </SidebarTrigger>

          <Button variant="outline" size="sm" asChild>
            <Link to="/">
              <LayoutGridIcon data-icon="inline-start" />
              Portail utilisateur
            </Link>
          </Button>

          <div className="ml-auto flex min-w-0 flex-col text-right sm:ml-0 sm:text-left">
            <span className="text-sm font-medium text-foreground">NewApp</span>
            <span className="truncate text-xs text-muted-foreground">
              Backoffice · GLPI 11
            </span>
          </div>
        </header>

        <main className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
