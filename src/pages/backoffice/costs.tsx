import { useEffect, useState } from "react"
import { ExternalLinkIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { api, type TicketCostFeuille3Row } from "@/lib/api"
import { resolveGlpiTicketsListUrl } from "@/lib/glpi-links"
import { cn } from "@/lib/utils"

const COLUMNS = [
  { key: "num_ticket", label: "Num_Ticket", className: "min-w-[6.5rem]" },
  {
    key: "duration_second",
    label: "Duration_second",
    className: "min-w-[7.5rem]",
  },
  { key: "time_cost", label: "Time_Cost", className: "min-w-[6rem]" },
  { key: "fixed_cost", label: "Fixed_Cost", className: "min-w-[6.5rem]" },
] as const

function cellValue(
  row: TicketCostFeuille3Row,
  key: (typeof COLUMNS)[number]["key"]
) {
  if (key === "time_cost") return String(row.time_cost ?? "")
  return String(row[key] ?? "")
}

export function BackofficeCostsPage() {
  const [costs, setCosts] = useState<TicketCostFeuille3Row[]>([])
  const [loading, setLoading] = useState(true)
  const [glpiTicketsUrl, setGlpiTicketsUrl] = useState<string | null>(null)

  useEffect(() => {
    api.ticketCosts(200).then(setCosts).finally(() => setLoading(false))
    resolveGlpiTicketsListUrl().then(setGlpiTicketsUrl)
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Coûts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Coûts synchronisés depuis GLPI.
          </p>
        </div>
        {glpiTicketsUrl ? (
          <Button asChild variant="outline" className="shrink-0">
            <a href={glpiTicketsUrl} target="_blank" rel="noreferrer">
              <ExternalLinkIcon data-icon="inline-start" />
              Voir dans GLPI
            </a>
          </Button>
        ) : null}
      </div>

      <Card className="overflow-hidden p-0">
        <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/30 px-4 py-3">
          <CardTitle className="text-base">
            {loading ? "…" : costs.length} coût(s)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4">
              <Skeleton className="h-48 w-full" />
            </div>
          ) : costs.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Aucun coût. Importez les coûts depuis le backoffice.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] border-collapse text-[13px]">
                <thead>
                  <tr className="bg-[#f3f3f3] text-left">
                    {COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        className={cn(
                          "border-b border-border px-3 py-2 font-semibold text-foreground",
                          col.className
                        )}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {costs.map((row, index) => (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-b border-border/70 hover:bg-primary/5",
                        index % 2 === 1 && "bg-muted/20"
                      )}
                    >
                      {COLUMNS.map((col) => {
                        const value = cellValue(row, col.key) || "—"

                        return (
                          <td
                            key={col.key}
                            className={cn(
                              "whitespace-nowrap px-3 py-1.5 text-foreground",
                              col.key !== "num_ticket" &&
                                "font-mono text-xs tabular-nums"
                            )}
                          >
                            {value}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
