import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/hooks/useProjects";
import { useFeedCards } from "@/hooks/useFeedCards";
import FeedCard from "@/components/feed/FeedCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, Plus, Pencil, Check, X, UserPlus, Trash2,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import type { EnrichedProject, ProjectMember } from "@/hooks/useProjects";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active: { label: "Ativo", className: "bg-[#22C55E]/10 text-[#22C55E] border-none" },
  completed: { label: "Concluído", className: "bg-[#3B82F6]/10 text-[#3B82F6] border-none" },
  archived: { label: "Arquivado", className: "bg-[#94A3B8]/10 text-[#94A3B8] border-none" },
};

const COUNTER_CARDS = [
  { key: "total" as const, label: "Total", color: "#94A3B8" },
  { key: "overdue" as const, label: "Atrasadas", color: "#EF4444" },
  { key: "in_progress" as const, label: "Em andamento", color: "#3B82F6" },
  { key: "completed" as const, label: "Concluídas", color: "#22C55E" },
];

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { projects, updateProject, deleteProject, addMember, removeMember } = useProjects();
  const { allCards } = useFeedCards("all");
  const qc = useQueryClient();

  const project = projects.find((p) => p.id === id);

  // Editable name
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");

  // New task form
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState<Date>(new Date());

  // Add member
  const [memberSearch, setMemberSearch] = useState("");
  const [allProfiles, setAllProfiles] = useState<ProjectMember[]>([]);
  const [showMemberSearch, setShowMemberSearch] = useState(false);

  const isCreator = project?.created_by === user?.id;
  const isLeader = profile?.role === "leader";
  const canEdit = isCreator || isLeader;

  // Project tasks
  const projectCards = useMemo(
    () => allCards.filter((c) => c.project_id === id),
    [allCards, id]
  );

  // Counts from project cards (real-time from feed data)
  const counts = useMemo(() => {
    const now = new Date();
    const c = { total: 0, pending: 0, in_progress: 0, completed: 0, overdue: 0 };
    for (const card of projectCards) {
      c.total++;
      if (card.status === "completed") c.completed++;
      else if (card.status === "in_progress") c.in_progress++;
      else c.pending++;
      if (card.is_overdue) c.overdue++;
    }
    return c;
  }, [projectCards]);

  const pctCompleted = counts.total > 0 ? (counts.completed / counts.total) * 100 : 0;
  const pctInProgress = counts.total > 0 ? (counts.in_progress / counts.total) * 100 : 0;
  const pctOverdue = counts.total > 0 ? (counts.overdue / counts.total) * 100 : 0;

  // Discussed in — ritual occurrences that have cards with this project_id
  const { data: discussedIn = [] } = useQuery({
    queryKey: ["project-discussed-in", id],
    queryFn: async () => {
      // Find cards for this project that have ritual_occurrence_id
      const { data: cards } = await supabase
        .from("cards")
        .select("ritual_occurrence_id")
        .eq("project_id", id!)
        .not("ritual_occurrence_id", "is", null);

      const occIds = [...new Set((cards ?? []).map((c) => c.ritual_occurrence_id).filter(Boolean))] as string[];
      if (occIds.length === 0) return [];

      const { data: occs } = await supabase
        .from("ritual_occurrences")
        .select("id, date, ritual_id, rituals(name)")
        .in("id", occIds)
        .order("date", { ascending: false });

      return (occs ?? []).map((o) => ({
        id: o.id,
        date: o.date,
        ritualName: (o.rituals as any)?.name ?? "Ritualística",
      }));
    },
    enabled: !!id,
  });

  // Create task linked to project
  const createTaskMutation = useMutation({
    mutationFn: async () => {
      if (!user || !id) throw new Error("Erro");
      const { error } = await supabase.from("cards").insert({
        title: newTitle.trim(),
        start_date: newDate.toISOString(),
        card_type: "task",
        origin_type: "project",
        project_id: id,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tarefa criada");
      setNewTitle("");
      setShowNewTask(false);
      qc.invalidateQueries({ queryKey: ["feed-cards"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const loadProfiles = async () => {
    const { data } = await supabase.from("profiles").select("id, full_name, avatar_url");
    setAllProfiles(data ?? []);
    setShowMemberSearch(true);
  };

  const filteredProfiles = allProfiles.filter(
    (p) =>
      p.id !== user?.id &&
      !project?.members.some((m) => m.id === p.id) &&
      (p.full_name ?? "").toLowerCase().includes(memberSearch.toLowerCase())
  );

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <p className="text-sm">Projeto não encontrado</p>
        <Button variant="ghost" size="sm" onClick={() => navigate("/app/projects")}>
          Voltar
        </Button>
      </div>
    );
  }

  const badge = STATUS_BADGE[project.status] ?? STATUS_BADGE.active;

  return (
    <div className="flex flex-col h-full bg-[#FAFAF8]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 sticky top-0 bg-[#FAFAF8] z-10 border-b border-[hsl(var(--border))]">
        <button onClick={() => navigate("/app/projects")} className="p-1">
          <ArrowLeft size={20} />
        </button>

        {editing ? (
          <div className="flex items-center gap-1 flex-1">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-8 text-sm"
              autoFocus
            />
            <button
              onClick={() => {
                if (editName.trim()) updateProject.mutate({ id: project.id, name: editName.trim() });
                setEditing(false);
              }}
            >
              <Check size={16} className="text-[#22C55E]" />
            </button>
            <button onClick={() => setEditing(false)}>
              <X size={16} className="text-muted-foreground" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h1 className="text-base font-medium text-foreground truncate">{project.name}</h1>
            {canEdit && (
              <button onClick={() => { setEditName(project.name); setEditing(true); }}>
                <Pencil size={14} className="text-muted-foreground" />
              </button>
            )}
          </div>
        )}

        <Badge className={`text-[10px] px-1.5 py-0 h-4 font-medium shrink-0 ${badge.className}`}>
          {badge.label}
        </Badge>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4 pt-3">
        {/* Counter cards */}
        <div className="grid grid-cols-2 gap-2">
          {COUNTER_CARDS.map((c) => (
            <div
              key={c.key}
              className="bg-white rounded-lg border border-[hsl(var(--border))] p-3 text-center"
            >
              <p className="text-2xl font-semibold" style={{ color: c.color }}>
                {counts[c.key]}
              </p>
              <p className="text-[11px] text-muted-foreground">{c.label}</p>
            </div>
          ))}
        </div>

        {/* Multi-color progress bar */}
        <div className="w-full h-2 rounded-full bg-[#E2E8F0] overflow-hidden flex">
          {pctCompleted > 0 && (
            <div style={{ width: `${pctCompleted}%`, backgroundColor: "#22C55E" }} />
          )}
          {pctInProgress > 0 && (
            <div style={{ width: `${pctInProgress}%`, backgroundColor: "#3B82F6" }} />
          )}
          {pctOverdue > 0 && (
            <div style={{ width: `${pctOverdue}%`, backgroundColor: "#EF4444" }} />
          )}
        </div>

        {/* Tasks */}
        <div>
          <h2 className="text-sm font-medium text-foreground mb-2">Tarefas</h2>
          {projectCards.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma tarefa vinculada</p>
          ) : (
            <div className="space-y-2">
              {projectCards.map((card) => (
                <FeedCard key={card.id} card={card} />
              ))}
            </div>
          )}
        </div>

        {/* Discussed in */}
        {discussedIn.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-foreground mb-2">Discutido em</h2>
            <div className="space-y-1.5">
              {discussedIn.map((d) => (
                <button
                  key={d.id}
                  onClick={() => navigate(`/app/ritual/${d.id}`)}
                  className="w-full flex items-center justify-between bg-white rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-xs"
                >
                  <span className="text-foreground font-medium">{d.ritualName}</span>
                  <span className="text-muted-foreground">
                    {format(new Date(d.date), "d MMM yyyy", { locale: ptBR })}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Members */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-foreground">Membros</h2>
            {isCreator && (
              <button onClick={loadProfiles} className="text-[#4F46E5]">
                <UserPlus size={16} />
              </button>
            )}
          </div>

          {showMemberSearch && isCreator && (
            <div className="mb-2 space-y-1">
              <Input
                placeholder="Buscar pessoa..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="h-8 text-xs"
                autoFocus
              />
              {memberSearch && filteredProfiles.length > 0 && (
                <div className="max-h-28 overflow-y-auto space-y-1">
                  {filteredProfiles.slice(0, 5).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        addMember.mutate({ projectId: project.id, profileId: p.id });
                        setMemberSearch("");
                        setShowMemberSearch(false);
                      }}
                      className="flex items-center gap-2 w-full px-2 py-1 rounded hover:bg-muted text-xs"
                    >
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={p.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[8px]">
                          {(p.full_name ?? "?").charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      {p.full_name ?? "Sem nome"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            {project.members.map((m) => (
              <div key={m.id} className="flex items-center gap-2 bg-white rounded-lg border border-[hsl(var(--border))] px-3 py-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={m.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px]">
                    {(m.full_name ?? "?").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-foreground flex-1">{m.full_name ?? "Sem nome"}</span>
                {isCreator && (
                  <button
                    onClick={() => removeMember.mutate({ projectId: project.id, profileId: m.id })}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
            {project.members.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum membro</p>
            )}
          </div>
        </div>

        {/* Delete */}
        {isCreator && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="w-full">
                <Trash2 size={14} className="mr-1" /> Excluir Projeto
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir projeto?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. As tarefas vinculadas não serão excluídas.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    deleteProject.mutate(project.id);
                    navigate("/app/projects");
                  }}
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Sticky new task button */}
      {canEdit && !showNewTask && (
        <div className="sticky bottom-14 px-4 pb-2 bg-[#FAFAF8]">
          <Button
            className="w-full bg-[#4F46E5] hover:bg-[#4338CA]"
            onClick={() => setShowNewTask(true)}
          >
            <Plus size={16} className="mr-1" /> Nova Tarefa
          </Button>
        </div>
      )}

      {showNewTask && (
        <div className="sticky bottom-14 px-4 pb-2 bg-[#FAFAF8] space-y-2 border-t border-[hsl(var(--border))] pt-2">
          <Input
            placeholder="Título da tarefa"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs flex-1">
                  {format(newDate, "d MMM", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={newDate}
                  onSelect={(d) => d && setNewDate(d)}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            <Button
              size="sm"
              className="bg-[#4F46E5] hover:bg-[#4338CA] text-xs"
              onClick={() => createTaskMutation.mutate()}
              disabled={!newTitle.trim() || createTaskMutation.isPending}
            >
              Criar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setShowNewTask(false); setNewTitle(""); }}
            >
              <X size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
