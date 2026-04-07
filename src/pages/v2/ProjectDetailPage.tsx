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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  ArrowLeft, Plus, Pencil, Check, X, UserPlus, Trash2, CalendarIcon, Video,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { canEditCard, canCreateProject, type UserRole } from "@/lib/permissions";
import { format, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import type { EnrichedProject, ProjectMember } from "@/hooks/useProjects";
import type { EnrichedFeedCard } from "@/hooks/useFeedCards";
import CreateMeetingModal from "@/components/projects/CreateMeetingModal";

const STATUS_OPTIONS = [
  { value: "active", label: "Ativo", className: "bg-primary text-primary-foreground" },
  { value: "completed", label: "Concluído", className: "bg-[#22C55E] text-white" },
  { value: "archived", label: "Arquivado", className: "bg-muted text-muted-foreground" },
];

const COUNTER_CARDS = [
  { key: "total" as const, label: "Total", color: "#94A3B8" },
  { key: "overdue" as const, label: "Atrasadas", color: "#EF4444" },
  { key: "in_progress" as const, label: "Em andamento", color: "#3B82F6" },
  { key: "completed" as const, label: "Concluídas", color: "#22C55E" },
];

type TaskFilter = "all" | "open" | "completed" | "overdue";

const TASK_FILTERS: { key: TaskFilter; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "open", label: "Abertas" },
  { key: "completed", label: "Concluídas" },
  { key: "overdue", label: "Atrasadas" },
];

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { projects, updateProject, deleteProject, addMember, removeMember } = useProjects();
  const { allCards } = useFeedCards("all");
  const qc = useQueryClient();

  const project = projects.find((p) => p.id === id);

  // State
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [descDraft, setDescDraft] = useState<string | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState<Date>(new Date());
  const [memberSearch, setMemberSearch] = useState("");
  const [allProfiles, setAllProfiles] = useState<ProjectMember[]>([]);
  const [showMemberSearch, setShowMemberSearch] = useState(false);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
  const [showMeetingModal, setShowMeetingModal] = useState(false);

  const isCreator = project?.created_by === user?.id;
  const role = (profile?.role || 'member') as UserRole;
  const canEdit = isCreator || canCreateProject(role);

  // Initialize description draft
  if (project && descDraft === null) {
    setDescDraft(project.description ?? "");
  }

  // Project cards (tasks + meetings)
  const projectCards = useMemo(
    () => allCards.filter((c) => c.project_id === id),
    [allCards, id]
  );

  const tasks = useMemo(() => projectCards.filter((c) => c.card_type !== "meeting"), [projectCards]);
  const meetings = useMemo(() => projectCards.filter((c) => c.card_type === "meeting"), [projectCards]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((card) => {
      if (taskFilter === "all") return true;
      if (taskFilter === "open") return card.status !== "completed";
      if (taskFilter === "completed") return card.status === "completed";
      if (taskFilter === "overdue") return card.is_overdue;
      return true;
    });
  }, [tasks, taskFilter]);

  // Counts
  const counts = useMemo(() => {
    const c = { total: 0, pending: 0, in_progress: 0, completed: 0, overdue: 0 };
    for (const card of tasks) {
      c.total++;
      if (card.status === "completed") c.completed++;
      else if (card.status === "in_progress") c.in_progress++;
      else c.pending++;
      if (card.is_overdue) c.overdue++;
    }
    return c;
  }, [tasks]);

  const pctCompleted = counts.total > 0 ? (counts.completed / counts.total) * 100 : 0;
  const pctInProgress = counts.total > 0 ? (counts.in_progress / counts.total) * 100 : 0;
  const pctOverdue = counts.total > 0 ? (counts.overdue / counts.total) * 100 : 0;

  // Target date logic
  const targetOverdueDays = project?.target_date && project.status === "active"
    ? differenceInDays(new Date(), parseISO(project.target_date))
    : 0;
  const isTargetOverdue = targetOverdueDays > 0;

  // Discussed in
  const { data: discussedIn = [] } = useQuery({
    queryKey: ["project-discussed-in", id],
    queryFn: async () => {
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

  // Create task
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

  // Create meeting
  const createMeetingMutation = useMutation({
    mutationFn: async (input: {
      title: string;
      description?: string;
      start_date: string;
      assignee_profile_ids: string[];
      assignee_contact_ids: string[];
    }) => {
      if (!user || !id) throw new Error("Erro");
      const { data, error } = await supabase
        .from("cards")
        .insert({
          title: input.title,
          description: input.description ?? null,
          start_date: input.start_date,
          card_type: "meeting",
          origin_type: "project",
          project_id: id,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;

      const inserts: PromiseLike<unknown>[] = [];
      if (input.assignee_profile_ids.length > 0) {
        inserts.push(
          supabase.from("card_assignees").insert(
            input.assignee_profile_ids.map((pid) => ({ card_id: data.id, profile_id: pid }))
          )
        );
      }
      if (input.assignee_contact_ids.length > 0) {
        inserts.push(
          supabase.from("card_contact_assignees").insert(
            input.assignee_contact_ids.map((cid) => ({ card_id: data.id, contact_id: cid }))
          )
        );
      }
      if (inserts.length > 0) await Promise.all(inserts);
    },
    onSuccess: () => {
      toast.success("Reunião criada");
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

  const handleSaveDesc = () => {
    if (!project) return;
    const val = (descDraft ?? "").trim() || null;
    if (val !== (project.description ?? null)) {
      updateProject.mutate({ id: project.id, description: val ?? undefined });
    }
  };

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

  const currentStatusOpt = STATUS_OPTIONS.find((s) => s.value === project.status) ?? STATUS_OPTIONS[0];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 sticky top-0 bg-background z-10 border-b border-border">
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

        {/* Status selector */}
        {canEdit ? (
          <Popover>
            <PopoverTrigger asChild>
              <button className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${currentStatusOpt.className}`}>
                {currentStatusOpt.label}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-36 p-1" align="end">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => updateProject.mutate({ id: project.id, status: s.value })}
                  className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent ${project.status === s.value ? "font-semibold" : ""}`}
                >
                  {s.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        ) : (
          <Badge className={`text-[10px] px-1.5 py-0 h-4 font-medium shrink-0 ${currentStatusOpt.className}`}>
            {currentStatusOpt.label}
          </Badge>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4 pt-3">
        {/* Description */}
        {canEdit ? (
          <textarea
            value={descDraft ?? ""}
            onChange={(e) => setDescDraft(e.target.value)}
            onBlur={handleSaveDesc}
            placeholder="Adicionar descrição..."
            className="w-full text-[13px] text-foreground bg-transparent resize-none outline-none min-h-[40px] placeholder:text-muted-foreground"
          />
        ) : project.description ? (
          <p className="text-[13px] text-foreground whitespace-pre-wrap">{project.description}</p>
        ) : null}

        {/* Target date */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Prazo:</span>
          {canEdit ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                  <CalendarIcon size={12} />
                  {project.target_date
                    ? format(parseISO(project.target_date), "dd/MM/yyyy")
                    : "Sem prazo"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={project.target_date ? parseISO(project.target_date) : undefined}
                  onSelect={(d) =>
                    updateProject.mutate({
                      id: project.id,
                      target_date: d ? format(d, "yyyy-MM-dd") : null,
                    })
                  }
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          ) : (
            <span className="text-xs">
              {project.target_date ? format(parseISO(project.target_date), "dd/MM/yyyy") : "—"}
            </span>
          )}
          {isTargetOverdue && (
            <span className="text-xs text-destructive font-medium">
              Prazo vencido há {targetOverdueDays} dia{targetOverdueDays > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Counter cards */}
        <div className="grid grid-cols-2 gap-2">
          {COUNTER_CARDS.map((c) => (
            <div
              key={c.key}
              className="bg-card rounded-lg border border-border p-3 text-center"
            >
              <p className="text-2xl font-semibold" style={{ color: c.color }}>
                {counts[c.key]}
              </p>
              <p className="text-[11px] text-muted-foreground">{c.label}</p>
            </div>
          ))}
        </div>

        {/* Multi-color progress bar */}
        <div className="w-full h-2 rounded-full bg-muted overflow-hidden flex">
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

        {/* Tasks with filter */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-foreground">Tarefas</h2>
          </div>
          <div className="flex items-center gap-1.5 mb-2 overflow-x-auto no-scrollbar">
            {TASK_FILTERS.map((f) => {
              const active = taskFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setTaskFilter(f.key)}
                  className={`shrink-0 h-7 px-2.5 rounded-full text-[11px] font-medium transition-colors ${
                    active ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
          {filteredTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma tarefa</p>
          ) : (
            <div className="space-y-2">
              {filteredTasks.map((card) => (
                <FeedCard key={card.id} card={card} />
              ))}
            </div>
          )}
        </div>

        {/* Meetings */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-foreground">Reuniões</h2>
            {canEdit && (
              <button
                onClick={() => setShowMeetingModal(true)}
                className="text-primary flex items-center gap-1 text-xs font-medium"
              >
                <Plus size={14} /> Reunião
              </button>
            )}
          </div>
          {meetings.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma reunião</p>
          ) : (
            <div className="space-y-2">
              {meetings.map((m) => (
                <button
                  key={m.id}
                  onClick={() => navigate(`/app/task/${m.id}`)}
                  className="w-full text-left bg-card border border-border rounded-xl p-3 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Badge className="text-[10px] px-1.5 py-0 h-4 font-medium bg-[#22C55E]/10 text-[#22C55E] border-none">
                      <Video size={10} className="mr-0.5" /> Reunião
                    </Badge>
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {format(new Date(m.start_date), "dd/MM · HH:mm")}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground truncate">{m.title}</p>
                  {m.assignees.length > 0 && (
                    <div className="flex items-center mt-1.5">
                      {m.assignees.slice(0, 3).map((a, i) => (
                        <Avatar
                          key={a.id}
                          className="h-5 w-5 border-2 border-card"
                          style={{ marginLeft: i > 0 ? -6 : 0, zIndex: 3 - i }}
                        >
                          <AvatarImage src={a.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[8px] bg-muted">
                            {(a.full_name ?? "?").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {m.assignees.length > 3 && (
                        <span className="text-[9px] text-muted-foreground ml-1">
                          +{m.assignees.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </button>
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
                  className="w-full flex items-center justify-between bg-card rounded-lg border border-border px-3 py-2 text-xs"
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
              <button onClick={loadProfiles} className="text-primary">
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
              <div key={m.id} className="flex items-center gap-2 bg-card rounded-lg border border-border px-3 py-2">
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
        <div className="sticky bottom-14 px-4 pb-2 bg-background">
          <Button
            className="w-full bg-primary hover:bg-primary/90"
            onClick={() => setShowNewTask(true)}
          >
            <Plus size={16} className="mr-1" /> Nova Tarefa
          </Button>
        </div>
      )}

      {showNewTask && (
        <div className="sticky bottom-14 px-4 pb-2 bg-background space-y-2 border-t border-border pt-2">
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
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90 text-xs"
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

      {/* Meeting modal */}
      <CreateMeetingModal
        open={showMeetingModal}
        onClose={() => setShowMeetingModal(false)}
        onCreate={(input) => createMeetingMutation.mutate(input)}
        loading={createMeetingMutation.isPending}
      />
    </div>
  );
}
