import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Plus, Lock, Trash2, ChevronDown, Check, X } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useAssigneeOptions } from "@/hooks/useAssigneeOptions";
import type { EnrichedOccurrence } from "@/hooks/useRitualOccurrences";
import type { Tables } from "@/integrations/supabase/types";

type Card = Tables<"cards">;
type AssigneeInfo = { id: string; full_name: string | null; avatar_url: string | null };

type OccurrenceCard = Card & {
  assignees: AssigneeInfo[];
  firstSeen: string | null;
  historyCount: number;
  is_overdue: boolean;
  isNewThisOcc: boolean;
  lastContextNote: string | null;
};

const STATUS_CYCLE = ["pending", "in_progress", "completed", "cancelled"];

interface Props {
  occurrence: EnrichedOccurrence;
  previousOccurrenceId: string | null;
}

/* ─── Status Circle ─── */
function StatusCircle({
  status,
  onClick,
  disabled,
}: {
  status: string;
  onClick: () => void;
  disabled: boolean;
}) {
  const config: Record<string, { border: string; bg: string; content: React.ReactNode }> = {
    pending: {
      border: "#94A3B8",
      bg: "#F8FAFC",
      content: <span className="rounded-full" style={{ width: 8, height: 8, backgroundColor: "#94A3B8", display: "block" }} />,
    },
    in_progress: {
      border: "#F59E0B",
      bg: "#FFFBEB",
      content: <span className="rounded-full" style={{ width: 8, height: 8, backgroundColor: "#F59E0B", display: "block" }} />,
    },
    completed: {
      border: "#22C55E",
      bg: "#F0FDF4",
      content: <Check size={14} style={{ color: "#22C55E" }} strokeWidth={3} />,
    },
    cancelled: {
      border: "#EF4444",
      bg: "#FEF2F2",
      content: <X size={14} style={{ color: "#EF4444" }} strokeWidth={3} />,
    },
  };
  const c = config[status] ?? config.pending;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={disabled}
      className="shrink-0 flex items-center justify-center rounded-full border-2 transition-colors"
      style={{
        width: 32,
        height: 32,
        borderColor: c.border,
        backgroundColor: c.bg,
      }}
    >
      {c.content}
    </button>
  );
}

/* ─── Carry-forward label helper ─── */
function carryLabel(count: number): { text: string; color: string } | null {
  if (count <= 0) return null;
  const text = count === 1 ? "1 reunião" : `${count} reuniões`;
  if (count > 3) return { text, color: "#EF4444" };
  if (count >= 2) return { text, color: "#F59E0B" };
  return { text, color: "#94A3B8" };
}

export default function OccurrenceDetail({ occurrence, previousOccurrenceId }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { options: assigneeOptions } = useAssigneeOptions();

  /* ── Notes ── */
  const [notes, setNotes] = useState(occurrence.notes ?? "");
  const [editingNotes, setEditingNotes] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveNotesNow = useCallback(async (value: string) => {
    await supabase.from("ritual_occurrences").update({ notes: value }).eq("id", occurrence.id);
  }, [occurrence.id]);

  const handleNotesChange = (value: string) => {
    setNotes(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveNotesNow(value), 1000);
  };

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  /* ── New item form ── */
  const [newTitle, setNewTitle] = useState("");
  const [newAssignee, setNewAssignee] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  /* ── Expanded context ── */
  const [expandedContextId, setExpandedContextId] = useState<string | null>(null);
  const [contextInputs, setContextInputs] = useState<Record<string, string>>({});

  /* ── Collapsible sections ── */
  const [doneOpen, setDoneOpen] = useState(false);
  const [cancelledOpen, setCancelledOpen] = useState(false);

  /* ── Fetch cards ── */
  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["occurrence-cards", occurrence.id],
    queryFn: async () => {
      const { data: rawCards } = await supabase
        .from("cards")
        .select("*")
        .eq("ritual_occurrence_id", occurrence.id)
        .order("created_at", { ascending: true });

      if (!rawCards?.length) return [] as OccurrenceCard[];

      const cardIds = rawCards.map((c) => c.id);
      const now = new Date();

      const assigneeMap = new Map<string, AssigneeInfo[]>();
      const { data: assigneeRows } = await supabase
        .from("card_assignees")
        .select("card_id, profile_id, profiles(id, full_name, avatar_url)")
        .in("card_id", cardIds);

      for (const row of assigneeRows ?? []) {
        const p = row.profiles as unknown as AssigneeInfo | null;
        if (!p) continue;
        const list = assigneeMap.get(row.card_id) ?? [];
        list.push(p);
        assigneeMap.set(row.card_id, list);
      }

      const historyMap = new Map<string, { firstSeen: string | null; count: number; lastNote: string | null }>();
      const { data: historyRows } = await supabase
        .from("task_history")
        .select("card_id, created_at, context_note, ritual_occurrence_id")
        .in("card_id", cardIds)
        .order("created_at", { ascending: true });

      const carriedCardIds = new Set<string>();
      for (const row of historyRows ?? []) {
        if (previousOccurrenceId && row.ritual_occurrence_id === previousOccurrenceId) {
          carriedCardIds.add(row.card_id);
        }
        const entry = historyMap.get(row.card_id);
        if (!entry) {
          historyMap.set(row.card_id, { firstSeen: row.created_at, count: 1, lastNote: row.context_note });
        } else {
          entry.count++;
          if (row.context_note) entry.lastNote = row.context_note;
        }
      }

      return rawCards.map((card): OccurrenceCard => {
        const d = card.end_date || card.start_date;
        const is_overdue = card.status !== "completed" && card.status !== "cancelled" && card.end_date
          ? new Date(card.end_date) < now
          : false;
        const history = historyMap.get(card.id);
        const isNewThisOcc = !carriedCardIds.has(card.id) && !previousOccurrenceId
          ? true
          : !carriedCardIds.has(card.id);
        return {
          ...card,
          assignees: assigneeMap.get(card.id) ?? [],
          firstSeen: history?.firstSeen ?? card.created_at,
          historyCount: history?.count ?? 0,
          is_overdue,
          isNewThisOcc,
          lastContextNote: history?.lastNote ?? null,
        };
      });
    },
    enabled: !!occurrence.id,
  });

  /* ── Categorize ── */
  const pendingAndActive = cards.filter((c) => c.status === "pending" || c.status === "in_progress");
  const completedCards = cards.filter((c) => c.status === "completed");
  const cancelledCards = cards.filter((c) => c.status === "cancelled");

  const carriedCount = cards.filter((c) => !c.isNewThisOcc).length;
  const newCount = cards.filter((c) => c.isNewThisOcc).length;
  const isOpen = occurrence.status === "open";

  /* ── Mutations ── */
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["occurrence-cards", occurrence.id] });
    qc.invalidateQueries({ queryKey: ["ritual-occurrences"] });
    qc.invalidateQueries({ queryKey: ["feed-cards"] });
    qc.invalidateQueries({ queryKey: ["carry-forward"] });
  };

  const updateCardStatus = useMutation({
    mutationFn: async ({ cardId, newStatus }: { cardId: string; newStatus: string }) => {
      const { error } = await supabase.from("cards").update({ status: newStatus }).eq("id", cardId);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const addItem = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Erro");
      const { data: card, error } = await supabase.from("cards").insert({
        title: newTitle.trim(),
        start_date: new Date().toISOString(),
        card_type: "task",
        origin_type: "ritual",
        ritual_occurrence_id: occurrence.id,
        created_by: user.id,
      }).select().single();
      if (error) throw error;

      if (newAssignee && card) {
        const opt = assigneeOptions.find((o) => o.id === newAssignee);
        if (opt?.type === "profile") {
          await supabase.from("card_assignees").insert({ card_id: card.id, profile_id: newAssignee });
        } else if (opt?.type === "contact") {
          await supabase.from("card_contact_assignees").insert({ card_id: card.id, contact_id: newAssignee });
        }
      }
    },
    onSuccess: () => {
      setNewTitle("");
      setNewAssignee("");
      setShowAddForm(false);
      toast.success("Item adicionado");
      invalidateAll();
    },
  });

  const addContextNote = useMutation({
    mutationFn: async ({ cardId, note }: { cardId: string; note: string }) => {
      if (!user) throw new Error("Erro");
      const card = cards.find((c) => c.id === cardId);
      const { error } = await supabase.from("task_history").insert({
        card_id: cardId,
        ritual_occurrence_id: occurrence.id,
        status_at_time: card?.status ?? "pending",
        updated_by: user.id,
        context_note: note,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success("Observação salva");
      setContextInputs((prev) => ({ ...prev, [vars.cardId]: "" }));
      setExpandedContextId(null);
      qc.invalidateQueries({ queryKey: ["occurrence-cards", occurrence.id] });
    },
  });

  const closeOccurrence = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ritual_occurrences").update({ status: "closed" }).eq("id", occurrence.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ocorrência fechada");
      qc.invalidateQueries({ queryKey: ["ritual-occurrences"] });
      qc.invalidateQueries({ queryKey: ["rituals"] });
    },
  });

  const deleteOccurrence = useMutation({
    mutationFn: async () => {
      await supabase.from("cards").update({ ritual_occurrence_id: null }).eq("ritual_occurrence_id", occurrence.id);
      await supabase.from("task_history").update({ ritual_occurrence_id: null }).eq("ritual_occurrence_id", occurrence.id);
      const { error } = await supabase.from("ritual_occurrences").delete().eq("id", occurrence.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ocorrência excluída. As tarefas foram preservadas.");
      invalidateAll();
      qc.invalidateQueries({ queryKey: ["rituals"] });
    },
  });

  const handleStatusCycle = (card: OccurrenceCard) => {
    if (!isOpen) return;
    const currentIdx = STATUS_CYCLE.indexOf(card.status);
    const nextIdx = (currentIdx + 1) % STATUS_CYCLE.length;
    updateCardStatus.mutate({ cardId: card.id, newStatus: STATUS_CYCLE[nextIdx] });
  };

  /* ── Render a single item card ── */
  const renderCard = (card: OccurrenceCard) => {
    const isCompleted = card.status === "completed";
    const isCancelled = card.status === "cancelled";
    const isDimmed = isCompleted || isCancelled;
    const assignee = card.assignees[0];
    const sinceStr = card.firstSeen
      ? format(new Date(card.firstSeen), "MMM/yy", { locale: ptBR })
      : null;
    const isExpanded = expandedContextId === card.id;

    // Build meta line
    const metaParts: React.ReactNode[] = [];
    if (card.isNewThisOcc) {
      metaParts.push(
        <span key="new" style={{ color: "#4F46E5", fontWeight: 500 }}>novo</span>
      );
    } else {
      const cl = carryLabel(card.historyCount);
      if (sinceStr) {
        metaParts.push(
          <span key="since" style={{ color: cl?.color ?? "#6B6B6B" }}>
            desde {sinceStr}
          </span>
        );
      }
      if (cl) {
        metaParts.push(
          <span key="count" style={{ color: cl.color }}>{cl.text}</span>
        );
      }
    }
    if (assignee?.full_name) {
      metaParts.push(<span key="assignee">{assignee.full_name}</span>);
    }

    return (
      <div
        key={card.id}
        style={{
          border: "0.5px solid #EEEEE9",
          borderRadius: 10,
          padding: 12,
          backgroundColor: "#fff",
        }}
      >
        <div className="flex items-start gap-3">
          {/* Status circle */}
          <StatusCircle
            status={card.status}
            onClick={() => handleStatusCycle(card)}
            disabled={!isOpen}
          />

          {/* Content area — tappable to toggle observation */}
          <div
            className="flex-1 min-w-0 cursor-pointer"
            onClick={() => {
              if (!isOpen) { navigate(`/app/task/${card.id}`); return; }
              setExpandedContextId(isExpanded ? null : card.id);
            }}
          >
            {/* Line 1 — Title */}
            <p
              className="text-sm leading-snug"
              style={{
                fontWeight: 500,
                color: isDimmed ? "#94A3B8" : "#1A1A1A",
                textDecoration: isDimmed ? "line-through" : "none",
                opacity: isCancelled ? 0.6 : 1,
              }}
            >
              {card.title}
            </p>

            {/* Line 2 — Meta */}
            {metaParts.length > 0 && (
              <p className="mt-0.5 flex items-center gap-0 flex-wrap" style={{ fontSize: 11, color: "#6B6B6B" }}>
                {metaParts.map((part, i) => (
                  <span key={i} className="flex items-center">
                    {i > 0 && <span className="mx-1">·</span>}
                    {part}
                  </span>
                ))}
              </p>
            )}

            {/* Line 3 — Last context note */}
            {card.lastContextNote && !isExpanded && (
              <div
                className="mt-1.5 rounded-md px-2 py-1.5"
                style={{ backgroundColor: "#F4F4F1", borderRadius: 6 }}
              >
                <p className="text-xs italic" style={{ color: "#6B6B6B" }}>
                  {card.lastContextNote}
                </p>
              </div>
            )}

            {/* Expandable observation input */}
            {isOpen && isExpanded && (
              <div className="mt-2 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                <Textarea
                  placeholder="Adicionar observação..."
                  className="text-xs resize-none min-h-[60px]"
                  value={contextInputs[card.id] ?? ""}
                  onChange={(e) =>
                    setContextInputs((prev) => ({ ...prev, [card.id]: e.target.value }))
                  }
                  autoFocus
                />
                <div className="flex gap-1.5 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => setExpandedContextId(null)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    className="h-6 text-[10px] px-2 bg-primary"
                    onClick={() => {
                      if (contextInputs[card.id]?.trim()) {
                        addContextNote.mutate({ cardId: card.id, note: contextInputs[card.id].trim() });
                      }
                    }}
                    disabled={!contextInputs[card.id]?.trim()}
                  >
                    Salvar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  /* ── Summary text ── */
  const summaryParts: string[] = [];
  if (carriedCount > 0) summaryParts.push(`${carriedCount} ite${carriedCount !== 1 ? "ns" : "m"} puxado${carriedCount !== 1 ? "s" : ""}`);
  if (newCount > 0) summaryParts.push(`${newCount} novo${newCount !== 1 ? "s" : ""}`);
  if (completedCards.length > 0) summaryParts.push(`${completedCards.length} concluído${completedCards.length !== 1 ? "s" : ""}`);
  if (cancelledCards.length > 0) summaryParts.push(`${cancelledCards.length} cancelado${cancelledCards.length !== 1 ? "s" : ""}`);
  const summaryText = carriedCount === 0 && newCount > 0
    ? "Todos os itens são novos nesta ocorrência"
    : summaryParts.join(" · ") || "Nenhum item";

  return (
    <div className="space-y-3 pb-4">
      {/* ── Meeting Notes ── */}
      {isOpen ? (
        <div
          className="rounded-r-lg p-3"
          style={{
            borderLeft: notes.trim() ? "3px solid #4F46E5" : "3px solid #CBD5E1",
            backgroundColor: notes.trim() ? "#EEF2FF" : "#F8FAFC",
          }}
        >
          <Textarea
            placeholder="Registre decisões e observações da reunião aqui..."
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            className="text-xs resize-none bg-transparent border-none p-0 focus-visible:ring-0 min-h-[80px] placeholder:text-muted-foreground/70"
          />
        </div>
      ) : notes.trim() ? (
        <div
          className="rounded-r-lg p-3"
          style={{ borderLeft: "3px solid #4F46E5", backgroundColor: "#EEF2FF" }}
        >
          <p className="text-xs whitespace-pre-wrap" style={{ color: "#1A1A1A" }}>{notes}</p>
        </div>
      ) : null}

      {/* ── Summary Card ── */}
      <div
        className="rounded-lg px-3 py-2"
        style={{ backgroundColor: "#EEF2FF", borderRadius: 8 }}
      >
        <p className="text-xs font-medium" style={{ color: "#4F46E5" }}>
          {summaryText}
        </p>
        <span className="text-[10px]" style={{ color: "#6B6B6B" }}>
          {format(new Date(occurrence.date), "d MMM yyyy", { locale: ptBR })}
        </span>
      </div>

      {/* ── Items ── */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : cards.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">Nenhum item nesta ocorrência</p>
      ) : (
        <div className="space-y-3">
          {/* Active items */}
          {pendingAndActive.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Pendentes e em andamento ({pendingAndActive.length})
              </p>
              <div className="space-y-1">
                {pendingAndActive.map(renderCard)}
              </div>
            </div>
          )}

          {/* Completed — collapsible, closed by default */}
          {completedCards.length > 0 && (
            <Collapsible open={doneOpen} onOpenChange={setDoneOpen}>
              <CollapsibleTrigger className="flex items-center gap-1 w-full text-left">
                <ChevronDown
                  size={12}
                  className={`transition-transform text-muted-foreground ${doneOpen ? "rotate-180" : ""}`}
                />
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Concluídos nesta ({completedCards.length})
                </p>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-1 mt-1.5">
                  {completedCards.map(renderCard)}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Cancelled — collapsible, closed by default */}
          {cancelledCards.length > 0 && (
            <Collapsible open={cancelledOpen} onOpenChange={setCancelledOpen}>
              <CollapsibleTrigger className="flex items-center gap-1 w-full text-left">
                <ChevronDown
                  size={12}
                  className={`transition-transform text-muted-foreground ${cancelledOpen ? "rotate-180" : ""}`}
                />
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Cancelados ({cancelledCards.length})
                </p>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-1 mt-1.5">
                  {cancelledCards.map(renderCard)}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}

      {/* ── Add new item ── */}
      {isOpen && (
        <>
          {showAddForm ? (
            <div
              className="rounded-lg p-3 space-y-2"
              style={{ border: "0.5px solid #EEEEE9", backgroundColor: "#fff" }}
            >
              <Input
                placeholder="Título do item..."
                className="h-8 text-xs"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                autoFocus
              />
              <Select value={newAssignee} onValueChange={setNewAssignee}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Responsável (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {user && (
                    <SelectItem value={user.id} className="text-xs font-medium">
                      Eu mesmo
                    </SelectItem>
                  )}
                  {assigneeOptions
                    .filter((o) => o.id !== user?.id)
                    .map((opt) => (
                      <SelectItem key={opt.id} value={opt.id} className="text-xs">
                        {opt.full_name}
                        {opt.type === "contact" && (
                          <span className="text-muted-foreground ml-1">(contato)</span>
                        )}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <div className="flex gap-1.5 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => { setShowAddForm(false); setNewTitle(""); setNewAssignee(""); }}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs bg-primary"
                  onClick={() => newTitle.trim() && addItem.mutate()}
                  disabled={!newTitle.trim() || addItem.isPending}
                >
                  Adicionar
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => setShowAddForm(true)}
            >
              <Plus size={14} className="mr-1" /> Adicionar item
            </Button>
          )}
        </>
      )}

      {/* ── Close / Delete ── */}
      {isOpen && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            onClick={() => closeOccurrence.mutate()}
            disabled={closeOccurrence.isPending}
          >
            <Lock size={12} className="mr-1" /> Fechar ocorrência
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive">
                <Trash2 size={12} className="mr-1" /> Excluir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir ocorrência?</AlertDialogTitle>
                <AlertDialogDescription>
                  {cards.length > 0
                    ? `Esta ocorrência tem ${cards.length} ite${cards.length !== 1 ? "ns" : "m"} e notas. As tarefas serão PRESERVADAS no sistema, mas as observações registradas nesta reunião serão perdidas.`
                    : "As observações registradas nesta reunião serão perdidas."}
                  {"\n\nDeseja continuar?"}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => deleteOccurrence.mutate()}
                  disabled={deleteOccurrence.isPending}
                >
                  Excluir mesmo assim
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
