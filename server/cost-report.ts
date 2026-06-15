import { db, getAllAssetsLookup } from "./db.js"
import {
  normalizeItemTypeKey,
  STANDARD_ITEM_TYPES,
} from "./item-types.js"

export type ItemCostReportRow = {
  item: string
  quantity: number
  interventions: number
  total_glpi: number
  total_super_cost: number
  total_reopen: number
  total: number
}

function buildAssetTypeMap() {
  return new Map(
    getAllAssetsLookup()
      .filter((asset) => asset.name)
      .map((asset) => [asset.name!.toLowerCase(), asset.itemtype])
  )
}

function countAssetsByType() {
  const counts = new Map<string, number>()
  for (const asset of getAllAssetsLookup()) {
    const key = normalizeItemTypeKey(asset.itemtype)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

function countKanbanInterventionsByType(assetMap: Map<string, string>) {
  const batches = new Map<string, Set<string>>()
  const rows = db
    .prepare(
      "SELECT ticket_id, item_name, kind, created_at FROM item_super_costs"
    )
    .all() as {
    ticket_id: number
    item_name: string
    kind: string
    created_at: string
  }[]

  for (const row of rows) {
    const key = normalizeItemTypeKey(row.item_name, assetMap)
    const batchKey = `${row.ticket_id}:${row.kind}:${row.created_at}`
    const set = batches.get(key) ?? new Set<string>()
    set.add(batchKey)
    batches.set(key, set)
  }

  return new Map(
    [...batches.entries()].map(([key, set]) => [key, set.size])
  )
}

export function listItemCostsReport(
  glpiByType: Record<string, number> = {},
  glpiInterventionsByType: Record<string, number> = {}
): ItemCostReportRow[] {
  const assetMap = buildAssetTypeMap()
  const assetCounts = countAssetsByType()
  const kanbanInterventions = countKanbanInterventionsByType(assetMap)
  const rows = db
    .prepare("SELECT item_name, share_cost, kind FROM item_super_costs")
    .all() as { item_name: string; share_cost: number; kind: string }[]

  const buckets = new Map<string, { super: number; reopen: number }>()

  for (const row of rows) {
    const key = normalizeItemTypeKey(row.item_name, assetMap)
    const bucket = buckets.get(key) ?? { super: 0, reopen: 0 }
    if (row.kind === "close") bucket.super += Number(row.share_cost) || 0
    if (row.kind === "reopen") bucket.reopen += Number(row.share_cost) || 0
    buckets.set(key, bucket)
  }

  const normalizedGlpi: Record<string, number> = {}
  for (const [label, amount] of Object.entries(glpiByType)) {
    const key = normalizeItemTypeKey(label, assetMap)
    normalizedGlpi[key] = (normalizedGlpi[key] ?? 0) + amount
  }

  const normalizedGlpiInterventions: Record<string, number> = {}
  for (const [label, count] of Object.entries(glpiInterventionsByType)) {
    const key = normalizeItemTypeKey(label, assetMap)
    normalizedGlpiInterventions[key] =
      (normalizedGlpiInterventions[key] ?? 0) + count
  }

  const labels = new Set<string>([
    ...STANDARD_ITEM_TYPES,
    ...buckets.keys(),
    ...Object.keys(normalizedGlpi),
    ...Object.keys(normalizedGlpiInterventions),
  ])

  return [...labels]
    .filter((item) => item !== "Unassigned")
    .sort((a, b) => a.localeCompare(b, "en"))
    .map((item) => {
      const totalGlpi = Math.round((normalizedGlpi[item] ?? 0) * 100) / 100
      const totalSuper =
        Math.round((buckets.get(item)?.super ?? 0) * 100) / 100
      const totalReopen =
        Math.round((buckets.get(item)?.reopen ?? 0) * 100) / 100
      const total = Math.round((totalGlpi + totalSuper + totalReopen) * 100) / 100
      const interventions =
        (kanbanInterventions.get(item) ?? 0) +
        (normalizedGlpiInterventions[item] ?? 0)

      return {
        item,
        quantity: assetCounts.get(item) ?? 0,
        interventions,
        total_glpi: totalGlpi,
        total_super_cost: totalSuper,
        total_reopen: totalReopen,
        total,
      }
    })
    .filter(
      (row) =>
        row.total_glpi > 0 ||
        row.total_super_cost > 0 ||
        row.total_reopen > 0 ||
        row.quantity > 0 ||
        row.interventions > 0
    )
}
