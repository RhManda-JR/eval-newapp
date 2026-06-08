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
    items: { itemtype: string; items_id: number; name?: string }[]
  }) =>
    request<{ ticket_id: number }>("/tickets", {
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

  imageUrl: (filename: string | null) =>
    filename ? `/api/images/${filename.split(/[/\\]/).pop()}` : null,
}
