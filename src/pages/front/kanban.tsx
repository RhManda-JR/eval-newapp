import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { GripVerticalIcon, Loader2Icon, PlusIcon } from "lucide-react"
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import {
  api,
  KANBAN_COLUMNS,
  ticketStatusToKanbanId,
  type KanbanConfig,
  type TicketFeuille2Row,
} from "@/lib/api"

type PendingMove = {
  ticket: TicketFeuille2Row
  fromStatus: number
  toStatus: number
}

function parseItems(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as string[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function KanbanPage() {
  const [tickets, setTickets] = useState<TicketFeuille2Row[]>([])
  const [config, setConfig] = useState<KanbanConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [detailTicket, setDetailTicket] = useState<TicketFeuille2Row | null>(null)
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null)
  const [statusComment, setStatusComment] = useState("")

  const loadBoard = useCallback(async () => {
    const [ticketRows, kanbanConfig] = await Promise.all([
      api.tickets(200),
      api.kanbanConfig(),
    ])
    setTickets(ticketRows)
    setConfig(kanbanConfig)
  }, [])

  useEffect(() => {
    loadBoard()
      .catch(() => toast.error("Impossible de charger le tableau Kanban"))
      .finally(() => setLoading(false))
  }, [loadBoard])

  const columns = useMemo(() => {
    return KANBAN_COLUMNS.map((column) => ({
      ...column,
      tickets: tickets.filter(
        (ticket) =>
          ticketStatusToKanbanId(ticket.status, ticket.status_id) ===
          column.statusId
      ),
    }))
  }, [tickets])

  function requiresComment(fromStatus: number, toStatus: number) {
    return toStatus === 6 && fromStatus !== 6
  }

  async function applyStatusChange(
    ticket: TicketFeuille2Row,
    toStatus: number,
    comment?: string
  ) {
    setUpdating(true)
    try {
      await api.updateTicketStatus(ticket.id, { status: toStatus, comment })
      const nextStatus =
        KANBAN_COLUMNS.find((c) => c.statusId === toStatus)?.label ?? ticket.status

      setTickets((prev) =>
        prev.map((row) =>
          row.id === ticket.id
            ? {
                ...row,
                status: nextStatus,
                status_id: toStatus,
                close_comment:
                  toStatus === 6 ? (comment?.trim() ?? row.close_comment) : "",
              }
            : row
        )
      )
      toast.success("Statut mis à jour")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Mise à jour échouée"
      )
    } finally {
      setUpdating(false)
      setPendingMove(null)
      setStatusComment("")
    }
  }

  function handleDrop(targetStatus: number) {
    if (draggingId == null) return
    const ticket = tickets.find((row) => row.id === draggingId)
    if (!ticket) return

    const fromStatus = ticketStatusToKanbanId(ticket.status, ticket.status_id)
    if (fromStatus === targetStatus) return

    if (requiresComment(fromStatus, targetStatus)) {
      setPendingMove({ ticket, fromStatus, toStatus: targetStatus })
      return
    }

    void applyStatusChange(ticket, targetStatus)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Tableau Kanban
          </h1>
          <p className="text-sm text-muted-foreground">
            Glissez les tickets entre les colonnes pour changer leur statut.
          </p>
        </div>
        <Button asChild>
          <Link to="/ticket/nouveau">
            <PlusIcon data-icon="inline-start" />
            Ajouter 1 ticket
          </Link>
        </Button>
      </div>

      {updating ? (
        <div
          role="status"
          aria-live="polite"
          className="overflow-hidden rounded-lg border bg-background/95 shadow-sm backdrop-blur"
        >
          <div className="h-1 overflow-hidden bg-muted">
            <div className="h-full animate-pulse bg-primary" />
          </div>
          <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 shrink-0 animate-spin text-primary" />
            Mise à jour du statut en cours…
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2Icon className="mr-2 size-5 animate-spin" />
          Chargement…
        </div>
      ) : (
        <div
          className={`grid gap-4 transition-opacity lg:grid-cols-3 ${updating ? "pointer-events-none opacity-60" : ""}`}
        >
          {columns.map((column) => (
            <div
              key={column.statusId}
              className="flex min-h-[28rem] flex-col rounded-xl border p-3"
              style={{
                backgroundColor:
                  config?.colors[column.colorKey] ?? "var(--muted)",
              }}
              onDragOver={(event) => {
                event.preventDefault()
                event.dataTransfer.dropEffect = "move"
              }}
              onDrop={(event) => {
                event.preventDefault()
                handleDrop(column.statusId)
                setDraggingId(null)
              }}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{column.label}</h2>
                  {config ? (
                    <p className="text-xs text-muted-foreground">
                      {config.labels_mg[column.labelMgKey]}
                    </p>
                  ) : null}
                </div>
                <Badge variant="secondary">{column.tickets.length}</Badge>
              </div>

              <div className="flex flex-1 flex-col gap-2">
                {column.tickets.map((ticket) => (
                  <Card
                    key={ticket.id}
                    draggable={!updating}
                    className="cursor-grab shadow-sm active:cursor-grabbing"
                    onDragStart={() => setDraggingId(ticket.id)}
                    onDragEnd={() => setDraggingId(null)}
                    onClick={() => setDetailTicket(ticket)}
                  >
                    <CardHeader className="p-3 pb-1">
                      <CardTitle className="flex items-start gap-2 text-sm">
                        <GripVerticalIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <span className="line-clamp-2">{ticket.titre}</span>
                      </CardTitle>
                      <CardDescription className="text-xs">
                        #{ticket.ref_ticket} · {ticket.type}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 text-xs text-muted-foreground">
                      <p className="line-clamp-2">{ticket.description}</p>
                      {ticket.status === "Closed" && ticket.close_comment ? (
                        <p className="mt-2 line-clamp-2 rounded-md bg-background/70 p-2 text-foreground">
                          <span className="font-medium">Résolution :</span>{" "}
                          {ticket.close_comment}
                        </p>
                      ) : null}
                      <p className="mt-2">
                        {ticket.date} {ticket.heure}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={detailTicket != null}
        onOpenChange={(open) => !open && setDetailTicket(null)}
      >
        <DialogContent className="max-w-lg">
          {detailTicket ? (
            <>
              <DialogHeader>
                <DialogTitle>{detailTicket.titre}</DialogTitle>
                <DialogDescription>
                  Ticket #{detailTicket.ref_ticket}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{detailTicket.status}</Badge>
                  <Badge variant="secondary">{detailTicket.type}</Badge>
                  <Badge>{detailTicket.priority}</Badge>
                </div>
                <p className="whitespace-pre-wrap leading-relaxed">
                  {detailTicket.description}
                </p>
                {detailTicket.status === "Closed" &&
                detailTicket.close_comment ? (
                  <div className="rounded-lg border bg-muted/50 p-3">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Commentaire de résolution
                    </p>
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {detailTicket.close_comment}
                    </p>
                  </div>
                ) : null}
                <p className="text-muted-foreground">
                  {detailTicket.date} · {detailTicket.heure}
                </p>
                {parseItems(detailTicket.items).length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {parseItems(detailTicket.items).map((item) => (
                      <Badge key={item} variant="outline">
                        {item}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingMove != null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingMove(null)
            setStatusComment("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Informations complémentaires</DialogTitle>
            <DialogDescription>
              La fermeture du ticket nécessite un commentaire de résolution.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="status-comment">Commentaire</FieldLabel>
              <Textarea
                id="status-comment"
                value={statusComment}
                onChange={(e) => setStatusComment(e.target.value)}
                placeholder="Décrivez la résolution du ticket…"
                rows={4}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPendingMove(null)
                setStatusComment("")
              }}
            >
              Annuler
            </Button>
            <Button
              disabled={!statusComment.trim() || updating}
              onClick={() => {
                if (!pendingMove) return
                void applyStatusChange(
                  pendingMove.ticket,
                  pendingMove.toStatus,
                  statusComment.trim()
                )
              }}
            >
              {updating ? (
                <Loader2Icon className="animate-spin" data-icon="inline-start" />
              ) : null}
              {updating ? "Mise à jour…" : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
