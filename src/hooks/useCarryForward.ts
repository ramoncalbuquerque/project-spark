import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";

type Card = Tables<"cards">;

export type AssigneeInfo = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

export type PendingCard = Card & {
  assignees: AssigneeInfo[];
  firstSeen: string | null;
  historyCount: number;
};

export function useCarryForward(ritualId: string | undefined) {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["carry-forward", ritualId],
    queryFn: async () => {
      // 1. Get last occurrence
      const { data: occs } = await supabase
        .from("ritual_occurrences")
        .select("id, date")
        .eq("ritual_id", ritualId!)
        .order("date", { ascending: false })
        .limit(1);

      if (!occs?.length) {
        return {
          pendingItems: [] as PendingCard[],
          completedCount: 0,
          lastOccurrenceDate: null as string | null,
          lastOccurrenceId: null as string | null,
        };
      }

      const lastOcc = occs[0];

      // 2. Fetch ALL cards from last occurrence
      const { data: allCards } = await supabase
        .from("cards")
        .select("*")
        .eq("ritual_occurrence_id", lastOcc.id);

      const cards = allCards ?? [];
      const completedCount = cards.filter((c) => c.status === "completed").length;
      const pendingRaw = cards.filter((c) => c.status !== "completed");

      if (pendingRaw.length === 0) {
        return {
          pendingItems: [] as PendingCard[],
          completedCount,
          lastOccurrenceDate: lastOcc.date,
          lastOccurrenceId: lastOcc.id,
        };
      }

      const cardIds = pendingRaw.map((c) => c.id);

      // 3. Fetch assignees
      const assigneeMap = new Map<string, AssigneeInfo[]>();
      const { data: assigneeRows } = await supabase
        .from("card_assignees")
        .select("card_id, profile_id, profiles(id, full_name, avatar_url)")
        .in("card_id", cardIds);

      for (const row of assigneeRows ?? []) {
        const p = row.profiles as unknown as AssigneeInfo | null;
        if (!p) continue;
        const list = assigneeMap.get(row.card_id) ?? [];
        list.push(p);
        assigneeMap.set(row.card_id, list);
      }

      // 4. Fetch task_history to count occurrences passed
      const historyMap = new Map<string, { firstSeen: string | null; count: number }>();
      const { data: historyRows } = await supabase
        .from("task_history")
        .select("card_id, created_at, ritual_occurrence_id")
        .in("card_id", cardIds)
        .order("created_at", { ascending: true });

      for (const row of historyRows ?? []) {
        const entry = historyMap.get(row.card_id);
        if (!entry) {
          historyMap.set(row.card_id, { firstSeen: row.created_at, count: 1 });
        } else {
          entry.count++;
        }
      }

      const pendingItems: PendingCard[] = pendingRaw.map((card) => {
        const history = historyMap.get(card.id);
        return {
          ...card,
          assignees: assigneeMap.get(card.id) ?? [],
          firstSeen: history?.firstSeen ?? card.created_at,
          historyCount: history?.count ?? 0,
        };
      });

      return {
        pendingItems,
        completedCount,
        lastOccurrenceDate: lastOcc.date,
        lastOccurrenceId: lastOcc.id,
      };
    },
    enabled: !!ritualId && !!user,
  });

  return {
    pendingItems: data?.pendingItems ?? [],
    completedCount: data?.completedCount ?? 0,
    lastOccurrenceDate: data?.lastOccurrenceDate ?? null,
    lastOccurrenceId: data?.lastOccurrenceId ?? null,
    isLoading,
  };
}
