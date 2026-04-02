import { parseISO, isSameDay, differenceInMinutes } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Card = Tables<"cards">;

export const START_HOUR = 6;
export const END_HOUR = 22;
export const SLOT_HEIGHT = 60;
export const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

export interface PositionedCard {
  card: Card;
  top: number;
  height: number;
  left: string;
  width: string;
}

interface CardItem {
  card: Card;
  top: number;
  height: number;
  startMinutes: number;
  endMinutes: number;
}

interface ColAssignment {
  item: CardItem;
  col: number;
}

export function getTimedCardsForDay(cards: Card[], day: Date): Card[] {
  return cards.filter((c) => {
    const d = parseISO(c.start_date);
    return isSameDay(d, day) && !c.all_day;
  });
}

export function positionCards(cards: Card[], day: Date): PositionedCard[] {
  const dayCards = getTimedCardsForDay(cards, day);

  const items: CardItem[] = dayCards.map((card) => {
    const start = parseISO(card.start_date);
    const startMinutes = (start.getHours() - START_HOUR) * 60 + start.getMinutes();
    const top = (startMinutes / 60) * SLOT_HEIGHT;

    let durationMinutes = 60;
    if (card.end_date) {
      const end = parseISO(card.end_date);
      durationMinutes = Math.max(15, differenceInMinutes(end, start));
    }
    const height = Math.max(16, (durationMinutes / 60) * SLOT_HEIGHT);

    return { card, top, height, startMinutes, endMinutes: startMinutes + durationMinutes };
  });

  items.sort((a, b) => a.startMinutes - b.startMinutes || b.endMinutes - a.endMinutes);

  const columns: number[] = []; // tracks endMinutes per column
  const colAssignments: ColAssignment[] = [];

  for (const item of items) {
    let placed = false;
    for (let c = 0; c < columns.length; c++) {
      if (item.startMinutes >= columns[c]) {
        columns[c] = item.endMinutes;
        colAssignments.push({ item, col: c });
        placed = true;
        break;
      }
    }
    if (!placed) {
      colAssignments.push({ item, col: columns.length });
      columns.push(item.endMinutes);
    }
  }

  // Group overlapping cards
  const groups: ColAssignment[][] = [];
  for (const ca of colAssignments) {
    let addedToGroup = false;
    for (const group of groups) {
      const overlaps = group.some(
        (g) => ca.item.startMinutes < g.item.endMinutes && ca.item.endMinutes > g.item.startMinutes
      );
      if (overlaps) {
        group.push(ca);
        addedToGroup = true;
        break;
      }
    }
    if (!addedToGroup) {
      groups.push([ca]);
    }
  }

  // Merge overlapping groups
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const overlaps = groups[i].some((a) =>
          groups[j].some(
            (b) => a.item.startMinutes < b.item.endMinutes && a.item.endMinutes > b.item.startMinutes
          )
        );
        if (overlaps) {
          groups[i].push(...groups[j]);
          groups.splice(j, 1);
          merged = true;
          break;
        }
      }
      if (merged) break;
    }
  }

  const result: PositionedCard[] = [];
  for (const group of groups) {
    const maxCol = Math.max(...group.map((g) => g.col)) + 1;
    for (const { item, col } of group) {
      result.push({
        card: item.card,
        top: item.top,
        height: item.height,
        left: `${(col / maxCol) * 100}%`,
        width: `${(1 / maxCol) * 100}%`,
      });
    }
  }

  return result;
}

export function getCardsForSlot(cards: Card[], day: Date, hour: number) {
  return cards.filter((c) => {
    const d = parseISO(c.start_date);
    return isSameDay(d, day) && d.getHours() === hour && !c.all_day;
  });
}
