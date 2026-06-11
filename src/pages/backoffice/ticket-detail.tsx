import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowLeftIcon, LinkIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { api, itemtypeLabel } from "@/lib/api"

export function BackofficeTicketDetailPage() {
  const { id } = useParams()
  const [data, setData] = useState<Awaited<ReturnType<typeof api.ticket>> | null>(
    null
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    api
      .ticket(Number(id))
      .then(setData)
      .finally(() => setLoading(false))
  }, [id])

  const ticket = data?.ticket

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" className="w-fit" asChild>
        <Link to="/backoffice/tickets">
          <ArrowLeftIcon data-icon="inline-start" />
          Retour aux tickets
        </Link>
      </Button>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : !ticket ? (
        <p className="text-muted-foreground">Ticket introuvable.</p>
      ) : (
        <>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Ticket #{ticket.id}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{ticket.name}</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {String(ticket.content ?? "—")}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Informations</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Statut</span>
                  <Badge variant="outline">{String(ticket.status)}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <Badge variant="secondary">{String(ticket.type)}</Badge>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Créé le</span>
                  <span>{String(ticket.date ?? "—").slice(0, 16)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Modifié le</span>
                  <span>{String(ticket.date_mod ?? "—").slice(0, 16)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="text-primary" />
                Éléments associés
              </CardTitle>
              <CardDescription>
                Liens Item_Ticket synchronisés depuis GLPI
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {data?.linked_items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun élément lié à ce ticket.
                </p>
              ) : (
                data?.linked_items.map((item) => (
                  <div
                    key={`${item.itemtype}-${item.items_id}`}
                    className="flex items-center justify-between rounded-lg border px-4 py-3"
                  >
                    <span className="text-sm">
                      {itemtypeLabel(item.itemtype)} #{item.items_id}
                    </span>
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={`http://localhost/glpi/front/${item.itemtype.toLowerCase()}.form.php?id=${item.items_id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Voir dans GLPI
                      </a>
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
