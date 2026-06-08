import { getAllAssetsLookup } from "./db.js"
import { TICKET_STATUS, TICKET_TYPE } from "./glpi.js"

export type TicketFeuille2Row = {
  id: number
  ref_ticket: number
  date: string
  heure: string
  type: string
  titre: string
  description: string
  status: string
  priority: string
  items: string
}

const FEUILLE2_STATUS: Record<number, string> = {
  1: "New",
  2: "Processing",
  3: "Planned",
  4: "Pending",
  5: "Solved",
  6: "Closed",
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
  let status = ""
  let itemsInline = ""

  for (const line of lines.slice(1)) {
    if (line.startsWith("Date:")) date = line.slice(5).trim()
    else if (line.startsWith("Heure:")) heure = line.slice(6).trim()
    else if (line.startsWith("Priorité:") || line.startsWith("Priority:")) {
      priority = line.replace(/^(Priorité|Priority):\s*/, "").trim()
    } else if (line.startsWith("Status:") || line.startsWith("Statut:")) {
      status = line.replace(/^(Status|Statut):\s*/, "").trim()
    } else if (line.startsWith("Éléments:") || line.startsWith("Items:")) {
      itemsInline = line.replace(/^(Éléments|Items):\s*/, "").trim()
    }
  }

  return { description, date, heure, priority, status, itemsInline }
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
      .map((link) =>
        assetMap.get(`${link.itemtype}:${link.items_id}`)
      )
      .filter((name): name is string => Boolean(name))

    const itemsFromContent = content.itemsInline
      ? content.itemsInline
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : []

    const itemNames = linkedNames.length > 0 ? linkedNames : itemsFromContent
    const glpiDate = String(ticket.date ?? "")

    return {
      id,
      ref_ticket: id,
      date: content.date || formatGlpiDate(glpiDate),
      heure: content.heure || (glpiDate.length >= 16 ? glpiDate.slice(11, 16) : ""),
      type: TICKET_TYPE[Number(ticket.type)] ?? String(ticket.type ?? ""),
      titre: String(ticket.name ?? ""),
      description: content.description,
      status:
        content.status ||
        FEUILLE2_STATUS[Number(ticket.status)] ||
        TICKET_STATUS[Number(ticket.status)] ||
        "New",
      priority: content.priority || "Medium",
      items: formatItemsJson(itemNames),
    } satisfies TicketFeuille2Row
  })
}
