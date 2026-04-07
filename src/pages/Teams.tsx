import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTeams } from "@/hooks/useTeams";
import { Users, Plus, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import CreateTeamModal from "@/components/teams/CreateTeamModal";
import TeamDetailModal from "@/components/teams/TeamDetailModal";
import type { Tables } from "@/integrations/supabase/types";
import { canManageTeams, type UserRole } from "@/lib/permissions";

type Team = Tables<"teams"> & { member_count: number };

const Teams = () => {
  const { profile } = useAuth();
  const { teams, isLoading } = useTeams();
  const role = (profile?.role || 'member') as UserRole;
  const canManage = canManageTeams(role);

  const [showCreate, setShowCreate] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Times</h1>
        {canManage && (
          <Button onClick={() => setShowCreate(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Novo Time
          </Button>
        )}
      </div>

      {/* Empty state */}
      {teams.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-20">
          <Users className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-1">
            Nenhum time encontrado
          </h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            {canManage
              ? "Crie seu primeiro time para começar a organizar sua equipe!"
              : "Você ainda não faz parte de nenhum time."}
          </p>
          {canManage && (
            <Button onClick={() => setShowCreate(true)} className="mt-4" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Criar Time
            </Button>
          )}
        </div>
      ) : (
        /* Team grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => (
            <button
              key={team.id}
              onClick={() => setSelectedTeam(team)}
              className="text-left border border-border rounded-lg p-4 bg-card hover:shadow-md hover:border-primary/30 transition-all cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-foreground truncate">{team.name}</h3>
                  {team.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {team.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {team.member_count} {team.member_count === 1 ? "membro" : "membros"}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {format(new Date(team.created_at), "dd MMM yyyy", { locale: ptBR })}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Modals */}
      <CreateTeamModal open={showCreate} onClose={() => setShowCreate(false)} />
      <TeamDetailModal
        team={selectedTeam}
        onClose={() => setSelectedTeam(null)}
      />
    </div>
  );
};

export default Teams;
