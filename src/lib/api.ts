import { authHeaders } from "@/lib/auth"

const API_BASE = "/api"

async function request<T>(
  path: string,
  options?: RequestInit & { admin?: boolean }
): Promise<T> {
  const headers: HeadersInit = {
    ...(options?.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),
    ...(options?.admin ? authHeaders() : {}),
    ...options?.headers,
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error ?? "Une erreur est survenue")
  }

  return data as T
}

export type Asset = {
  glpi_id: number
  itemtype: string
  name: string | null
  serial: string | null
  location: string | null
  manufacturer: string | null
  model: string | null
  state: string | null
  status_label: string | null
  user_name: string | null
  comment: string | null
  image_path: string | null
}

export type Ticket = {
  id: number
  name: string
  content?: string
  status: number
  type: number
  date: string
  date_mod?: string
}

export type TicketCostFeuille3Row = {
  id: number
  num_ticket: number
  duration_second: number
  time_cost: string
  fixed_cost: number
}

export type ItemCostReportRow = {
  item: string
  quantity: number
  interventions: number
  total_glpi: number
  total_super_cost: number
  total_reopen: number
  total: number
}

/** @deprecated use ItemCostReportRow */
export type ItemCostGroup = ItemCostReportRow

export type ItemCostMovementRow = {
  ticket_id: number
  mvt: string
  valeur: number
  share_cost: number
  created_at: string
}

export type ItemCostDetailReport = {
  item: string
  movements: ItemCostMovementRow[]
  totals: {
    glpi: number
    super_cost: number
    reopen: number
    total: number
  }
}

export type CostImportResult = {
  records: number
  applied: number
  failed: number
  details: {
    ref: string
    ticket_id?: number
    mvt?: string
    valeur?: number
    applied?: boolean
    error?: string
  }[]
}

export type TicketSuperCostSummary = {
  total_cost: number
  item_count: number
  shares: { item_name: string; share_cost: number }[]
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

export type KanbanConfig = {
  colors: {
    new: string
    in_progress: string
    closed: string
  }
  labels_mg: {
    new: string
    in_progress: string
    closed: string
  }
}

export const TICKET_URGENCIES = [
  { value: "Très haute", label: "Très haute" },
  { value: "Haute", label: "Haute" },
  { value: "Moyenne", label: "Moyenne" },
  { value: "Basse", label: "Basse" },
  { value: "Très basse", label: "Très basse" },
] as const

export const TICKET_IMPACTS = [
  { value: "Très haut", label: "Très haut" },
  { value: "Haut", label: "Haut" },
  { value: "Moyen", label: "Moyen" },
  { value: "Bas", label: "Bas" },
  { value: "Très bas", label: "Très bas" },
] as const

const GLPI_PRIORITY_MATRIX: Record<number, Record<number, number>> = {
  1: { 1: 1, 2: 1, 3: 2, 4: 2, 5: 2 },
  2: { 1: 1, 2: 2, 3: 2, 4: 3, 5: 3 },
  3: { 1: 2, 2: 2, 3: 3, 4: 4, 5: 4 },
  4: { 1: 2, 2: 3, 3: 4, 4: 4, 5: 5 },
  5: { 1: 2, 2: 3, 3: 4, 4: 5, 5: 5 },
}

const URGENCY_LEVELS: Record<string, number> = {
  "très basse": 1,
  "tres basse": 1,
  basse: 2,
  moyenne: 3,
  haute: 4,
  "très haute": 5,
  "tres haute": 5,
}

const IMPACT_LEVELS: Record<string, number> = {
  "très bas": 1,
  "tres bas": 1,
  bas: 2,
  moyen: 3,
  haut: 4,
  "très haut": 5,
  "tres haut": 5,
}

const PRIORITY_LABELS: Record<number, string> = {
  1: "Très basse",
  2: "Basse",
  3: "Moyenne",
  4: "Haute",
  5: "Très haute",
  6: "Majeure",
}

export function computeTicketPriorityLabel(urgency: string, impact: string): string {
  const u = URGENCY_LEVELS[urgency.trim().toLowerCase()] ?? 3
  const i = IMPACT_LEVELS[impact.trim().toLowerCase()] ?? 3
  const level = GLPI_PRIORITY_MATRIX[u]?.[i] ?? Math.round((u + i) / 2)
  return PRIORITY_LABELS[level] ?? "Moyenne"
}

export const KANBAN_COLUMNS = [
  {
    statusId: 1,
    label: "New",
    colorKey: "new" as const,
    labelMgKey: "new" as const,
  },
  {
    statusId: 2,
    label: "In progress (assigned)",
    colorKey: "in_progress" as const,
    labelMgKey: "in_progress" as const,
  },
  {
    statusId: 6,
    label: "Closed",
    colorKey: "closed" as const,
    labelMgKey: "closed" as const,
  },
] as const

export function ticketStatusToKanbanId(
  status: string | number,
  statusId?: number
): number {
  if (typeof statusId === "number" && statusId > 0) {
    if (statusId === 1) return 1
    if (statusId === 2 || statusId === 3 || statusId === 4) return 2
    if (statusId === 5 || statusId === 6) return 6
  }

  const normalized = String(status).trim().toLowerCase()
  if (normalized === "1" || normalized === "new" || normalized === "nouveau") {
    return 1
  }
  if (
    normalized === "2" ||
    normalized === "in progress (assigned)" ||
    normalized === "in progress (planned)" ||
    normalized === "pending" ||
    normalized === "processing" ||
    normalized === "planned" ||
    normalized.startsWith("en cours")
  ) {
    return 2
  }
  if (
    normalized === "6" ||
    normalized === "5" ||
    normalized === "closed" ||
    normalized === "clos" ||
    normalized === "fermé" ||
    normalized === "solved" ||
    normalized === "résolu"
  ) {
    return 6
  }

  const numeric = Number(status)
  if (numeric === 1) return 1
  if (numeric === 2 || numeric === 3 || numeric === 4) return 2
  if (numeric === 5 || numeric === 6) return 6
  return 1
}

export type Stats = {
  assets: { total: number; by_type: { itemtype: string; count: number }[] }
  tickets: {
    total: number
    by_status: { label: string; count: number }[]
    by_type: { label: string; count: number }[]
  }
  glpi: { connected: boolean; version: string | null }
}

const ITEMTYPE_LABELS: Record<string, string> = {
  Computer: "Ordinateur",
  Monitor: "Écran",
  Printer: "Imprimante",
}

export function itemtypeLabel(itemtype: string) {
  return ITEMTYPE_LABELS[itemtype] ?? itemtype
}

export const api = {
  authConfig: () =>
    request<{ defaultCode: string }>("/auth/config"),

  verifyCode: (code: string) =>
    request<{ ok: boolean }>("/auth/verify", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  stats: () => request<Stats>("/stats", { admin: true }),

  assets: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v)
    ).toString()
    return request<Asset[]>(`/assets${query ? `?${query}` : ""}`)
  },

  asset: (itemtype: string, id: number) =>
    request<Asset>(`/assets/${itemtype}/${id}`),

  tickets: (limit = 50) =>
    request<TicketFeuille2Row[]>(`/tickets?limit=${limit}&format=feuille2`),

  ticketsRaw: (limit = 50) =>
    request<Ticket[]>(`/tickets?limit=${limit}&format=raw`),

  ticketCosts: (limit = 200) =>
    request<TicketCostFeuille3Row[]>(`/ticket-costs?limit=${limit}`),

  ticket: (id: number) =>
    request<{
      ticket: Ticket & Record<string, unknown>
      linked_items: {
        itemtype: string
        items_id: number
      }[]
    }>(`/tickets/${id}`),

  createTicket: (data: {
    name: string
    content: string
    type?: number
    urgency?: string
    impact?: string
    items: { itemtype: string; items_id: number; name?: string }[]
  }) =>
    request<{
      ticket_id: number
      urgency: string
      impact: string
      priority: string
    }>("/tickets", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  importBundle: (files: {
    feuille1?: File
    feuille2?: File
    feuille3?: File
    images?: File
  }) => {
    const form = new FormData()
    if (files.feuille1) form.append("feuille1", files.feuille1)
    if (files.feuille2) form.append("feuille2", files.feuille2)
    if (files.feuille3) form.append("feuille3", files.feuille3)
    if (files.images) form.append("images", files.images)

    return request<{
      totalRecords: number
      totalCreated: number
      totalUpdated: number
      totalSkipped: number
      summary: unknown
    }>("/admin/import-bundle", { method: "POST", body: form, admin: true })
  },

  resetData: () =>
    request<{ ok: boolean; message: string }>("/reset", {
      method: "POST",
      body: JSON.stringify({ confirm: true }),
      admin: true,
    }),

  sync: () => request<{ synced: number }>("/sync", { method: "POST" }),

  kanbanConfig: () => request<KanbanConfig>("/kanban/config"),

  updateKanbanConfig: (config: Partial<KanbanConfig>) =>
    request<KanbanConfig>("/kanban/config", {
      method: "PUT",
      body: JSON.stringify(config),
      admin: true,
    }),

  itemCosts: () => request<ItemCostReportRow[]>("/item-costs"),

  itemCostDetails: (item: string) =>
    request<ItemCostDetailReport>(
      `/item-costs/${encodeURIComponent(item)}/details`
    ),

  importCostCsv: (file: File) => {
    const form = new FormData()
    form.append("csv", file)
    return request<CostImportResult>("/costs/import", {
      method: "POST",
      body: form,
    })
  },

  ticketSuperCost: (id: number) =>
    request<TicketSuperCostSummary | null>(`/tickets/${id}/super-cost`),

  updateTicketStatus: (
    id: number,
    data: {
      status: number
      comment?: string
      super_cost?: number
      cancel_last_cost?: boolean
      reopen_percent?: number
      items?: string[]
    }
  ) =>
    request<{ ok: boolean; ticket_id: number; status: number }>(
      `/tickets/${id}/status`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      }
    ),

  imageUrl: (filename: string | null) =>
    filename ? `/api/images/${filename.split(/[/\\]/).pop()}` : null,
}
