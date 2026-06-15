export const STANDARD_ITEM_TYPES = ["Computer", "Monitor", "Printer"] as const

const ALIAS_TO_TYPE: Record<string, string> = {
  computer: "Computer",
  ordinateur: "Computer",
  monitor: "Monitor",
  moniteur: "Monitor",
  printer: "Printer",
  imprimante: "Printer",
}

/** Clé canonique pour regrouper les coûts (Computer, Monitor, …). */
export function normalizeItemTypeKey(
  name: string,
  assetMap?: Map<string, string>
): string {
  const trimmed = name.trim()
  if (!trimmed || trimmed === "—") return "Unassigned"

  const alias = ALIAS_TO_TYPE[trimmed.toLowerCase()]
  if (alias) return alias

  if ((STANDARD_ITEM_TYPES as readonly string[]).includes(trimmed)) {
    return trimmed
  }

  const itemtype = assetMap?.get(trimmed.toLowerCase())
  if (itemtype) return normalizeItemTypeKey(itemtype)

  return trimmed
}
