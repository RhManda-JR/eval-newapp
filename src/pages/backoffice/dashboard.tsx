import { useEffect, useState } from "react"
import {
  BoxIcon,
  MonitorIcon,
  PrinterIcon,
  TicketIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { api, itemtypeLabel, type Stats } from "@/lib/api"

const TYPE_ICONS: Record<string, typeof BoxIcon> = {
  Computer: MonitorIcon,
  Monitor: MonitorIcon,
  Printer: PrinterIcon,
}

export function BackofficeDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.stats().then(setStats).finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Statistiques synchronisées depuis GLPI ExistingApp (JSON).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Éléments totaux</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-3xl font-semibold">{stats?.assets.total ?? 0}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Parc importé visible dans GLPI
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tickets totaux</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-3xl font-semibold">{stats?.tickets.total ?? 0}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              GLPI {stats?.glpi.version ?? "—"}
            </p>
          </CardContent>
        </Card>

        <Card className="sm:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Connexion GLPI</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={stats?.glpi.connected ? "default" : "destructive"}>
              {stats?.glpi.connected ? "Connecté" : "Hors ligne"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BoxIcon className="text-primary" />
              Éléments par type
            </CardTitle>
            <CardDescription>Détail du parc synchronisé</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : stats?.assets.by_type.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun élément importé.</p>
            ) : (
              stats?.assets.by_type.map((row) => {
                const Icon = TYPE_ICONS[row.itemtype] ?? BoxIcon
                return (
                  <div
                    key={row.itemtype}
                    className="flex items-center justify-between rounded-lg border px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {itemtypeLabel(row.itemtype)}
                      </span>
                    </div>
                    <Badge variant="secondary">{row.count}</Badge>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TicketIcon className="text-primary" />
              Tickets par statut & type
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Par statut
                  </p>
                  {stats?.tickets.by_status.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>{row.label}</span>
                      <Badge variant="outline">{row.count}</Badge>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Par type
                  </p>
                  {stats?.tickets.by_type.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>{row.label}</span>
                      <Badge variant="outline">{row.count}</Badge>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
