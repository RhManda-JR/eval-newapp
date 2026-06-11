import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ExternalLinkIcon, EyeIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { api, type TicketFeuille2Row } from "@/lib/api"
import { resolveGlpiTicketsListUrl } from "@/lib/glpi-links"
import { cn } from "@/lib/utils"

const COLUMNS = [
  { key: "ref_ticket", label: "Ref_Ticket", className: "min-w-[4.5rem]" },
  { key: "date", label: "Date", className: "min-w-[5.5rem]" },
  { key: "heure", label: "Heure", className: "min-w-[4rem]" },
  { key: "type", label: "Type", className: "min-w-[5.5rem]" },
  { key: "titre", label: "Titre", className: "min-w-[9rem]" },
  { key: "description", label: "Description", className: "min-w-[12rem]" },
  { key: "status", label: "Status", className: "min-w-[5.5rem]" },
  { key: "priority", label: "Priority", className: "min-w-[5.5rem]" },
  { key: "items", label: "Items", className: "min-w-[8rem]" },
] as const

function cellValue(
  ticket: TicketFeuille2Row,
  key: (typeof COLUMNS)[number]["key"]
) {
  return String(ticket[key] ?? "")
}

export function BackofficeTicketsPage() {
  const [tickets, setTickets] = useState<TicketFeuille2Row[]>([])
  const [loading, setLoading] = useState(true)
  const [glpiTicketsUrl, setGlpiTicketsUrl] = useState<string | null>(null)

  useEffect(() => {
    api.tickets(100).then(setTickets).finally(() => setLoading(false))
    resolveGlpiTicketsListUrl().then(setGlpiTicketsUrl)
  }, [])

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tickets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Liste synchronisée depuis GLPI.
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

      <Card className="min-w-0 max-w-full overflow-hidden p-0">
        <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/30 px-4 py-3">
          <CardTitle className="text-base">
            {loading ? "…" : tickets.length} ticket(s)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4">
              <Skeleton className="h-48 w-full" />
            </div>
          ) : tickets.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Aucun ticket. Importez les tickets depuis le backoffice.
            </p>
          ) : (
            <div className="max-h-[min(32rem,calc(100vh-14rem))] max-w-full overflow-auto">
              <table className="w-full min-w-[58rem] border-collapse text-[13px]">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#f3f3f3] text-left shadow-[0_1px_0_0_var(--border)]">
                    {COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        className={cn(
                          "border-b border-border bg-[#f3f3f3] px-3 py-2.5 font-semibold text-foreground",
                          col.className
                        )}
                      >
                        {col.label}
                      </th>
                    ))}
                    <th className="min-w-[4.5rem] border-b border-border bg-[#f3f3f3] px-3 py-2.5 font-semibold">
                      Fiche
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket, index) => (
                    <tr
                      key={ticket.id}
                      className={cn(
                        "border-b border-border/70 align-top hover:bg-primary/5",
                        index % 2 === 1 && "bg-muted/20"
                      )}
                    >
                      {COLUMNS.map((col) => {
                        const value = cellValue(ticket, col.key) || "—"

                        if (col.key === "status") {
                          return (
                            <td key={col.key} className="px-3 py-2">
                              <Badge variant="outline" className="font-normal">
                                {value}
                              </Badge>
                            </td>
                          )
                        }

                        if (col.key === "items") {
                          return (
                            <td
                              key={col.key}
                              className="break-all px-3 py-2 font-mono text-xs leading-relaxed text-foreground"
                            >
                              {value}
                            </td>
                          )
                        }

                        return (
                          <td
                            key={col.key}
                            className={cn(
                              "px-3 py-2 text-foreground",
                              col.key === "titre" &&
                                "font-medium leading-snug break-words",
                              col.key === "description" &&
                                "leading-snug break-words text-muted-foreground",
                              col.key !== "titre" &&
                                col.key !== "description" &&
                                "whitespace-nowrap"
                            )}
                          >
                            {value}
                          </td>
                        )
                      })}
                      <td className="px-3 py-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/backoffice/tickets/${ticket.id}`}>
                            <EyeIcon data-icon="inline-start" />
                            Voir
                          </Link>
                        </Button>
                      </td>
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
