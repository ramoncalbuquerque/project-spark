import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";

type Card = Tables<"cards">;

export function useCarryForward(ritualId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Fetch pending cards from the last occurrence
  const { data: pendingCards = [] } = useQuery({
    queryKey: ["carry-forward", ritualId],
    queryFn: async () => {
      // Get last occurrence
      const { data: occs } = await supabase
        .from("ritual_occurrences")
        .select("id")
        .eq("ritual_id", ritualId!)
        .order("date", { ascending: false })
        .limit(1);

      if (!occs?.length) return [] as Card[];

      const lastOccId = occs[0].id;

      const { data: cards } = await supabase
        .from("cards")
        .select("*")
        .eq("ritual_occurrence_id", lastOccId)
        .neq("status", "completed");

      return (cards ?? []) as Card[];
    },
    enabled: !!ritualId && !!user,
  });

  const executeCarryForward = async (newOccurrenceId: string) => {
    if (!user || pendingCards.length === 0) return;

    // For each pending card: update ritual_occurrence_id + insert task_history
    for (const card of pendingCards) {
      await supabase
        .from("cards")
        .update({ ritual_occurrence_id: newOccurrenceId })
        .eq("id", card.id);

      await supabase.from("task_history").insert({
        card_id: card.id,
        ritual_occurrence_id: newOccurrenceId,
        status_at_time: card.status,
        updated_by: user.id,
        context_note: "Carry-forward automático",
      });
    }

    qc.invalidateQueries({ queryKey: ["carry-forward", newOccurrenceId] });
    qc.invalidateQueries({ queryKey: ["ritual-occurrences"] });
    qc.invalidateQueries({ queryKey: ["feed-cards"] });
  };

  return { pendingCards, executeCarryForward };
}
