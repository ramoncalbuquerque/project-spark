import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";

type Card = Tables<"cards">;

export type AgendaAssignee = { id: string; full_name: string | null; avatar_url: string | null };

export type AgendaCard = Card & {
  assignees: AgendaAssignee[];
};

export function useAgendaCards(startISO: string, endISO: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["agenda-cards", startISO, endISO],
    queryFn: async () => {
      const { data: rawCards, error } = await supabase
        .from("cards")
        .select("*")
        .gte("start_date", startISO)
        .lte("start_date", endISO)
        .order("start_date", { ascending: true });
      if (error) throw error;

      const cards = rawCards as Card[];
      if (cards.length === 0) return [] as AgendaCard[];

      const cardIds = cards.map((c) => c.id);
      const assigneeMap = new Map<string, AgendaAssignee[]>();

      try {
        const { data } = await supabase
          .from("card_assignees")
          .select("card_id, profile_id, profiles(id, full_name, avatar_url)")
          .in("card_id", cardIds);

        for (const row of data ?? []) {
          const p = row.profiles as unknown as AgendaAssignee | null;
          if (!p) continue;
          const list = assigneeMap.get(row.card_id) ?? [];
          list.push(p);
          assigneeMap.set(row.card_id, list);
        }
      } catch (err) {
        console.warn("Failed to enrich agenda cards:", err);
      }

      return cards.map((card): AgendaCard => ({
        ...card,
        assignees: assigneeMap.get(card.id) ?? [],
      }));
    },
    enabled: !!user,
  });
}
