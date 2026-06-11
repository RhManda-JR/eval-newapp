import { useEffect, useRef, useState } from "react"
import { Columns3Icon, Loader2Icon, SaveIcon } from "lucide-react"
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
import { api, KANBAN_COLUMNS, type KanbanConfig } from "@/lib/api"

const COLOR_FIELDS = [
  { key: "new" as const, label: "New / vaovao" },
  { key: "in_progress" as const, label: "In progress (assigned) / efa manao" },
  { key: "closed" as const, label: "Closed / vita" },
]

const LABEL_FIELDS = [
  { key: "new" as const, label: "New", placeholder: "vaovao" },
  {
    key: "in_progress" as const,
    label: "In progress (assigned)",
    placeholder: "efa manao",
  },
  { key: "closed" as const, label: "Closed", placeholder: "vita" },
]

export function BackofficeKanbanSettingsPage() {
  const [config, setConfig] = useState<KanbanConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle")
  const readyRef = useRef(false)
  const lastSavedRef = useRef("")
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    api
      .kanbanConfig()
      .then((loaded) => {
        setConfig(loaded)
        lastSavedRef.current = JSON.stringify(loaded)
        readyRef.current = true
      })
      .catch(() => toast.error("Impossible de charger la configuration"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!readyRef.current || !config) return

    const serialized = JSON.stringify(config)
    if (serialized === lastSavedRef.current) return

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      setSaving(true)
      setSaveState("idle")
      try {
        const saved = await api.updateKanbanConfig(config)
        lastSavedRef.current = JSON.stringify(saved)
        setConfig(saved)
        setSaveState("saved")
      } catch (error) {
        setSaveState("error")
        toast.error(
          error instanceof Error ? error.message : "Échec de sauvegarde"
        )
      } finally {
        setSaving(false)
      }
    }, 600)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [config])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!config) return

    if (timerRef.current) clearTimeout(timerRef.current)

    setSaving(true)
    setSaveState("idle")
    try {
      const saved = await api.updateKanbanConfig(config)
      lastSavedRef.current = JSON.stringify(saved)
      setConfig(saved)
      setSaveState("saved")
      toast.success("Configuration Kanban enregistrée")
    } catch (error) {
      setSaveState("error")
      toast.error(error instanceof Error ? error.message : "Échec de sauvegarde")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Personnalisation Kanban
          </h1>
          <p className="text-sm text-muted-foreground">
            Couleurs et libellés malgaches sauvegardés automatiquement dans
            SQLite.
          </p>
        </div>
        {saving ? (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Enregistrement…
          </span>
        ) : saveState === "saved" ? (
          <span className="text-sm text-emerald-600">Sauvegardé</span>
        ) : saveState === "error" ? (
          <span className="text-sm text-destructive">Erreur de sauvegarde</span>
        ) : null}
      </div>

      {loading || !config ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2Icon className="size-5 animate-spin" />
          Chargement…
        </div>
      ) : (
        <form onSubmit={handleSave} className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Columns3Icon className="text-primary" />
                Couleurs de fond
              </CardTitle>
              <CardDescription>
                3 couleurs pour les colonnes du tableau Kanban.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                {COLOR_FIELDS.map((field) => (
                  <Field key={field.key}>
                    <FieldLabel htmlFor={`color-${field.key}`}>
                      {field.label}
                    </FieldLabel>
                    <div className="flex gap-2">
                      <Input
                        id={`color-${field.key}`}
                        type="color"
                        className="h-10 w-16 shrink-0 cursor-pointer p-1"
                        value={config.colors[field.key]}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            colors: {
                              ...config.colors,
                              [field.key]: e.target.value,
                            },
                          })
                        }
                      />
                      <Input
                        value={config.colors[field.key]}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            colors: {
                              ...config.colors,
                              [field.key]: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                  </Field>
                ))}
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Libellés malgaches</CardTitle>
              <CardDescription>
                Noms de statut affichés sous les colonnes (ex: vaovao, efa manao,
                vita).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                {LABEL_FIELDS.map((field) => (
                  <Field key={field.key}>
                    <FieldLabel htmlFor={`label-${field.key}`}>
                      {field.label}
                    </FieldLabel>
                    <Input
                      id={`label-${field.key}`}
                      value={config.labels_mg[field.key]}
                      placeholder={field.placeholder}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          labels_mg: {
                            ...config.labels_mg,
                            [field.key]: e.target.value,
                          },
                        })
                      }
                    />
                  </Field>
                ))}
              </FieldGroup>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Aperçu</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3">
                {KANBAN_COLUMNS.map((column) => (
                  <div
                    key={column.statusId}
                    className="rounded-lg border p-4"
                    style={{ backgroundColor: config.colors[column.colorKey] }}
                  >
                    <p className="font-medium">{column.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {config.labels_mg[column.labelMgKey]}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Button type="submit" disabled={saving} className="w-fit">
            {saving ? (
              <Loader2Icon className="animate-spin" data-icon="inline-start" />
            ) : (
              <SaveIcon data-icon="inline-start" />
            )}
            Enregistrer maintenant
          </Button>
        </form>
      )}
    </div>
  )
}
