import { useState } from "react"
import { FileArchiveIcon, Loader2Icon, UploadIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"
import {
  resolveGlpiComputersListUrl,
  resolveGlpiTicketsListUrl,
} from "@/lib/glpi-links"

const CSV_SLOTS = [
  { key: "feuille1" as const, label: "Parc (CSV)" },
  { key: "feuille2" as const, label: "Tickets (CSV)" },
  {
    key: "feuille3" as const,
    label: "Coûts (CSV)",
    hint: "ticket · mvt (open/reouverture/cancel/closed) · valeur",
  },
]

export function BackofficeImportPage() {
  const [files, setFiles] = useState<{
    feuille1?: File
    feuille2?: File
    feuille3?: File
    images?: File
  }>({})
  const [loading, setLoading] = useState(false)
  const [formKey, setFormKey] = useState(0)

  async function handleImport() {
    if (!files.feuille1 && !files.feuille2 && !files.feuille3 && !files.images) {
      toast.error("Sélectionnez au moins un fichier à importer")
      return
    }

    setLoading(true)
    try {
      const result = await api.importBundle(files)
      const skipped = result.totalSkipped ?? 0
      const created = result.totalCreated ?? result.totalRecords
      const updated = result.totalUpdated ?? 0
      const summary = result.summary as {
        images?: string[]
        images_linked?: number
        images_glpi?: {
          uploaded: number
          linked: number
          skipped: number
          failed: number
        }
      }
      const imageCount = summary.images?.length ?? 0
      const imagesLinked = summary.images_linked ?? 0
      const imagesGlpi = summary.images_glpi?.uploaded ?? 0
      const imagesGlpiSkipped = summary.images_glpi?.skipped ?? 0
      const imagesGlpiFailed = summary.images_glpi?.failed ?? 0

      let message =
        updated > 0
          ? `Import terminé : ${created} créé(s), ${updated} mis à jour`
          : skipped > 0
            ? `Import terminé : ${created} créé(s), ${skipped} déjà à jour`
            : `Import terminé : ${created} enregistrement(s) vers GLPI`

      if (imageCount > 0) {
        message += ` · ${imageCount} image(s)`
        if (imagesLinked > 0) {
          message += `, ${imagesLinked} liée(s) au parc`
        }
        if (imagesGlpi > 0) {
          message += `, ${imagesGlpi} envoyée(s) vers GLPI`
        } else if (imagesGlpiSkipped > 0) {
          message += `, ${imagesGlpiSkipped} déjà dans GLPI`
        }
        if (imagesGlpiFailed > 0) {
          message += `, ${imagesGlpiFailed} échec(s) GLPI`
        }
        if (
          imagesLinked === 0 &&
          imagesGlpi === 0 &&
          imagesGlpiSkipped === 0 &&
          imagesGlpiFailed === 0
        ) {
          message += " — importez d'abord le Parc CSV"
        }
      }

      if (files.feuille2 || files.feuille1) {
        const glpiUrl = files.feuille2
          ? await resolveGlpiTicketsListUrl()
          : await resolveGlpiComputersListUrl()
        toast.success(message, {
          action: {
            label: "Voir dans GLPI",
            onClick: () => window.open(glpiUrl, "_blank", "noopener,noreferrer"),
          },
        })
      } else {
        toast.success(message)
      }
      setFiles({})
      setFormKey((key) => key + 1)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import échoué")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Importez un ou plusieurs fichiers (parc, tickets, coûts, images) vers GLPI.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UploadIcon className="text-primary" />
            Fichiers à importer
          </CardTitle>
          <CardDescription>
            Chaque fichier est optionnel. Envoyez uniquement ce dont vous avez besoin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup key={formKey}>
            {CSV_SLOTS.map((slot) => (
              <Field key={slot.key}>
                <FieldLabel>{slot.label}</FieldLabel>
                <Input
                  type="file"
                  accept=".csv"
                  disabled={loading}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setFiles((prev) => ({ ...prev, [slot.key]: file }))
                    }
                  }}
                />
                {files[slot.key] && (
                  <p className="text-xs text-muted-foreground">
                    ✓ {files[slot.key]?.name}
                  </p>
                )}
                {"hint" in slot && slot.hint ? (
                  <p className="text-xs text-muted-foreground">{slot.hint}</p>
                ) : null}
              </Field>
            ))}

            <Field>
              <FieldLabel>Images (ZIP)</FieldLabel>
              <Input
                type="file"
                accept=".zip"
                disabled={loading}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) setFiles((prev) => ({ ...prev, images: file }))
                }}
              />
              {files.images && (
                <p className="text-xs text-muted-foreground">
                  ✓ {files.images.name}
                </p>
              )}
            </Field>

            <Button disabled={loading} onClick={handleImport}>
              {loading ? (
                <Loader2Icon className="animate-spin" data-icon="inline-start" />
              ) : (
                <FileArchiveIcon data-icon="inline-start" />
              )}
              {loading ? "Import en cours…" : "Lancer l'import vers GLPI"}
            </Button>
          </FieldGroup>
        </CardContent>
      </Card>
    </div>
  )
}
