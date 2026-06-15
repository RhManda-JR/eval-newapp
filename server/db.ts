import Database from "better-sqlite3"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, "data")

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const db = new Database(path.join(dataDir, "newapp.db"))

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS import_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    records_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'success',
    payload TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS assets_mirror (
    glpi_id INTEGER NOT NULL,
    itemtype TEXT NOT NULL,
    name TEXT,
    serial TEXT,
    location TEXT,
    manufacturer TEXT,
    model TEXT,
    state TEXT,
    status_label TEXT,
    user_name TEXT,
    comment TEXT,
    image_path TEXT,
    raw_json TEXT,
    synced_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (glpi_id, itemtype)
  );

  CREATE TABLE IF NOT EXISTS asset_tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    import_log_id INTEGER,
    glpi_id INTEGER NOT NULL,
    itemtype TEXT NOT NULL,
    image_path TEXT
  );

  CREATE TABLE IF NOT EXISTS images_store (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL UNIQUE,
    stored_path TEXT NOT NULL,
    import_log_id INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tickets_mirror (
    glpi_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    content TEXT,
    type INTEGER,
    status INTEGER,
    urgency TEXT,
    impact TEXT,
    priority TEXT,
    items_json TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    synced_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS item_super_costs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    item_name TEXT NOT NULL,
    total_cost REAL NOT NULL,
    item_count INTEGER NOT NULL,
    share_cost REAL NOT NULL,
    kind TEXT NOT NULL DEFAULT 'close',
    created_at TEXT DEFAULT (datetime('now'))
  );
`)

const defaults: Record<string, string> = {
  glpi_url: "http://127.0.0.1/glpi",
  glpi_user: "glpi",
  glpi_password: "glpi",
  backoffice_code: "JUIN26",
  kanban_color_new: "#dbeafe",
  kanban_color_in_progress: "#ffedd5",
  kanban_color_closed: "#bbf7d0",
  kanban_label_new_mg: "vaovao",
  kanban_label_in_progress_mg: "efa manao",
  kanban_label_closed_mg: "vita",
}

const insertSetting = db.prepare(
  "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)"
)

for (const [key, value] of Object.entries(defaults)) {
  insertSetting.run(key, value)
}

for (const column of ["status_label TEXT", "user_name TEXT"]) {
  try {
    db.exec(`ALTER TABLE assets_mirror ADD COLUMN ${column}`)
  } catch {
    // colonne déjà présente
  }
}

for (const column of ["urgency TEXT", "impact TEXT"]) {
  try {
    db.exec(`ALTER TABLE tickets_mirror ADD COLUMN ${column}`)
  } catch {
    // colonne déjà présente
  }
}

try {
  db.exec(`ALTER TABLE item_super_costs ADD COLUMN kind TEXT NOT NULL DEFAULT 'close'`)
} catch {
  // colonne déjà présente
}

export function getSetting(key: string): string | null {
  const row = db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function setSetting(key: string, value: string) {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value)
}

for (const [key, value] of Object.entries(defaults)) {
  if (key.startsWith("kanban_") && !getSetting(key)) {
    setSetting(key, value)
  }
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

const KANBAN_KEYS = {
  colors: {
    new: "kanban_color_new",
    in_progress: "kanban_color_in_progress",
    closed: "kanban_color_closed",
  },
  labels_mg: {
    new: "kanban_label_new_mg",
    in_progress: "kanban_label_in_progress_mg",
    closed: "kanban_label_closed_mg",
  },
} as const

export function getKanbanConfig(): KanbanConfig {
  return {
    colors: {
      new: getSetting(KANBAN_KEYS.colors.new) ?? defaults.kanban_color_new,
      in_progress:
        getSetting(KANBAN_KEYS.colors.in_progress) ??
        defaults.kanban_color_in_progress,
      closed:
        getSetting(KANBAN_KEYS.colors.closed) ?? defaults.kanban_color_closed,
    },
    labels_mg: {
      new: getSetting(KANBAN_KEYS.labels_mg.new) ?? defaults.kanban_label_new_mg,
      in_progress:
        getSetting(KANBAN_KEYS.labels_mg.in_progress) ??
        defaults.kanban_label_in_progress_mg,
      closed:
        getSetting(KANBAN_KEYS.labels_mg.closed) ??
        defaults.kanban_label_closed_mg,
    },
  }
}

export function setKanbanConfig(config: Partial<KanbanConfig>) {
  if (config.colors) {
    for (const [key, settingKey] of Object.entries(KANBAN_KEYS.colors)) {
      const value = config.colors[key as keyof KanbanConfig["colors"]]
      if (typeof value === "string" && value.trim()) {
        setSetting(settingKey, value.trim())
      }
    }
  }
  if (config.labels_mg) {
    for (const [key, settingKey] of Object.entries(KANBAN_KEYS.labels_mg)) {
      const value = config.labels_mg[key as keyof KanbanConfig["labels_mg"]]
      if (typeof value === "string" && value.trim()) {
        setSetting(settingKey, value.trim())
      }
    }
  }
}

export function getAllSettings(): Record<string, string> {
  const rows = db.prepare("SELECT key, value FROM settings").all() as {
    key: string
    value: string
  }[]
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

export type ImportLog = {
  id: number
  filename: string
  file_type: string
  records_count: number
  status: string
  payload: string | null
  created_at: string
}

export type AssetMirror = {
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
  raw_json: string | null
  synced_at: string
}

export function listImports(): ImportLog[] {
  return db
    .prepare(
      "SELECT id, filename, file_type, records_count, status, payload, created_at FROM import_logs ORDER BY id DESC LIMIT 50"
    )
    .all() as ImportLog[]
}

export function createImport(log: {
  filename: string
  file_type: string
  records_count: number
  status: string
  payload: string
}) {
  const result = db
    .prepare(
      "INSERT INTO import_logs (filename, file_type, records_count, status, payload) VALUES (?, ?, ?, ?, ?)"
    )
    .run(
      log.filename,
      log.file_type,
      log.records_count,
      log.status,
      log.payload
    )
  return Number(result.lastInsertRowid)
}

export function trackAsset(data: {
  import_log_id: number
  glpi_id: number
  itemtype: string
  image_path?: string
}) {
  db.prepare(
    "INSERT INTO asset_tracking (import_log_id, glpi_id, itemtype, image_path) VALUES (?, ?, ?, ?)"
  ).run(data.import_log_id, data.glpi_id, data.itemtype, data.image_path ?? null)
}

export function storeImage(filename: string, storedPath: string, importLogId: number) {
  db.prepare(
    "INSERT OR REPLACE INTO images_store (filename, stored_path, import_log_id) VALUES (?, ?, ?)"
  ).run(filename, storedPath, importLogId)
}

export function getImagePath(filename: string): string | null {
  const row = db
    .prepare("SELECT stored_path FROM images_store WHERE filename = ?")
    .get(filename) as { stored_path: string } | undefined
  return row?.stored_path ?? null
}

export function findImageFilenameForAsset(assetName: string): string | null {
  const base = assetName?.trim()
  if (!base) return null

  for (const ext of ["png", "jpg", "jpeg", "gif", "webp"]) {
    const filename = `${base}.${ext}`
    if (getImagePath(filename)) return filename
  }

  const rows = db
    .prepare("SELECT filename FROM images_store")
    .all() as { filename: string }[]
  const lower = base.toLowerCase()

  for (const row of rows) {
    const stem = row.filename.replace(/\.[^.]+$/i, "").toLowerCase()
    if (stem === lower) return row.filename
  }

  return null
}

export function updateAssetImagePath(
  itemtype: string,
  glpiId: number,
  imageFilename: string
) {
  db.prepare(
    "UPDATE assets_mirror SET image_path = ? WHERE itemtype = ? AND glpi_id = ?"
  ).run(imageFilename, itemtype, glpiId)
}

export function upsertAssetMirror(asset: AssetMirror) {
  db.prepare(
    `INSERT INTO assets_mirror (glpi_id, itemtype, name, serial, location, manufacturer, model, state, status_label, user_name, comment, image_path, raw_json, synced_at)
     VALUES (@glpi_id, @itemtype, @name, @serial, @location, @manufacturer, @model, @state, @status_label, @user_name, @comment, @image_path, @raw_json, datetime('now'))
     ON CONFLICT(glpi_id, itemtype) DO UPDATE SET
       name = excluded.name,
       serial = excluded.serial,
       location = excluded.location,
       manufacturer = excluded.manufacturer,
       model = excluded.model,
       state = excluded.state,
       status_label = excluded.status_label,
       user_name = excluded.user_name,
       comment = excluded.comment,
       image_path = COALESCE(excluded.image_path, assets_mirror.image_path),
       raw_json = excluded.raw_json,
       synced_at = datetime('now')`
  ).run(asset)
}

export function searchAssets(filters: {
  q?: string
  itemtype?: string
  location?: string
  serial?: string
  manufacturer?: string
  status?: string
  user?: string
  model?: string
}) {
  let sql = "SELECT * FROM assets_mirror WHERE 1=1"
  const params: Record<string, string> = {}

  if (filters.itemtype) {
    sql += " AND itemtype = @itemtype"
    params.itemtype = filters.itemtype
  }
  if (filters.location) {
    sql += " AND location LIKE @location"
    params.location = `%${filters.location}%`
  }
  if (filters.serial) {
    sql += " AND serial LIKE @serial"
    params.serial = `%${filters.serial}%`
  }
  if (filters.manufacturer) {
    sql += " AND manufacturer LIKE @manufacturer"
    params.manufacturer = `%${filters.manufacturer}%`
  }
  if (filters.status) {
    sql += " AND status_label LIKE @status"
    params.status = `%${filters.status}%`
  }
  if (filters.user) {
    sql += " AND user_name LIKE @user"
    params.user = `%${filters.user}%`
  }
  if (filters.model) {
    sql += " AND model LIKE @model"
    params.model = `%${filters.model}%`
  }
  if (filters.q) {
    sql += ` AND (name LIKE @q OR serial LIKE @q OR comment LIKE @q OR location LIKE @q
      OR manufacturer LIKE @q OR model LIKE @q OR status_label LIKE @q OR user_name LIKE @q)`
    params.q = `%${filters.q}%`
  }

  sql += " ORDER BY name ASC"
  return db.prepare(sql).all(params) as AssetMirror[]
}

export function getAsset(itemtype: string, glpiId: number) {
  return db
    .prepare("SELECT * FROM assets_mirror WHERE itemtype = ? AND glpi_id = ?")
    .get(itemtype, glpiId) as AssetMirror | undefined
}

export function getAllAssetsLookup() {
  return db
    .prepare("SELECT glpi_id, itemtype, name FROM assets_mirror")
    .all() as { glpi_id: number; itemtype: string; name: string | null }[]
}

export function getAssetStats() {
  const rows = db
    .prepare(
      "SELECT itemtype, COUNT(*) as count FROM assets_mirror GROUP BY itemtype ORDER BY itemtype"
    )
    .all() as { itemtype: string; count: number }[]

  const total = rows.reduce((sum, row) => sum + row.count, 0)
  return { total, by_type: rows }
}

export function collectTrackedAssetIds(): { itemtype: string; glpi_id: number }[] {
  return db
    .prepare("SELECT DISTINCT itemtype, glpi_id FROM asset_tracking")
    .all() as { itemtype: string; glpi_id: number }[]
}

export function collectGlpiTicketIdsFromImports(): number[] {
  const imports = listImports()
  const ids = new Set<number>()

  for (const imp of imports) {
    if (!imp.payload) continue
    try {
      const payload = JSON.parse(imp.payload) as {
        glpiResults?: { ok?: boolean; id?: number }[]
        ticketIds?: number[]
      }
      if (Array.isArray(payload.ticketIds)) {
        payload.ticketIds.forEach((id) => ids.add(id))
      }
      if (Array.isArray(payload.glpiResults)) {
        for (const result of payload.glpiResults) {
          if (result.ok && result.id) ids.add(result.id)
        }
      }
    } catch {
      continue
    }
  }

  return [...ids]
}

export type TicketMirror = {
  glpi_id: number
  name: string
  content: string | null
  type: number | null
  status: number | null
  urgency: string | null
  impact: string | null
  priority: string | null
  items_json: string | null
  created_at: string
  synced_at: string
}

export function upsertTicketMirror(ticket: {
  glpi_id: number
  name: string
  content?: string
  type?: number
  status?: number
  urgency?: string
  impact?: string
  priority?: string
  items_json?: string
}) {
  db.prepare(
    `INSERT INTO tickets_mirror (glpi_id, name, content, type, status, urgency, impact, priority, items_json, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(glpi_id) DO UPDATE SET
       name = excluded.name,
       content = excluded.content,
       type = excluded.type,
       status = excluded.status,
       urgency = excluded.urgency,
       impact = excluded.impact,
       priority = excluded.priority,
       items_json = excluded.items_json,
       synced_at = datetime('now')`
  ).run(
    ticket.glpi_id,
    ticket.name,
    ticket.content ?? null,
    ticket.type ?? null,
    ticket.status ?? null,
    ticket.urgency ?? null,
    ticket.impact ?? null,
    ticket.priority ?? null,
    ticket.items_json ?? null
  )
}

export function getTicketMirror(glpiId: number): TicketMirror | null {
  const row = db
    .prepare("SELECT * FROM tickets_mirror WHERE glpi_id = ?")
    .get(glpiId) as TicketMirror | undefined
  return row ?? null
}

export type ItemSuperCostRow = {
  id: number
  ticket_id: number
  item_name: string
  total_cost: number
  item_count: number
  share_cost: number
  created_at: string
}

export type SuperCostKind = "close" | "reopen"

export function saveItemSuperCosts(
  ticketId: number,
  itemNames: string[],
  totalCost: number,
  kind: SuperCostKind = "close"
) {
  const cleaned = itemNames.map((name) => name.trim()).filter(Boolean)
  const itemCount = Math.max(cleaned.length, 1)
  const shareCost = totalCost / itemCount
  const targets = cleaned.length > 0 ? cleaned : ["—"]

  const insert = db.prepare(
    `INSERT INTO item_super_costs (ticket_id, item_name, total_cost, item_count, share_cost, kind, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )

  const tx = db.transaction(() => {
    const batchAt = new Date().toISOString()
    for (const itemName of targets) {
      insert.run(
        ticketId,
        itemName,
        totalCost,
        itemCount,
        shareCost,
        kind,
        batchAt
      )
    }
  })
  tx()
}

export function deleteLastTicketCloseSuperCosts(ticketId: number) {
  const last = db
    .prepare(
      `SELECT created_at FROM item_super_costs
       WHERE ticket_id = ? AND kind = 'close'
       ORDER BY created_at DESC, id DESC
       LIMIT 1`
    )
    .get(ticketId) as { created_at: string } | undefined

  if (!last) return

  db.prepare(
    `DELETE FROM item_super_costs
     WHERE ticket_id = ? AND kind = 'close' AND created_at = ?`
  ).run(ticketId, last.created_at)
}

/** @deprecated use deleteLastTicketCloseSuperCosts */
export function deleteTicketCloseSuperCosts(ticketId: number) {
  deleteLastTicketCloseSuperCosts(ticketId)
}

export type TicketSuperCostSummary = {
  total_cost: number
  item_count: number
  shares: { item_name: string; share_cost: number }[]
}

export function getTicketSuperCostSummary(
  ticketId: number
): TicketSuperCostSummary | null {
  const last = db
    .prepare(
      `SELECT created_at FROM item_super_costs
       WHERE ticket_id = ? AND kind = 'close'
       ORDER BY created_at DESC, id DESC
       LIMIT 1`
    )
    .get(ticketId) as { created_at: string } | undefined

  if (!last) return null

  const rows = db
    .prepare(
      `SELECT item_name, share_cost, total_cost, item_count
       FROM item_super_costs
       WHERE ticket_id = ? AND kind = 'close' AND created_at = ?
       ORDER BY item_name COLLATE NOCASE`
    )
    .all(ticketId, last.created_at) as Pick<
    ItemSuperCostRow,
    "item_name" | "share_cost" | "total_cost" | "item_count"
  >[]

  if (rows.length === 0) return null

  return {
    total_cost: rows[0].total_cost,
    item_count: rows[0].item_count,
    shares: rows.map((row) => ({
      item_name: row.item_name,
      share_cost: row.share_cost,
    })),
  }
}

export function resetLocalData() {
  db.exec(`
    DELETE FROM import_logs;
    DELETE FROM assets_mirror;
    DELETE FROM asset_tracking;
    DELETE FROM images_store;
    DELETE FROM tickets_mirror;
    DELETE FROM item_super_costs;
  `)
}

export function getDataDir() {
  return dataDir
}

export { db }
