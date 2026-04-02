import { useEffect, useRef, useState, useCallback } from "react";
import { useCalendar } from "@/contexts/CalendarContext";
import { useCards } from "@/hooks/useCards";
import { useCardModal } from "@/contexts/CardContext";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDragSelect } from "@/hooks/useDragSelect";
import { useDragMove } from "@/hooks/useDragMove";
import CalendarCard from "./CalendarCard";
import { positionCards, HOURS, SLOT_HEIGHT, START_HOUR } from "./calendarUtils";
import {
  startOfWeek,
  addDays,
  format,
  isToday,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

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

/** Ghost preview of where the card will be dropped */
const DropGhost = ({ hour, durationMinutes, cardType }: { hour: number; durationMinutes: number; cardType: string }) => {
  const top = (hour - START_HOUR) * SLOT_HEIGHT;
  const height = Math.max(16, (durationMinutes / 60) * SLOT_HEIGHT);
  const colors: Record<string, string> = {
    task: "bg-[#1E88E5]/30 border-[#1565C0]",
    meeting: "bg-[#2E7D32]/30 border-[#1B5E20]",
    project: "bg-[#7B1FA2]/30 border-[#6A1B9A]",
  };
  const color = colors[cardType] || colors.task;

  return (
    <div
      className={`absolute left-0 right-0 z-[4] rounded-[6px] border-2 border-dashed ${color} pointer-events-none`}
      style={{ top, height }}
    />
  );
};

const WeekView = () => {
  const { selectedDate } = useCalendar();
  const { cards, updateCard } = useCards();
  const { openCreateModal } = useCardModal();
  const { profile } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const isLeader = profile?.role === "leader";

  // Drag-to-select (create)
  const handleDragSelect = useCallback(
    (startDate: Date, endDate: Date) => {
      openCreateModal(startDate, endDate);
    },
    [openCreateModal]
  );

  const { isSlotSelected, onPointerDown: onSelectDown, onPointerMove: onSelectMove, onPointerUp: onSelectUp } =
    useDragSelect({ enabled: isLeader, onSelect: handleDragSelect });

  // Drag-to-move
  const handleMove = useCallback(
    (card: Tables<"cards">, newStart: Date, newEnd: Date | null) => {
      updateCard.mutate({
        id: card.id,
        start_date: newStart.toISOString(),
        end_date: newEnd ? newEnd.toISOString() : card.end_date,
      });
    },
    [updateCard]
  );

  const {
    dragMove,
    startLongPress,
    cancelLongPress,
    isCardBeingDragged,
    getDropSlot,
  } = useDragMove({ enabled: isLeader, onMove: handleMove });

  const { drag } = useDragSelect({ enabled: isLeader, onSelect: handleDragSelect });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = (8 - START_HOUR) * SLOT_HEIGHT;
    }
  }, []);

  const getDayLabel = (day: Date, index: number) => {
    if (isMobile) return SHORT_DAYS[index];
    return format(day, "EEEE", { locale: ptBR });
  };

  const handleSlotMouseDown = useCallback(
    (day: Date, hour: number) => {
      if (dragMove) return; // Don't start select while moving
      onSelectDown(day, hour);
    },
    [dragMove, onSelectDown]
  );

  const handleSlotMouseEnter = useCallback(
    (day: Date, hour: number) => {
      onSelectMove(day, hour);
      onMovePointerMove(day, hour);
    },
    [onSelectMove, onMovePointerMove]
  );

  const handleGlobalUp = useCallback(() => {
    if (dragMove) {
      onMovePointerUp();
    } else {
      onSelectUp();
    }
  }, [dragMove, onMovePointerUp, onSelectUp]);

  const handleCardLongPress = useCallback(
    (card: Tables<"cards">) => {
      const start = parseISO(card.start_date);
      // Find which day column this card belongs to
      const matchingDay = days.find(
        (d) => d.getFullYear() === start.getFullYear() && d.getMonth() === start.getMonth() && d.getDate() === start.getDate()
      );
      if (matchingDay) {
        startLongPress(card, matchingDay, start.getHours());
      }
    },
    [days, startLongPress]
  );

  const dropSlot = getDropSlot();

  return (
    <div
      className="flex flex-col h-full border border-border rounded-lg overflow-hidden bg-card select-none"
      onMouseUp={handleGlobalUp}
      onTouchEnd={handleGlobalUp}
      onMouseLeave={handleGlobalUp}
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
            const showDropGhost =
              dropSlot && dropSlot.day.getTime() === day.getTime();

            return (
              <div
                key={colIdx}
                className={`flex-1 ${DAY_COL_W} border-l border-border relative ${
                  today ? "bg-primary/5" : ""
                }`}
              >
                {HOURS.map((hour, rowIdx) => {
                  const selected = isSlotSelected(day, hour);
                  const isDropTarget =
                    showDropGhost && hour === dropSlot!.hour;
                  return (
                    <div
                      key={rowIdx}
                      className={`border-b border-border/50 ${
                        rowIdx % 2 === 0 ? "bg-muted/20" : ""
                      } ${isLeader && !dragMove ? "cursor-crosshair" : ""} ${
                        isLeader && dragMove ? "cursor-grabbing" : ""
                      } ${
                        selected
                          ? "!bg-[rgba(27,94,32,0.15)] border border-dashed !border-primary/40"
                          : ""
                      } ${
                        isDropTarget
                          ? "!bg-[rgba(27,94,32,0.1)]"
                          : ""
                      } transition-colors duration-100`}
                      style={{ height: SLOT_HEIGHT }}
                      onMouseDown={() => handleSlotMouseDown(day, hour)}
                      onMouseEnter={() => handleSlotMouseEnter(day, hour)}
                      onTouchStart={() => handleSlotMouseDown(day, hour)}
                      data-hour={hour}
                    />
                  );
                })}

                {/* Drop ghost preview */}
                {showDropGhost && dropSlot && (
                  <DropGhost
                    hour={dropSlot.hour}
                    durationMinutes={dropSlot.durationMinutes}
                    cardType={dragMove!.card.card_type}
                  />
                )}

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
                    <CalendarCard
                      card={pc.card}
                      compact={isMobile}
                      height={pc.height}
                      isDragging={isCardBeingDragged(pc.card.id)}
                      onLongPressStart={isLeader ? handleCardLongPress : undefined}
                      onLongPressCancel={cancelLongPress}
                    />
                  </div>
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
