import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CheckIcon, Loader2Icon, TicketIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  api,
  itemtypeLabel,
  TICKET_IMPACTS,
  TICKET_PRIORITIES,
  TICKET_URGENCIES,
  type Asset,
} from "@/lib/api"

export function CreateTicketPage() {
  const navigate = useNavigate()
  const [assets, setAssets] = useState<Asset[]>([])
  const [assetsLoading, setAssetsLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [name, setName] = useState("")
  const [content, setContent] = useState("")
  const [type, setType] = useState("1")
  const [urgency, setUrgency] = useState("Moyenne")
  const [impact, setImpact] = useState("Moyen")
  const [priority, setPriority] = useState("Moyenne")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    api
      .assets()
      .then(setAssets)
      .catch(() => toast.error("Impossible de charger le parc"))
      .finally(() => setAssetsLoading(false))
  }, [])

  function toggleAsset(asset: Asset) {
    const key = `${asset.itemtype}:${asset.glpi_id}`
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !content.trim()) {
      toast.error("Titre et description requis")
      return
    }

    const items = [...selected].map((key) => {
      const [itemtype, id] = key.split(":")
      const asset = assets.find((a) => `${a.itemtype}:${a.glpi_id}` === key)
      return {
        itemtype,
        items_id: Number(id),
        name: asset?.name ?? undefined,
      }
    })

    setSubmitting(true)
    try {
      const result = await api.createTicket({
        name,
        content,
        type: Number(type),
        urgency,
        impact,
        priority,
        items,
      })
      toast.success(`Ticket #${result.ticket_id} créé dans GLPI`)
      navigate("/kanban")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Échec")
    } finally {
      setSubmitting(false)
    }
  }

  const busy = assetsLoading || submitting

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nouveau ticket</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Créez un ticket GLPI et associez un ou plusieurs éléments du parc.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid gap-6 lg:grid-cols-2"
        aria-busy={busy}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TicketIcon className="text-primary" />
              Informations du ticket
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="title">Titre</FieldLabel>
                <Input
                  id="title"
                  value={name}
                  disabled={busy}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex : Panne imprimante comptabilité"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="type">Type</FieldLabel>
                <Select value={type} onValueChange={setType} disabled={busy}>
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Incident</SelectItem>
                    <SelectItem value="2">Demande</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="urgency">Urgence</FieldLabel>
                  <Select
                    value={urgency}
                    onValueChange={setUrgency}
                    disabled={busy}
                  >
                    <SelectTrigger id="urgency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TICKET_URGENCIES.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="impact">Impact</FieldLabel>
                  <Select
                    value={impact}
                    onValueChange={setImpact}
                    disabled={busy}
                  >
                    <SelectTrigger id="impact">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TICKET_IMPACTS.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="priority">Priorité</FieldLabel>
                  <Select
                    value={priority}
                    onValueChange={setPriority}
                    disabled={busy}
                  >
                    <SelectTrigger id="priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TICKET_PRIORITIES.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="content">Description</FieldLabel>
                <Textarea
                  id="content"
                  value={content}
                  disabled={busy}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                  placeholder="Décrivez le problème…"
                />
              </Field>
              <Button type="submit" disabled={busy}>
                {submitting ? (
                  <Loader2Icon className="animate-spin" data-icon="inline-start" />
                ) : (
                  <CheckIcon data-icon="inline-start" />
                )}
                {submitting ? "Création…" : "Créer le ticket"}
              </Button>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Éléments à associer</CardTitle>
            <CardDescription>
              Sélectionnez un ou plusieurs éléments du parc ({selected.size}{" "}
              sélectionné{selected.size > 1 ? "s" : ""})
            </CardDescription>
          </CardHeader>
          <CardContent className="flex max-h-96 flex-col gap-2 overflow-y-auto">
            {assetsLoading ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : assets.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun élément disponible. Importez d&apos;abord les données.
              </p>
            ) : (
              assets.map((asset) => {
                const key = `${asset.itemtype}:${asset.glpi_id}`
                const checked = selected.has(key)
                return (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors hover:bg-muted/40"
                  >
                    <Checkbox
                      checked={checked}
                      disabled={busy}
                      onCheckedChange={() => toggleAsset(asset)}
                    />
                    <div className="flex flex-1 flex-col gap-0.5">
                      <span className="text-sm font-medium">{asset.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {itemtypeLabel(asset.itemtype)} · {asset.serial || "—"}
                      </span>
                    </div>
                    <Badge variant="outline">{asset.location || "—"}</Badge>
                  </label>
                )
              })
            )}
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
