import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTeams, useTeamMembers, useAllProfiles } from "@/hooks/useTeams";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Users, X, Plus, Trash2, Pencil, Check, UserPlus } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Team = Tables<"teams"> & { member_count: number };

interface TeamDetailModalProps {
  team: Team | null;
  onClose: () => void;
}

const TeamDetailModal = ({ team, onClose }: TeamDetailModalProps) => {
  const { user, profile } = useAuth();
  const { updateTeam, deleteTeam } = useTeams();
  const { members, isLoading: membersLoading, addMember, removeMember } =
    useTeamMembers(team?.id ?? null);
  const allProfiles = useAllProfiles();

  const isCreator = team?.created_by === user?.id;
  const isLeader = profile?.role === "leader";
  const canEdit = isCreator && isLeader;

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");

  const memberIds = useMemo(() => new Set(members.map((m) => m.profile_id)), [members]);

  const filteredProfiles = useMemo(() => {
    return allProfiles.filter((p) => {
      if (memberIds.has(p.id)) return false;
      if (!search.trim()) return true;
      return (p.full_name || "").toLowerCase().includes(search.toLowerCase());
    });
  }, [allProfiles, memberIds, search]);

  if (!team) return null;

  const startEdit = () => {
    setEditName(team.name);
    setEditDesc(team.description || "");
    setEditing(true);
  };

  const saveEdit = () => {
    if (!editName.trim()) return;
    updateTeam.mutate(
      { id: team.id, name: editName.trim(), description: editDesc.trim() || undefined },
      { onSuccess: () => setEditing(false) }
    );
  };

  const handleDelete = () => {
    deleteTeam.mutate(team.id, { onSuccess: onClose });
  };

  const handleAddMember = (profileId: string) => {
    addMember.mutate(profileId);
    setSearch("");
    setAddOpen(false);
  };

  return (
    <Dialog open={!!team} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {editing ? "Editar Time" : team.name}
          </DialogTitle>
        </DialogHeader>

        {/* Name & description */}
        {editing ? (
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="mt-1"
                autoFocus
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="mt-1"
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={saveEdit} disabled={!editName.trim() || updateTeam.isPending}>
                <Check className="h-4 w-4 mr-1" /> Salvar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div>
            {team.description && (
              <p className="text-sm text-muted-foreground mb-2">{team.description}</p>
            )}
            {canEdit && (
              <Button size="sm" variant="ghost" onClick={startEdit} className="text-xs">
                <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
              </Button>
            )}
          </div>
        )}

        {/* Members */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">
              Membros ({members.length})
            </h3>
            {canEdit && (
              <Popover open={addOpen} onOpenChange={setAddOpen}>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline">
                    <UserPlus className="h-4 w-4 mr-1" /> Adicionar
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-2" align="end">
                  <Input
                    placeholder="Buscar por nome..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="mb-2"
                    autoFocus
                  />
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {filteredProfiles.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        Nenhum usuário encontrado
                      </p>
                    ) : (
                      filteredProfiles.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => handleAddMember(p.id)}
                          className="w-full text-left px-2 py-1.5 rounded hover:bg-muted text-sm flex items-center gap-2"
                        >
                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                            {(p.full_name || "?")[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-foreground">
                              {p.full_name || "Sem nome"}
                            </div>
                            <div className="text-xs text-muted-foreground">{p.role}</div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>

          {membersLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum membro adicionado ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-muted/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                      {(m.profile?.full_name || "?")[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {m.profile?.full_name || "Sem nome"}
                      </div>
                      <div className="text-xs text-muted-foreground">{m.profile?.role}</div>
                    </div>
                  </div>
                  {canEdit && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive">
                          <X className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover membro?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {m.profile?.full_name || "Este membro"} será removido do time.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => removeMember.mutate(m.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Delete team */}
        {canEdit && (
          <div className="mt-6 pt-4 border-t border-border">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="w-full">
                  <Trash2 className="h-4 w-4 mr-1" /> Excluir Time
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir time?</AlertDialogTitle>
                  <AlertDialogDescription>
                    O time "{team.name}" e todos os seus membros serão removidos permanentemente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TeamDetailModal;
