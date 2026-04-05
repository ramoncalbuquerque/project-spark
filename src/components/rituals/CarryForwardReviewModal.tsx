import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { X, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { PendingCard } from "@/hooks/useCarryForward";

const STATUS_COLOR: Record<string, string> = {
  overdue: "#EF4444",
  in_progress: "#3B82F6",
  completed: "#22C55E",
  pending: "#94A3B8",
};

interface Props {
  ritualName: string;
  pendingItems: PendingCard[];
  completedCount: number;
  lastOccurrenceDate: string | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (selectedCardIds: string[], date: Date) => void;
  isCreating: boolean;
}

export default function CarryForwardReviewModal({
  ritualName,
  pendingItems,
  completedCount,
  lastOccurrenceDate,
  open,
  onClose,
  onConfirm,
  isCreating,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [occDate, setOccDate] = useState<Date>(new Date());
  // Sync selected when modal opens or pendingItems change
  useEffect(() => {
    if (open) {
      setSelected(new Set(pendingItems.map((c) => c.id)));
      setOccDate(new Date());
    }
  }, [open, pendingItems]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!open) return null;

  const lastDateStr = lastOccurrenceDate
    ? format(new Date(lastOccurrenceDate), "dd/MM/yyyy")
    : null;

  const now = new Date();

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-3">
        <button onClick={onClose} className="p-1">
          <X size={20} className="text-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-foreground truncate">
            Nova ocorrência — {ritualName}
          </h2>
          {lastDateStr && (
            <p className="text-[11px] text-muted-foreground">
              Revise os itens que serão puxados da última reunião ({lastDateStr})
            </p>
          )}
        </div>
        <div className="px-4 py-2 border-b border-border">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 w-full justify-start">
                <CalendarIcon size={14} />
                {format(occDate, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={occDate}
                onSelect={(d) => d && setOccDate(d)}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {pendingItems.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-sm text-muted-foreground text-center">
              Nenhum item pendente.{"\n"}A ocorrência será criada vazia.
            </p>
          </div>
        ) : (
          pendingItems.map((card) => {
            const isOverdue =
              card.status !== "completed" &&
              (card.end_date || card.start_date) &&
              new Date(card.end_date || card.start_date) < now;
            const displayStatus = isOverdue ? "overdue" : card.status;
            const dotColor = STATUS_COLOR[displayStatus] ?? STATUS_COLOR.pending;
            const assignee = card.assignees[0];
            const sinceStr = card.firstSeen
              ? format(new Date(card.firstSeen), "MMM/yy", { locale: ptBR })
              : null;

            return (
              <label
                key={card.id}
                className="flex items-start gap-3 p-3 bg-card border border-border rounded-lg cursor-pointer"
              >
                <Checkbox
                  checked={selected.has(card.id)}
                  onCheckedChange={() => toggle(card.id)}
                  className="mt-0.5"
                />
                <div
                  className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                  style={{ backgroundColor: dotColor }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-foreground truncate">
                    {card.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {sinceStr && `desde ${sinceStr}`}
                    {sinceStr && card.historyCount > 0 && " · "}
                    {card.historyCount > 0 &&
                      `${card.historyCount} ocorrência${card.historyCount !== 1 ? "s" : ""}`}
                    {assignee && (
                      <>
                        {(sinceStr || card.historyCount > 0) && " · "}
                        {assignee.full_name ?? "Sem nome"}
                      </>
                    )}
                  </p>
                </div>
                {assignee && (
                  <Avatar className="h-5 w-5 shrink-0 mt-0.5">
                    <AvatarImage src={assignee.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[8px]">
                      {(assignee.full_name ?? "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
              </label>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border space-y-2">
        <p className="text-[11px] text-muted-foreground text-center">
          {pendingItems.length > 0
            ? `${selected.size} ${selected.size === 1 ? "item será puxado" : "itens serão puxados"} · ${completedCount} concluído${completedCount !== 1 ? "s" : ""} desde a última`
            : `${completedCount} concluído${completedCount !== 1 ? "s" : ""} desde a última`}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 h-11" onClick={onClose} disabled={isCreating}>
            Cancelar
          </Button>
          <Button
            className="flex-1 h-11 bg-primary hover:bg-primary/90"
            onClick={() => onConfirm([...selected], occDate)}
            disabled={isCreating}
          >
            {isCreating ? "Criando..." : "Criar ocorrência"}
          </Button>
        </div>
      </div>
    </div>
  );
}
