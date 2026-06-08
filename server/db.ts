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
`)

const defaults: Record<string, string> = {
  glpi_url: "http://127.0.0.1/glpi/public",
  glpi_user: "glpi",
  glpi_password: "glpi",
  backoffice_code: "JUIN26",
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

export function resetLocalData() {
  db.exec(`
    DELETE FROM import_logs;
    DELETE FROM assets_mirror;
    DELETE FROM asset_tracking;
    DELETE FROM images_store;
  `)
}

export function getDataDir() {
  return dataDir
}

export { db }
