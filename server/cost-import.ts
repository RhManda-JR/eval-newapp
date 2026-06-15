import {
  deleteLastTicketCloseSuperCosts,
  saveItemSuperCosts,
} from "./db.js"
import { fetchTicketRefMap } from "./glpi.js"
import {
  normalizeCostMovement,
  readCostCsvMovement,
  readCostCsvTicketRef,
  readCostCsvValue,
  resolveCostItemNames,
  resolveTicketId,
} from "./cost-items.js"

function parseDecimal(value: string): number {
  return Number(String(value).replace(",", ".").trim()) || 0
}

export type CostImportRowResult = {
  ref: string
  ticket_id?: number
  mvt?: string
  valeur?: number
  applied?: boolean
  error?: string
}

export type CostImportResult = {
  records: number
  applied: number
  failed: number
  details: CostImportRowResult[]
}

export async function applyCostMovementRows(
  rows: Record<string, string>[],
  ticketRefMap: Record<string, number>
): Promise<CostImportResult> {
  const details: CostImportRowResult[] = []
  let applied = 0
  let failed = 0

  for (const row of rows) {
    const ref = readCostCsvTicketRef(row)
    const mvtRaw = readCostCsvMovement(row)
    const valeurRaw = readCostCsvValue(row)
    const mvt = normalizeCostMovement(mvtRaw)

    if (!ref) {
      failed++
      details.push({ ref: "", error: "Ticket manquant" })
      continue
    }

    if (!mvt) {
      failed++
      details.push({
        ref,
        mvt: mvtRaw,
        error: "Mouvement invalide (open/reouverture/cancel/closed)",
      })
      continue
    }

    const ticketId = resolveTicketId(ref, ticketRefMap)
    if (!ticketId) {
      failed++
      details.push({ ref, mvt: mvtRaw, error: "Ticket introuvable" })
      continue
    }

    if (mvt === "cancel") {
      deleteLastTicketCloseSuperCosts(ticketId)
      applied++
      details.push({ ref, ticket_id: ticketId, mvt: "cancel", applied: true })
      continue
    }

    const valeur = parseDecimal(valeurRaw)
    if (valeur <= 0) {
      failed++
      details.push({
        ref,
        ticket_id: ticketId,
        mvt: mvtRaw,
        error: "Valeur requise pour open/reouverture/closed",
      })
      continue
    }

    const items = await resolveCostItemNames(ticketId)
    const kind = mvt === "open" ? "reopen" : "close"
    saveItemSuperCosts(ticketId, items, valeur, kind)
    applied++
    details.push({
      ref,
      ticket_id: ticketId,
      mvt: mvtRaw,
      valeur,
      applied: true,
    })
  }

  return {
    records: rows.length,
    applied,
    failed,
    details,
  }
}

export async function importCostMovementsFromCsv(csvText: string) {
  const { parseCsv } = await import("./import-service.js")
  const rows = parseCsv(csvText)
  const ticketRefMap = await fetchTicketRefMap()
  return applyCostMovementRows(rows, ticketRefMap)
}
