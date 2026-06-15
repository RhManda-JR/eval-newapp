import { getAllAssetsLookup } from "./db.js"
import {
  FEUILLE2_STATUS,
  glpiImpactToLabel,
  glpiPriorityToLabel,
  glpiUrgencyToLabel,
  normalizeTicketStatusId,
  TICKET_STATUS,
  TICKET_TYPE,
} from "./glpi.js"

const ITEMTYPE_LABELS: Record<string, string> = {
  Computer: "Ordinateur",
  Monitor: "Moniteur",
  Printer: "Imprimante",
}

export type TicketFeuille2Row = {
  id: number
  ref_ticket: number
  date: string
  heure: string
  type: string
  titre: string
  description: string
  status: string
  status_id: number
  priority: string
  urgency: string
  impact: string
  items: string
  close_comment: string
}

function parseTicketContent(content: string) {
  const lines = String(content || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const description = lines[0] ?? ""
  let date = ""
  let heure = ""
  let priority = ""
  let urgency = ""
  let impact = ""
  let status = ""
  let itemsInline = ""

  for (const line of lines.slice(1)) {
    if (line.startsWith("Date:")) date = line.slice(5).trim()
    else if (line.startsWith("Heure:")) heure = line.slice(6).trim()
    else if (line.startsWith("Urgence:") || line.startsWith("Urgency:")) {
      urgency = line.replace(/^(Urgence|Urgency):\s*/, "").trim()
    } else if (line.startsWith("Impact:")) {
      impact = line.replace(/^Impact:\s*/, "").trim()
    } else if (line.startsWith("Priorité:") || line.startsWith("Priority:")) {
      priority = line.replace(/^(Priorité|Priority):\s*/, "").trim()
    } else if (line.startsWith("Status:") || line.startsWith("Statut:")) {
      status = line.replace(/^(Status|Statut):\s*/, "").trim()
    } else if (line.startsWith("Éléments:") || line.startsWith("Items:")) {
      itemsInline = line.replace(/^(Éléments|Items):\s*/, "").trim()
    }
  }

  return { description, date, heure, priority, urgency, impact, status, itemsInline }
}

export function parseTicketItemsFromContent(content: string): string[] {
  const { itemsInline } = parseTicketContent(content)
  if (!itemsInline) return []
  return itemsInline
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
}

function formatGlpiDate(dateStr: string) {
  if (!dateStr) return ""
  const part = dateStr.slice(0, 10)
  const [y, m, d] = part.split("-")
  if (y && m && d) return `${d}/${m}/${y}`
  return part
}

function formatItemsJson(names: string[]) {
  return JSON.stringify(names)
}

function extractCloseComment(
  content: string,
  solution?: unknown
): string {
  const fromContent = [...String(content || "").matchAll(
    /\[Changement de statut\]\s*(.+)/g
  )]
    .map((match) => match[1]?.trim())
    .filter(Boolean)
    .at(-1)

  const fromSolution = String(solution ?? "").trim()

  return fromSolution || fromContent || ""
}

export function mapTicketsToFeuille2(
  tickets: Record<string, unknown>[],
  links: { tickets_id: number; itemtype: string; items_id: number }[]
) {
  const assetMap = new Map(
    getAllAssetsLookup().map((a) => [`${a.itemtype}:${a.glpi_id}`, a.name ?? ""])
  )

  const linksByTicket = new Map<
    number,
    { itemtype: string; items_id: number }[]
  >()

  for (const link of links) {
    const ticketId = Number(link.tickets_id)
    if (!ticketId) continue

    const list = linksByTicket.get(ticketId) ?? []
    list.push({
      itemtype: String(link.itemtype),
      items_id: Number(link.items_id),
    })
    linksByTicket.set(ticketId, list)
  }

  return tickets.map((ticket) => {
    const id = Number(ticket.id)
    const content = parseTicketContent(String(ticket.content ?? ""))
    const ticketLinks = linksByTicket.get(id) ?? []

    const linkedNames = ticketLinks
      .map((link) => {
        const assetName = assetMap.get(`${link.itemtype}:${link.items_id}`)
        if (assetName) return assetName
        return ITEMTYPE_LABELS[link.itemtype] ?? link.itemtype
      })
      .filter((name): name is string => Boolean(name))

    const itemsFromContent = content.itemsInline
      ? content.itemsInline
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : []

    const itemNames = linkedNames.length > 0 ? linkedNames : itemsFromContent
    const glpiDate = String(ticket.date ?? "")
    const statusId = normalizeTicketStatusId(ticket.status)
    const status =
      FEUILLE2_STATUS[statusId] ||
      TICKET_STATUS[statusId] ||
      content.status ||
      "New"
    const closeComment = extractCloseComment(
      String(ticket.content ?? ""),
      ticket.solution
    )

    return {
      id,
      ref_ticket: id,
      date: content.date || formatGlpiDate(glpiDate),
      heure: content.heure || (glpiDate.length >= 16 ? glpiDate.slice(11, 16) : ""),
      type: TICKET_TYPE[Number(ticket.type)] ?? String(ticket.type ?? ""),
      titre: String(ticket.name ?? ""),
      description: content.description,
      status,
      status_id: statusId,
      priority:
        content.priority ||
        glpiPriorityToLabel(ticket.priority) ||
        "Moyenne",
      urgency:
        content.urgency ||
        glpiUrgencyToLabel(ticket.urgency) ||
        "Moyenne",
      impact:
        content.impact || glpiImpactToLabel(ticket.impact) || "Moyen",
      items: formatItemsJson(itemNames),
      close_comment: status === "Closed" ? closeComment : "",
    } satisfies TicketFeuille2Row
  })
}
