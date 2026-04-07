import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Occurrence = Tables<"ritual_occurrences">;

export type EnrichedOccurrence = Occurrence & {
  cardCount: number;
  completedCount: number;
};

export function useRitualOccurrences(ritualId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["ritual-occurrences", ritualId] });
    qc.invalidateQueries({ queryKey: ["rituals"] });
  };

  const { data: occurrences = [], isLoading } = useQuery({
    queryKey: ["ritual-occurrences", ritualId],
    queryFn: async () => {
      const { data: raw, error } = await supabase
        .from("ritual_occurrences")
        .select("*")
        .eq("ritual_id", ritualId!)
        .order("date", { ascending: false });
      if (error) throw error;
      if (!raw?.length) return [] as EnrichedOccurrence[];

      const occIds = raw.map((o) => o.id);

      // Count cards per occurrence
      const countMap = new Map<string, { total: number; done: number }>();
      const { data: cards } = await supabase
        .from("cards")
        .select("ritual_occurrence_id, status")
        .in("ritual_occurrence_id", occIds);

      for (const c of cards ?? []) {
        if (!c.ritual_occurrence_id) continue;
        const entry = countMap.get(c.ritual_occurrence_id) ?? { total: 0, done: 0 };
        entry.total++;
        if (c.status === "completed") entry.done++;
        countMap.set(c.ritual_occurrence_id, entry);
      }

      return raw.map((occ): EnrichedOccurrence => {
        const counts = countMap.get(occ.id) ?? { total: 0, done: 0 };
        return { ...occ, cardCount: counts.total, completedCount: counts.done };
      });
    },
    enabled: !!ritualId && !!user,
  });

  const createOccurrence = useMutation({
    mutationFn: async (input?: { date?: string }) => {
      if (!user || !ritualId) throw new Error("Erro");
      const { data, error } = await supabase
        .from("ritual_occurrences")
        .insert({
          ritual_id: ritualId,
          date: input?.date ?? new Date().toISOString(),
          status: "open",
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const updateOccurrence = useMutation({
    mutationFn: async (input: { id: string; notes?: string; status?: string }) => {
      const updates: { notes?: string; status?: string } = {};
      if (input.notes !== undefined) updates.notes = input.notes;
      if (input.status !== undefined) updates.status = input.status;
      const { error } = await supabase.from("ritual_occurrences").update(updates).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  return { occurrences, isLoading, createOccurrence, updateOccurrence };
}
