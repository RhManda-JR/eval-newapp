import AdmZip from "adm-zip"
import fs from "fs"
import path from "path"

import {
  createImport,
  findImageFilenameForAsset,
  getAllAssetsLookup,
  getDataDir,
  getImagePath,
  searchAssets,
  storeImage,
  trackAsset,
  updateAssetImagePath,
  upsertTicketMirror,
} from "./db.js"
import {
  createTicketCostsInGlpi,
  createTicketWithItems,
  fetchTicketCostsIndex,
  fetchTicketRefMap,
  mapImportTicketStatus,
  priorityLabelToGlpiLevel,
  priorityLevelToImpactLabel,
  priorityLevelToUrgencyLabel,
  syncAssetsFromGlpi,
  ticketCostSignature,
  uploadAssetImagesToGlpi,
  upsertAssetsFromCsvRows,
} from "./glpi.js"
import { applyCostMovementRows } from "./cost-import.js"
import { isMovementCostCsv } from "./cost-items.js"

type UploadedFile = { originalname: string; buffer: Buffer }

type AssetRef = { itemtype: string; glpi_id: number }

function detectDelimiter(line: string) {
  const semicolons = (line.match(/;/g) ?? []).length
  const commas = (line.match(/,/g) ?? []).length
  return semicolons >= commas ? ";" : ","
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim())
      current = ""
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result
}

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []

  const delimiter = detectDelimiter(lines[0])
  const headers = parseCsvLine(lines[0], delimiter).map((h) =>
    h.replace(/^"|"$/g, "").toLowerCase()
  )

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line, delimiter).map((v) =>
      v.replace(/^"|"$/g, "")
    )
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]))
  })
}

function parseItemsList(raw: string): string[] {
  if (!raw?.trim()) return []
  try {
    const normalized = raw.replace(/""/g, '"')
    const parsed = JSON.parse(normalized) as string[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return raw
      .replace(/[\[\]"]/g, "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  }
}

function parseDecimal(value: string): number {
  return Number(String(value).replace(",", ".").trim()) || 0
}

const ITEMTYPE_LABELS: Record<string, string> = {
  computer: "Computer",
  monitor: "Monitor",
  printer: "Printer",
}

export async function processZipImages(
  buffer: Buffer,
  importLogId: number
): Promise<string[]> {
  const imagesDir = path.join(getDataDir(), "images")
  fs.mkdirSync(imagesDir, { recursive: true })

  const zip = new AdmZip(buffer)
  const entries = zip.getEntries().filter((e) => !e.isDirectory)
  const saved: string[] = []

  for (const entry of entries) {
    const filename = path.basename(entry.entryName)
    if (!/\.(jpg|jpeg|png|gif|webp)$/i.test(filename)) continue

    const target = path.join(imagesDir, filename)
    if (fs.existsSync(target) && getImagePath(filename)) {
      saved.push(filename)
      continue
    }

    fs.writeFileSync(target, entry.getData())
    storeImage(filename, target, importLogId)
    saved.push(filename)
  }

  return saved
}

function resolveAssetImageFilename(
  row: Record<string, string>,
  assetName: string
): string | undefined {
  const explicit = (row.image || row.image_path || "").trim()
  if (explicit) {
    const filename = path.basename(explicit)
    if (getImagePath(filename)) return filename
  }

  return findImageFilenameForAsset(assetName) ?? undefined
}

async function linkImagesToExistingAssets() {
  const assets = searchAssets({})
  let linked = 0

  for (const asset of assets) {
    if (asset.image_path) continue

    const filename = findImageFilenameForAsset(asset.name ?? "")
    if (!filename) continue

    updateAssetImagePath(asset.itemtype, asset.glpi_id, filename)
    linked++
  }

  return linked
}

function buildAssetNameMap() {
  const map = new Map<string, AssetRef>()
  for (const asset of getAllAssetsLookup()) {
    if (asset.name) {
      map.set(asset.name.toLowerCase(), {
        itemtype: asset.itemtype,
        glpi_id: asset.glpi_id,
      })
    }
  }
  return map
}

function buildImageUploadTargets(importedImages: string[]) {
  const assetByName = buildAssetNameMap()
  const targets = new Map<
    string,
    {
      filename: string
      storedPath: string
      itemtype: string
      glpi_id: number
    }
  >()

  for (const filename of importedImages) {
    const storedPath = getImagePath(filename)
    if (!storedPath) continue

    const stem = filename.replace(/\.[^.]+$/i, "")
    const asset = assetByName.get(stem.toLowerCase())
    if (!asset) continue

    const key = `${asset.itemtype}:${asset.glpi_id}`
    targets.set(key, {
      filename,
      storedPath,
      itemtype: asset.itemtype,
      glpi_id: asset.glpi_id,
    })
    updateAssetImagePath(asset.itemtype, asset.glpi_id, filename)
  }

  return [...targets.values()]
}

async function uploadLinkedImagesToGlpi(importedImages: string[] = []) {
  const links =
    importedImages.length > 0
      ? buildImageUploadTargets(importedImages)
      : buildImageUploadTargets(
          searchAssets({})
            .map((asset) => asset.image_path)
            .filter((filename): filename is string => Boolean(filename))
        )

  if (links.length === 0) {
    return { uploaded: 0, linked: 0, skipped: 0, failed: 0, results: [] }
  }

  return uploadAssetImagesToGlpi(links)
}

function buildExistingAssetMap() {
  const map = new Map<string, AssetRef>()
  for (const asset of getAllAssetsLookup()) {
    if (asset.name) {
      map.set(`${asset.itemtype}:${asset.name.toLowerCase()}`, {
        itemtype: asset.itemtype,
        glpi_id: asset.glpi_id,
      })
    }
  }
  return map
}

function assetKey(itemtype: string, name: string) {
  return `${itemtype}:${name.toLowerCase()}`
}

async function importFeuille1(
  buffer: Buffer,
  importLogId: number,
  assetNameMap: Map<string, AssetRef>
) {
  await syncAssetsFromGlpi()
  const existingAssets = buildExistingAssetMap()
  const rows = parseCsv(buffer.toString("utf-8"))
  const details: unknown[] = []
  let totalCreated = 0
  let totalUpdated = 0
  let totalFailed = 0
  const upsertEntries: {
    itemtype: string
    row: Record<string, string>
    imageFilename?: string
    glpiId?: number
  }[] = []

  for (const row of rows) {
    const itemtype =
      ITEMTYPE_LABELS[row.item_type?.toLowerCase() ?? ""] ?? "Computer"
    const name = row.name || row.nom || `ASSET-${Date.now()}`
    const key = assetKey(itemtype, name)
    const existing = existingAssets.get(key)
    const imageFilename = resolveAssetImageFilename(row, name)

    upsertEntries.push({
      itemtype,
      row,
      imageFilename,
      glpiId: existing?.glpi_id,
    })
  }

  const results = await upsertAssetsFromCsvRows(upsertEntries)

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const itemtype =
      ITEMTYPE_LABELS[row.item_type?.toLowerCase() ?? ""] ?? "Computer"
    const name = row.name || row.nom || `ASSET-${Date.now()}`
    const key = assetKey(itemtype, name)
    const result = results[i]

    if (!result?.ok || !result.id) {
      totalFailed++
      details.push({ name, itemtype, error: result?.error ?? "Échec import" })
      continue
    }

    const assetRef = { itemtype, glpi_id: result.id }
    existingAssets.set(key, assetRef)
    assetNameMap.set(name.toLowerCase(), assetRef)

    if (result.updated) {
      const imageFilename = resolveAssetImageFilename(row, name)
      if (imageFilename) {
        updateAssetImagePath(itemtype, result.id, imageFilename)
      }
      totalUpdated++
      details.push({
        name,
        itemtype,
        updated: true,
        glpi_id: result.id,
        image: imageFilename ?? null,
      })
      continue
    }

    const imageFilename = resolveAssetImageFilename(row, name)
    trackAsset({
      import_log_id: importLogId,
      glpi_id: result.id,
      itemtype,
      image_path: imageFilename,
    })
    if (imageFilename) {
      updateAssetImagePath(itemtype, result.id, imageFilename)
    }
    totalCreated++
    details.push({
      name,
      itemtype,
      created: true,
      glpi_id: result.id,
      image: imageFilename ?? null,
    })
  }

  return {
    label: "Parc",
    records: rows.length,
    created: totalCreated,
    updated: totalUpdated,
    skipped: totalUpdated,
    failed: totalFailed,
    details,
  }
}

async function importFeuille2(
  buffer: Buffer,
  assetNameMap: Map<string, AssetRef>
) {
  const rows = parseCsv(buffer.toString("utf-8"))
  const existingTickets = await fetchTicketRefMap()
  const ticketRefMap = new Map<string, number>()
  const results: unknown[] = []
  let totalCreated = 0
  let totalSkipped = 0

  for (const row of rows) {
    const ref = row.ref_ticket || row.num_ticket || ""
    const itemNames = parseItemsList(row.items || "")

    if (ref && existingTickets[ref]) {
      ticketRefMap.set(ref, existingTickets[ref])
      totalSkipped++
      results.push({
        ref,
        ticket_id: existingTickets[ref],
        linked: 0,
        skipped: true,
      })
      continue
    }

    const linkedItems: { itemtype: string; items_id: number }[] = []

    for (const itemName of itemNames) {
      const asset = assetNameMap.get(itemName.toLowerCase())
      if (asset) {
        linkedItems.push({
          itemtype: asset.itemtype,
          items_id: asset.glpi_id,
        })
      }
    }

    const ticketType = row.type?.toLowerCase() === "demande" ? 2 : 1
    const content = [
      row.description,
      row.date ? `Date: ${row.date}` : "",
      row.heure ? `Heure: ${row.heure}` : "",
      row.status ? `Status: ${row.status}` : "",
      row.priority ? `Priorité: ${row.priority}` : "",
      itemNames.length ? `Éléments: ${itemNames.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n")

    const importPriorityLevel = priorityLabelToGlpiLevel(row.priority || "Moyenne")
    const created = await createTicketWithItems({
      name: row.titre || row.title || `Ticket ${ref}`,
      content,
      type: ticketType,
      status: mapImportTicketStatus(row.status || "New"),
      urgency: priorityLevelToUrgencyLabel(
        Math.min(importPriorityLevel, 5)
      ),
      impact: priorityLevelToImpactLabel(Math.min(importPriorityLevel, 5)),
      externalid: ref || undefined,
      items: linkedItems,
    })

    upsertTicketMirror({
      glpi_id: created.ticket_id,
      name: row.titre || row.title || `Ticket ${ref}`,
      content: created.content,
      type: ticketType,
      status: created.status,
      urgency: created.urgency,
      impact: created.impact,
      priority: created.priority,
      items_json: JSON.stringify(linkedItems),
    })

    if (ref) {
      ticketRefMap.set(ref, created.ticket_id)
      existingTickets[ref] = created.ticket_id
    }
    totalCreated++
    results.push({
      ref,
      ticket_id: created.ticket_id,
      linked: linkedItems.length,
      skipped: false,
    })
  }

  return {
    label: "Tickets",
    records: rows.length,
    created: totalCreated,
    skipped: totalSkipped,
    ticketRefMap: Object.fromEntries(ticketRefMap),
    details: results,
  }
}

async function importFeuille3Glpi(
  buffer: Buffer,
  ticketRefMap: Record<string, number>
) {
  const rows = parseCsv(buffer.toString("utf-8"))
  const existingCosts = await fetchTicketCostsIndex()
  const costs: {
    tickets_id: number
    actiontime: number
    cost_time: number
    cost_fixed: number
    name: string
  }[] = []
  const details: unknown[] = []
  let totalSkipped = 0

  for (const row of rows) {
    const ref = row.num_ticket || row.ref_ticket || ""
    const ticketsId = ticketRefMap[ref]
    if (!ticketsId) {
      details.push({ ref, skipped: false, error: "Ticket introuvable" })
      continue
    }

    const actiontime = Number(row.duration_second) || 0
    const costTime = parseDecimal(row.time_cost)
    const costFixed = parseDecimal(row.fixed_cost)
    const signature = ticketCostSignature(
      ticketsId,
      actiontime,
      costTime,
      costFixed
    )

    if (existingCosts.has(signature)) {
      totalSkipped++
      details.push({ ref, tickets_id: ticketsId, skipped: true })
      continue
    }

    costs.push({
      tickets_id: ticketsId,
      actiontime,
      cost_time: costTime,
      cost_fixed: costFixed,
      name: `Coût import — ticket ${ref}`,
    })
    existingCosts.add(signature)
    details.push({ ref, tickets_id: ticketsId, skipped: false })
  }

  const results = await createTicketCostsInGlpi(costs)

  return {
    label: "Coûts GLPI",
    format: "glpi-ticketcost",
    records: rows.length,
    created: results.filter((r) => r.ok).length,
    skipped: totalSkipped,
    details,
  }
}

async function importFeuille3(
  buffer: Buffer,
  ticketRefMap: Record<string, number>
) {
  const rows = parseCsv(buffer.toString("utf-8"))
  if (isMovementCostCsv(rows)) {
    const result = await applyCostMovementRows(rows, ticketRefMap)
    return {
      label: "Coûts (mouvements)",
      format: "ticket-mvt-valeur",
      records: result.records,
      created: result.applied,
      failed: result.failed,
      details: result.details,
    }
  }
  return importFeuille3Glpi(buffer, ticketRefMap)
}

export async function importBundle(files: {
  feuille1?: UploadedFile
  feuille2?: UploadedFile
  feuille3?: UploadedFile
  images?: UploadedFile
}) {
  const batchLogId = createImport({
    filename: "Import-data-juin-26",
    file_type: "bundle",
    records_count: 0,
    status: "processing",
    payload: "{}",
  })

  const summary: Record<string, unknown> = { files: [] as unknown[], images: [] as string[] }
  const assetNameMap = new Map<string, AssetRef>()

  if (
    !files.feuille1 &&
    !files.feuille2 &&
    !files.feuille3 &&
    !files.images
  ) {
    throw new Error("Sélectionnez au moins un fichier à importer")
  }

  if (files.images) {
    await syncAssetsFromGlpi()
    summary.images = await processZipImages(files.images.buffer, batchLogId)
    summary.images_linked = await linkImagesToExistingAssets()
  }

  if (files.feuille1) {
    const feuille1Result = await importFeuille1(
      files.feuille1.buffer,
      batchLogId,
      assetNameMap
    )
    ;(summary.files as unknown[]).push(feuille1Result)
  }

  let ticketRefMap: Record<string, number> = {}

  if (files.feuille2) {
    if (!files.feuille1) {
      await syncAssetsFromGlpi()
      for (const asset of getAllAssetsLookup()) {
        if (asset.name) {
          assetNameMap.set(asset.name.toLowerCase(), {
            itemtype: asset.itemtype,
            glpi_id: asset.glpi_id,
          })
        }
      }
    }

    const feuille2Result = await importFeuille2(files.feuille2.buffer, assetNameMap)
    ticketRefMap = feuille2Result.ticketRefMap as Record<string, number>
    ;(summary.files as unknown[]).push(feuille2Result)
  }

  if (files.feuille3) {
    if (!files.feuille2) {
      ticketRefMap = await fetchTicketRefMap()
    }

    const feuille3Result = await importFeuille3(files.feuille3.buffer, ticketRefMap)
    ;(summary.files as unknown[]).push(feuille3Result)
  }

  if (files.feuille1 || files.feuille2) {
    await syncAssetsFromGlpi()
  }

  if (files.images || files.feuille1) {
    if (files.images && !files.feuille1) {
      await syncAssetsFromGlpi()
    }
    summary.images_glpi = await uploadLinkedImagesToGlpi(
      (summary.images as string[] | undefined) ?? []
    )
  }

  const fileSummaries = summary.files as {
    records: number
    created: number
    updated?: number
    skipped?: number
  }[]
  const totalRecords = fileSummaries.reduce((sum, f) => sum + f.records, 0)
  const totalCreated = fileSummaries.reduce((sum, f) => sum + f.created, 0)
  const totalUpdated = fileSummaries.reduce((sum, f) => sum + (f.updated ?? 0), 0)
  const totalSkipped = fileSummaries.reduce((sum, f) => sum + (f.skipped ?? 0), 0)

  createImport({
    filename: "Import-data-juin-26-completed",
    file_type: "bundle",
    records_count: totalRecords,
    status: "success",
    payload: JSON.stringify(summary),
  })

  return {
    batchLogId,
    summary,
    totalRecords,
    totalCreated,
    totalUpdated,
    totalSkipped,
  }
}
