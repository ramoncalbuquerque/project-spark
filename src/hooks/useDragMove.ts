import { useState, useCallback, useRef } from "react";
import { parseISO, differenceInMinutes, addMinutes, setHours, setMinutes } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Card = Tables<"cards">;

interface DragMoveState {
  card: Card;
  originDay: Date;
  originHour: number;
  currentDay: Date;
  currentHour: number;
  durationMinutes: number;
}

interface UseDragMoveOptions {
  enabled: boolean;
  onMove: (card: Card, newStart: Date, newEnd: Date | null) => void;
}

const LONG_PRESS_MS = 500;

export function useDragMove({ enabled, onMove }: UseDragMoveOptions) {
  const [dragMove, setDragMove] = useState<DragMoveState | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingMove = useRef(false);

  const startLongPress = useCallback(
    (card: Card, day: Date, hour: number) => {
      if (!enabled) return;
      longPressTimer.current = setTimeout(() => {
        const start = parseISO(card.start_date);
        let durationMinutes = 60;
        if (card.end_date) {
          durationMinutes = Math.max(15, differenceInMinutes(parseISO(card.end_date), start));
        }
        isDraggingMove.current = true;
        setDragMove({
          card,
          originDay: day,
          originHour: hour,
          currentDay: day,
          currentHour: hour,
          durationMinutes,
        });
      }, LONG_PRESS_MS);
    },
    [enabled]
  );

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const onMovePointerMove = useCallback(
    (day: Date, hour: number) => {
      if (!isDraggingMove.current || !dragMove) return;
      if (dragMove.currentDay.getTime() !== day.getTime() || dragMove.currentHour !== hour) {
        setDragMove((prev) => (prev ? { ...prev, currentDay: day, currentHour: hour } : null));
      }
    },
    [dragMove]
  );

  const onMovePointerUp = useCallback(() => {
    cancelLongPress();
    if (!isDraggingMove.current || !dragMove) {
      isDraggingMove.current = false;
      setDragMove(null);
      return;
    }
    isDraggingMove.current = false;

    const newStart = setMinutes(setHours(new Date(dragMove.currentDay), dragMove.currentHour), 0);
    const hasEnd = !!dragMove.card.end_date;
    const newEnd = hasEnd ? addMinutes(newStart, dragMove.durationMinutes) : null;

    setDragMove(null);
    onMove(dragMove.card, newStart, newEnd);
  }, [dragMove, onMove, cancelLongPress]);

  const isCardBeingDragged = useCallback(
    (cardId: string) => dragMove?.card.id === cardId,
    [dragMove]
  );

  const getDropSlot = useCallback(() => {
    if (!dragMove) return null;
    return { day: dragMove.currentDay, hour: dragMove.currentHour, durationMinutes: dragMove.durationMinutes };
  }, [dragMove]);

  return {
    dragMove,
    startLongPress,
    cancelLongPress,
    onMovePointerMove,
    onMovePointerUp,
    isCardBeingDragged,
    getDropSlot,
    isDraggingMove: isDraggingMove.current,
  };
}
