import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckSquare, Clock, Folder, Users, Paperclip } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { EnrichedFeedCard } from "@/hooks/useFeedCards";

const STATUS_COLOR: Record<string, string> = {
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

const TYPE_ICON: Record<string, { icon: typeof CheckSquare; color: string }> = {
  task: { icon: CheckSquare, color: "#94A3B8" },
  meeting: { icon: Clock, color: "#0D9488" },
  project: { icon: Folder, color: "#7C3AED" },
  ritual: { icon: Users, color: "#D97706" },
};

export default function FeedCard({ card }: { card: EnrichedFeedCard }) {
  const navigate = useNavigate();
  const displayStatus = card.is_overdue ? "overdue" : card.status;
  const statusColor = STATUS_COLOR[displayStatus] ?? STATUS_COLOR.pending;
  const isCompleted = card.status === "completed";

  const hasTime = !card.all_day && card.start_date;
  const timeStr = hasTime ? format(new Date(card.start_date), "HH:mm") : null;

  const deadlineStr = card.end_date
    ? format(new Date(card.end_date), "d MMM", { locale: ptBR })
    : null;

  const visibleAssignees = card.assignees.slice(0, 2);
  const extraCount = card.assignees.length - 2;

  const typeEntry = TYPE_ICON[card.card_type] ?? TYPE_ICON.task;
  const TypeIcon = typeEntry.icon;

  // Build meta items
  const metaItems: string[] = [];
  if (deadlineStr) metaItems.push(`Prazo: ${deadlineStr}`);
  if (card.assignees.length === 1) metaItems.push(card.assignees[0].full_name ?? "");
  if (card.checklist_total > 0) metaItems.push(`${card.checklist_done}/${card.checklist_total}`);

  return (
    <button
      onClick={() => navigate(`/app/task/${card.id}`)}
      className="w-full text-left rounded-xl relative transition-shadow hover:shadow-md"
      style={{
        borderLeftWidth: 3,
        borderLeftColor: statusColor,
        border: "0.5px solid #EEEEE9",
        borderLeft: `3px solid ${statusColor}`,
        borderRadius: "0px 12px 12px 0px",
        padding: 12,
        opacity: isCompleted ? 0.7 : 1,
        backgroundColor: "var(--background, #fff)",
      }}
    >
      {/* Line 1: Status dot + label + time + avatars */}
      <div className="flex items-center gap-1.5">
        <span
          className="shrink-0 rounded-full"
          style={{ width: 6, height: 6, backgroundColor: statusColor }}
        />
        <span className="text-[11px] font-medium" style={{ color: statusColor }}>
          {STATUS_LABEL[displayStatus]}
        </span>

        {timeStr && (
          <span className="ml-auto text-[11px] text-muted-foreground mr-1">{timeStr}</span>
        )}

        {/* Avatars */}
        {visibleAssignees.length > 0 && (
          <div className={`flex items-center ${!timeStr ? "ml-auto" : ""}`}>
            {visibleAssignees.map((a, i) => (
              <Avatar
                key={a.id}
                className="border-2 border-background"
                style={{
                  width: 22,
                  height: 22,
                  marginLeft: i > 0 ? -6 : 0,
                  zIndex: 2 - i,
                }}
              >
                <AvatarImage src={a.avatar_url ?? undefined} />
                <AvatarFallback
                  className={`text-[9px] ${a.type === "contact" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}
                  style={{ fontSize: 9 }}
                >
                  {(a.full_name ?? "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
            {extraCount > 0 && (
              <span
                className="rounded-full bg-muted flex items-center justify-center text-[8px] font-medium text-muted-foreground border-2 border-background"
                style={{ width: 22, height: 22, marginLeft: -6, zIndex: 0 }}
              >
                +{extraCount}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Line 2: Type icon + title */}
      <div className="flex items-start gap-1.5 mt-1.5">
        <TypeIcon
          size={14}
          className="shrink-0 mt-0.5"
          style={{ color: typeEntry.color }}
        />
        <p
          className="text-sm font-medium leading-snug truncate"
          style={{
            color: isCompleted ? "#9CA3AF" : "#1A1A1A",
            textDecoration: isCompleted ? "line-through" : "none",
          }}
        >
          {card.title}
        </p>
      </div>

      {/* Line 3: Meta info */}
      {metaItems.length > 0 && (
        <p className="mt-1 text-[11px]" style={{ color: "#6B6B6B" }}>
          {metaItems.join(" · ")}
          {card.checklist_total > 0 && (
            <> · <CheckSquare size={10} className="inline -mt-px" /> {card.checklist_done}/{card.checklist_total}</>
          )}
        </p>
      )}

      {/* Line 4: Breadcrumb origin */}
      {card.project_name && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/app/project/${card.project_id}`);
          }}
          className="flex items-center gap-1 mt-1.5 hover:underline"
          style={{ color: "#A1A1A1", fontSize: 10 }}
        >
          <Folder size={10} />
          <span>{card.project_name}</span>
        </button>
      )}
    </button>
  );
}
