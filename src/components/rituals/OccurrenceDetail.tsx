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
import { Plus, Send, Lock, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import type { EnrichedOccurrence } from "@/hooks/useRitualOccurrences";
import type { Tables } from "@/integrations/supabase/types";

type Card = Tables<"cards">;
type AssigneeInfo = { id: string; full_name: string | null; avatar_url: string | null };

type OccurrenceCard = Card & {
  assignees: AssigneeInfo[];
  firstSeen: string | null;
  historyCount: number;
  is_overdue: boolean;
};

const STATUS_DOT: Record<string, string> = {
  overdue: "#EF4444",
  in_progress: "#3B82F6",
  completed: "#22C55E",
  pending: "#94A3B8",
};

interface Props {
  occurrence: EnrichedOccurrence;
  previousOccurrenceId: string | null;
  onClose?: () => void;
}

export default function OccurrenceDetail({ occurrence, previousOccurrenceId, onClose }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [notes, setNotes] = useState(occurrence.notes ?? "");
  const [newItemTitle, setNewItemTitle] = useState("");
  const [contextInputs, setContextInputs] = useState<Record<string, string>>({});
  const [activeContextId, setActiveContextId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save notes with debounce
  const saveNotesNow = useCallback(async (value: string) => {
    await supabase
      .from("ritual_occurrences")
      .update({ notes: value })
      .eq("id", occurrence.id);
  }, [occurrence.id]);

  const handleNotesChange = (value: string) => {
    setNotes(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveNotesNow(value);
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Fetch cards for this occurrence
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

      const historyMap = new Map<string, { firstSeen: string | null; count: number }>();
      const { data: historyRows } = await supabase
        .from("task_history")
        .select("card_id, created_at")
        .in("card_id", cardIds)
        .order("created_at", { ascending: true });

      for (const row of historyRows ?? []) {
        const entry = historyMap.get(row.card_id);
        if (!entry) {
          historyMap.set(row.card_id, { firstSeen: row.created_at, count: 1 });
        } else {
          entry.count++;
        }
      }

      return rawCards.map((card): OccurrenceCard => {
        const d = card.end_date || card.start_date;
        const is_overdue = card.status !== "completed" && (d ? new Date(d) < now : false);
        const history = historyMap.get(card.id);
        return {
          ...card,
          assignees: assigneeMap.get(card.id) ?? [],
          firstSeen: history?.firstSeen ?? null,
          historyCount: history?.count ?? 0,
          is_overdue,
        };
      });
    },
    enabled: !!occurrence.id,
  });

  // Summary stats: carried, completed since last, new
  const { data: summaryStats } = useQuery({
    queryKey: ["occurrence-summary", occurrence.id, previousOccurrenceId],
    queryFn: async () => {
      let carried = 0;
      let completedSinceLast = 0;
      const totalCards = cards.length;

      if (previousOccurrenceId) {
        // Cards that were in the previous occurrence and also in this one
        const { data: prevCards } = await supabase
          .from("cards")
          .select("id, status")
          .eq("ritual_occurrence_id", previousOccurrenceId);

        const prevIds = new Set((prevCards ?? []).map((c) => c.id));

        // Cards carried = cards in this occurrence that have task_history referencing previous occ
        const { data: historyCarried } = await supabase
          .from("task_history")
          .select("card_id")
          .eq("ritual_occurrence_id", occurrence.id);

        const carriedIds = new Set<string>();
        for (const h of historyCarried ?? []) {
          if (prevIds.has(h.card_id)) carriedIds.add(h.card_id);
        }
        carried = carriedIds.size;

        // Completed since last = cards from prev occurrence that are now completed
        completedSinceLast = (prevCards ?? []).filter(c => c.status === "completed").length;
      }

      const newItems = totalCards - carried;

      return { carried, completedSinceLast, newItems: Math.max(0, newItems) };
    },
    enabled: !!occurrence.id && cards.length > 0,
  });

  // Close occurrence
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

  // Add new task item
  const addItem = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Erro");
      const { error } = await supabase.from("cards").insert({
        title: newItemTitle.trim(),
        start_date: new Date().toISOString(),
        card_type: "task",
        origin_type: "ritual",
        ritual_occurrence_id: occurrence.id,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewItemTitle("");
      toast.success("Item adicionado");
      qc.invalidateQueries({ queryKey: ["occurrence-cards", occurrence.id] });
      qc.invalidateQueries({ queryKey: ["ritual-occurrences"] });
      qc.invalidateQueries({ queryKey: ["feed-cards"] });
    },
  });

  // Add context note
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
      toast.success("Contexto adicionado");
      setContextInputs((prev) => ({ ...prev, [vars.cardId]: "" }));
      setActiveContextId(null);
      qc.invalidateQueries({ queryKey: ["occurrence-cards", occurrence.id] });
    },
  });

  const isOpen = occurrence.status === "open";

  return (
    <div className="space-y-3 pb-4">
      {/* Notes field — prominent, at top */}
      <div className="border-l-2 border-primary rounded-r-lg bg-primary/5 p-3">
        <p className="text-xs font-medium text-foreground mb-1.5">Notas da reunião</p>
        <Textarea
          placeholder="Registre decisões, observações e contexto da reunião..."
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          className="text-xs resize-none bg-transparent border-none p-0 focus-visible:ring-0 min-h-[120px]"
          disabled={!isOpen}
        />
      </div>

      {/* Summary stats */}
      {summaryStats && (summaryStats.carried > 0 || summaryStats.completedSinceLast > 0 || summaryStats.newItems > 0) && (
        <p className="text-[10px] text-muted-foreground">
          {summaryStats.carried > 0 && `${summaryStats.carried} puxado${summaryStats.carried !== 1 ? "s" : ""}`}
          {summaryStats.carried > 0 && summaryStats.completedSinceLast > 0 && " · "}
          {summaryStats.completedSinceLast > 0 && `${summaryStats.completedSinceLast} concluído${summaryStats.completedSinceLast !== 1 ? "s" : ""} desde a última`}
          {(summaryStats.carried > 0 || summaryStats.completedSinceLast > 0) && summaryStats.newItems > 0 && " · "}
          {summaryStats.newItems > 0 && `${summaryStats.newItems} novo${summaryStats.newItems !== 1 ? "s" : ""}`}
        </p>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">
          {format(new Date(occurrence.date), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
        <Badge
          className={`text-[10px] px-1.5 py-0 h-4 font-medium border-none ${
            isOpen ? "bg-[#3B82F6]/10 text-[#3B82F6]" : "bg-[#94A3B8]/10 text-[#94A3B8]"
          }`}
        >
          {isOpen ? "Aberta" : "Fechada"}
        </Badge>
      </div>

      {/* Cards list */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : cards.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum item nesta ocorrência</p>
      ) : (
        <div className="space-y-1.5">
          {cards.map((card) => {
            const displayStatus = card.is_overdue ? "overdue" : card.status;
            const dotColor = STATUS_DOT[displayStatus] ?? STATUS_DOT.pending;
            const assignee = card.assignees[0];
            const sinceStr = card.firstSeen
              ? format(new Date(card.firstSeen), "MMM/yy", { locale: ptBR })
              : null;

            return (
              <div key={card.id} className="bg-card border border-border rounded-lg p-3">
                <button
                  onClick={() => navigate(`/app/task/${card.id}`)}
                  className="w-full text-left flex items-start gap-2"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full mt-1 shrink-0"
                    style={{ backgroundColor: dotColor }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{card.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {sinceStr && `desde ${sinceStr}`}
                      {sinceStr && card.historyCount > 0 && " · "}
                      {card.historyCount > 0 && `${card.historyCount} atualização${card.historyCount !== 1 ? "ões" : ""}`}
                    </p>
                  </div>
                  {assignee && (
                    <Avatar className="h-5 w-5 shrink-0">
                      <AvatarImage src={assignee.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[8px]">
                        {(assignee.full_name ?? "?").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </button>

                {isOpen && (
                  <>
                    {activeContextId === card.id ? (
                      <div className="flex gap-1.5 mt-2">
                        <Input
                          placeholder="Nota de contexto..."
                          className="h-7 text-xs flex-1"
                          value={contextInputs[card.id] ?? ""}
                          onChange={(e) =>
                            setContextInputs((prev) => ({ ...prev, [card.id]: e.target.value }))
                          }
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && contextInputs[card.id]?.trim()) {
                              addContextNote.mutate({ cardId: card.id, note: contextInputs[card.id].trim() });
                            }
                          }}
                        />
                        <button
                          onClick={() => {
                            if (contextInputs[card.id]?.trim()) {
                              addContextNote.mutate({ cardId: card.id, note: contextInputs[card.id].trim() });
                            }
                          }}
                          className="text-primary"
                        >
                          <Send size={14} />
                        </button>
                        <button onClick={() => setActiveContextId(null)} className="text-muted-foreground">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setActiveContextId(card.id)}
                        className="text-[10px] text-primary mt-1.5"
                      >
                        + Atualizar contexto
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add new item */}
      {isOpen && (
        <div className="flex gap-1.5">
          <Input
            placeholder="Adicionar novo item..."
            className="h-8 text-xs flex-1"
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newItemTitle.trim()) addItem.mutate();
            }}
          />
          <Button
            size="sm"
            className="h-8 bg-primary hover:bg-primary/90 px-2"
            onClick={() => newItemTitle.trim() && addItem.mutate()}
            disabled={!newItemTitle.trim() || addItem.isPending}
          >
            <Plus size={14} />
          </Button>
        </div>
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
