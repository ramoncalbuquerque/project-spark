import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useRituals, FREQ_LABEL } from "@/hooks/useRituals";
import { useRitualOccurrences } from "@/hooks/useRitualOccurrences";
import { useCarryForward } from "@/hooks/useCarryForward";
import OccurrenceDetail from "@/components/rituals/OccurrenceDetail";
import { Trash2 } from "lucide-react";

export default function RitualDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { rituals, updateRitual, deleteRitual } = useRituals();
  const { occurrences, isLoading: occsLoading, createOccurrence } = useRitualOccurrences(id);
  const { pendingCards, executeCarryForward } = useCarryForward(id);

  const ritual = rituals.find((r) => r.id === id);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [creating, setCreating] = useState(false);

  const pendingCount = ritual?.lastOccurrence?.pendingCount ?? 0;

  const handleNewOccurrence = async () => {
    if (!id) return;
    setCreating(true);
    try {
      const newOcc = await createOccurrence.mutateAsync();
      if (pendingCards.length > 0) {
        await executeCarryForward(newOcc.id);
        toast.success(`Ocorrência criada com ${pendingCards.length} item(ns) puxados`);
      } else {
        toast.success("Nova ocorrência criada");
      }
    } catch {
      // error handled by mutation
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

  // Default open the most recent occurrence
  const defaultOpen = occurrences.length > 0 ? [occurrences[0].id] : [];

  return (
    <div className="flex flex-col h-full bg-[#FAFAF8]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 sticky top-0 bg-[#FAFAF8] z-10 border-b border-[hsl(var(--border))]">
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
            <div className="min-w-0">
              <h1 className="text-base font-medium text-foreground truncate">{ritual.name}</h1>
              <p className="text-[10px] text-muted-foreground">
                {FREQ_LABEL[ritual.frequency ?? ""] ?? ritual.frequency ?? ""}
              </p>
            </div>
            <button onClick={() => { setEditName(ritual.name); setEditing(true); }}>
              <Pencil size={14} className="text-muted-foreground" />
            </button>
          </div>
        )}

        {pendingCount > 0 && (
          <Badge className="bg-[#EF4444]/10 text-[#EF4444] border-none text-[10px] px-1.5 py-0 h-4 font-medium shrink-0">
            {pendingCount}
          </Badge>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4 pt-3">
        {/* New occurrence button */}
        <Button
          className="w-full bg-[#4F46E5] hover:bg-[#4338CA] h-12 text-sm font-medium"
          onClick={handleNewOccurrence}
          disabled={creating}
        >
          <Plus size={18} className="mr-2" />
          {creating ? "Criando..." : "Nova Ocorrência"}
          {pendingCards.length > 0 && (
            <span className="ml-2 text-[10px] opacity-80">
              ({pendingCards.length} pendente{pendingCards.length !== 1 ? "s" : ""} serão puxados)
            </span>
          )}
        </Button>

        {/* Occurrences list */}
        {occsLoading ? (
          <p className="text-xs text-muted-foreground">Carregando...</p>
        ) : occurrences.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Nenhuma ocorrência ainda</p>
        ) : (
          <Accordion type="multiple" defaultValue={defaultOpen} className="space-y-2">
            {occurrences.map((occ) => (
              <AccordionItem
                key={occ.id}
                value={occ.id}
                className="bg-white border border-[hsl(var(--border))] rounded-xl overflow-hidden"
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
                          ? "bg-[#3B82F6]/10 text-[#3B82F6]"
                          : "bg-[#94A3B8]/10 text-[#94A3B8]"
                      }`}
                    >
                      {occ.status === "open" ? "Aberta" : "Fechada"}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-3">
                  <OccurrenceDetail occurrence={occ} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}

        {/* Delete ritual */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" className="w-full">
              <Trash2 size={14} className="mr-1" /> Excluir Ritualística
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir ritualística?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. As ocorrências e tarefas vinculadas permanecerão.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => { deleteRitual.mutate(ritual.id); navigate("/app/rituals"); }}>
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
