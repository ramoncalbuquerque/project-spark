import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Lock, ChevronDown, ChevronUp } from "lucide-react";
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

// Status rotation: pending → in_progress → completed → not_done → pending
const STATUS_CYCLE = ["pending", "in_progress", "completed", "not_done"];
const STATUS_COLORS: Record<string, string> = {
  pending: "#94A3B8",
  in_progress: "#F59E0B",
  completed: "#22C55E",
  not_done: "#EF4444",
  overdue: "#EF4444",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  completed: "Concluído",
  not_done: "Não feito",
};

interface Props {
  occurrence: EnrichedOccurrence;
  previousOccurrenceId: string | null;
}

export default function OccurrenceDetail({ occurrence, previousOccurrenceId }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { options: assigneeOptions } = useAssigneeOptions();

  // Notes state with debounce
  const [notes, setNotes] = useState(occurrence.notes ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveNotesNow = useCallback(async (value: string) => {
    await supabase
      .from("ritual_occurrences")
      .update({ notes: value })
      .eq("id", occurrence.id);
  }, [occurrence.id]);

  const handleNotesChange = (value: string) => {
    setNotes(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveNotesNow(value), 1000);
  };

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  // New item form
  const [newTitle, setNewTitle] = useState("");
  const [newAssignee, setNewAssignee] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // Expanded context cards
  const [expandedContextId, setExpandedContextId] = useState<string | null>(null);
  const [contextInputs, setContextInputs] = useState<Record<string, string>>({});

  // Fetch cards
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

      // Assignees
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

      // History
      const historyMap = new Map<string, { firstSeen: string | null; count: number; lastNote: string | null }>();
      const { data: historyRows } = await supabase
        .from("task_history")
        .select("card_id, created_at, context_note, ritual_occurrence_id")
        .in("card_id", cardIds)
        .order("created_at", { ascending: true });

      // Track which cards have history referencing previous occurrence (= carried)
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
        const is_overdue = card.status !== "completed" && (d ? new Date(d) < now : false);
        const history = historyMap.get(card.id);
        const isNewThisOcc = !carriedCardIds.has(card.id) && !previousOccurrenceId
          ? true // first occurrence, everything is "new"
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

  // Summary
  const carried = cards.filter((c) => !c.isNewThisOcc).length;
  const completedCards = cards.filter((c) => c.status === "completed").length;
  const newCards = cards.filter((c) => c.isNewThisOcc).length;

  // Sort: active first, completed at bottom
  const activeCards = cards.filter((c) => c.status !== "completed");
  const doneCards = cards.filter((c) => c.status === "completed");

  const isOpen = occurrence.status === "open";

  // Mutations
  const updateCardStatus = useMutation({
    mutationFn: async ({ cardId, newStatus }: { cardId: string; newStatus: string }) => {
      const { error } = await supabase
        .from("cards")
        .update({ status: newStatus })
        .eq("id", cardId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["occurrence-cards", occurrence.id] });
      qc.invalidateQueries({ queryKey: ["ritual-occurrences"] });
      qc.invalidateQueries({ queryKey: ["feed-cards"] });
    },
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

      // Assign if selected
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
      qc.invalidateQueries({ queryKey: ["occurrence-cards", occurrence.id] });
      qc.invalidateQueries({ queryKey: ["ritual-occurrences"] });
      qc.invalidateQueries({ queryKey: ["feed-cards"] });
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
      const { error } = await supabase
        .from("ritual_occurrences")
        .update({ status: "closed" })
        .eq("id", occurrence.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ocorrência fechada");
      qc.invalidateQueries({ queryKey: ["ritual-occurrences"] });
      qc.invalidateQueries({ queryKey: ["rituals"] });
    },
  });

  const handleStatusCycle = (card: OccurrenceCard) => {
    if (!isOpen) return;
    const currentIdx = STATUS_CYCLE.indexOf(card.status);
    const nextStatus = STATUS_CYCLE[(currentIdx + 1) % STATUS_CYCLE.length];
    updateCardStatus.mutate({ cardId: card.id, newStatus: nextStatus });
  };

  const renderCard = (card: OccurrenceCard) => {
    const displayStatus = card.is_overdue && card.status === "pending" ? "overdue" : card.status;
    const color = STATUS_COLORS[displayStatus] ?? STATUS_COLORS.pending;
    const isCompleted = card.status === "completed";
    const isNotDone = card.status === "not_done";
    const assignee = card.assignees[0];
    const sinceStr = card.firstSeen
      ? format(new Date(card.firstSeen), "MMM/yy", { locale: ptBR })
      : null;

    return (
      <div
        key={card.id}
        className={`bg-card border border-border rounded-lg p-3 ${isCompleted ? "opacity-70" : ""}`}
      >
        <div className="flex items-start gap-3">
          {/* Status circle */}
          <button
            onClick={() => handleStatusCycle(card)}
            disabled={!isOpen}
            className="shrink-0 mt-0.5 flex items-center justify-center"
            style={{ width: 28, height: 28 }}
          >
            <div
              className="rounded-full border-2 flex items-center justify-center transition-colors"
              style={{
                width: 24,
                height: 24,
                borderColor: color,
                backgroundColor: isCompleted || isNotDone ? color : "transparent",
              }}
            >
              {isCompleted && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {isNotDone && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3 3L9 9M9 3L3 9" stroke="white" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </div>
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <button
              onClick={() => navigate(`/app/task/${card.id}`)}
              className="text-left w-full"
            >
              <p className={`text-[13px] font-medium text-foreground truncate ${isCompleted ? "line-through" : ""}`}>
                {card.title}
              </p>
            </button>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {card.isNewThisOcc ? (
                <span className="text-primary font-medium">novo nesta ocorrência</span>
              ) : (
                <>
                  {sinceStr && (
                    <span style={{ color: card.historyCount >= 3 ? STATUS_COLORS.overdue : card.historyCount >= 2 ? STATUS_COLORS.in_progress : undefined }}>
                      desde {sinceStr}
                    </span>
                  )}
                  {sinceStr && card.historyCount > 0 && " · "}
                  {card.historyCount > 0 && `${card.historyCount} ocorrência${card.historyCount !== 1 ? "s" : ""}`}
                </>
              )}
              {assignee && (
                <>
                  {" · "}
                  {assignee.full_name ?? "Sem nome"}
                </>
              )}
            </p>

            {/* Last context note */}
            {card.lastContextNote && (
              <div className="mt-1.5 bg-muted/50 rounded px-2 py-1">
                <p className="text-[10px] text-muted-foreground italic">{card.lastContextNote}</p>
              </div>
            )}

            {/* Expandable context input */}
            {isOpen && (
              <>
                {expandedContextId === card.id ? (
                  <div className="mt-2 space-y-1.5">
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
                ) : (
                  <button
                    onClick={() => setExpandedContextId(card.id)}
                    className="text-[10px] text-primary mt-1.5 flex items-center gap-0.5"
                  >
                    <ChevronDown size={10} /> Observação
                  </button>
                )}
              </>
            )}
          </div>

          {/* Avatar */}
          {assignee && (
            <Avatar className="h-6 w-6 shrink-0 mt-0.5">
              <AvatarImage src={assignee.avatar_url ?? undefined} />
              <AvatarFallback className="text-[9px]">
                {(assignee.full_name ?? "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3 pb-4">
      {/* Section 1 — Summary */}
      <div className="bg-primary/5 border border-primary/10 rounded-lg px-3 py-2.5">
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-foreground font-medium">
            {carried > 0 && `${carried} puxado${carried !== 1 ? "s" : ""}`}
            {carried > 0 && completedCards > 0 && " · "}
            {completedCards > 0 && `${completedCards} concluído${completedCards !== 1 ? "s" : ""}`}
            {(carried > 0 || completedCards > 0) && newCards > 0 && " · "}
            {newCards > 0 && `${newCards} novo${newCards !== 1 ? "s" : ""}`}
            {carried === 0 && completedCards === 0 && newCards === 0 && "Nenhum item"}
          </p>
          <span className="text-[10px] text-muted-foreground">
            {format(new Date(occurrence.date), "d MMM yyyy", { locale: ptBR })}
          </span>
        </div>
      </div>

      {/* Section 2 — Meeting notes */}
      <div className="border-l-[3px] border-primary rounded-r-lg bg-primary/5 p-3">
        <p className="text-[11px] font-medium text-foreground mb-1.5">Notas da reunião</p>
        <Textarea
          placeholder="Registre decisões, observações e contexto..."
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          className="text-xs resize-none bg-transparent border-none p-0 focus-visible:ring-0 min-h-[120px]"
          disabled={!isOpen}
        />
      </div>

      {/* Section 3 — Items */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : cards.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">Nenhum item nesta ocorrência</p>
      ) : (
        <div className="space-y-1.5">
          {activeCards.map(renderCard)}
          {doneCards.length > 0 && (
            <>
              <p className="text-[10px] text-muted-foreground pt-2 pb-1 font-medium">
                Concluídos ({doneCards.length})
              </p>
              {doneCards.map(renderCard)}
            </>
          )}
        </div>
      )}

      {/* Add new item */}
      {isOpen && (
        <>
          {showAddForm ? (
            <div className="bg-card border border-border rounded-lg p-3 space-y-2">
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
                  {assigneeOptions.map((opt) => (
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

      {/* Close occurrence */}
      {isOpen && (
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={() => closeOccurrence.mutate()}
          disabled={closeOccurrence.isPending}
        >
          <Lock size={12} className="mr-1" /> Fechar ocorrência
        </Button>
      )}
    </div>
  );
}
