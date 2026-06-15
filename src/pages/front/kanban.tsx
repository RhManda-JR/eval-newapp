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
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  api,
  KANBAN_COLUMNS,
  ticketStatusToKanbanId,
  type KanbanConfig,
  type TicketFeuille2Row,
  type TicketSuperCostSummary,
} from "@/lib/api"
import { cn } from "@/lib/utils"

type PendingMove = {
  ticket: TicketFeuille2Row
  fromStatus: number
  toStatus: number
}

type PendingReopen = {
  ticket: TicketFeuille2Row
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
  const [detailSuperCost, setDetailSuperCost] =
    useState<TicketSuperCostSummary | null>(null)
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null)
  const [pendingReopen, setPendingReopen] = useState<PendingReopen | null>(null)
  const [statusComment, setStatusComment] = useState("")
  const [superCost, setSuperCost] = useState("")
  const [cancelLastCost, setCancelLastCost] = useState(false)
  const [reopenPercent, setReopenPercent] = useState("0")
  const [reopenLastCost, setReopenLastCost] =
    useState<TicketSuperCostSummary | null>(null)

  const closeItems = useMemo(
    () => (pendingMove ? parseItems(pendingMove.ticket.items) : []),
    [pendingMove]
  )

  const superCostValue = useMemo(() => {
    const parsed = Number(superCost.replace(",", "."))
    return Number.isFinite(parsed) ? parsed : 0
  }, [superCost])

  const costSplitPreview = useMemo(() => {
    if (superCostValue <= 0) return []
    const count = Math.max(closeItems.length, 1)
    const share = superCostValue / count
    const targets = closeItems.length > 0 ? closeItems : ["—"]
    return targets.map((item) => ({ item, share }))
  }, [closeItems, superCostValue])

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

  useEffect(() => {
    if (!detailTicket) {
      setDetailSuperCost(null)
      return
    }

    api
      .ticketSuperCost(detailTicket.id)
      .then(setDetailSuperCost)
      .catch(() => setDetailSuperCost(null))
  }, [detailTicket])

  useEffect(() => {
    if (!pendingReopen) {
      setReopenLastCost(null)
      return
    }

    api
      .ticketSuperCost(pendingReopen.ticket.id)
      .then(setReopenLastCost)
      .catch(() => setReopenLastCost(null))
  }, [pendingReopen])

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

  function requiresReopenDialog(fromStatus: number, toStatus: number) {
    return fromStatus === 6 && (toStatus === 1 || toStatus === 2)
  }

  const reopenPercentValue = useMemo(() => {
    const parsed = Number(reopenPercent.replace(",", "."))
    return Number.isFinite(parsed) ? parsed : 0
  }, [reopenPercent])

  const reopenCostPreview = useMemo(() => {
    if (!pendingReopen || reopenPercentValue <= 0 || !reopenLastCost) return null
    const total =
      Math.round(reopenLastCost.total_cost * reopenPercentValue) / 100
    if (total <= 0) return null
    const items = parseItems(pendingReopen.ticket.items)
    const count = Math.max(items.length, 1)
    const share = total / count
    const targets = items.length > 0 ? items : ["—"]
    return { total, shares: targets.map((item) => ({ item, share })) }
  }, [pendingReopen, reopenLastCost, reopenPercentValue])

  function applyStatusChangeOptimistic(
    ticket: TicketFeuille2Row,
    toStatus: number,
    options?: {
      comment?: string
      superCost?: number
      cancelLastCost?: boolean
      reopenPercent?: number
    }
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
                toStatus === 6
                  ? (options?.comment?.trim() ?? row.close_comment)
                  : "",
            }
          : row
      )
    )

    void api
      .updateTicketStatus(ticket.id, {
        status: toStatus,
        comment: options?.comment,
        super_cost: options?.superCost,
        cancel_last_cost: options?.cancelLastCost,
        reopen_percent: options?.reopenPercent,
        items: parseItems(ticket.items),
      })
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

    if (requiresReopenDialog(fromStatus, targetStatus)) {
      setPendingReopen({ ticket, toStatus: targetStatus })
      setCancelLastCost(false)
      setReopenPercent("0")
      return
    }

    applyStatusChangeOptimistic(ticket, targetStatus)
  }

  function handleDragCancel() {
    setActiveTicket(null)
  }

  function confirmCloseTicket() {
    if (!pendingMove || !statusComment.trim()) return

    applyStatusChangeOptimistic(pendingMove.ticket, pendingMove.toStatus, {
      comment: statusComment.trim(),
      superCost: superCostValue > 0 ? superCostValue : undefined,
    })
    setPendingMove(null)
    setStatusComment("")
    setSuperCost("")
  }

  function confirmReopenTicket() {
    if (!pendingReopen) return

    const hasReopenCost = reopenPercentValue > 0 && reopenLastCost != null
    const toStatus = hasReopenCost ? 2 : pendingReopen.toStatus

    applyStatusChangeOptimistic(pendingReopen.ticket, toStatus, {
      cancelLastCost,
      reopenPercent: hasReopenCost ? reopenPercentValue : undefined,
    })
    setPendingReopen(null)
    setCancelLastCost(false)
    setReopenPercent("0")
  }

  function formatAmount(value: number) {
    return value.toLocaleString("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
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
                {detailSuperCost ? (
                  <div className="rounded-lg border bg-muted/50 p-3">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      Super coût / vidiny vaovao
                    </p>
                    <p className="font-semibold">
                      {formatAmount(detailSuperCost.total_cost)}
                    </p>
                    {detailSuperCost.shares.length > 1 ? (
                      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                        {detailSuperCost.shares.map((share) => (
                          <li key={share.item_name}>
                            {share.item_name} — {formatAmount(share.share_cost)}
                          </li>
                        ))}
                      </ul>
                    ) : null}
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
            setSuperCost("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fermeture du ticket</DialogTitle>
            <DialogDescription>
              Commentaire de résolution et super coût (vidiny vaovao) enregistré
              dans SQLite, réparti entre les éléments liés.
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
            <Field>
              <FieldLabel htmlFor="super-cost">
                Super coût / vidiny vaovao
              </FieldLabel>
              <Input
                id="super-cost"
                type="number"
                min="0"
                step="0.01"
                value={superCost}
                onChange={(e) => setSuperCost(e.target.value)}
                placeholder="Ex : 150000"
              />
            </Field>
            {costSplitPreview.length > 0 ? (
              <div className="text-sm text-muted-foreground">
                <p className="mb-1">
                  Répartition — total {formatAmount(superCostValue)}
                </p>
                <ul>
                  {costSplitPreview.map((row) => (
                    <li key={row.item}>
                      {row.item} : {formatAmount(row.share)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </FieldGroup>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPendingMove(null)
                setStatusComment("")
                setSuperCost("")
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

      <Dialog
        open={pendingReopen != null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingReopen(null)
            setCancelLastCost(false)
            setReopenPercent("0")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réouverture du ticket</DialogTitle>
            <DialogDescription>
              {pendingReopen
                ? `Vers ${
                    pendingReopen.toStatus === 1 ? "Nouveau" : "En cours"
                  } — gestion du dernier super coût.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            {reopenLastCost ? (
              <div className="rounded-lg border bg-muted/50 p-3 text-sm">
                <p className="mb-1 text-muted-foreground">
                  Dernier super coût
                </p>
                <p className="font-semibold">
                  {formatAmount(reopenLastCost.total_cost)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aucun super coût de fermeture enregistré.
              </p>
            )}
            <Field orientation="horizontal">
              <Checkbox
                id="cancel-last-cost"
                checked={cancelLastCost}
                disabled={!reopenLastCost}
                onCheckedChange={(checked) =>
                  setCancelLastCost(checked === true)
                }
              />
              <FieldLabel htmlFor="cancel-last-cost">
                Annuler le dernier coût
              </FieldLabel>
            </Field>
            <Field>
              <FieldLabel htmlFor="reopen-percent">
                Pourcentage réouverture (%)
              </FieldLabel>
              <Input
                id="reopen-percent"
                type="number"
                min="0"
                max="100"
                step="1"
                value={reopenPercent}
                disabled={!reopenLastCost}
                onChange={(e) => setReopenPercent(e.target.value)}
                placeholder="Ex : 10"
              />
            </Field>
            {reopenCostPreview ? (
              <div className="text-sm text-muted-foreground">
                <p className="mb-1">
                  Coût réouverture ({reopenPercentValue}%) — total{" "}
                  {formatAmount(reopenCostPreview.total)} → statut En cours
                </p>
                <ul>
                  {reopenCostPreview.shares.map((row) => (
                    <li key={row.item}>
                      {row.item} : {formatAmount(row.share)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </FieldGroup>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPendingReopen(null)
                setCancelLastCost(false)
                setReopenPercent("0")
              }}
            >
              Annuler
            </Button>
            <Button onClick={confirmReopenTicket}>Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
