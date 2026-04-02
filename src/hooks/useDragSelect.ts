import { useState, useCallback, useRef } from "react";
import { setHours, setMinutes } from "date-fns";

interface DragState {
  day: Date;
  startSlot: number;
  endSlot: number;
}

interface UseDragSelectOptions {
  enabled: boolean;
  onSelect: (startDate: Date, endDate: Date) => void;
}

export function useDragSelect({ enabled, onSelect }: UseDragSelectOptions) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const draggingRef = useRef(false);

  const getSelectedRange = useCallback((d: DragState) => {
    const min = Math.min(d.startSlot, d.endSlot);
    const max = Math.max(d.startSlot, d.endSlot);
    return { min, max };
  }, []);

  const isSlotSelected = useCallback(
    (day: Date, hour: number) => {
      if (!drag || drag.day.getTime() !== day.getTime()) return false;
      const { min, max } = getSelectedRange(drag);
      return hour >= min && hour <= max;
    },
    [drag, getSelectedRange]
  );

  const onPointerDown = useCallback(
    (day: Date, hour: number) => {
      if (!enabled) return;
      draggingRef.current = true;
      setDrag({ day, startSlot: hour, endSlot: hour });
    },
    [enabled]
  );

  const onPointerMove = useCallback(
    (day: Date, hour: number) => {
      if (!draggingRef.current || !drag) return;
      if (drag.day.getTime() !== day.getTime()) return;
      if (drag.endSlot !== hour) {
        setDrag((prev) => (prev ? { ...prev, endSlot: hour } : null));
      }
    },
    [drag]
  );

  const onPointerUp = useCallback(() => {
    if (!draggingRef.current || !drag) {
      draggingRef.current = false;
      setDrag(null);
      return;
    }
    draggingRef.current = false;
    const { min, max } = getSelectedRange(drag);
    const startDate = setMinutes(setHours(new Date(drag.day), min), 0);
    const endDate = setMinutes(setHours(new Date(drag.day), max + 1), 0);
    setDrag(null);

    // If it's a single slot, just use start (same as click behavior)
    if (min === max) {
      onSelect(startDate, startDate);
    } else {
      onSelect(startDate, endDate);
    }
  }, [drag, getSelectedRange, onSelect]);

  return {
    drag,
    isSlotSelected,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    isDragging: draggingRef.current,
  };
}
