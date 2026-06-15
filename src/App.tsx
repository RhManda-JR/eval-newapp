import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

import { AppLayout } from "@/components/app-layout"
import { BackofficeGuard } from "@/components/backoffice-guard"
import { FrontLayout } from "@/components/front-layout"
import { BackofficeDashboardPage } from "@/pages/backoffice/dashboard"
import { BackofficeImportPage } from "@/pages/backoffice/import"
import { BackofficeLoginPage } from "@/pages/backoffice/login"
import { BackofficeTicketDetailPage } from "@/pages/backoffice/ticket-detail"
import { BackofficeCostsPage } from "@/pages/backoffice/costs"
import { BackofficeKanbanSettingsPage } from "@/pages/backoffice/kanban-settings"
import { BackofficeTicketsPage } from "@/pages/backoffice/tickets"
import { ResetPage } from "@/pages/reset"
import { CreateTicketPage } from "@/pages/front/create-ticket"
import { ElementsPage } from "@/pages/front/elements"
import { ItemCostsPage } from "@/pages/front/costs"
import { ImportCostsPage } from "@/pages/front/import-costs"
import { KanbanPage } from "@/pages/front/kanban"

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<FrontLayout />}>
          <Route index element={<ElementsPage />} />
          <Route path="kanban" element={<KanbanPage />} />
          <Route path="import" element={<ImportCostsPage />} />
          <Route path="couts" element={<ItemCostsPage />} />
          <Route path="ticket/nouveau" element={<CreateTicketPage />} />
        </Route>

        <Route path="backoffice/entree" element={<BackofficeLoginPage />} />

        <Route element={<BackofficeGuard />}>
          <Route element={<AppLayout />}>
            <Route path="backoffice" element={<BackofficeDashboardPage />} />
            <Route path="backoffice/import" element={<BackofficeImportPage />} />
            <Route path="backoffice/reset" element={<ResetPage />} />
            <Route path="backoffice/tickets" element={<BackofficeTicketsPage />} />
            <Route path="backoffice/couts" element={<BackofficeCostsPage />} />
            <Route
              path="backoffice/kanban"
              element={<BackofficeKanbanSettingsPage />}
            />
            <Route
              path="backoffice/tickets/:id"
              element={<BackofficeTicketDetailPage />}
            />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
