import { useEffect, useState } from "react"
import { Loader2Icon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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

function formatEuro(value: number) {
  return `${value.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`
}

export function ImportCostsPage() {
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [rows, setRows] = useState<ItemCostReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  const [detail, setDetail] = useState<ItemCostDetailReport | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  async function loadCosts() {
    setRows(await api.itemCosts())
  }

  useEffect(() => {
    loadCosts()
      .catch(() => toast.error("Impossible de charger les coûts"))
      .finally(() => setLoading(false))
  }, [])

  async function handleImport() {
    if (!importFile) {
      toast.error("Sélectionnez un CSV")
      return
    }
    setImportLoading(true)
    try {
      const result = await api.importCostCsv(importFile)
      toast.success(`${result.applied} ligne(s) importée(s)`)
      setImportFile(null)
      await loadCosts()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import échoué")
    } finally {
      setImportLoading(false)
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
      <h1 className="text-2xl font-semibold tracking-tight">Import</h1>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-sm text-muted-foreground">
            CSV : ticket · mvt · valeur
          </p>
          <Input
            type="file"
            accept=".csv"
            disabled={importLoading}
            onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <Button
          disabled={importLoading}
          onClick={() => void handleImport()}
          className="shrink-0"
        >
          {importLoading ? (
            <Loader2Icon className="animate-spin" data-icon="inline-start" />
          ) : null}
          Importer
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-32 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun coût.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Catégorie</TableHead>
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
                <TableCell className="text-right font-medium tabular-nums">
                  {formatEuro(row.total)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog
        open={selectedItem !== null}
        onOpenChange={(open) => !open && setSelectedItem(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedItem}
              {detail ? ` — ${formatEuro(detail.totals.total)}` : ""}
            </DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : detail && detail.movements.length > 0 ? (
            <Table>
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
                    <TableCell>{m.ticket_id}</TableCell>
                    <TableCell>{m.mvt}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatEuro(m.valeur)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune ligne.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
