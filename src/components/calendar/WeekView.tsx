import { useEffect, useRef, useCallback } from "react";
import { useCalendar } from "@/contexts/CalendarContext";
import { useCards } from "@/hooks/useCards";
import { useCardModal } from "@/contexts/CardContext";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDragSelect } from "@/hooks/useDragSelect";
import CalendarCard from "./CalendarCard";
import { positionCards, HOURS, SLOT_HEIGHT, START_HOUR } from "./calendarUtils";
import {
  startOfWeek,
  addDays,
  format,
  isToday,
} from "date-fns";
import { ptBR } from "date-fns/locale";

const HOUR_COL_W = "w-12 min-w-[3rem]";
const DAY_COL_W = "min-w-[44px]";

const SHORT_DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const NowLine = () => {
  const [top, setTop] = __import_useState(0);
  const [visible, setVisible] = __import_useState(false);

  // fix: use React hooks properly
  return null;
};

// Inline NowLine with proper imports
import { useState } from "react";

const NowLineComponent = () => {
  const [top, setTop] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      if (h >= START_HOUR && h < 22) {
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
    <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top }}>
      <div className="relative w-full">
        <div className="absolute left-0 w-2 h-2 rounded-full bg-destructive -translate-y-1/2" />
        <div className="absolute left-0 right-0 h-[2px] bg-destructive" />
      </div>
    </div>
  );
};

const WeekView = () => {
  const { selectedDate } = useCalendar();
  const { cards } = useCards();
  const { openCreateModal } = useCardModal();
  const { profile } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const isLeader = profile?.role === "leader";

  const handleDragSelect = useCallback(
    (startDate: Date, endDate: Date) => {
      if (startDate.getTime() === endDate.getTime()) {
        openCreateModal(startDate);
      } else {
        openCreateModal(startDate, endDate);
      }
    },
    [openCreateModal]
  );

  const { isSlotSelected, onPointerDown, onPointerMove, onPointerUp } = useDragSelect({
    enabled: isLeader,
    onSelect: handleDragSelect,
  });

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
    <div
      className="flex flex-col h-full border border-border rounded-lg overflow-hidden bg-card"
      onMouseUp={onPointerUp}
      onTouchEnd={onPointerUp}
      onMouseLeave={onPointerUp}
    >
      {/* Header */}
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
            const positioned = positionCards(cards, day);

            return (
              <div
                key={colIdx}
                className={`flex-1 ${DAY_COL_W} border-l border-border relative ${
                  today ? "bg-primary/5" : ""
                }`}
              >
                {/* Slot grid lines + drag targets */}
                {HOURS.map((hour, rowIdx) => {
                  const selected = isSlotSelected(day, hour);
                  return (
                    <div
                      key={rowIdx}
                      className={`border-b border-border/50 ${
                        rowIdx % 2 === 0 ? "bg-muted/20" : ""
                      } ${isLeader ? "cursor-crosshair" : ""} ${
                        selected
                          ? "!bg-[rgba(27,94,32,0.15)] border border-dashed !border-primary/40"
                          : ""
                      } transition-colors duration-100`}
                      style={{ height: SLOT_HEIGHT }}
                      onMouseDown={() => onPointerDown(day, hour)}
                      onMouseEnter={() => onPointerMove(day, hour)}
                      onTouchStart={() => onPointerDown(day, hour)}
                      onTouchMove={(e) => {
                        const touch = e.touches[0];
                        const el = document.elementFromPoint(touch.clientX, touch.clientY);
                        if (el) {
                          const slotHour = el.getAttribute("data-hour");
                          if (slotHour) onPointerMove(day, parseInt(slotHour));
                        }
                      }}
                      data-hour={hour}
                    />
                  );
                })}

                {/* Absolutely positioned cards */}
                {positioned.map((pc) => (
                  <div
                    key={pc.card.id}
                    className="absolute z-[5] px-0.5"
                    style={{
                      top: pc.top,
                      height: pc.height,
                      left: pc.left,
                      width: pc.width,
                    }}
                  >
                    <CalendarCard card={pc.card} compact={isMobile} height={pc.height} />
                  </div>
                ))}

                {today && <NowLineComponent />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WeekView;
