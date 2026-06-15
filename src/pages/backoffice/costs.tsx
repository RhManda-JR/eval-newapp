import { useEffect, useMemo, useState } from "react"
import {
  BoxIcon,
  LaptopIcon,
  MonitorIcon,
  PrinterIcon,
  RefreshCwIcon,
  SearchIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { api, type ItemCostDetailReport, type ItemCostReportRow } from "@/lib/api"
import { cn } from "@/lib/utils"

const ITEM_ICONS: Record<string, typeof BoxIcon> = {
  Computer: LaptopIcon,
  Monitor: MonitorIcon,
  Printer: PrinterIcon,
  "Non assigné": BoxIcon,
}

const ITEM_ALIASES: Record<string, string[]> = {
  Computer: ["computer", "ordinateur"],
  Monitor: ["monitor", "moniteur"],
  Printer: ["printer", "imprimante"],
  "Non assigné": ["non assigné", "non assigne", "unassigned"],
}

function formatEuro(value: number) {
  return `${value.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`
}

function matchesQuery(row: ItemCostReportRow, query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true

  if (row.item.toLowerCase().includes(normalized)) return true

  const aliases = ITEM_ALIASES[row.item] ?? []
  return aliases.some((alias) => alias.includes(normalized))
}

type SummaryStatProps = {
  label: string
  value: string
  loading: boolean
  valueClassName?: string
  className?: string
}

function SummaryStat({
  label,
  value,
  loading,
  valueClassName,
  className,
}: SummaryStatProps) {
  return (
    <Card className={cn("shadow-none", className)}>
      <CardContent className="flex flex-col gap-1 px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <p className={cn("text-2xl font-semibold tabular-nums", valueClassName)}>
            {value}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export function BackofficeCostsPage() {
  const [rows, setRows] = useState<ItemCostReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [query, setQuery] = useState("")
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  const [detail, setDetail] = useState<ItemCostDetailReport | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  async function loadCosts() {
    const data = await api.itemCosts()
    setRows(data)
  }

  useEffect(() => {
    loadCosts().finally(() => setLoading(false))
  }, [])

  const filteredRows = useMemo(
    () => rows.filter((row) => matchesQuery(row, query)),
    [query, rows]
  )

  const summary = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => ({
        equipment: acc.equipment + row.quantity,
        glpi: acc.glpi + row.total_glpi,
        superCost: acc.superCost + row.total_super_cost,
        reopen: acc.reopen + row.total_reopen,
        total: acc.total + row.total,
      }),
      { equipment: 0, glpi: 0, superCost: 0, reopen: 0, total: 0 }
    )
  }, [filteredRows])

  async function handleSync() {
    setSyncing(true)
    try {
      const result = await api.sync()
      await loadCosts()
      toast.success(`Synchronisation GLPI terminée (${result.synced} élément(s))`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Synchronisation échouée"
      )
    } finally {
      setSyncing(false)
    }
  }

  async function openDetail(item: string) {
    setSelectedItem(item)
    setDetailLoading(true)
    setDetail(null)
    try {
      setDetail(await api.itemCostDetails(item))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Détail indisponible")
      setSelectedItem(null)
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Coût par Équipement (SQLite Kanban)
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Ventilation des coûts financiers (GLPI + Kanban) à partir de la table
            consolidée.
          </p>
        </div>
        <Button disabled={syncing} onClick={() => void handleSync()}>
          <RefreshCwIcon
            data-icon="inline-start"
            className={cn(syncing && "animate-spin")}
          />
          Synchroniser GLPI
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryStat
          label="Équipements uniques"
          value={String(summary.equipment)}
          loading={loading}
        />
        <SummaryStat
          label="Coûts GLPI"
          value={formatEuro(summary.glpi)}
          loading={loading}
        />
        <SummaryStat
          label="Total SuperPrice"
          value={formatEuro(summary.superCost)}
          loading={loading}
          valueClassName="text-sky-600 dark:text-sky-400"
        />
        <SummaryStat
          label="Total réouverture"
          value={formatEuro(summary.reopen)}
          loading={loading}
          valueClassName="text-amber-600 dark:text-amber-400"
        />
        <SummaryStat
          label="Coût total"
          value={formatEuro(summary.total)}
          loading={loading}
          valueClassName="text-primary"
          className="border-l-4 border-l-primary"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gestion des Coûts par Type d&apos;Équipement</CardTitle>
          <CardDescription>
            Cliquez sur une catégorie pour le détail (ticket · mvt · valeur) et les
            totaux.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filtrer par type d'équipement (ex: Computer, Monitor) ou ID…"
              className="pl-9"
            />
          </div>

          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : filteredRows.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Aucun coût trouvé</EmptyTitle>
                <EmptyDescription>
                  {query.trim()
                    ? "Aucun type ne correspond à votre recherche."
                    : "Fermez des tickets Kanban avec un super coût ou synchronisez GLPI."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>Type Équipement</TableHead>
                  <TableHead className="text-right">Quantité (Unique)</TableHead>
                  <TableHead className="text-right">Interventions</TableHead>
                  <TableHead className="text-right">GLPI (€)</TableHead>
                  <TableHead className="text-right">SuperPrice (€)</TableHead>
                  <TableHead className="text-right">Réouverture (€)</TableHead>
                  <TableHead className="text-right">Total (€)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => {
                  const Icon = ITEM_ICONS[row.item] ?? BoxIcon
                  return (
                    <TableRow
                      key={row.item}
                      className="cursor-pointer"
                      onClick={() => void openDetail(row.item)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className="text-muted-foreground" />
                          <span className="font-medium">{row.item}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.quantity}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className="size-7 justify-center rounded-full p-0 tabular-nums">
                          {row.interventions}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatEuro(row.total_glpi)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sky-600 dark:text-sky-400">
                        {formatEuro(row.total_super_cost)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-amber-600 dark:text-amber-400">
                        {formatEuro(row.total_reopen)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatEuro(row.total)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={selectedItem !== null}
        onOpenChange={(open) => !open && setSelectedItem(null)}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader className="pr-6">
            <DialogTitle>Détail — {selectedItem}</DialogTitle>
            <DialogDescription>
              Mouvements : open / reouverture · cancel · closed
            </DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : detail ? (
            <div className="flex min-w-0 flex-col gap-4">
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">GLPI</p>
                  <p className="tabular-nums">{formatEuro(detail.totals.glpi)}</p>
                </div>
                <div>
                  <p className="text-xs text-sky-600 dark:text-sky-400">SuperPrice</p>
                  <p className="tabular-nums text-sky-600 dark:text-sky-400">
                    {formatEuro(detail.totals.super_cost)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Réouverture
                  </p>
                  <p className="tabular-nums text-amber-600 dark:text-amber-400">
                    {formatEuro(detail.totals.reopen)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="font-semibold tabular-nums">
                    {formatEuro(detail.totals.total)}
                  </p>
                </div>
              </div>
              {detail.movements.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun mouvement Kanban pour cette catégorie.
                </p>
              ) : (
                <div className="min-w-0 overflow-x-auto rounded-md border">
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ticket</TableHead>
                        <TableHead>Mvt</TableHead>
                        <TableHead className="text-right">Valeur</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.movements.map((m) => (
                        <TableRow key={`${m.ticket_id}-${m.mvt}-${m.created_at}`}>
                          <TableCell className="tabular-nums">
                            {m.ticket_id}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px]">
                              {m.mvt}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatEuro(m.valeur)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
