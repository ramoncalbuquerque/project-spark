import { Calendar, Users, Filter, Plus } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import MiniCalendar from "@/components/MiniCalendar";

const navItems = [
  { title: "Calendário", url: "/dashboard", icon: Calendar },
  { title: "Times", url: "/teams", icon: Users },
];

export function AppSidebar() {
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar className="border-r border-border bg-card">
      <SidebarContent className="pt-2">
        {/* Create button */}
        <div className="px-3 pb-2">
          <Button className="w-full gap-2 h-10 text-sm font-semibold" disabled>
            <Plus className="h-4 w-4" />
            Criar
          </Button>
        </div>

        <Separator />

        {/* Mini calendar */}
        <MiniCalendar />

        <Separator />

        {/* Navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="hover:bg-accent"
                      activeClassName="bg-accent text-primary font-medium"
                      onClick={() => setOpenMobile(false)}
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator />

        {/* Filters placeholder */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Filter className="mr-2 h-3.5 w-3.5" />
            Filtros
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Filtros disponíveis em breve
            </p>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator />

        {/* Teams placeholder */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Users className="mr-2 h-3.5 w-3.5" />
            Times
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Seus times aparecerão aqui
            </p>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
