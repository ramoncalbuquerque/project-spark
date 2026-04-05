import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { EnrichedFeedCard } from "@/hooks/useFeedCards";

const STATUS_BORDER: Record<string, string> = {
  overdue: "#EF4444",
  in_progress: "#3B82F6",
  completed: "#22C55E",
  pending: "#94A3B8",
};

const STATUS_LABEL: Record<string, string> = {
  overdue: "Atrasado",
  in_progress: "Em andamento",
  completed: "Concluído",
  pending: "Pendente",
};

const TYPE_LABEL: Record<string, string> = {
  task: "Tarefa",
  meeting: "Reunião",
  event: "Evento",
};

export default function FeedCard({ card }: { card: EnrichedFeedCard }) {
  const navigate = useNavigate();
  const displayStatus = card.is_overdue ? "overdue" : card.status;
  const borderColor = STATUS_BORDER[displayStatus] ?? STATUS_BORDER.pending;
  const assignee = card.assignees[0];

  const hasTime = !card.all_day && card.start_date;
  const timeStr = hasTime ? format(new Date(card.start_date), "HH:mm") : null;

  const deadlineStr = card.end_date
    ? format(new Date(card.end_date), "d MMM", { locale: ptBR })
    : null;

  return (
    <button
      onClick={() => navigate(`/app/task/${card.id}`)}
      className="w-full text-left bg-white border border-[hsl(var(--border))] rounded-xl p-3 relative"
      style={{ borderLeftWidth: 3, borderLeftColor: borderColor }}
    >
      {/* Row 1: status + type + time */}
      <div className="flex items-center gap-1.5 mb-1">
        <Badge
          className="text-[10px] px-1.5 py-0 h-4 font-medium"
          style={{
            backgroundColor: `${borderColor}18`,
            color: borderColor,
            border: "none",
          }}
        >
          {STATUS_LABEL[displayStatus]}
        </Badge>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal text-muted-foreground">
          {TYPE_LABEL[card.card_type] ?? card.card_type}
        </Badge>
        {timeStr && (
          <span className="ml-auto text-[11px] text-muted-foreground">{timeStr}</span>
        )}
      </div>

      {/* Row 2: title */}
      <p className="text-sm font-medium text-foreground leading-snug pr-8 truncate">
        {card.title}
      </p>

      {/* Row 3: meta */}
      <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
        {deadlineStr && <span>Prazo: {deadlineStr}</span>}
        {card.checklist_total > 0 && (
          <span className="flex items-center gap-0.5">
            <CheckSquare size={11} />
            {card.checklist_done}/{card.checklist_total}
          </span>
        )}
      </div>

      {/* Row 4: project chip */}
      {card.project_name && (
        <div className="mt-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/app/project/${card.project_id}`);
            }}
            className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(239_84%_67%/0.1)] text-[#4F46E5] font-medium hover:bg-[hsl(239_84%_67%/0.2)] transition-colors"
          >
            @{card.project_name}
          </button>
        </div>
      )}

      {/* Avatar */}
      {assignee && (
        <Avatar className="absolute top-3 right-3 h-6 w-6">
          <AvatarImage src={assignee.avatar_url ?? undefined} />
          <AvatarFallback className="text-[10px] bg-muted">
            {(assignee.full_name ?? "?").charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}
    </button>
  );
}
