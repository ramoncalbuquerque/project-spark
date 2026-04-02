import { useEffect, useRef, useState } from "react";
import { useCalendar } from "@/contexts/CalendarContext";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  startOfWeek,
  addDays,
  format,
  isToday,
} from "date-fns";
import { ptBR } from "date-fns/locale";

const START_HOUR = 6;
const END_HOUR = 22;
const SLOT_HEIGHT = 60;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const HOUR_COL_W = "w-12 min-w-[3rem]";
const DAY_COL_W = "min-w-[44px]";

const SHORT_DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const NowLine = () => {
  const [top, setTop] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      if (h >= START_HOUR && h < END_HOUR) {
        setTop((h - START_HOUR) * SLOT_HEIGHT + (m / 60) * SLOT_HEIGHT);
        setVisible(true);
      } else {
        setVisible(false);
      }
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="absolute left-0 right-0 z-10 pointer-events-none"
      style={{ top }}
    >
      <div className="relative w-full">
        <div className="absolute left-0 w-2 h-2 rounded-full bg-destructive -translate-y-1/2" />
        <div className="absolute left-0 right-0 h-[2px] bg-destructive" />
      </div>
    </div>
  );
};

const WeekView = () => {
  const { selectedDate } = useCalendar();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = (8 - START_HOUR) * SLOT_HEIGHT;
    }
  }, []);

  const getDayLabel = (day: Date, index: number) => {
    if (isMobile) return SHORT_DAYS[index];
    return format(day, "EEEE", { locale: ptBR });
  };

  return (
    <div className="flex flex-col h-full border border-border rounded-lg overflow-hidden bg-card">
      {/* Header — uses same column structure as grid */}
      <div className="flex shrink-0 border-b border-border overflow-hidden">
        <div className={`${HOUR_COL_W} shrink-0`} />
        {days.map((day, i) => {
          const today = isToday(day);
          return (
            <div
              key={i}
              className={`flex-1 ${DAY_COL_W} text-center py-2 border-l border-border ${
                today ? "bg-primary/5" : ""
              }`}
            >
              <div className="text-[10px] md:text-xs text-muted-foreground uppercase truncate px-0.5">
                {getDayLabel(day, i)}
              </div>
              <div
                className={`text-base md:text-lg font-semibold leading-tight ${
                  today ? "text-primary" : "text-foreground"
                }`}
              >
                {format(day, "d")}
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-auto">
        <div className="flex relative" style={{ height: HOURS.length * SLOT_HEIGHT }}>
          {/* Hour labels */}
          <div className={`${HOUR_COL_W} shrink-0 relative`}>
            {HOURS.map((hour, i) => (
              <div
                key={hour}
                className="absolute left-0 right-0 text-right pr-1.5 -translate-y-1/2 text-[10px] md:text-xs text-muted-foreground"
                style={{ top: i * SLOT_HEIGHT }}
              >
                {`${String(hour).padStart(2, "0")}:00`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, colIdx) => {
            const today = isToday(day);
            return (
              <div
                key={colIdx}
                className={`flex-1 ${DAY_COL_W} border-l border-border relative ${
                  today ? "bg-primary/5" : ""
                }`}
              >
                {HOURS.map((_, rowIdx) => (
                  <div
                    key={rowIdx}
                    className={`border-b border-border/50 ${
                      rowIdx % 2 === 0 ? "bg-muted/20" : ""
                    }`}
                    style={{ height: SLOT_HEIGHT }}
                  />
                ))}
                {today && <NowLine />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WeekView;
