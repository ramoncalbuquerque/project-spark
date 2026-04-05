import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAgendaCards, type AgendaCard } from "@/hooks/useAgendaCards";
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isSameDay,
  isToday,
  isSameMonth,
  startOfMonth,
  endOfMonth,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";

type ViewMode = "week" | "month";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-muted-foreground/40",
  in_progress: "bg-blue-500",
  completed: "bg-green-500",
  overdue: "bg-destructive",
};

function statusBorderColor(card: AgendaCard) {
  if (card.status === "completed") return "border-l-green-500";
  if (card.status === "in_progress") return "border-l-blue-500";
  const dateStr = card.end_date || card.start_date;
  if (card.status !== "completed" && dateStr && new Date(dateStr) < new Date())
    return "border-l-destructive";
  return "border-l-muted-foreground/40";
}

function dotColor(card: AgendaCard) {
  if (card.status === "completed") return STATUS_COLORS.completed;
  if (card.status === "in_progress") return STATUS_COLORS.in_progress;
  const dateStr = card.end_date || card.start_date;
  if (dateStr && new Date(dateStr) < new Date()) return STATUS_COLORS.overdue;
  return STATUS_COLORS.pending;
}

const WEEK_DAYS_SHORT = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

const AgendaPage = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState(new Date());

  // Date ranges
  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(anchor, { weekStartsOn: 1 });
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const rangeStart = viewMode === "week" ? weekStart : calStart;
  const rangeEnd = viewMode === "week" ? weekEnd : calEnd;

  const { data: cards = [], isLoading } = useAgendaCards(
    rangeStart.toISOString(),
    rangeEnd.toISOString()
  );

  const cardsByDay = useMemo(() => {
    const map = new Map<string, AgendaCard[]>();
    for (const card of cards) {
      const key = format(parseISO(card.start_date), "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(card);
      map.set(key, list);
    }
    return map;
  }, [cards]);

  const goNext = () =>
    setAnchor((d) => (viewMode === "week" ? addWeeks(d, 1) : addMonths(d, 1)));
  const goPrev = () =>
    setAnchor((d) => (viewMode === "week" ? subWeeks(d, 1) : subMonths(d, 1)));

  const weekLabel = `Semana de ${format(weekStart, "d MMM", { locale: ptBR })} - ${format(weekEnd, "d MMM", { locale: ptBR })}`;
  const monthLabel = format(anchor, "MMMM 'de' yyyy", { locale: ptBR });

  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const monthDays = eachDayOfInterval({ start: calStart, end: calEnd });

  return (
    <div className="flex flex-col h-full">
      {/* Top controls */}
      <div className="flex items-center justify-between px-1 pb-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-foreground capitalize whitespace-nowrap">
            {viewMode === "week" ? weekLabel : monthLabel}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex rounded-lg border border-border overflow-hidden">
          {(["week", "month"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === v
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-foreground hover:bg-accent"
              }`}
            >
              {v === "week" ? "Semana" : "Mês"}
            </button>
          ))}
        </div>
      </div>

      {/* Views */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {viewMode === "week" ? (
          <WeekView
            days={weekDays}
            cardsByDay={cardsByDay}
            onCardClick={(id) => navigate(`/app/task/${id}`)}
          />
        ) : (
          <MonthGrid
            days={monthDays}
            anchor={anchor}
            cardsByDay={cardsByDay}
            onDayClick={(day) => navigate(`/app/feed?date=${format(day, "yyyy-MM-dd")}`)}
          />
        )}
      </div>
    </div>
  );
};

/* ── Week View ── */
function WeekView({
  days,
  cardsByDay,
  onCardClick,
}: {
  days: Date[];
  cardsByDay: Map<string, AgendaCard[]>;
  onCardClick: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {days.map((day) => {
        const key = format(day, "yyyy-MM-dd");
        const dayCards = cardsByDay.get(key) ?? [];
        const today = isToday(day);
        const dayLabel = `${WEEK_DAYS_SHORT[day.getDay() === 0 ? 6 : day.getDay() - 1]} ${format(day, "d")}`;

        return (
          <div key={key} className="px-1">
            <p
              className={`text-xs font-semibold mb-1 ${
                today ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {dayLabel}
              {today && (
                <span className="ml-1 text-primary font-medium">— hoje</span>
              )}
            </p>
            {dayCards.length === 0 ? (
              <p className="text-xs text-muted-foreground/40 pl-2 pb-2">—</p>
            ) : (
              <div className="flex flex-col gap-1 pb-2">
                {dayCards.map((card) => (
                  <button
                    key={card.id}
                    onClick={() => onCardClick(card.id)}
                    className={`flex items-center gap-2 rounded-md border-l-[3px] px-2 py-1.5 text-left bg-accent/60 ${statusBorderColor(card)}`}
                  >
                    {!card.all_day && (
                      <span className="text-[11px] text-muted-foreground font-mono w-10 shrink-0">
                        {format(parseISO(card.start_date), "HH:mm")}
                      </span>
                    )}
                    <span className="text-sm text-foreground truncate flex-1">
                      {card.title}
                    </span>
                    {card.assignees[0]?.full_name && (
                      <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                        {card.assignees[0].full_name.split(" ")[0]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Month Grid ── */
function MonthGrid({
  days,
  anchor,
  cardsByDay,
  onDayClick,
}: {
  days: Date[];
  anchor: Date;
  cardsByDay: Map<string, AgendaCard[]>;
  onDayClick: (day: Date) => void;
}) {
  return (
    <div>
      {/* Header */}
      <div className="grid grid-cols-7 mb-1">
        {WEEK_DAYS_SHORT.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-muted-foreground">
            {d}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const key = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, anchor);
          const today = isToday(day);
          const dayCards = cardsByDay.get(key) ?? [];
          const dots = dayCards.slice(0, 3);

          return (
            <button
              key={i}
              onClick={() => onDayClick(day)}
              className="flex flex-col items-center py-2 min-h-[48px]"
            >
              <span
                className={`inline-flex items-center justify-center w-7 h-7 text-xs rounded-full ${
                  today
                    ? "bg-primary text-primary-foreground font-bold"
                    : inMonth
                    ? "text-foreground"
                    : "text-muted-foreground/30"
                }`}
              >
                {format(day, "d")}
              </span>
              {dots.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {dots.map((c, j) => (
                    <span
                      key={j}
                      className={`w-1.5 h-1.5 rounded-full ${dotColor(c)}`}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default AgendaPage;
