import cors from "cors"
import express from "express"
import fs from "fs"
import multer from "multer"
import path from "path"

import {
  DEFAULT_BACKOFFICE_CODE,
  requireBackoffice,
  verifyBackofficeCode,
} from "./auth.js"
import { listItemCostsReport } from "./cost-report.js"
import {
  collectGlpiTicketIdsFromImports,
  deleteLastTicketCloseSuperCosts,
  getAllSettings,
  getAsset,
  getAssetStats,
  getDataDir,
  getKanbanConfig,
  getTicketSuperCostSummary,
  listImports,
  resetLocalData,
  saveItemSuperCosts,
  searchAssets,
  setKanbanConfig,
  setSetting,
  upsertTicketMirror,
} from "./db.js"
import { importBundle } from "./import-service.js"
import {
  createTicketWithItems,
  computeGlpiCostsByItemType,
  fetchTicketById,
  fetchTickets,
  fetchTicketsFeuille2,
  fetchTicketCostsFeuille3,
  getGlpiStatus,
  getTicketStats,
  resetGlpiData,
  syncAssetsFromGlpi,
  updateTicketStatus,
} from "./glpi.js"

const app = express()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
})

app.use(cors())
app.use(express.json())

const imagesDir = path.join(getDataDir(), "images")
fs.mkdirSync(imagesDir, { recursive: true })
app.use("/api/images", express.static(imagesDir))

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", app: "NewApp", sqlite: true })
})

app.post("/api/auth/verify", (req, res) => {
  const code = String(req.body?.code ?? "")
  if (!verifyBackofficeCode(code)) {
    res.status(401).json({ error: "Code incorrect" })
    return
  }
  res.json({ ok: true })
})

app.get("/api/auth/config", (_req, res) => {
  res.json({ defaultCode: DEFAULT_BACKOFFICE_CODE })
})

app.get("/api/settings", (_req, res) => {
  const settings = getAllSettings()
  const { glpi_password: _, backoffice_code: __, ...safe } = settings
  res.json(safe)
})

app.put("/api/settings", requireBackoffice, (req, res) => {
  const allowed = ["glpi_url", "glpi_user", "glpi_password", "backoffice_code"] as const
  for (const key of allowed) {
    if (typeof req.body[key] === "string") setSetting(key, req.body[key])
  }
  res.json(getAllSettings())
})

app.get("/api/glpi/status", async (_req, res) => {
  res.json(await getGlpiStatus())
})

app.get("/api/kanban/config", (_req, res) => {
  res.json(getKanbanConfig())
})

app.put("/api/kanban/config", requireBackoffice, (req, res) => {
  setKanbanConfig(req.body ?? {})
  res.json(getKanbanConfig())
})

app.post("/api/sync", async (_req, res) => {
  try {
    const result = await syncAssetsFromGlpi()
    res.json(result)
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : "Sync échouée",
    })
  }
})

app.get("/api/assets", async (req, res) => {
  try {
    await syncAssetsFromGlpi()
    const assets = searchAssets({
      q: String(req.query.q ?? ""),
      itemtype: String(req.query.itemtype ?? ""),
      location: String(req.query.location ?? ""),
      serial: String(req.query.serial ?? ""),
      manufacturer: String(req.query.manufacturer ?? ""),
      status: String(req.query.status ?? ""),
      user: String(req.query.user ?? ""),
      model: String(req.query.model ?? ""),
    })
    res.json(assets)
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : "Erreur assets",
    })
  }
})

app.get("/api/assets/:itemtype/:id", async (req, res) => {
  try {
    await syncAssetsFromGlpi()
    const asset = getAsset(req.params.itemtype, Number(req.params.id))
    if (!asset) {
      res.status(404).json({ error: "Élément introuvable" })
      return
    }
    res.json(asset)
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : "Erreur asset",
    })
  }
})

app.get("/api/stats", requireBackoffice, async (_req, res) => {
  try {
    await syncAssetsFromGlpi()
    const [assets, tickets] = await Promise.all([
      Promise.resolve(getAssetStats()),
      getTicketStats(),
    ])
    res.json({ assets, tickets, glpi: await getGlpiStatus() })
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : "Erreur stats",
    })
  }
})

app.get("/api/tickets", async (req, res) => {
  try {
    const limit = Number(req.query.limit ?? 50)
    const format = String(req.query.format ?? "feuille2")

    if (format === "raw") {
      res.json(await fetchTickets(limit))
      return
    }

    await syncAssetsFromGlpi()
    res.json(await fetchTicketsFeuille2(limit))
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : "Erreur tickets",
    })
  }
})

app.get("/api/ticket-costs", async (req, res) => {
  try {
    const limit = Number(req.query.limit ?? 200)
    res.json(await fetchTicketCostsFeuille3(limit))
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : "Erreur coûts",
    })
  }
})

app.get("/api/tickets/:id", async (req, res) => {
  try {
    const data = await fetchTicketById(Number(req.params.id))
    res.json(data)
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : "Ticket introuvable",
    })
  }
})

app.get("/api/tickets/:id/super-cost", (req, res) => {
  const summary = getTicketSuperCostSummary(Number(req.params.id))
  res.json(summary)
})

app.get("/api/item-costs", async (_req, res) => {
  try {
    const glpiByType = await computeGlpiCostsByItemType()
    res.json(listItemCostsReport(glpiByType))
  } catch {
    res.json(listItemCostsReport({}))
  }
})

app.patch("/api/tickets/:id/status", async (req, res) => {
  try {
    const status = Number(req.body?.status)
    const comment =
      typeof req.body?.comment === "string" ? req.body.comment : undefined
    const superCost = Number(req.body?.super_cost)
    const cancelLastCost = Boolean(req.body?.cancel_last_cost)
    const reopenPercent = Number(req.body?.reopen_percent)
    const items = Array.isArray(req.body?.items)
      ? (req.body.items as unknown[])
          .map((item) => String(item).trim())
          .filter(Boolean)
      : []

    if (![1, 2, 6].includes(status)) {
      res.status(400).json({ error: "Statut Kanban invalide (1, 2 ou 6)" })
      return
    }

    const ticketId = Number(req.params.id)
    const closeCostBefore = getTicketSuperCostSummary(ticketId)
    const result = await updateTicketStatus(ticketId, status, comment)

    if (status === 6 && Number.isFinite(superCost) && superCost > 0) {
      saveItemSuperCosts(ticketId, items, superCost, "close")
    }

    if (status !== 6) {
      if (cancelLastCost) {
        deleteLastTicketCloseSuperCosts(ticketId)
      }
      if (
        Number.isFinite(reopenPercent) &&
        reopenPercent > 0 &&
        closeCostBefore
      ) {
        const reopenTotal =
          Math.round(closeCostBefore.total_cost * reopenPercent) / 100
        if (reopenTotal > 0) {
          const reopenItems =
            items.length > 0
              ? items
              : closeCostBefore.shares.map((share) => share.item_name)
          saveItemSuperCosts(ticketId, reopenItems, reopenTotal, "reopen")
        }
      }
    }

    res.json(result)
  } catch (error) {
    res.status(502).json({
      error:
        error instanceof Error
          ? error.message
          : "Mise à jour du statut échouée",
    })
  }
})

app.post("/api/tickets", async (req, res) => {
  try {
    const { name, content, type, urgency, impact, items } = req.body as {
      name: string
      content: string
      type?: number
      urgency?: string
      impact?: string
      items: { itemtype: string; items_id: number; name?: string }[]
    }

    if (!name?.trim() || !content?.trim()) {
      res.status(400).json({ error: "Titre et description requis" })
      return
    }

    const result = await createTicketWithItems({
      name,
      content,
      type,
      urgency,
      impact,
      items: items ?? [],
    })

    upsertTicketMirror({
      glpi_id: result.ticket_id,
      name: name.trim(),
      content: result.content,
      type: result.type,
      status: result.status,
      urgency: result.urgency,
      impact: result.impact,
      priority: result.priority,
      items_json: JSON.stringify(items ?? []),
    })

    res.json({
      ticket_id: result.ticket_id,
      urgency: result.urgency,
      impact: result.impact,
      priority: result.priority,
    })
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : "Création échouée",
    })
  }
})

app.get("/api/imports", requireBackoffice, (_req, res) => {
  res.json(listImports())
})

app.post(
  "/api/admin/import-bundle",
  requireBackoffice,
  upload.fields([
    { name: "feuille1", maxCount: 1 },
    { name: "feuille2", maxCount: 1 },
    { name: "feuille3", maxCount: 1 },
    { name: "images", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const files = req.files as Record<string, Express.Multer.File[]>
      const result = await importBundle({
        feuille1: files.feuille1?.[0],
        feuille2: files.feuille2?.[0],
        feuille3: files.feuille3?.[0],
        images: files.images?.[0],
      })
      res.json(result)
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Import échoué",
      })
    }
  }
)

app.post("/api/reset", requireBackoffice, async (req, res) => {
  if (req.body?.confirm !== true) {
    res.status(400).json({ error: "Confirmation requise (confirm: true)" })
    return
  }

  try {
    const trackedIds = collectGlpiTicketIdsFromImports()
    const glpi = await resetGlpiData(trackedIds)
    resetLocalData()

    res.json({
      ok: true,
      message: `Réinitialisation complète effectuée`,
      glpi,
    })
  } catch (error) {
    res.status(502).json({
      error:
        error instanceof Error
          ? error.message
          : "Échec de la réinitialisation GLPI",
    })
  }
})

const PORT = Number(process.env.PORT ?? 3001)

app.listen(PORT, () => {
  console.log(`NewApp API → http://localhost:${PORT}`)
})
