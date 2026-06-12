import { useEffect, useState } from "react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { api, type ItemCostGroup } from "@/lib/api"

function formatAmount(value: number) {
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

export function ItemCostsPage() {
  const [groups, setGroups] = useState<ItemCostGroup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .itemCosts()
      .then(setGroups)
      .finally(() => setLoading(false))
  }, [])

  const grandTotal = groups.reduce((sum, row) => sum + row.total_cost, 0)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Coûts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Super coûts enregistrés à la fermeture des tickets, regroupés par
          élément.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {loading ? "…" : `${groups.length} élément(s)`}
          </CardTitle>
          <CardDescription>
            Coût total : {formatAmount(grandTotal)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun coût enregistré. Fermez un ticket depuis le Kanban avec un
              super coût.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4 font-medium">Item</th>
                  <th className="py-2 pr-4 font-medium">Vidiny vaovao</th>
                  <th className="py-2 pr-4 font-medium">Coût total</th>
                  <th className="py-2 font-medium">Tickets</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((row) => (
                  <tr key={row.item_name} className="border-b">
                    <td className="py-2 pr-4">{row.item_name}</td>
                    <td className="py-2 pr-4">{formatAmount(row.last_share)}</td>
                    <td className="py-2 pr-4">{formatAmount(row.total_cost)}</td>
                    <td className="py-2">{row.entry_count}</td>
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
