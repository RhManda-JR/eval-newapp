import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { Loader2Icon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { cn } from "@/lib/utils"

type PendingMove = {
  ticket: TicketFeuille2Row
  fromStatus: number
  toStatus: number
}

const COLUMN_DISPLAY_LABELS: Record<number, string> = {
  1: "Nouveau",
  2: "In progress",
  6: "Terminé",
}

const DEFAULT_LABELS_MG = {
  new: "vaovao",
  in_progress: "efa manao",
  closed: "vita",
} as const

const DEFAULT_COLUMN_COLORS = {
  new: "#dbeafe",
  in_progress: "#ffedd5",
  closed: "#dcfce7",
} as const

function parseItems(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as string[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function ticketCardLabel(ticket: TicketFeuille2Row) {
  return ticket.titre.trim() || `Ticket ${ticket.ref_ticket}`
}

function ticketDragId(ticketId: number) {
  return `ticket-${ticketId}`
}

function columnDropId(statusId: number) {
  return `column-${statusId}`
}

type KanbanCardViewProps = {
  ticket: TicketFeuille2Row
  isOverlay?: boolean
  className?: string
}

function KanbanCardView({ ticket, isOverlay = false, className }: KanbanCardViewProps) {
  return (
    <div
      className={cn(
        "rounded-xl bg-white px-4 py-3 text-sm font-medium text-foreground shadow-sm",
        isOverlay
          ? "scale-[1.03] rotate-1 cursor-grabbing shadow-xl ring-1 ring-black/5"
          : className
      )}
    >
      {ticketCardLabel(ticket)}
    </div>
  )
}

type KanbanCardProps = {
  ticket: TicketFeuille2Row
  isDragging?: boolean
  onOpen: (ticket: TicketFeuille2Row) => void
}

function KanbanCard({ ticket, isDragging = false, onOpen }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: ticketDragId(ticket.id),
    data: { ticket },
  })

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="rounded-xl border-2 border-dashed border-white/70 bg-white/25 px-4 py-3 shadow-none"
        aria-hidden
      >
        <span className="invisible text-sm font-medium">
          {ticketCardLabel(ticket)}
        </span>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      className="touch-none cursor-grab rounded-xl bg-white px-4 py-3 text-sm font-medium text-foreground shadow-sm transition-[box-shadow,transform,opacity] duration-200 hover:shadow-md active:cursor-grabbing"
      onClick={() => onOpen(ticket)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpen(ticket)
        }
      }}
    >
      {ticketCardLabel(ticket)}
    </div>
  )
}

type KanbanColumnProps = {
  statusId: number
  displayLabel: string
  malagasyLabel: string
  color: string
  tickets: TicketFeuille2Row[]
  activeTicketId: number | null
  onOpen: (ticket: TicketFeuille2Row) => void
  showAddButton?: boolean
}

function KanbanColumn({
  statusId,
  displayLabel,
  malagasyLabel,
  color,
  tickets,
  activeTicketId,
  onOpen,
  showAddButton,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: columnDropId(statusId),
    data: { statusId },
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[26rem] flex-col rounded-2xl p-4 shadow-sm transition-[box-shadow,transform] duration-200",
        isOver && "scale-[1.01] shadow-md ring-2 ring-white/80 ring-offset-2"
      )}
      style={{ backgroundColor: color }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{displayLabel}</h2>
          <p className="text-sm font-medium text-foreground/75">{malagasyLabel}</p>
        </div>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/70 text-xs font-medium text-foreground/80 shadow-sm">
          {tickets.length}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        {tickets.map((ticket) => (
          <KanbanCard
            key={ticket.id}
            ticket={ticket}
            isDragging={activeTicketId === ticket.id}
            onOpen={onOpen}
          />
        ))}
      </div>

      {showAddButton ? (
        <Button
          asChild
          variant="ghost"
          className="mt-4 h-10 w-full justify-center rounded-xl bg-white/60 text-sm font-normal text-foreground shadow-sm hover:bg-white/80"
        >
          <Link to="/ticket/nouveau">
            <PlusIcon data-icon="inline-start" />
            Ajouter 1 ticket
          </Link>
        </Button>
      ) : null}
    </div>
  )
}

export function KanbanPage() {
  const [tickets, setTickets] = useState<TicketFeuille2Row[]>([])
  const [config, setConfig] = useState<KanbanConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTicket, setActiveTicket] = useState<TicketFeuille2Row | null>(null)
  const [detailTicket, setDetailTicket] = useState<TicketFeuille2Row | null>(null)
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null)
  const [statusComment, setStatusComment] = useState("")

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  )

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
      displayLabel: COLUMN_DISPLAY_LABELS[column.statusId] ?? column.label,
      malagasyLabel:
        config?.labels_mg[column.labelMgKey]?.trim() ||
        DEFAULT_LABELS_MG[column.labelMgKey],
      tickets: tickets.filter(
        (ticket) =>
          ticketStatusToKanbanId(ticket.status, ticket.status_id) ===
          column.statusId
      ),
    }))
  }, [tickets, config])

  function columnColor(colorKey: keyof KanbanConfig["colors"]) {
    return config?.colors[colorKey] ?? DEFAULT_COLUMN_COLORS[colorKey]
  }

  function requiresComment(fromStatus: number, toStatus: number) {
    return toStatus === 6 && fromStatus !== 6
  }

  function applyStatusChangeOptimistic(
    ticket: TicketFeuille2Row,
    toStatus: number,
    comment?: string
  ) {
    const previousTickets = tickets
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

    void api
      .updateTicketStatus(ticket.id, { status: toStatus, comment })
      .catch((error) => {
        setTickets(previousTickets)
        toast.error(
          error instanceof Error ? error.message : "Mise à jour échouée"
        )
      })
  }

  function handleDragStart(event: DragStartEvent) {
    const ticket = event.active.data.current?.ticket as
      | TicketFeuille2Row
      | undefined
    if (ticket) setActiveTicket(ticket)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTicket(null)

    const ticket = event.active.data.current?.ticket as
      | TicketFeuille2Row
      | undefined
    const targetStatus = event.over?.data.current?.statusId as
      | number
      | undefined

    if (!ticket || targetStatus == null) return

    const fromStatus = ticketStatusToKanbanId(ticket.status, ticket.status_id)
    if (fromStatus === targetStatus) return

    if (requiresComment(fromStatus, targetStatus)) {
      setPendingMove({ ticket, fromStatus, toStatus: targetStatus })
      return
    }

    applyStatusChangeOptimistic(ticket, targetStatus)
  }

  function handleDragCancel() {
    setActiveTicket(null)
  }

  function confirmCloseTicket() {
    if (!pendingMove || !statusComment.trim()) return

    applyStatusChangeOptimistic(
      pendingMove.ticket,
      pendingMove.toStatus,
      statusComment.trim()
    )
    setPendingMove(null)
    setStatusComment("")
  }

  return (
    <div className="flex flex-col gap-4">
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2Icon className="mr-2 size-5 animate-spin" />
          Chargement…
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="grid gap-5 lg:grid-cols-3">
            {columns.map((column) => (
              <KanbanColumn
                key={column.statusId}
                statusId={column.statusId}
                displayLabel={column.displayLabel}
                malagasyLabel={column.malagasyLabel}
                color={columnColor(column.colorKey)}
                tickets={column.tickets}
                activeTicketId={activeTicket?.id ?? null}
                onOpen={setDetailTicket}
                showAddButton={column.statusId === 1}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.18, 0.67, 0.6, 1)" }}>
            {activeTicket ? (
              <KanbanCardView ticket={activeTicket} isOverlay />
            ) : null}
          </DragOverlay>
        </DndContext>
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
                  <Badge>Urgence : {detailTicket.urgency}</Badge>
                  <Badge>Impact : {detailTicket.impact}</Badge>
                  <Badge>Priorité : {detailTicket.priority}</Badge>
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
              disabled={!statusComment.trim()}
              onClick={confirmCloseTicket}
            >
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
