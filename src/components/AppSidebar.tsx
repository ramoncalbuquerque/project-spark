import { Calendar, Users, Filter, Plus, X } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MiniCalendar from "@/components/MiniCalendar";
import { useCardModal } from "@/contexts/CardContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCalendar } from "@/contexts/CalendarContext";
import { useAllProfiles, useTeams } from "@/hooks/useTeams";

const navItems = [
  { title: "Calendário", url: "/dashboard", icon: Calendar },
  { title: "Times", url: "/teams", icon: Users },
];

export function AppSidebar() {
  const { setOpenMobile } = useSidebar();
  const { openCreateModal } = useCardModal();
  const { profile } = useAuth();
  const { filters, setFilters, clearFilters } = useCalendar();
  const allProfiles = useAllProfiles();
  const { teams } = useTeams();
  const isLeader = profile?.role === "leader";

  const hasFilters = filters.profileId || filters.teamId;

  return (
    <Sidebar className="border-r border-border bg-card">
      <SidebarContent className="pt-2">
        {/* Create button — only for leaders */}
        {isLeader && (
          <div className="px-3 pb-2">
            <Button
              className="w-full gap-2 h-10 text-sm font-semibold"
              onClick={() => {
                openCreateModal();
                setOpenMobile(false);
              }}
            >
              <Plus className="h-4 w-4" />
              Criar
            </Button>
          </div>
        )}

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

        {/* Filters */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Filter className="mr-2 h-3.5 w-3.5" />
            Filtros
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-3 space-y-2 pb-2">
              <Select
                value={filters.profileId || "all"}
                onValueChange={(v) =>
                  setFilters({ ...filters, profileId: v === "all" ? null : v, teamId: null })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Filtrar por pessoa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as pessoas</SelectItem>
                  {allProfiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name || "Sem nome"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.teamId || "all"}
                onValueChange={(v) =>
                  setFilters({ ...filters, teamId: v === "all" ? null : v, profileId: null })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Filtrar por time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os times</SelectItem>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs text-muted-foreground"
                  onClick={clearFilters}
                >
                  <X className="h-3 w-3 mr-1" />
                  Limpar filtros
                </Button>
              )}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator />

        {/* Teams list */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Users className="mr-2 h-3.5 w-3.5" />
            Times
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {teams.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                Nenhum time encontrado
              </p>
            ) : (
              <SidebarMenu>
                {teams.map((team) => (
                  <SidebarMenuItem key={team.id}>
                    <SidebarMenuButton
                      onClick={() => {
                        setFilters({ profileId: null, teamId: team.id });
                        setOpenMobile(false);
                      }}
                      className={`text-xs ${
                        filters.teamId === team.id ? "bg-accent text-primary font-medium" : ""
                      }`}
                    >
                      <Users className="mr-2 h-3.5 w-3.5" />
                      <span className="truncate">{team.name}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        {team.member_count}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
