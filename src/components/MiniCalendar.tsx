import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  addMonths,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";

const MiniCalendar = () => {
  const { selectedDate, setSelectedDate } = useCalendar();
  const [displayMonth, setDisplayMonth] = useState(new Date());

  const monthStart = startOfMonth(displayMonth);
  const monthEnd = endOfMonth(displayMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const weekDays = ["D", "S", "T", "Q", "Q", "S", "S"];

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-foreground capitalize">
          {format(displayMonth, "MMMM yyyy", { locale: ptBR })}
        </span>
        <div className="flex gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setDisplayMonth(subMonths(displayMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setDisplayMonth(addMonths(displayMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0">
        {weekDays.map((d, i) => (
          <div
            key={i}
            className="text-center text-xs font-medium text-muted-foreground py-1"
          >
            {d}
          </div>
        ))}
        {days.map((day, i) => {
          const inMonth = isSameMonth(day, displayMonth);
          const today = isToday(day);
          const selected = isSameDay(day, selectedDate);
          return (
            <div key={i} className="flex items-center justify-center py-0.5">
              <button
                onClick={() => setSelectedDate(day)}
                className={`flex items-center justify-center w-7 h-7 text-xs rounded-full transition-colors ${
                  today
                    ? "bg-primary text-primary-foreground font-bold"
                    : selected
                    ? "ring-2 ring-primary text-primary font-semibold"
                    : inMonth
                    ? "text-foreground hover:bg-accent"
                    : "text-muted-foreground/40"
                }`}
              >
                {format(day, "d")}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MiniCalendar;
