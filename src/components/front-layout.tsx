import { Link, Outlet } from "react-router-dom"
import {
  CoinsIcon,
  Columns3Icon,
  HeadsetIcon,
  LayoutGridIcon,
  UploadIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"

export function FrontLayout() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link to="/" className="flex shrink-0 flex-col leading-tight">
            <span className="text-sm font-semibold text-foreground">NewApp</span>
            <span className="text-xs text-muted-foreground">Portail utilisateur</span>
          </Link>

          <nav className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/">
                <LayoutGridIcon data-icon="inline-start" />
                Éléments
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/kanban">
                <Columns3Icon data-icon="inline-start" />
                Kanban
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/import">
                <UploadIcon data-icon="inline-start" />
                Import
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/couts">
                <CoinsIcon data-icon="inline-start" />
                Coûts
              </Link>
            </Button>
          </nav>

          <Button variant="outline" size="sm" className="shrink-0" asChild>
            <Link to="/backoffice/entree">
              <HeadsetIcon data-icon="inline-start" />
              Backoffice
            </Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  )
}
