import { useEffect, useState } from "react"
import { ExternalLinkIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  api,
  type ItemCostGroup,
  type TicketCostFeuille3Row,
} from "@/lib/api"
import { resolveGlpiTicketsListUrl } from "@/lib/glpi-links"

const GLPI_COLUMNS = [
  { key: "num_ticket", label: "Num_Ticket" },
  { key: "duration_second", label: "Duration_second" },
  { key: "time_cost", label: "Time_Cost" },
  { key: "fixed_cost", label: "Fixed_Cost" },
] as const

function formatAmount(value: number) {
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function glpiCellValue(
  row: TicketCostFeuille3Row,
  key: (typeof GLPI_COLUMNS)[number]["key"]
) {
  if (key === "time_cost") return String(row.time_cost ?? "")
  return String(row[key] ?? "")
}

export function BackofficeCostsPage() {
  const [glpiCosts, setGlpiCosts] = useState<TicketCostFeuille3Row[]>([])
  const [itemCosts, setItemCosts] = useState<ItemCostGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [glpiTicketsUrl, setGlpiTicketsUrl] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([api.ticketCosts(200), api.itemCosts(), resolveGlpiTicketsListUrl()])
      .then(([costs, groups, url]) => {
        setGlpiCosts(costs)
        setItemCosts(groups)
        setGlpiTicketsUrl(url)
      })
      .finally(() => setLoading(false))
  }, [])

  const superTotal = itemCosts.reduce((sum, row) => sum + row.total_cost, 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Coûts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Super coûts SQLite et coûts GLPI.
          </p>
        </div>
        {glpiTicketsUrl ? (
          <Button asChild variant="outline">
            <a href={glpiTicketsUrl} target="_blank" rel="noreferrer">
              <ExternalLinkIcon data-icon="inline-start" />
              Voir dans GLPI
            </a>
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Super coûts / vidiny vaovao</CardTitle>
          <CardDescription>
            {loading
              ? "Chargement…"
              : `${itemCosts.length} élément(s) — total ${formatAmount(superTotal)}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : itemCosts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun super coût. Fermez un ticket depuis le Kanban avec un montant
              saisi.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4 font-medium">Item</th>
                  <th className="py-2 pr-4 font-medium">Vidiny vaovao</th>
                  <th className="py-2 pr-4 font-medium">Coût total</th>
                  <th className="py-2 font-medium">Tickets</th>
                </tr>
              </thead>
              <tbody>
                {itemCosts.map((row) => (
                  <tr key={row.item_name} className="border-b">
                    <td className="py-2 pr-4">{row.item_name}</td>
                    <td className="py-2 pr-4">{formatAmount(row.last_share)}</td>
                    <td className="py-2 pr-4">{formatAmount(row.total_cost)}</td>
                    <td className="py-2">{row.entry_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Coûts GLPI — {loading ? "…" : `${glpiCosts.length} coût(s)`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : glpiCosts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun coût GLPI. Importez les coûts depuis le backoffice.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  {GLPI_COLUMNS.map((col) => (
                    <th key={col.key} className="py-2 pr-4 font-medium">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {glpiCosts.map((row) => (
                  <tr key={row.id} className="border-b">
                    {GLPI_COLUMNS.map((col) => (
                      <td key={col.key} className="py-2 pr-4">
                        {glpiCellValue(row, col.key) || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
