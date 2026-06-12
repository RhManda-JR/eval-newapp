import fs from "fs"

import {
  collectTrackedAssetIds,
  getAsset,
  type AssetMirror,
  upsertAssetMirror,
} from "./db.js"
import { getAllSettings } from "./db.js"

type GlpiConfig = { url: string; user: string; password: string }

const ASSET_TYPES = ["Computer", "Monitor", "Printer"] as const
const TICKET_STATUS: Record<number, string> = {
  1: "Nouveau",
  2: "En cours (attribué)",
  3: "En cours (planifié)",
  4: "En attente",
  5: "Résolu",
  6: "Clos",
}
const TICKET_TYPE: Record<number, string> = {
  1: "Incident",
  2: "Demande",
}

const GLPI_URGENCY_LABEL: Record<number, string> = {
  1: "Très basse",
  2: "Basse",
  3: "Moyenne",
  4: "Haute",
  5: "Très haute",
}

const GLPI_IMPACT_LABEL: Record<number, string> = {
  1: "Très bas",
  2: "Bas",
  3: "Moyen",
  4: "Haut",
  5: "Très haut",
}

const TICKET_PRIORITY_LABEL: Record<number, string> = {
  1: "Très basse",
  2: "Basse",
  3: "Moyenne",
  4: "Haute",
  5: "Très haute",
  6: "Majeure",
}

const GLPI_URGENCY_FROM_LABEL: Record<string, number> = {
  "très basse": 1,
  "tres basse": 1,
  "very low": 1,
  basse: 2,
  low: 2,
  moyenne: 3,
  medium: 3,
  haute: 4,
  high: 4,
  "très haute": 5,
  "tres haute": 5,
  "very high": 5,
}

const GLPI_IMPACT_FROM_LABEL: Record<string, number> = {
  "très bas": 1,
  "tres bas": 1,
  "very low": 1,
  bas: 2,
  low: 2,
  moyen: 3,
  medium: 3,
  haut: 4,
  high: 4,
  "très haut": 5,
  "tres haut": 5,
  "very high": 5,
}

const TICKET_PRIORITY_FROM_LABEL: Record<string, number> = {
  ...GLPI_URGENCY_FROM_LABEL,
  bas: 2,
  moyen: 3,
  haut: 4,
  élevé: 4,
  eleve: 4,
  "très haut": 5,
  "tres haut": 5,
  majeure: 6,
  major: 6,
}

function labelToLevel(
  label: string,
  map: Record<string, number>,
  fallback = 3
): number {
  return map[label.trim().toLowerCase()] ?? fallback
}

export function urgencyLabelToLevel(label: string): number {
  return labelToLevel(label, GLPI_URGENCY_FROM_LABEL)
}

export function impactLabelToLevel(label: string): number {
  return labelToLevel(label, GLPI_IMPACT_FROM_LABEL)
}

export function priorityLabelToGlpiLevel(label: string): number {
  return labelToLevel(label, TICKET_PRIORITY_FROM_LABEL)
}

export function glpiUrgencyToLabel(urgency: unknown): string {
  const id = Number(urgency)
  return GLPI_URGENCY_LABEL[id] ?? "Moyenne"
}

export function glpiImpactToLabel(impact: unknown): string {
  const id = Number(impact)
  return GLPI_IMPACT_LABEL[id] ?? "Moyen"
}

export function glpiPriorityToLabel(priority: unknown): string {
  const id = Number(priority)
  return TICKET_PRIORITY_LABEL[id] ?? "Moyenne"
}

export function priorityLevelToUrgencyLabel(level: number): string {
  return GLPI_URGENCY_LABEL[Math.min(Math.max(level, 1), 5)] ?? "Moyenne"
}

export function priorityLevelToImpactLabel(level: number): string {
  return GLPI_IMPACT_LABEL[Math.min(Math.max(level, 1), 5)] ?? "Moyen"
}

/** Libellés attendus dans le fichier d'import Feuille-2. */
const FEUILLE2_STATUS: Record<number, string> = {
  1: "New",
  2: "In progress (assigned)",
  3: "In progress (planned)",
  4: "Pending",
  5: "Solved",
  6: "Closed",
}

function mapImportTicketStatus(raw: string): number {
  const normalized = raw?.trim().toLowerCase() ?? ""

  const statuses: Record<string, number> = {
    new: 1,
    "in progress (assigned)": 2,
    closed: 6,
    // Alias / rétrocompatibilité
    nouveau: 1,
    incoming: 1,
    processing: 2,
    assigned: 2,
    "en cours (attribué)": 2,
    "en cours (assigné)": 2,
    "en cours": 2,
    "in progress": 2,
    planned: 3,
    planifie: 3,
    planifié: 3,
    "in progress (planned)": 3,
    pending: 4,
    "en attente": 4,
    solved: 5,
    resolu: 5,
    résolu: 5,
    clos: 6,
    ferme: 6,
    fermé: 6,
  }

  return statuses[normalized] ?? 1
}

const MODEL_CONFIG: Record<
  string,
  { modelItemtype: string; field: string }
> = {
  Computer: { modelItemtype: "ComputerModel", field: "computermodels_id" },
  Monitor: { modelItemtype: "MonitorModel", field: "monitormodels_id" },
  Printer: { modelItemtype: "PrinterModel", field: "printermodels_id" },
}

class DropdownCache {
  private readonly cache = new Map<string, number>()

  async findOrCreate(
    sessionToken: string,
    url: string,
    itemtype: string,
    name: string | undefined
  ): Promise<number | undefined> {
    const trimmed = name?.trim()
    if (!trimmed) return undefined

    const cacheKey = `${itemtype}:${trimmed.toLowerCase()}`
    const cached = this.cache.get(cacheKey)
    if (cached) return cached

    const headers = {
      "Content-Type": "application/json",
      "Session-Token": sessionToken,
    }

    const searchRes = await fetch(
      `${url}/apirest.php/${itemtype}/?searchText[name]=${encodeURIComponent(trimmed)}`,
      { headers }
    )
    const found = (await searchRes.json()) as { id?: number }[]
    if (Array.isArray(found) && found[0]?.id) {
      const id = Number(found[0].id)
      this.cache.set(cacheKey, id)
      return id
    }

    const createRes = await fetch(`${url}/apirest.php/${itemtype}/`, {
      method: "POST",
      headers,
      body: JSON.stringify({ input: { name: trimmed } }),
    })
    const created = (await createRes.json()) as { id?: number }
    if (createRes.ok && created?.id) {
      const id = Number(created.id)
      this.cache.set(cacheKey, id)
      return id
    }

    return undefined
  }
}

async function findUserByDisplayName(
  sessionToken: string,
  url: string,
  displayName: string | undefined
): Promise<number | undefined> {
  const trimmed = displayName?.trim()
  if (!trimmed) return undefined

  const headers = { "Session-Token": sessionToken }

  for (const field of ["realname", "name"] as const) {
    const response = await fetch(
      `${url}/apirest.php/User/?searchText[${field}]=${encodeURIComponent(trimmed)}`,
      { headers }
    )
    const users = (await response.json()) as { id?: number }[]
    if (Array.isArray(users) && users[0]?.id) {
      return Number(users[0].id)
    }
  }

  return undefined
}

async function buildAssetInput(
  sessionToken: string,
  url: string,
  cache: DropdownCache,
  itemtype: string,
  row: Record<string, string>,
  imageFilename?: string
): Promise<Record<string, unknown>> {
  const input: Record<string, unknown> = {
    name: row.name || row.nom || `ASSET-${Date.now()}`,
    serial: row.inventory_number || row.serial || row["numéro de série"] || "",
    otherserial: row.otherserial || "",
  }

  const stateId = await cache.findOrCreate(sessionToken, url, "State", row.status)
  if (stateId) input.states_id = stateId

  const locationId = await cache.findOrCreate(
    sessionToken,
    url,
    "Location",
    row.location
  )
  if (locationId) input.locations_id = locationId

  const manufacturerId = await cache.findOrCreate(
    sessionToken,
    url,
    "Manufacturer",
    row.manufacturer
  )
  if (manufacturerId) input.manufacturers_id = manufacturerId

  const modelConfig = MODEL_CONFIG[itemtype]
  if (modelConfig?.modelItemtype && row.model) {
    const modelId = await cache.findOrCreate(
      sessionToken,
      url,
      modelConfig.modelItemtype,
      row.model
    )
    if (modelId) input[modelConfig.field] = modelId
  }

  const userId = await findUserByDisplayName(sessionToken, url, row.user)
  if (userId) input.users_id = userId

  const commentParts: string[] = []
  if (imageFilename) commentParts.push(`Image: ${imageFilename}`)
  if (row.comment) commentParts.push(row.comment)
  if (!userId && row.user) commentParts.push(`Utilisateur: ${row.user}`)

  if (commentParts.length > 0) {
    input.comment = commentParts.join(" — ")
  }

  return input
}

function getConfig(): GlpiConfig {
  const settings = getAllSettings()
  return {
    url: settings.glpi_url?.replace(/\/$/, "") ?? "",
    user: settings.glpi_user ?? "glpi",
    password: settings.glpi_password ?? "glpi",
  }
}

function basicAuth(user: string, password: string) {
  return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`
}

export async function initSession() {
  const { url, user, password } = getConfig()
  if (!url) return { ok: false as const, error: "URL GLPI non configurée" }

  try {
    const response = await fetch(`${url}/apirest.php/initSession/`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: basicAuth(user, password),
      },
    })
    const data = (await response.json()) as
      | { session_token: string }
      | [string, string]

    if (!response.ok) {
      return {
        ok: false as const,
        error: Array.isArray(data) ? data[1] : "Échec de connexion",
      }
    }
    if ("session_token" in data) {
      return { ok: true as const, session_token: data.session_token }
    }
    return { ok: false as const, error: "Réponse API inattendue" }
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Erreur réseau",
    }
  }
}

async function withSession<T>(
  fn: (sessionToken: string, url: string) => Promise<T>
): Promise<T> {
  const session = await initSession()
  if (!session.ok || !session.session_token) {
    throw new Error(session.error ?? "Session GLPI invalide")
  }
  const { url } = getConfig()
  try {
    return await fn(session.session_token, url)
  } finally {
    await fetch(`${url}/apirest.php/killSession/`, {
      method: "GET",
      headers: { "Session-Token": session.session_token },
    })
  }
}

async function listAllItems<T extends Record<string, unknown>>(
  sessionToken: string,
  url: string,
  itemtype: string,
  expandDropdowns = true
): Promise<T[]> {
  const items: T[] = []
  const pageSize = 50
  let start = 0

  while (true) {
    const end = start + pageSize - 1
    const expand = expandDropdowns ? "&expand_dropdowns=true" : ""
    const response = await fetch(
      `${url}/apirest.php/${itemtype}/?range=${start}-${end}${expand}`,
      {
        headers: {
          "Content-Type": "application/json",
          "Session-Token": sessionToken,
        },
      }
    )
    const data = (await response.json()) as T[]
    if (!response.ok || !Array.isArray(data) || data.length === 0) break
    items.push(...data)

    const contentRange = response.headers.get("Content-Range")
    if (contentRange) {
      const match = contentRange.match(/\d+-\d+\/(\d+)/)
      if (match && end + 1 >= Number(match[1])) break
    }
    if (data.length < pageSize) break
    start += pageSize
  }

  return items
}

function extractFromComment(comment: string, label: string) {
  const match = comment.match(new RegExp(`${label}:\\s*([^—\\n]+)`))
  return match?.[1]?.trim() ?? ""
}

function labelFromGlpiField(value: unknown): string {
  if (value == null || value === 0 || value === "0") return ""
  if (typeof value === "string") {
    const asNumber = Number(value)
    if (!Number.isNaN(asNumber) && String(asNumber) === value.trim()) return ""
    return value.trim()
  }
  return String(value)
}

function modelLabelFromItem(
  item: Record<string, unknown>,
  itemtype: string
): string {
  const field = MODEL_CONFIG[itemtype]?.field
  if (field) {
    const fromField = labelFromGlpiField(item[field])
    if (fromField) return fromField
  }

  return (
    labelFromGlpiField(item.computermodels_id) ||
    labelFromGlpiField(item.monitormodels_id) ||
    labelFromGlpiField(item.printermodels_id)
  )
}

function mapGlpiItemToMirror(
  item: Record<string, unknown>,
  itemtype: string
): AssetMirror {
  const tracking = getAsset(itemtype, Number(item.id))
  const comment = String(item.comment ?? "")

  const statusLabel =
    labelFromGlpiField(item.states_id) || extractFromComment(comment, "Statut")
  const location =
    labelFromGlpiField(item.locations_id) || extractFromComment(comment, "Lieu")
  const manufacturer =
    labelFromGlpiField(item.manufacturers_id) ||
    extractFromComment(comment, "Fabricant")
  const model =
    modelLabelFromItem(item, itemtype) || extractFromComment(comment, "Modèle")
  const userName =
    labelFromGlpiField(item.users_id) ||
    extractFromComment(comment, "Utilisateur")

  return {
    glpi_id: Number(item.id),
    itemtype,
    name: String(item.name ?? ""),
    serial: String(item.serial ?? ""),
    location,
    manufacturer,
    model,
    state: statusLabel,
    status_label: statusLabel,
    user_name: userName,
    comment,
    image_path: tracking?.image_path ?? null,
    raw_json: JSON.stringify(item),
    synced_at: new Date().toISOString(),
  }
}

export async function syncAssetsFromGlpi() {
  return withSession(async (sessionToken, url) => {
    let synced = 0

    for (const itemtype of ASSET_TYPES) {
      const items = await listAllItems<Record<string, unknown>>(
        sessionToken,
        url,
        itemtype
      )
      for (const item of items) {
        upsertAssetMirror(mapGlpiItemToMirror(item, itemtype))
        synced++
      }
    }

    return { synced }
  })
}

async function postItemsInGlpi(
  sessionToken: string,
  url: string,
  itemtype: string,
  items: Record<string, unknown>[]
) {
  const results: { ok: boolean; id?: number; error?: string }[] = []

  for (const item of items) {
    const response = await fetch(`${url}/apirest.php/${itemtype}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Session-Token": sessionToken,
      },
      body: JSON.stringify({ input: item }),
    })
    const data = await response.json()

    if (response.ok && typeof data === "object" && data && "id" in data) {
      results.push({ ok: true, id: Number((data as { id: number }).id) })
    } else {
      results.push({
        ok: false,
        error: Array.isArray(data) ? String(data[1]) : "Échec création",
      })
    }
  }

  return results
}

export async function createItemsInGlpi(
  itemtype: string,
  items: Record<string, unknown>[]
) {
  return withSession(async (sessionToken, url) =>
    postItemsInGlpi(sessionToken, url, itemtype, items)
  )
}

async function saveAssetsFromCsvRows(
  sessionToken: string,
  url: string,
  entries: {
    itemtype: string
    row: Record<string, string>
    imageFilename?: string
    glpiId?: number
  }[]
) {
  const cache = new DropdownCache()
  const results: { ok: boolean; id?: number; error?: string; updated?: boolean }[] =
    []

  for (const entry of entries) {
    const input = await buildAssetInput(
      sessionToken,
      url,
      cache,
      entry.itemtype,
      entry.row,
      entry.imageFilename
    )

    if (entry.glpiId) {
      const response = await fetch(
        `${url}/apirest.php/${entry.itemtype}/${entry.glpiId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Session-Token": sessionToken,
          },
          body: JSON.stringify({ input }),
        }
      )
      const data = await response.json()
      if (response.ok) {
        results.push({ ok: true, id: entry.glpiId, updated: true })
      } else {
        results.push({
          ok: false,
          error: Array.isArray(data) ? String(data[1]) : "Échec mise à jour",
        })
      }
      continue
    }

    const [result] = await postItemsInGlpi(sessionToken, url, entry.itemtype, [
      input,
    ])
    results.push(result ?? { ok: false, error: "Échec création" })
  }

  return results
}

export async function createAssetsFromCsvRows(
  entries: {
    itemtype: string
    row: Record<string, string>
    imageFilename?: string
  }[]
) {
  return withSession(async (sessionToken, url) =>
    saveAssetsFromCsvRows(sessionToken, url, entries)
  )
}

export async function upsertAssetsFromCsvRows(
  entries: {
    itemtype: string
    row: Record<string, string>
    imageFilename?: string
    glpiId?: number
  }[]
) {
  return withSession(async (sessionToken, url) =>
    saveAssetsFromCsvRows(sessionToken, url, entries)
  )
}

export async function getGlpiStatus() {
  const session = await initSession()
  if (!session.ok || !session.session_token) {
    return {
      connected: false,
      error: session.error ?? "Connexion impossible",
      version: null,
      ticket_count: 0,
    }
  }

  const { url } = getConfig()

  try {
    const [configRes, ticketsRes] = await Promise.all([
      fetch(`${url}/apirest.php/getGlpiConfig/`, {
        headers: {
          "Content-Type": "application/json",
          "Session-Token": session.session_token,
        },
      }),
      fetch(`${url}/apirest.php/Ticket/?range=0-0`, {
        headers: {
          "Content-Type": "application/json",
          "Session-Token": session.session_token,
        },
      }),
    ])

    const config = (await configRes.json()) as { cfg_glpi?: { version?: string } }
    const tickets = (await ticketsRes.json()) as unknown[]

    await fetch(`${url}/apirest.php/killSession/`, {
      method: "GET",
      headers: { "Session-Token": session.session_token },
    })

    return {
      connected: true,
      error: null,
      version: config.cfg_glpi?.version ?? null,
      ticket_count: Array.isArray(tickets) ? tickets.length : 0,
    }
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : "Erreur API",
      version: null,
      ticket_count: 0,
    }
  }
}

export async function fetchTickets(limit = 50) {
  return withSession(async (sessionToken, url) => {
    const response = await fetch(
      `${url}/apirest.php/Ticket/?range=0-${Math.max(limit - 1, 0)}&expand_dropdowns=true`,
      {
        headers: {
          "Content-Type": "application/json",
          "Session-Token": sessionToken,
        },
      }
    )
    const data = await response.json()
    if (!response.ok) {
      throw new Error(
        Array.isArray(data) ? String(data[1]) : "Impossible de récupérer les tickets"
      )
    }
    return data as Record<string, unknown>[]
  })
}

export async function fetchTicketCostsFeuille3(limit = 200) {
  const { mapCostsToFeuille3 } = await import("./ticket-cost-mapper.js")

  return withSession(async (sessionToken, url) => {
    const costs = await listAllItems<Record<string, unknown>>(
      sessionToken,
      url,
      "TicketCost"
    )

    return mapCostsToFeuille3(costs.slice(0, limit))
  })
}

export async function fetchTicketsFeuille2(limit = 100) {
  const { mapTicketsToFeuille2 } = await import("./ticket-mapper.js")

  return withSession(async (sessionToken, url) => {
    const tickets = await listAllItems<Record<string, unknown>>(
      sessionToken,
      url,
      "Ticket"
    )
    const limited = tickets.slice(0, limit)

    const links = await listAllItems<{
      tickets_id: number
      itemtype: string
      items_id: number
    }>(sessionToken, url, "Item_Ticket", false)

    return mapTicketsToFeuille2(limited, links)
  })
}

export async function fetchTicketById(id: number) {
  return withSession(async (sessionToken, url) => {
    const ticketRes = await fetch(
      `${url}/apirest.php/Ticket/${id}?expand_dropdowns=true`,
      {
        headers: {
          "Content-Type": "application/json",
          "Session-Token": sessionToken,
        },
      }
    )

    const ticket = await ticketRes.json()

    if (!ticketRes.ok) {
      throw new Error(
        Array.isArray(ticket) ? String(ticket[1]) : "Ticket introuvable"
      )
    }

    const allLinks = await listAllItems<{
      id: number
      tickets_id: number
      itemtype: string
      items_id: number
    }>(sessionToken, url, "Item_Ticket", false)

    const linked_items = allLinks.filter(
      (link) => Number(link.tickets_id) === id
    )

    return { ticket, linked_items }
  })
}

export async function getTicketStats() {
  const tickets = await fetchTickets(500)
  const by_status: Record<string, number> = {}
  const by_type: Record<string, number> = {}

  for (const ticket of tickets) {
    const statusLabel =
      TICKET_STATUS[Number(ticket.status)] ?? `Statut ${ticket.status}`
    const typeLabel =
      TICKET_TYPE[Number(ticket.type)] ?? `Type ${ticket.type}`
    by_status[statusLabel] = (by_status[statusLabel] ?? 0) + 1
    by_type[typeLabel] = (by_type[typeLabel] ?? 0) + 1
  }

  return {
    total: tickets.length,
    by_status: Object.entries(by_status).map(([label, count]) => ({
      label,
      count,
    })),
    by_type: Object.entries(by_type).map(([label, count]) => ({
      label,
      count,
    })),
  }
}

export async function createTicketCostsInGlpi(
  costs: {
    tickets_id: number
    actiontime: number
    cost_time: number
    cost_fixed: number
    name: string
  }[]
) {
  return withSession(async (sessionToken, url) => {
    const results: { ok: boolean; id?: number; error?: string }[] = []

    for (const cost of costs) {
      const response = await fetch(`${url}/apirest.php/TicketCost/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Session-Token": sessionToken,
        },
        body: JSON.stringify({
          input: {
            tickets_id: cost.tickets_id,
            name: cost.name,
            actiontime: cost.actiontime,
            cost_time: cost.cost_time,
            cost_fixed: cost.cost_fixed,
            begin_date: new Date().toISOString().slice(0, 19).replace("T", " "),
          },
        }),
      })

      const data = await response.json()

      if (response.ok && typeof data === "object" && data && "id" in data) {
        results.push({ ok: true, id: Number((data as { id: number }).id) })
      } else {
        results.push({
          ok: false,
          error: Array.isArray(data) ? String(data[1]) : "Échec coût",
        })
      }
    }

    return results
  })
}

export async function fetchTicketRefMap(limit = 500) {
  return withSession(async (sessionToken, url) => {
    const tickets = await listAllItems<Record<string, unknown>>(
      sessionToken,
      url,
      "Ticket"
    )
    const map: Record<string, number> = {}

    for (const ticket of tickets.slice(0, limit)) {
      const id = Number(ticket.id)
      map[String(id)] = id
      const externalId = ticket.externalid
      if (externalId != null && String(externalId).trim()) {
        map[String(externalId)] = id
      }
    }

    return map
  })
}

export function ticketCostSignature(
  ticketsId: number,
  actiontime: number,
  costTime: number,
  costFixed: number
) {
  return `${ticketsId}:${actiontime}:${costTime}:${costFixed}`
}

export async function fetchTicketCostsIndex() {
  return withSession(async (sessionToken, url) => {
    const costs = await listAllItems<Record<string, unknown>>(
      sessionToken,
      url,
      "TicketCost",
      false
    )
    const index = new Set<string>()

    for (const cost of costs) {
      index.add(
        ticketCostSignature(
          Number(cost.tickets_id),
          Number(cost.actiontime) || 0,
          Number(cost.cost_time) || 0,
          Number(cost.cost_fixed) || 0
        )
      )
    }

    return index
  })
}

export async function createTicketWithItems(input: {
  name: string
  content: string
  type?: number
  status?: number
  urgency?: string
  impact?: string
  priority?: string
  externalid?: string
  items: { itemtype: string; items_id: number; name?: string }[]
}) {
  return withSession(async (sessionToken, url) => {
    const sessionRes = await fetch(`${url}/apirest.php/getFullSession/`, {
      headers: { "Session-Token": sessionToken },
    })
    const sessionData = (await sessionRes.json()) as {
      session?: { glpiID?: number; glpiactive_entity?: number }
    }
    const requesterId = sessionData.session?.glpiID ?? 2
    const entityId = sessionData.session?.glpiactive_entity ?? 0
    const itemNames = input.items
      .map((item) => item.name?.trim())
      .filter((name): name is string => Boolean(name))
    const priorityLabel = input.priority?.trim() || "Moyenne"
    const priorityLevel = priorityLabelToGlpiLevel(priorityLabel)
    const urgencyLabel =
      input.urgency?.trim() || priorityLevelToUrgencyLabel(priorityLevel)
    const impactLabel =
      input.impact?.trim() || priorityLevelToImpactLabel(priorityLevel)
    const urgencyLevel = urgencyLabelToLevel(urgencyLabel)
    const impactLevel = impactLabelToLevel(impactLabel)
    const body = input.content.trim()
    const contentLines = [body]
    if (!/(^|\n)(Status|Statut):/m.test(body)) {
      contentLines.push(`Status: ${FEUILLE2_STATUS[input.status ?? 1] ?? "New"}`)
    }
    if (!/(^|\n)(Urgence|Urgency):/m.test(body)) {
      contentLines.push(`Urgence: ${urgencyLabel}`)
    }
    if (!/(^|\n)(Impact):/m.test(body)) {
      contentLines.push(`Impact: ${impactLabel}`)
    }
    if (!/(^|\n)(Priorité|Priority):/m.test(body)) {
      contentLines.push(`Priorité: ${priorityLabel}`)
    }
    if (itemNames.length > 0 && !/(^|\n)(Éléments|Items):/m.test(body)) {
      contentLines.push(`Éléments: ${itemNames.join(", ")}`)
    }
    const content = contentLines.filter(Boolean).join("\n")

    const ticketInput: Record<string, unknown> = {
      name: input.name,
      content,
      type: input.type ?? 1,
      status: input.status ?? 1,
      urgency: urgencyLevel,
      impact: impactLevel,
      priority: priorityLevel,
      entities_id: entityId,
      global_validation: 1,
      _users_id_requester: requesterId,
    }
    if (input.externalid) ticketInput.externalid = input.externalid

    const ticketRes = await fetch(`${url}/apirest.php/Ticket/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Session-Token": sessionToken,
      },
      body: JSON.stringify({ input: ticketInput }),
    })

    const ticketData = (await ticketRes.json()) as
      | { id?: number }
      | [string, string]
    if (!ticketRes.ok || !ticketData || Array.isArray(ticketData) || !ticketData.id) {
      throw new Error(
        Array.isArray(ticketData) ? String(ticketData[1]) : "Création ticket échouée"
      )
    }

    const ticketId = Number(ticketData.id)
    const links: { ok: boolean; error?: string }[] = []

    for (const item of input.items) {
      const linkRes = await fetch(`${url}/apirest.php/Item_Ticket/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Session-Token": sessionToken,
        },
        body: JSON.stringify({
          input: {
            itemtype: item.itemtype,
            items_id: item.items_id,
            tickets_id: ticketId,
          },
        }),
      })
      const linkData = await linkRes.json()
      const linkError = Array.isArray(linkData) ? String(linkData[1]) : undefined
      links.push({
        ok: linkRes.ok,
        error: linkError,
      })

      if (!linkRes.ok) {
        throw new Error(
          linkError ??
            `Liaison échouée pour ${item.itemtype} #${item.items_id}`
        )
      }
    }

    return {
      ticket_id: ticketId,
      links,
      urgency: urgencyLabel,
      impact: impactLabel,
      priority: priorityLabel,
      content,
      type: input.type ?? 1,
      status: input.status ?? 1,
    }
  })
}

async function deleteItems(
  sessionToken: string,
  url: string,
  itemtype: string,
  ids: number[]
) {
  if (ids.length === 0) return { deleted: 0, failed: 0, errors: [] as string[] }

  const response = await fetch(`${url}/apirest.php/${itemtype}/`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "Session-Token": sessionToken,
    },
    body: JSON.stringify({
      input: ids.map((id) => ({ id })),
      force_purge: true,
    }),
  })

  const data = await response.json()
  let deleted = 0
  let failed = 0
  const errors: string[] = []

  if (Array.isArray(data)) {
    for (const entry of data as Record<string, boolean | string>[]) {
      const key = Object.keys(entry).find((k) => k !== "message")
      if (!key) continue
      if (entry[key] === true) deleted++
      else {
        failed++
        if (typeof entry.message === "string") errors.push(entry.message)
      }
    }
  }

  return { deleted, failed, errors }
}

export async function resetGlpiData(trackedTicketIds: number[] = []) {
  return withSession(async (sessionToken, url) => {
    const ticketIds = [
      ...new Set([
        ...trackedTicketIds,
        ...(await listAllItems<{ id: number }>(sessionToken, url, "Ticket")).map(
          (t) => t.id
        ),
      ]),
    ]

    const tickets = await deleteItems(sessionToken, url, "Ticket", ticketIds)

    const trackedAssets = collectTrackedAssetIds()
    const assetsByType = new Map<string, number[]>()
    for (const asset of trackedAssets) {
      const list = assetsByType.get(asset.itemtype) ?? []
      list.push(asset.glpi_id)
      assetsByType.set(asset.itemtype, list)
    }

    for (const itemtype of ASSET_TYPES) {
      const allIds = (
        await listAllItems<{ id: number }>(sessionToken, url, itemtype)
      ).map((i) => i.id)
      const tracked = assetsByType.get(itemtype) ?? []
      assetsByType.set(itemtype, [...new Set([...tracked, ...allIds])])
    }

    const assets: Record<string, { deleted: number; failed: number }> = {}
    for (const [itemtype, ids] of assetsByType) {
      assets[itemtype] = await deleteItems(sessionToken, url, itemtype, ids)
    }

    return {
      tickets_found: ticketIds.length,
      tickets_deleted: tickets.deleted,
      tickets_failed: tickets.failed,
      assets,
      errors: tickets.errors,
    }
  })
}

function detectImageMime(buffer: Buffer): { ext: string; mime: string } {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { ext: "jpg", mime: "image/jpeg" }
  }

  if (
    buffer.length >= 4 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return { ext: "png", mime: "image/png" }
  }

  if (buffer.length >= 3 && buffer.toString("ascii", 0, 3) === "GIF") {
    return { ext: "gif", mime: "image/gif" }
  }

  const lower = buffer.toString("utf-8", 0, 12).toLowerCase()
  if (lower.includes("webp")) {
    return { ext: "webp", mime: "image/webp" }
  }

  return { ext: "jpg", mime: "image/jpeg" }
}

function imageStem(filename: string) {
  return filename.replace(/\.[^.]+$/i, "")
}

async function uploadDocumentToGlpi(
  sessionToken: string,
  url: string,
  fileBuffer: Buffer,
  originalFilename: string
): Promise<{ ok: boolean; id?: number; error?: string }> {
  const { ext, mime } = detectImageMime(fileBuffer)
  const uploadName = `${imageStem(originalFilename)}.${ext}`
  const manifest = JSON.stringify({
    input: { name: uploadName, _filename: [uploadName] },
  })

  const form = new FormData()
  form.append("uploadManifest", manifest)
  form.append(
    "filename[0]",
    new Blob([fileBuffer], { type: mime }),
    uploadName
  )

  const response = await fetch(`${url}/apirest.php/Document/`, {
    method: "POST",
    headers: { "Session-Token": sessionToken },
    body: form,
  })

  const data = (await response.json()) as {
    id?: number
    upload_result?: {
      filename?: { error?: string }[]
    }
    message?: string
  }

  if (!response.ok || !data?.id) {
    return {
      ok: false,
      error: Array.isArray(data)
        ? String((data as [string, string])[1])
        : "Échec upload document",
    }
  }

  const uploadError = data.upload_result?.filename?.[0]?.error
  if (uploadError) {
    return { ok: false, error: uploadError }
  }

  return { ok: true, id: Number(data.id) }
}

async function linkDocumentToItem(
  sessionToken: string,
  url: string,
  documentId: number,
  itemtype: string,
  itemsId: number
): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch(`${url}/apirest.php/Document_Item/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Session-Token": sessionToken,
    },
    body: JSON.stringify({
      input: {
        documents_id: documentId,
        itemtype,
        items_id: itemsId,
      },
    }),
  })

  const data = await response.json()
  if (response.ok) {
    return { ok: true }
  }

  return {
    ok: false,
    error: Array.isArray(data) ? String(data[1]) : "Échec liaison document",
  }
}

async function fetchDocumentLinksIndex(
  sessionToken: string,
  url: string
): Promise<Set<string>> {
  const [links, documents] = await Promise.all([
    listAllItems<{
      documents_id: number
      itemtype: string
      items_id: number
    }>(sessionToken, url, "Document_Item", false),
    listAllItems<{ id: number; filename?: string | null }>(
      sessionToken,
      url,
      "Document",
      false
    ),
  ])

  const validDocumentIds = new Set(
    documents
      .filter((doc) => doc.filename && String(doc.filename).trim())
      .map((doc) => Number(doc.id))
  )

  const index = new Set<string>()
  for (const link of links) {
    if (
      link.itemtype &&
      link.items_id &&
      validDocumentIds.has(Number(link.documents_id))
    ) {
      index.add(`${link.itemtype}:${link.items_id}`)
    }
  }

  return index
}

export async function uploadAssetImagesToGlpi(
  links: {
    filename: string
    storedPath: string
    itemtype: string
    glpi_id: number
  }[]
) {
  return withSession(async (sessionToken, url) => {
    const existingLinks = await fetchDocumentLinksIndex(sessionToken, url)
    const results: {
      filename: string
      itemtype: string
      glpi_id: number
      ok: boolean
      document_id?: number
      skipped?: boolean
      error?: string
    }[] = []

    let uploaded = 0
    let linked = 0
    let skipped = 0
    let failed = 0

    for (const entry of links) {
      const linkKey = `${entry.itemtype}:${entry.glpi_id}`
      if (existingLinks.has(linkKey)) {
        skipped++
        results.push({
          ...entry,
          ok: true,
          skipped: true,
        })
        continue
      }

      let fileBuffer: Buffer
      try {
        fileBuffer = fs.readFileSync(entry.storedPath)
      } catch (error) {
        failed++
        results.push({
          ...entry,
          ok: false,
          error:
            error instanceof Error ? error.message : "Fichier image introuvable",
        })
        continue
      }

      const upload = await uploadDocumentToGlpi(
        sessionToken,
        url,
        fileBuffer,
        entry.filename
      )

      if (!upload.ok || !upload.id) {
        failed++
        results.push({
          ...entry,
          ok: false,
          error: upload.error ?? "Échec upload GLPI",
        })
        continue
      }

      uploaded++

      const link = await linkDocumentToItem(
        sessionToken,
        url,
        upload.id,
        entry.itemtype,
        entry.glpi_id
      )

      if (!link.ok) {
        failed++
        results.push({
          ...entry,
          ok: false,
          document_id: upload.id,
          error: link.error ?? "Échec liaison GLPI",
        })
        continue
      }

      linked++
      existingLinks.add(linkKey)
      results.push({
        ...entry,
        ok: true,
        document_id: upload.id,
      })
    }

    return { uploaded, linked, skipped, failed, results }
  })
}

export const KANBAN_STATUS_IDS = [1, 2, 6] as const

export function normalizeTicketStatusId(raw: unknown): number {
  const numeric = Number(raw)
  if (!Number.isNaN(numeric) && numeric > 0) {
    if (numeric === 1) return 1
    if (numeric === 2 || numeric === 3 || numeric === 4) return 2
    if (numeric === 5 || numeric === 6) return 6
  }

  const label = String(raw ?? "").trim().toLowerCase()
  if (!label) return 1
  if (label === "new" || label === "nouveau" || label === "1") return 1
  if (
    label === "2" ||
    label.includes("in progress") ||
    label.includes("processing") ||
    label.includes("planned") ||
    label.includes("pending") ||
    label.includes("en cours") ||
    label.includes("attente")
  ) {
    return 2
  }
  if (
    label === "6" ||
    label === "5" ||
    label.includes("closed") ||
    label.includes("clos") ||
    label.includes("fermé") ||
    label.includes("solved") ||
    label.includes("résolu")
  ) {
    return 6
  }

  return 1
}

function updateContentStatusLine(content: string, statusLabel: string) {
  const lines = content.length > 0 ? content.split(/\r?\n/) : []
  let found = false

  const updated = lines.map((line) => {
    if (line.startsWith("Status:") || line.startsWith("Statut:")) {
      found = true
      return `Status: ${statusLabel}`
    }
    return line
  })

  if (!found && content.trim()) {
    updated.push(`Status: ${statusLabel}`)
  }

  return updated.join("\n")
}

export async function updateTicketStatus(
  ticketId: number,
  status: number,
  comment?: string
) {
  return withSession(async (sessionToken, url) => {
    const detailRes = await fetch(
      `${url}/apirest.php/Ticket/${ticketId}?expand_dropdowns=true`,
      {
        headers: {
          "Content-Type": "application/json",
          "Session-Token": sessionToken,
        },
      }
    )
    const current = (await detailRes.json()) as Record<string, unknown>

    if (!detailRes.ok) {
      throw new Error(
        Array.isArray(current) ? String(current[1]) : "Ticket introuvable"
      )
    }

    const statusLabel = FEUILLE2_STATUS[status] ?? TICKET_STATUS[status] ?? "New"
    const existingContent = String(current.content ?? "").trim()
    let nextContent = updateContentStatusLine(existingContent, statusLabel)

    if (comment?.trim()) {
      const note = comment.trim()
      nextContent = nextContent
        ? `${nextContent}\n\n[Changement de statut] ${note}`
        : `[Changement de statut] ${note}`
    }

    const input: Record<string, unknown> = {
      status,
      content: nextContent,
    }

    if (comment?.trim() && status === 6) {
      input.solution = comment.trim()
      input.solutiontypes_id = 0
    }

    const response = await fetch(`${url}/apirest.php/Ticket/${ticketId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Session-Token": sessionToken,
      },
      body: JSON.stringify({ input }),
    })
    const data = await response.json()

    if (!response.ok) {
      throw new Error(
        Array.isArray(data) ? String(data[1]) : "Mise à jour du statut échouée"
      )
    }

    return { ok: true, ticket_id: ticketId, status }
  })
}

export { FEUILLE2_STATUS, mapImportTicketStatus, TICKET_PRIORITY_LABEL, TICKET_STATUS, TICKET_TYPE }
