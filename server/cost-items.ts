import { getTicketMirror } from "./db.js"
import { fetchTicketLinkedItemLabels } from "./glpi.js"
import { parseTicketItemsFromContent } from "./ticket-mapper.js"

const ITEMTYPE_LABELS: Record<string, string> = {
  Computer: "Computer",
  Monitor: "Monitor",
  Printer: "Printer",
}

export async function resolveCostItemNames(
  ticketId: number,
  bodyItems: string[] = []
): Promise<string[]> {
  if (bodyItems.length > 0) return bodyItems

  const mirror = getTicketMirror(ticketId)
  if (mirror?.items_json) {
    try {
      const parsed = JSON.parse(mirror.items_json) as unknown
      if (Array.isArray(parsed) && parsed.length > 0) {
        const names = parsed
          .map((entry) => {
            if (typeof entry === "string") return entry.trim()
            if (entry && typeof entry === "object" && "itemtype" in entry) {
              const itemtype = String(
                (entry as { itemtype: string }).itemtype
              )
              return ITEMTYPE_LABELS[itemtype] ?? itemtype
            }
            return ""
          })
          .filter(Boolean)
        if (names.length > 0) return names
      }
    } catch {
      // ignore invalid JSON
    }
  }

  if (mirror?.content) {
    const fromContent = parseTicketItemsFromContent(mirror.content)
    if (fromContent.length > 0) return fromContent
  }

  try {
    const fromGlpi = await fetchTicketLinkedItemLabels(ticketId)
    if (fromGlpi.length > 0) return fromGlpi
  } catch {
    // GLPI indisponible
  }

  return []
}

export function resolveTicketId(
  ref: string,
  ticketRefMap: Record<string, number>
): number | null {
  const trimmed = ref.trim()
  if (!trimmed) return null

  if (ticketRefMap[trimmed]) return ticketRefMap[trimmed]

  const numeric = Number(trimmed)
  if (Number.isFinite(numeric) && numeric > 0) {
    if (ticketRefMap[String(numeric)]) return ticketRefMap[String(numeric)]
    return numeric
  }

  return null
}

export type CostMovement = "close" | "open" | "cancel"

export function normalizeCostMovement(raw: string): CostMovement | null {
  const m = raw.trim().toLowerCase()
  if (["close", "clos", "ferme", "fermé", "closed"].includes(m)) return "close"
  if (["open", "ouvert", "reopen", "réouverture", "reouverture"].includes(m)) {
    return "open"
  }
  if (["cancel", "annule", "annulé", "annulation"].includes(m)) return "cancel"
  return null
}

export function isMovementCostCsv(rows: Record<string, string>[]): boolean {
  if (rows.length === 0) return false
  const keys = new Set(Object.keys(rows[0]))
  const hasMvt =
    keys.has("mvt") || keys.has("mouvement") || keys.has("movement")
  const hasTicket =
    keys.has("ticket") || keys.has("num_ticket") || keys.has("ref_ticket")
  return hasMvt && hasTicket
}

export function readCostCsvTicketRef(row: Record<string, string>) {
  return (row.ticket || row.num_ticket || row.ref_ticket || "").trim()
}

export function readCostCsvMovement(row: Record<string, string>) {
  return (row.mvt || row.mouvement || row.movement || "").trim()
}

export function readCostCsvValue(row: Record<string, string>) {
  return (row.valeur || row.valeure || row.value || "").trim()
}
