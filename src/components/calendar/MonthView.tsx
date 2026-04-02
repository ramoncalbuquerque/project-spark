import { useCalendar } from "@/contexts/CalendarContext";
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
} from "date-fns";
import { ptBR } from "date-fns/locale";

const WEEK_DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const MonthView = () => {
  const { selectedDate, setSelectedDate, setViewMode } = useCalendar();

  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

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
          const selected = isSameDay(day, selectedDate);

          return (
            <div
              key={i}
              className={`border-b border-r border-border/50 p-2 min-h-[80px] cursor-pointer hover:bg-accent/50 transition-colors ${
                !inMonth ? "bg-muted/30" : ""
              }`}
              onClick={() => {
                setSelectedDate(day);
                setViewMode("day");
              }}
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
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MonthView;
