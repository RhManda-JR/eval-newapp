import { db, getAllAssetsLookup } from "./db.js"

const ITEMTYPE_LABELS: Record<string, string> = {
  Computer: "Ordinateur",
  Monitor: "Moniteur",
  Printer: "Imprimante",
}

export type ItemCostReportRow = {
  item: string
  total_glpi: number
  total_super_cost: number
  total_reopen: number
}

function buildAssetTypeMap() {
  return new Map(
    getAllAssetsLookup()
      .filter((asset) => asset.name)
      .map((asset) => [asset.name!.toLowerCase(), asset.itemtype])
  )
}

function itemNameToLabel(itemName: string, assetMap: Map<string, string>) {
  if (itemName === "—") return "Autre"
  const itemtype = assetMap.get(itemName.toLowerCase())
  if (!itemtype) return itemName
  return ITEMTYPE_LABELS[itemtype] ?? itemtype
}

export function listItemCostsReport(
  glpiByType: Record<string, number> = {}
): ItemCostReportRow[] {
  const assetMap = buildAssetTypeMap()
  const rows = db
    .prepare("SELECT item_name, share_cost, kind FROM item_super_costs")
    .all() as { item_name: string; share_cost: number; kind: string }[]

  const buckets = new Map<string, { super: number; reopen: number }>()

  for (const row of rows) {
    const label = itemNameToLabel(row.item_name, assetMap)
    const bucket = buckets.get(label) ?? { super: 0, reopen: 0 }
    if (row.kind === "close") bucket.super += Number(row.share_cost) || 0
    if (row.kind === "reopen") bucket.reopen += Number(row.share_cost) || 0
    buckets.set(label, bucket)
  }

  const labels = new Set([
    ...buckets.keys(),
    ...Object.keys(glpiByType),
    "Ordinateur",
    "Moniteur",
  ])

  return [...labels]
    .filter((label) => label !== "Autre")
    .sort((a, b) => a.localeCompare(b, "fr"))
    .map((item) => ({
      item,
      total_glpi: Math.round((glpiByType[item] ?? 0) * 100) / 100,
      total_super_cost:
        Math.round((buckets.get(item)?.super ?? 0) * 100) / 100,
      total_reopen: Math.round((buckets.get(item)?.reopen ?? 0) * 100) / 100,
    }))
    .filter(
      (row) =>
        row.total_glpi > 0 || row.total_super_cost > 0 || row.total_reopen > 0
    )
}
