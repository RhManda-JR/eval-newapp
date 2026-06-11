import { useEffect, useState } from "react"
import { Loader2Icon, SearchIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { api, type Asset } from "@/lib/api"
import { cn } from "@/lib/utils"

const COLUMNS = [
  { key: "name", label: "Name", className: "min-w-[8.5rem]" },
  { key: "status_label", label: "Status", className: "min-w-[7.5rem]" },
  { key: "location", label: "Location", className: "min-w-[8rem]" },
  { key: "manufacturer", label: "Manufacturer", className: "min-w-[6.5rem]" },
  { key: "itemtype", label: "Item_Type", className: "min-w-[6.5rem]" },
  { key: "model", label: "Model", className: "min-w-[7rem]" },
  { key: "serial", label: "Inventory_Number", className: "min-w-[8.5rem]" },
  { key: "user_name", label: "User", className: "min-w-[8rem]" },
] as const

function statusVariant(status: string | null) {
  const value = status?.toLowerCase() ?? ""
  if (value.includes("production")) return "default"
  if (value.includes("maintenance")) return "secondary"
  if (value.includes("panne")) return "destructive"
  if (value.includes("stock")) return "outline"
  return "outline"
}

function cellValue(asset: Asset, key: (typeof COLUMNS)[number]["key"]) {
  switch (key) {
    case "name":
      return asset.name
    case "status_label":
      return asset.status_label
    case "location":
      return asset.location
    case "manufacturer":
      return asset.manufacturer
    case "itemtype":
      return asset.itemtype
    case "model":
      return asset.model
    case "serial":
      return asset.serial
    case "user_name":
      return asset.user_name
    default:
      return ""
  }
}

export function ElementsPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [filters, setFilters] = useState({
    q: "",
    itemtype: "",
    location: "",
    serial: "",
    manufacturer: "",
    status: "",
    user: "",
    model: "",
  })

  async function search(isInitial = false) {
    if (isInitial) setInitialLoading(true)
    else setSearching(true)

    try {
      const data = await api.assets(filters)
      setAssets(data)
    } finally {
      if (isInitial) setInitialLoading(false)
      else setSearching(false)
    }
  }

  useEffect(() => {
    search(true)
  }, [])

  const loading = initialLoading || searching

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Parc informatique
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Parc synchronisé depuis GLPI.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SearchIcon className="text-primary" />
            Filtres
          </CardTitle>
          <CardDescription>
            Filtrez par nom, statut, lieu, fabricant, modèle, etc.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field>
                <FieldLabel>Mot-clé</FieldLabel>
                <Input
                  value={filters.q}
                  disabled={loading}
                  onChange={(e) =>
                    setFilters({ ...filters, q: e.target.value })
                  }
                  placeholder="Name, inventory, user…"
                />
              </Field>
              <Field>
                <FieldLabel>Item_Type</FieldLabel>
                <Select
                  value={filters.itemtype || "all"}
                  disabled={loading}
                  onValueChange={(v) =>
                    setFilters({ ...filters, itemtype: v === "all" ? "" : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tous" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="Computer">Computer</SelectItem>
                    <SelectItem value="Monitor">Monitor</SelectItem>
                    <SelectItem value="Printer">Printer</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Status</FieldLabel>
                <Input
                  value={filters.status}
                  disabled={loading}
                  onChange={(e) =>
                    setFilters({ ...filters, status: e.target.value })
                  }
                  placeholder="En production…"
                />
              </Field>
              <Field>
                <FieldLabel>Location</FieldLabel>
                <Input
                  value={filters.location}
                  disabled={loading}
                  onChange={(e) =>
                    setFilters({ ...filters, location: e.target.value })
                  }
                />
              </Field>
              <Field>
                <FieldLabel>Manufacturer</FieldLabel>
                <Input
                  value={filters.manufacturer}
                  disabled={loading}
                  onChange={(e) =>
                    setFilters({ ...filters, manufacturer: e.target.value })
                  }
                />
              </Field>
              <Field>
                <FieldLabel>Model</FieldLabel>
                <Input
                  value={filters.model}
                  disabled={loading}
                  onChange={(e) =>
                    setFilters({ ...filters, model: e.target.value })
                  }
                />
              </Field>
              <Field>
                <FieldLabel>Inventory_Number</FieldLabel>
                <Input
                  value={filters.serial}
                  disabled={loading}
                  onChange={(e) =>
                    setFilters({ ...filters, serial: e.target.value })
                  }
                />
              </Field>
              <Field>
                <FieldLabel>User</FieldLabel>
                <Input
                  value={filters.user}
                  disabled={loading}
                  onChange={(e) =>
                    setFilters({ ...filters, user: e.target.value })
                  }
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={loading} onClick={() => search()}>
                {searching ? (
                  <Loader2Icon className="animate-spin" data-icon="inline-start" />
                ) : (
                  <SearchIcon data-icon="inline-start" />
                )}
                {searching ? "Recherche…" : "Rechercher"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => {
                  setFilters({
                    q: "",
                    itemtype: "",
                    location: "",
                    serial: "",
                    manufacturer: "",
                    status: "",
                    user: "",
                    model: "",
                  })
                  setSearching(true)
                  api
                    .assets()
                    .then(setAssets)
                    .finally(() => setSearching(false))
                }}
              >
                Réinitialiser
              </Button>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card className="overflow-hidden p-0">
        <CardHeader className="border-b bg-muted/30 px-4 py-3">
          <CardTitle className="text-base">
            {initialLoading ? "…" : assets.length} élément(s)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {initialLoading ? (
            <div className="p-4">
              <Skeleton className="h-48 w-full" />
            </div>
          ) : assets.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Aucun élément. Importez le parc depuis le backoffice.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[72rem] border-collapse text-[13px]">
                <thead>
                  <tr className="bg-[#f3f3f3] text-left">
                    {COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        className={cn(
                          "border-b border-border px-3 py-2 font-semibold text-foreground",
                          col.className
                        )}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset, index) => (
                    <tr
                      key={`${asset.itemtype}-${asset.glpi_id}`}
                      className={cn(
                        "border-b border-border/70 hover:bg-primary/5",
                        index % 2 === 1 && "bg-muted/20"
                      )}
                    >
                      {COLUMNS.map((col) => {
                        const value = cellValue(asset, col.key) || "—"

                        if (col.key === "status_label") {
                          return (
                            <td key={col.key} className="px-3 py-1.5">
                              <Badge
                                variant={statusVariant(asset.status_label)}
                                className="font-normal"
                              >
                                {value}
                              </Badge>
                            </td>
                          )
                        }

                        return (
                          <td
                            key={col.key}
                            className={cn(
                              "whitespace-nowrap px-3 py-1.5 text-foreground",
                              col.key === "serial" && "font-mono text-xs",
                              col.key === "name" && "font-medium"
                            )}
                          >
                            {value}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
