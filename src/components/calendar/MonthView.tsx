import { useCalendar } from "@/contexts/CalendarContext";
import { useCards } from "@/hooks/useCards";
import { useCardModal } from "@/contexts/CardContext";
import { useAuth } from "@/contexts/AuthContext";
import CalendarCard from "./CalendarCard";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  isSameDay,
  parseISO,
} from "date-fns";
import type { EnrichedCard } from "@/hooks/useCards";

const WEEK_DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MAX_VISIBLE = 3;

function getCardsForDay(cards: EnrichedCard[], day: Date) {
  return cards.filter((c) => isSameDay(parseISO(c.start_date), day));
}

const MonthView = () => {
  const { selectedDate, setSelectedDate, setViewMode } = useCalendar();
  const { cards } = useCards();
  const { openCreateModal } = useCardModal();
  const { profile } = useAuth();
  const isLeader = profile?.role === "leader";

  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const handleDayClick = (day: Date) => {
    if (isLeader) {
      openCreateModal(day);
    } else {
      setSelectedDate(day);
      setViewMode("day");
    }
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card h-full flex flex-col">
      {/* Header */}
      <div className="grid grid-cols-7 border-b border-border">
        {WEEK_DAYS.map((d) => (
          <div
            key={d}
            className="text-center py-2 text-xs font-medium text-muted-foreground uppercase"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 flex-1">
        {days.map((day, i) => {
          const inMonth = isSameMonth(day, selectedDate);
          const today = isToday(day);
          const dayCards = getCardsForDay(cards, day);
          const visible = dayCards.slice(0, MAX_VISIBLE);
          const overflow = dayCards.length - MAX_VISIBLE;

          return (
            <div
              key={i}
              className={`border-b border-r border-border/50 p-1 min-h-[80px] cursor-pointer hover:bg-accent/50 transition-colors ${
                !inMonth ? "bg-muted/30" : ""
              }`}
              onClick={() => handleDayClick(day)}
            >
              <span
                className={`inline-flex items-center justify-center w-7 h-7 text-sm rounded-full ${
                  today
                    ? "bg-primary text-primary-foreground font-bold"
                    : inMonth
                    ? "text-foreground"
                    : "text-muted-foreground/40"
                }`}
              >
                {format(day, "d")}
              </span>
              <div className="flex flex-col gap-0.5 mt-0.5">
                {visible.map((card) => (
                  <CalendarCard key={card.id} card={card} compact />
                ))}
                {overflow > 0 && (
                  <span className="text-[10px] text-muted-foreground px-1">
                    +{overflow} mais
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MonthView;
