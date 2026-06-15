import { useEffect, useState } from "react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { api, type ItemCostReportRow } from "@/lib/api"

function formatAmount(value: number) {
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function ItemCostsPage() {
  const [rows, setRows] = useState<ItemCostReportRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .itemCosts()
      .then(setRows)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Coûts par item</h1>

      <Card>
        <CardHeader>
          <CardTitle>
            {loading ? "…" : `${rows.length} type(s) d'item`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun coût enregistré pour le moment.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4 font-medium">Item</th>
                  <th className="py-2 pr-4 font-medium">Total GLPI</th>
                  <th className="py-2 pr-4 font-medium">Total super coût</th>
                  <th className="py-2 font-medium">Total réouverture</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.item} className="border-b">
                    <td className="py-2 pr-4">{row.item}</td>
                    <td className="py-2 pr-4">{formatAmount(row.total_glpi)}</td>
                    <td className="py-2 pr-4">
                      {formatAmount(row.total_super_cost)}
                    </td>
                    <td className="py-2">{formatAmount(row.total_reopen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
