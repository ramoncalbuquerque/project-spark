import type { Tables } from "@/integrations/supabase/types";
import { useCardModal } from "@/contexts/CardContext";

type Card = Tables<"cards">;

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
}

const CalendarCard = ({ card, compact = false, height }: CalendarCardProps) => {
  const { openEditModal } = useCardModal();
  const color = TYPE_COLORS[card.card_type] || TYPE_COLORS.task;
  const badge = PRIORITY_BADGES[card.priority] || PRIORITY_BADGES.medium;
  const typeLabel = TYPE_LABELS[card.card_type] || TYPE_LABELS.task;
  const isShort = height !== undefined && height < 30;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        openEditModal(card);
      }}
      className={`w-full h-full text-left rounded-[6px] px-2 py-1 text-white text-[11px] leading-tight border-l-2 cursor-pointer hover:shadow-md hover:brightness-110 transition-all overflow-hidden flex flex-col justify-start ${color}`}
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
