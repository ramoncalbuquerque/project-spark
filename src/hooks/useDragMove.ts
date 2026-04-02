import { useState, useCallback, useRef, useEffect } from "react";
import { parseISO, differenceInMinutes, addMinutes, setHours, setMinutes } from "date-fns";
import { flushSync } from "react-dom";
import type { CardWithAssignees } from "@/hooks/useCards";

type Card = CardWithAssignees;

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
  const dragMoveRef = useRef<DragMoveState | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  useEffect(() => {
    dragMoveRef.current = dragMove;
  }, [dragMove]);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

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
        const state: DragMoveState = {
          card,
          originDay: day,
          originHour: hour,
          currentDay: day,
          currentHour: hour,
          durationMinutes,
        };
        flushSync(() => {
          setDragMove(state);
        });
        dragMoveRef.current = state;

        const onDocMove = (e: PointerEvent) => {
          const el = document.elementFromPoint(e.clientX, e.clientY);
          const slot = el?.closest("[data-hour]") as HTMLElement | null;
          if (slot && slot.dataset.hour && slot.dataset.day) {
            const newHour = Number(slot.dataset.hour);
            const newDay = new Date(slot.dataset.day);
            const prev = dragMoveRef.current;
            if (prev && (prev.currentDay.getTime() !== newDay.getTime() || prev.currentHour !== newHour)) {
              const updated = { ...prev, currentDay: newDay, currentHour: newHour };
              dragMoveRef.current = updated;
              flushSync(() => {
                setDragMove(updated);
              });
            }
          }
        };

        const onDocUp = () => {
          document.removeEventListener("pointermove", onDocMove);
          document.removeEventListener("pointerup", onDocUp);

          const dm = dragMoveRef.current;
          if (!isDraggingMove.current || !dm) {
            isDraggingMove.current = false;
            flushSync(() => {
              setDragMove(null);
            });
            return;
          }
          isDraggingMove.current = false;

          const newStart = setMinutes(setHours(new Date(dm.currentDay), dm.currentHour), 0);
          const hasEnd = !!dm.card.end_date;
          const newEnd = hasEnd ? addMinutes(newStart, dm.durationMinutes) : null;

          flushSync(() => {
            setDragMove(null);
          });
          dragMoveRef.current = null;
          onMoveRef.current(dm.card, newStart, newEnd);
        };

        document.addEventListener("pointermove", onDocMove);
        document.addEventListener("pointerup", onDocUp);
      }, LONG_PRESS_MS);
    },
    [enabled]
  );

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
    isCardBeingDragged,
    getDropSlot,
    isDraggingMove: isDraggingMove.current,
  };
}
