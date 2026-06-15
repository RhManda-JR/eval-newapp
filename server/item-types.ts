export const STANDARD_ITEM_TYPES = ["Computer", "Monitor", "Printer"] as const

export const UNASSIGNED_ITEM_TYPE = "Unassigned"

const ALIAS_TO_TYPE: Record<string, string> = {
  computer: "Computer",
  ordinateur: "Computer",
  monitor: "Monitor",
  moniteur: "Monitor",
  printer: "Printer",
  imprimante: "Printer",
}

export function displayItemTypeLabel(key: string): string {
  return key === UNASSIGNED_ITEM_TYPE ? "Non assigné" : key
}

export function resolveItemTypeInput(label: string): string {
  const trimmed = label.trim()
  if (
    trimmed === "Non assigné" ||
    trimmed === "Non assigne" ||
    trimmed === UNASSIGNED_ITEM_TYPE
  ) {
    return UNASSIGNED_ITEM_TYPE
  }
  return trimmed
}

export function displayMovementLabel(kind: string): string {
  if (kind === "reopen") return "reouverture"
  if (kind === "close") return "closed"
  return kind
}

/** Clé canonique pour regrouper les coûts (Computer, Monitor, …). */
export function normalizeItemTypeKey(
  name: string,
  assetMap?: Map<string, string>
): string {
  const trimmed = name.trim()
  if (!trimmed || trimmed === "—") return UNASSIGNED_ITEM_TYPE

  const alias = ALIAS_TO_TYPE[trimmed.toLowerCase()]
  if (alias) return alias

  if ((STANDARD_ITEM_TYPES as readonly string[]).includes(trimmed)) {
    return trimmed
  }

  const itemtype = assetMap?.get(trimmed.toLowerCase())
  if (itemtype) return normalizeItemTypeKey(itemtype)

  return trimmed
}
