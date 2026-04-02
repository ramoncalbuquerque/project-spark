import { useEffect, useRef, useState } from "react";
import { useCalendar } from "@/contexts/CalendarContext";
import { format, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";

const START_HOUR = 6;
const END_HOUR = 22;
const SLOT_HEIGHT = 60;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

const DayView = () => {
  const { selectedDate } = useCalendar();
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = isToday(selectedDate);

  const [nowTop, setNowTop] = useState<number | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = (8 - START_HOUR) * SLOT_HEIGHT;
    }
  }, []);

  useEffect(() => {
    if (!today) { setNowTop(null); return; }
    const update = () => {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      if (h >= START_HOUR && h < END_HOUR) {
        setNowTop((h - START_HOUR) * SLOT_HEIGHT + (m / 60) * SLOT_HEIGHT);
      } else {
        setNowTop(null);
      }
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [today]);

  return (
    <div className="flex flex-col h-full border border-border rounded-lg overflow-hidden bg-card">
      {/* Header */}
      <div className="flex border-b border-border shrink-0">
        <div className="w-14 shrink-0" />
        <div className={`flex-1 text-center py-2 ${today ? "bg-primary/5" : ""}`}>
          <div className="text-xs text-muted-foreground uppercase">
            {format(selectedDate, "EEEE", { locale: ptBR })}
          </div>
          <div className={`text-lg font-semibold ${today ? "text-primary" : "text-foreground"}`}>
            {format(selectedDate, "d")}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex relative" style={{ height: HOURS.length * SLOT_HEIGHT }}>
          <div className="w-14 shrink-0 relative">
            {HOURS.map((hour, i) => (
              <div
                key={hour}
                className="absolute left-0 right-0 text-right pr-2 -translate-y-1/2 text-xs text-muted-foreground"
                style={{ top: i * SLOT_HEIGHT }}
              >
                {`${String(hour).padStart(2, "0")}:00`}
              </div>
            ))}
          </div>

          <div className={`flex-1 border-l border-border relative ${today ? "bg-primary/5" : ""}`}>
            {HOURS.map((_, rowIdx) => (
              <div
                key={rowIdx}
                className={`border-b border-border/50 ${rowIdx % 2 === 0 ? "bg-muted/20" : ""}`}
                style={{ height: SLOT_HEIGHT }}
              />
            ))}
            {nowTop !== null && (
              <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: nowTop }}>
                <div className="relative w-full">
                  <div className="absolute left-0 w-2 h-2 rounded-full bg-destructive -translate-y-1/2" />
                  <div className="absolute left-0 right-0 h-[2px] bg-destructive" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DayView;
