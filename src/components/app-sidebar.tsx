import { NavLink, useLocation } from "react-router-dom"
import {
  CoinsIcon,
  Columns3Icon,
  ExternalLinkIcon,
  LayoutDashboardIcon,
  RotateCcwIcon,
  TicketIcon,
  UploadIcon,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

const navItems = [
  {
    title: "Tableau de bord",
    url: "/backoffice",
    icon: LayoutDashboardIcon,
  },
  {
    title: "Import",
    url: "/backoffice/import",
    icon: UploadIcon,
  },
  {
    title: "Tickets",
    url: "/backoffice/tickets",
    icon: TicketIcon,
  },
  {
    title: "Coûts",
    url: "/backoffice/couts",
    icon: CoinsIcon,
  },
  {
    title: "Kanban",
    url: "/backoffice/kanban",
    icon: Columns3Icon,
  },
  {
    title: "Réinitialisation",
    url: "/backoffice/reset",
    icon: RotateCcwIcon,
  },
]

export function AppSidebar() {
  const location = useLocation()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/60 px-4 py-5">
        <div className="flex flex-col gap-0.5 group-data-[collapsible=icon]:items-center">
          <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
            NewApp
          </span>
          <span className="text-xs text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
            Extension GLPI
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    isActive={
                      item.url === "/backoffice"
                        ? location.pathname === "/backoffice"
                        : location.pathname.startsWith(item.url)
                    }
                  >
                    <NavLink to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60 p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Ouvrir GLPI">
              <a
                href="http://localhost/glpi/"
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLinkIcon />
                <span>GLPI ExistingApp</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
