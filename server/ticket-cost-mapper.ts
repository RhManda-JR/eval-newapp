export type TicketCostFeuille3Row = {
  id: number
  num_ticket: number
  duration_second: number
  time_cost: string
  fixed_cost: number
}

function formatCostDisplay(value: unknown) {
  const num = Number(value)
  if (Number.isNaN(num)) return "0"
  if (Number.isInteger(num)) return String(num)
  return String(num).replace(".", ",")
}

function extractNumTicket(cost: Record<string, unknown>) {
  const name = String(cost.name ?? "")
  const match = name.match(/ticket\s+(\d+)/i)
  if (match) return Number(match[1])
  return Number(cost.tickets_id ?? 0)
}

export function mapCostsToFeuille3(costs: Record<string, unknown>[]) {
  return costs
    .map((cost) => ({
      id: Number(cost.id),
      num_ticket: extractNumTicket(cost),
      duration_second: Number(cost.actiontime ?? 0),
      time_cost: formatCostDisplay(cost.cost_time ?? 0),
      fixed_cost: Number(cost.cost_fixed ?? 0),
    }))
    .sort((a, b) => a.num_ticket - b.num_ticket || a.id - b.id)
}
