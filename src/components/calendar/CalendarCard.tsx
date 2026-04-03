import { useRef, useCallback, useMemo } from "react";
import type { EnrichedCard } from "@/hooks/useCards";
import { useCardModal } from "@/contexts/CardContext";
import { Users } from "lucide-react";
import { isPast, parseISO } from "date-fns";

type Card = EnrichedCard;

const TYPE_COLORS: Record<string, string> = {
  task: "bg-[#1E88E5] border-[#1565C0]",
  meeting: "bg-[#2E7D32] border-[#1B5E20]",
  project: "bg-[#7B1FA2] border-[#6A1B9A]",
};

const TYPE_LABELS: Record<string, string> = {
  task: "Tarefa",
  meeting: "Reunião",
  project: "Projeto",
};

const PRIORITY_BADGES: Record<string, { label: string; className: string }> = {
  low: { label: "Baixa", className: "bg-white/20 text-white/80" },
  medium: { label: "Média", className: "bg-yellow-300/30 text-yellow-100" },
  high: { label: "Alta", className: "bg-orange-400/30 text-orange-100" },
  urgent: { label: "Urgente", className: "bg-red-400/40 text-red-100" },
};

const STATUS_DOTS: Record<string, string> = {
  pending: "bg-gray-300",
  in_progress: "bg-blue-400",
  completed: "bg-green-400",
  overdue: "bg-red-500",
};

const MAX_VISIBLE_INITIALS = 3;

/** Check if a card is visually overdue */
export function isCardOverdue(card: Card): boolean {
  if (card.status === "completed") return false;
  const dateStr = card.end_date || card.start_date;
  if (!dateStr) return false;
  return isPast(parseISO(dateStr));
}

interface CalendarCardProps {
  card: Card;
  compact?: boolean;
  height?: number;
  isDragging?: boolean;
  onLongPressStart?: (card: Card) => void;
  onLongPressCancel?: () => void;
}

const CalendarCard = ({
  card,
  compact = false,
  height,
  isDragging = false,
  onLongPressStart,
  onLongPressCancel,
}: CalendarCardProps) => {
  const { openEditModal } = useCardModal();
  const color = TYPE_COLORS[card.card_type] || TYPE_COLORS.task;
  const badge = PRIORITY_BADGES[card.priority] || PRIORITY_BADGES.medium;
  const typeLabel = TYPE_LABELS[card.card_type] || TYPE_LABELS.task;
  const isShort = height !== undefined && height < 30;
  const pointerDownTime = useRef(0);

  const overdue = useMemo(() => isCardOverdue(card), [card]);
  const displayStatus = overdue ? "overdue" : card.status;
  const statusDot = STATUS_DOTS[displayStatus] || STATUS_DOTS.pending;

  const assignees = card.assignees ?? [];
  const teams = card.teams ?? [];
  const hasAssignment = assignees.length > 0 || teams.length > 0;

  const visibleInitials = useMemo(() => {
    return assignees.slice(0, MAX_VISIBLE_INITIALS).map((a) => ({
      id: a.id,
      initial: a.full_name?.[0]?.toUpperCase() || "?",
    }));
  }, [assignees]);

  const overflowCount = Math.max(0, assignees.length - MAX_VISIBLE_INITIALS);

  const handlePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      pointerDownTime.current = Date.now();
      onLongPressStart?.(card);
    },
    [card, onLongPressStart]
  );

  const handlePointerUp = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      onLongPressCancel?.();
      const elapsed = Date.now() - pointerDownTime.current;
      if (elapsed < 400 && !isDragging) {
        openEditModal(card);
      }
    },
    [card, isDragging, openEditModal, onLongPressCancel]
  );

  const handlePointerLeave = useCallback(() => {}, []);

  return (
    <button
      onMouseDown={handlePointerDown}
      onTouchStart={handlePointerDown}
      onMouseUp={handlePointerUp}
      onTouchEnd={handlePointerUp}
      onMouseLeave={handlePointerLeave}
      className={`w-full h-full text-left rounded-[6px] px-2 py-1 text-white text-[11px] leading-tight cursor-pointer hover:shadow-md hover:brightness-110 hover:scale-[1.02] transition-all overflow-hidden flex flex-col justify-start relative ${color} ${
        isDragging ? "opacity-30" : ""
      } ${overdue ? "border-l-[3px] !border-l-red-500" : "border-l-2"}`}
      title={card.title}
    >
      {/* Title row with status dot */}
      <span className="truncate font-bold block w-full flex items-center gap-1">
        <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${statusDot}`} />
        <span className="truncate">{card.title}</span>
      </span>
      {!isShort && !compact && (
        <>
          <span className="truncate block w-full text-[10px] text-white/80">{typeLabel}</span>
          <span className={`text-[9px] px-1 rounded mt-0.5 inline-block ${badge.className}`}>
            {badge.label}
          </span>
        </>
      )}
      {/* Assignee indicators */}
      {!isShort && hasAssignment && (
        <div className="absolute bottom-0.5 right-1 flex items-center">
          {visibleInitials.map((item, idx) => (
            <div
              key={item.id}
              className="h-4 w-4 rounded-full bg-white/25 flex items-center justify-center text-[8px] font-bold text-white border border-white/30"
              style={{ marginLeft: idx > 0 ? -4 : 0, zIndex: MAX_VISIBLE_INITIALS - idx }}
            >
              {item.initial}
            </div>
          ))}
          {overflowCount > 0 && (
            <span className="text-[7px] text-white/70 font-semibold ml-0.5">+{overflowCount}</span>
          )}
          {teams.length > 0 && (
            <div className="h-4 w-4 rounded-full bg-white/25 flex items-center justify-center ml-0.5">
              <Users className="h-2.5 w-2.5 text-white" />
            </div>
          )}
        </div>
      )}
    </button>
  );
};

export default CalendarCard;

export const OverflowBadge = ({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) => (
  <button
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer px-1"
  >
    +{count} mais
  </button>
);
