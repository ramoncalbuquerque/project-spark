import { useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Check, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format, addWeeks, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useRituals, FREQ_LABEL } from "@/hooks/useRituals";
import { useRitualOccurrences } from "@/hooks/useRitualOccurrences";
import { useCarryForward } from "@/hooks/useCarryForward";
import OccurrenceDetail from "@/components/rituals/OccurrenceDetail";
import CarryForwardReviewModal from "@/components/rituals/CarryForwardReviewModal";

const FREQ_BADGE_COLOR: Record<string, string> = {
  weekly: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  biweekly: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  monthly: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  custom: "bg-muted text-muted-foreground",
};

function getNextSuggestion(lastDate: string, frequency: string | null): string | null {
  if (!frequency) return null;
  const d = new Date(lastDate);
  let next: Date;
  switch (frequency) {
    case "weekly": next = addWeeks(d, 1); break;
    case "biweekly": next = addWeeks(d, 2); break;
    case "monthly": next = addMonths(d, 1); break;
    default: return null;
  }
  return format(next, "dd/MM/yyyy");
}

export default function RitualDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { rituals, updateRitual, deleteRitual } = useRituals();
  const { occurrences, isLoading: occsLoading, createOccurrence } = useRitualOccurrences(id);
  const {
    pendingItems, completedCount, lastOccurrenceDate, lastOccurrenceId,
  } = useCarryForward(id);

  const ritual = rituals.find((r) => r.id === id);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Deletion stats
  const [deletionStats, setDeletionStats] = useState<{ occCount: number; cardCount: number } | null>(null);

  // Objective field
  const [objective, setObjective] = useState<string | null>(null);
  const objectiveRef = useRef<HTMLTextAreaElement>(null);
  const currentObjective = objective ?? ritual?.description ?? "";

  const handleObjectiveBlur = useCallback(() => {
    if (!ritual || objective === null) return;
    const trimmed = objective.trim();
    if (trimmed !== (ritual.description ?? "")) {
      updateRitual.mutate({ id: ritual.id, description: trimmed || "" });
    }
  }, [ritual, objective, updateRitual]);

  const pendingCount = ritual?.lastOccurrence?.pendingCount ?? 0;

  const lastOcc = occurrences.length > 0 ? occurrences[0] : null;
  const nextSuggestion = lastOcc && ritual?.frequency
    ? getNextSuggestion(lastOcc.date, ritual.frequency)
    : null;

  const handleConfirmCreate = async (selectedCardIds: string[], date: Date) => {
    if (!id || !user) return;
    setCreating(true);
    try {
      const newOcc = await createOccurrence.mutateAsync({ date: date.toISOString() });

      // For each selected card: move to new occurrence + record history on PREVIOUS occurrence
      for (const cardId of selectedCardIds) {
        const card = pendingItems.find((c) => c.id === cardId);
        await supabase
          .from("cards")
          .update({ ritual_occurrence_id: newOcc.id })
          .eq("id", cardId);

        await supabase.from("task_history").insert({
          card_id: cardId,
          ritual_occurrence_id: lastOccurrenceId,
          status_at_time: card?.status ?? "pending",
          updated_by: user.id,
          context_note: "Carry-forward automático",
        });
      }

      setReviewOpen(false);
      qc.invalidateQueries({ queryKey: ["carry-forward", id] });
      qc.invalidateQueries({ queryKey: ["ritual-occurrences", id] });
      qc.invalidateQueries({ queryKey: ["rituals"] });
      qc.invalidateQueries({ queryKey: ["feed-cards"] });

      toast.success(
        selectedCardIds.length > 0
          ? `Ocorrência criada com ${selectedCardIds.length} item(ns) puxados`
          : "Nova ocorrência criada"
      );
    } catch {
      toast.error("Erro ao criar ocorrência");
    } finally {
      setCreating(false);
    }
  };

  if (!ritual) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <p className="text-sm">Ritualística não encontrada</p>
        <Button variant="ghost" size="sm" onClick={() => navigate("/app/rituals")}>Voltar</Button>
      </div>
    );
  }

  const defaultOpen = occurrences.length > 0 ? [occurrences[0].id] : [];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-4 py-3 sticky top-0 bg-background z-10 border-b border-border space-y-2">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/app/rituals")} className="p-1">
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
              <button onClick={() => {
                if (editName.trim()) updateRitual.mutate({ id: ritual.id, name: editName.trim() });
                setEditing(false);
              }}>
                <Check size={16} className="text-[#22C55E]" />
              </button>
              <button onClick={() => setEditing(false)}>
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <h1 className="text-base font-medium text-foreground truncate">{ritual.name}</h1>
              {ritual.frequency && (
                <Badge className={`text-[10px] px-1.5 py-0 h-4 font-medium border-none shrink-0 ${FREQ_BADGE_COLOR[ritual.frequency] ?? FREQ_BADGE_COLOR.custom}`}>
                  {FREQ_LABEL[ritual.frequency] ?? ritual.frequency}
                </Badge>
              )}
              <button onClick={() => { setEditName(ritual.name); setEditing(true); }}>
                <Pencil size={14} className="text-muted-foreground" />
              </button>
            </div>
          )}

          {pendingCount > 0 && (
            <Badge className="bg-destructive/10 text-destructive border-none text-[10px] px-1.5 py-0 h-4 font-medium shrink-0">
              {pendingCount}
            </Badge>
          )}
        </div>

        <Textarea
          ref={objectiveRef}
          placeholder="Descreva o objetivo desta ritualística..."
          value={currentObjective}
          onChange={(e) => setObjective(e.target.value)}
          onBlur={handleObjectiveBlur}
          rows={2}
          className="text-xs resize-none min-h-[40px]"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4 pt-3">
        {/* New occurrence button */}
        <div className="space-y-1">
          <Button
            className="w-full bg-primary hover:bg-primary/90 h-12 text-sm font-medium"
            onClick={() => setReviewOpen(true)}
          >
            <Plus size={18} className="mr-2" />
            Nova Ocorrência
            {pendingItems.length > 0 && (
              <span className="ml-2 text-[10px] opacity-80">
                ({pendingItems.length} pendente{pendingItems.length !== 1 ? "s" : ""})
              </span>
            )}
          </Button>
          {lastOcc && nextSuggestion && (
            <p className="text-[10px] text-muted-foreground text-center">
              Última: {format(new Date(lastOcc.date), "dd/MM/yyyy")}.
              Próxima sugerida: ~{nextSuggestion} ({(FREQ_LABEL[ritual.frequency ?? ""] ?? "").toLowerCase()}).
            </p>
          )}
        </div>

        {/* Occurrences list */}
        {occsLoading ? (
          <p className="text-xs text-muted-foreground">Carregando...</p>
        ) : occurrences.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Nenhuma ocorrência ainda</p>
        ) : (
          <Accordion type="multiple" defaultValue={defaultOpen} className="space-y-2">
            {occurrences.map((occ, idx) => {
              const prevOcc = idx < occurrences.length - 1 ? occurrences[idx + 1] : null;
              return (
                <AccordionItem
                  key={occ.id}
                  value={occ.id}
                  className="bg-card border border-border rounded-xl overflow-hidden"
                >
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex items-center gap-2 text-left flex-1 min-w-0">
                      <span className="text-xs font-medium text-foreground">
                        {format(new Date(occ.date), "d MMM yyyy", { locale: ptBR })}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {occ.cardCount} {occ.cardCount === 1 ? "item" : "itens"} · {occ.completedCount} concluído{occ.completedCount !== 1 ? "s" : ""}
                      </span>
                      <Badge
                        className={`text-[9px] px-1 py-0 h-3.5 border-none ml-auto ${
                          occ.status === "open"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {occ.status === "open" ? "Aberta" : "Fechada"}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3">
                    <OccurrenceDetail occurrence={occ} previousOccurrenceId={prevOcc?.id ?? null} />
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}

        {/* Delete ritual */}
        <AlertDialog onOpenChange={async (open) => {
          if (open && id) {
            // Fetch stats for the confirmation message
            const { data: occs } = await supabase
              .from("ritual_occurrences")
              .select("id")
              .eq("ritual_id", id);
            const occIds = (occs ?? []).map((o) => o.id);
            let cardCount = 0;
            if (occIds.length > 0) {
              const { count } = await supabase
                .from("cards")
                .select("id", { count: "exact", head: true })
                .in("ritual_occurrence_id", occIds);
              cardCount = count ?? 0;
            }
            setDeletionStats({ occCount: occIds.length, cardCount });
          }
        }}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" className="w-full">
              <Trash2 size={14} className="mr-1" /> Excluir Ritualística
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir ritualística?</AlertDialogTitle>
              <AlertDialogDescription>
                {deletionStats
                  ? `A ritualística "${ritual.name}" tem ${deletionStats.occCount} ocorrência${deletionStats.occCount !== 1 ? "s" : ""} e ${deletionStats.cardCount} tarefa${deletionStats.cardCount !== 1 ? "s" : ""} vinculada${deletionStats.cardCount !== 1 ? "s" : ""}.\n\nAs tarefas serão PRESERVADAS no sistema. O histórico de ocorrências e observações será perdido.\n\nDeseja continuar?`
                  : "Carregando informações..."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleting || !deletionStats}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    // Fetch all occurrence IDs
                    const { data: occs } = await supabase
                      .from("ritual_occurrences")
                      .select("id")
                      .eq("ritual_id", ritual.id);
                    const occIds = (occs ?? []).map((o) => o.id);

                    if (occIds.length > 0) {
                      // Unlink cards
                      await supabase
                        .from("cards")
                        .update({ ritual_occurrence_id: null })
                        .in("ritual_occurrence_id", occIds);
                      // Unlink task_history
                      await supabase
                        .from("task_history")
                        .update({ ritual_occurrence_id: null })
                        .in("ritual_occurrence_id", occIds);
                    }

                    // Delete ritual (cascades occurrences + members)
                    deleteRitual.mutate(ritual.id);
                    navigate("/app/rituals");
                    toast.success("Ritualística excluída. As tarefas foram preservadas.");
                  } catch {
                    toast.error("Erro ao excluir ritualística");
                    setDeleting(false);
                  }
                }}
              >
                Excluir mesmo assim
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Carry-forward review modal */}
      <CarryForwardReviewModal
        ritualName={ritual.name}
        pendingItems={pendingItems}
        completedCount={completedCount}
        lastOccurrenceDate={lastOccurrenceDate}
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onConfirm={handleConfirmCreate}
        isCreating={creating}
      />
    </div>
  );
}
