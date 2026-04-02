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
  const allProfiles = useAllProfiles();
  const color = TYPE_COLORS[card.card_type] || TYPE_COLORS.task;
  const badge = PRIORITY_BADGES[card.priority] || PRIORITY_BADGES.medium;
  const typeLabel = TYPE_LABELS[card.card_type] || TYPE_LABELS.task;
  const isShort = height !== undefined && height < 30;
  const pointerDownTime = useRef(0);

  const assigneeName = useMemo(() => {
    if (!card.assigned_to_profile) return null;
    const p = allProfiles.find((pr) => pr.id === card.assigned_to_profile);
    return p?.full_name || null;
  }, [card.assigned_to_profile, allProfiles]);

  const assigneeInitial = assigneeName ? assigneeName[0]?.toUpperCase() : null;

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

  const handlePointerLeave = useCallback(() => {
    // Don't cancel on leave — only cancel on short click (pointerUp)
  }, []);

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
      {/* Assignee indicator */}
      {!isShort && (card.assigned_to_profile || card.assigned_to_team) && (
        <div className="absolute bottom-0.5 right-1">
          {card.assigned_to_team ? (
            <div className="h-4 w-4 rounded-full bg-white/25 flex items-center justify-center">
              <Users className="h-2.5 w-2.5 text-white" />
            </div>
          ) : assigneeInitial ? (
            <div className="h-4 w-4 rounded-full bg-white/25 flex items-center justify-center text-[8px] font-bold text-white">
              {assigneeInitial}
            </div>
          ) : null}
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
