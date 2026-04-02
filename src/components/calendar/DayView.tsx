import { useEffect, useRef, useState, useCallback } from "react";
import { useCalendar } from "@/contexts/CalendarContext";
import { useCards, type CardWithAssignees } from "@/hooks/useCards";
import { useCardModal } from "@/contexts/CardContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDragSelect } from "@/hooks/useDragSelect";
import { useDragMove } from "@/hooks/useDragMove";
import CalendarCard from "./CalendarCard";
import { positionCards, HOURS, SLOT_HEIGHT, START_HOUR } from "./calendarUtils";
import { format, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

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

const DayView = () => {
  const { selectedDate } = useCalendar();
  const { cards, updateCard } = useCards();
  const { openCreateModal } = useCardModal();
  const { profile } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = isToday(selectedDate);
  const isLeader = profile?.role === "leader";

  const [nowTop, setNowTop] = useState<number | null>(null);

  // Drag-to-select
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
    (card: CardWithAssignees, newStart: Date, newEnd: Date | null) => {
      updateCard.mutate({
        id: card.id,
        updates: {
          start_date: newStart.toISOString(),
          end_date: newEnd ? newEnd.toISOString() : card.end_date,
        },
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

  useEffect(() => {
    if (!today) { setNowTop(null); return; }
    const update = () => {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      if (h >= START_HOUR && h < 22) {
        setNowTop((h - START_HOUR) * SLOT_HEIGHT + (m / 60) * SLOT_HEIGHT);
      } else {
        setNowTop(null);
      }
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [today]);

  const handleSlotMouseDown = useCallback(
    (hour: number) => {
      if (dragMove) return;
      onSelectDown(selectedDate, hour);
    },
    [dragMove, onSelectDown, selectedDate]
  );

  const handleSlotMouseEnter = useCallback(
    (hour: number) => {
      onSelectMove(selectedDate, hour);
    },
    [onSelectMove, selectedDate]
  );

  const handleGlobalUp = useCallback(() => {
    onSelectUp();
  }, [onSelectUp]);

  const handleCardLongPress = useCallback(
    (card: Tables<"cards">) => {
      const start = parseISO(card.start_date);
      startLongPress(card, selectedDate, start.getHours());
    },
    [selectedDate, startLongPress]
  );

  const positioned = positionCards(cards, selectedDate);
  const dropSlot = getDropSlot();
  const showDropGhost = dropSlot && dropSlot.day.getTime() === selectedDate.getTime();

  return (
    <div
      className="flex flex-col h-full border border-border rounded-lg overflow-hidden bg-card select-none"
      onMouseUp={handleGlobalUp}
      onTouchEnd={handleGlobalUp}
      onMouseLeave={handleGlobalUp}
    >
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
            {HOURS.map((hour, rowIdx) => {
              const selected = isSlotSelected(selectedDate, hour);
              const isDropTarget = showDropGhost && hour === dropSlot!.hour;
              return (
                <div
                  key={rowIdx}
                  className={`border-b border-border/50 ${rowIdx % 2 === 0 ? "bg-muted/20" : ""} ${
                    isLeader && !dragMove ? "cursor-crosshair" : ""
                  } ${isLeader && dragMove ? "cursor-grabbing" : ""} ${
                    selected
                      ? "!bg-[rgba(27,94,32,0.15)] border border-dashed !border-primary/40"
                      : ""
                  } ${isDropTarget ? "!bg-[rgba(27,94,32,0.1)]" : ""} transition-colors duration-100`}
                  style={{ height: SLOT_HEIGHT }}
                  onMouseDown={() => handleSlotMouseDown(hour)}
                  onMouseEnter={() => handleSlotMouseEnter(hour)}
                  onTouchStart={() => handleSlotMouseDown(hour)}
                  data-hour={hour}
                  data-day={selectedDate.toISOString()}
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
                className={`absolute z-[5] px-0.5 ${drag ? "pointer-events-none" : ""}`}
                style={{
                  top: pc.top,
                  height: pc.height,
                  left: pc.left,
                  width: pc.width,
                }}
              >
                <CalendarCard
                  card={pc.card}
                  height={pc.height}
                  isDragging={isCardBeingDragged(pc.card.id)}
                  onLongPressStart={isLeader ? handleCardLongPress : undefined}
                  onLongPressCancel={cancelLongPress}
                />
              </div>
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
