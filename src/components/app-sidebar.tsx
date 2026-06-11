import { NavLink, useLocation } from "react-router-dom"
import {
  AppWindowIcon,
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
      <SidebarHeader className="border-b border-sidebar-border/60 px-4 py-5 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-4">
        <div className="flex flex-col gap-0.5 group-data-[collapsible=icon]:items-center">
          <span className="text-base font-semibold tracking-tight text-sidebar-foreground group-data-[collapsible=icon]:hidden">
            NewApp
          </span>
          <AppWindowIcon
            className="hidden size-5 shrink-0 text-sidebar-foreground group-data-[collapsible=icon]:block"
            aria-label="NewApp"
          />
          <span className="text-xs text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
            Extension GLPI
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-2 group-data-[collapsible=icon]:items-center">
        <SidebarGroup className="px-3 py-4 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-1 group-data-[collapsible=icon]:py-2">
          <SidebarGroupLabel className="mb-2 px-1">Navigation</SidebarGroupLabel>
          <SidebarGroupContent className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center">
            <SidebarMenu className="gap-2 group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:items-center">
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

      <SidebarFooter className="border-t border-sidebar-border/60 p-4 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-1 group-data-[collapsible=icon]:py-3">
        <SidebarMenu className="gap-2 group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:items-center">
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
