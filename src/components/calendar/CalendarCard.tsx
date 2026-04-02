import { useRef, useCallback, useMemo } from "react";
import type { EnrichedCard } from "@/hooks/useCards";
import { useCardModal } from "@/contexts/CardContext";
import { Users } from "lucide-react";

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

const MAX_VISIBLE_INITIALS = 3;

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
      className={`w-full h-full text-left rounded-[6px] px-2 py-1 text-white text-[11px] leading-tight border-l-2 cursor-pointer hover:shadow-md hover:brightness-110 transition-all overflow-hidden flex flex-col justify-start relative ${color} ${
        isDragging ? "opacity-30" : ""
      }`}
      title={card.title}
    >
      <span className="truncate font-bold block w-full">{card.title}</span>
      {!isShort && !compact && (
        <>
          <span className="truncate block w-full text-[10px] text-white/80">{typeLabel}</span>
          <span className={`text-[9px] px-1 rounded mt-0.5 inline-block ${badge.className}`}>
            {badge.label}
          </span>
        </>
      )}
      {/* Assignee indicators — stacked initials + team icon */}
      {!isShort && hasAssignment && (
        <div className="absolute bottom-0.5 right-1 flex items-center">
          {/* Stacked initials */}
          {visibleInitials.length > 0 && (
            <div className="flex items-center" style={{ marginRight: overflowCount > 0 || teams.length > 0 ? 2 : 0 }}>
              {visibleInitials.map((item, idx) => (
                <div
                  key={item.id}
                  className="h-4 w-4 rounded-full bg-white/25 flex items-center justify-center text-[8px] font-bold text-white border border-white/30"
                  style={{ marginLeft: idx > 0 ? -4 : 0, zIndex: MAX_VISIBLE_INITIALS - idx }}
                />
              ))}
              {/* Render initials on top of circles */}
              {visibleInitials.map((item, idx) => (
                <div
                  key={`i-${item.id}`}
                  className="absolute h-4 w-4 flex items-center justify-center text-[8px] font-bold text-white pointer-events-none"
                  style={{ right: `${(visibleInitials.length - 1 - idx) * 12 + (overflowCount > 0 || teams.length > 0 ? 2 : 0) + (teams.length > 0 ? 18 : 0) + (overflowCount > 0 ? 16 : 0)}px` }}
                />
              ))}
            </div>
          )}
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
