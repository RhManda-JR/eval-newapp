import { useEffect, useState } from "react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
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
import { toast } from "sonner"

function formatEuro(value: number) {
  return `${value.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`
}

export function ItemCostsPage() {
  const [rows, setRows] = useState<ItemCostReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  const [detail, setDetail] = useState<ItemCostDetailReport | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  async function loadCosts() {
    const data = await api.itemCosts()
    setRows(data)
  }

  useEffect(() => {
    loadCosts()
      .catch(() => toast.error("Impossible de charger les coûts"))
      .finally(() => setLoading(false))
  }, [])

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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Coûts par item</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cliquez sur une catégorie pour voir le détail des mouvements (ticket ·
          mvt · valeur).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {loading ? "…" : `${rows.length} catégorie(s)`}
          </CardTitle>
          <CardDescription>
            open / reouverture · cancel · closed
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun coût enregistré.               Importez un CSV depuis la page{" "}
              <Link to="/import" className="underline underline-offset-2">
                Import
              </Link>
              .
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Catégorie</TableHead>
                  <TableHead className="text-right">GLPI</TableHead>
                  <TableHead className="text-right">SuperPrice</TableHead>
                  <TableHead className="text-right">Réouverture</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.item}
                    className="cursor-pointer"
                    onClick={() => void openDetail(row.item)}
                  >
                    <TableCell className="font-medium">{row.item}</TableCell>
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
                ))}
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
              Lignes importées ou saisies par ticket.
            </DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <Skeleton className="h-32 w-full" />
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
                  Aucun mouvement pour cette catégorie.
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
