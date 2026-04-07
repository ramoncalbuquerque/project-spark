import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Ritual = Tables<"rituals">;

export type RitualMember = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

export type EnrichedRitual = Ritual & {
  members: RitualMember[];
  lastOccurrence: { date: string; pendingCount: number } | null;
};

const FREQ_LABEL: Record<string, string> = {
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
  custom: "Personalizada",
};

export { FREQ_LABEL };

export function useRituals() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["rituals"] });

  const { data: rituals = [], isLoading } = useQuery({
    queryKey: ["rituals"],
    queryFn: async () => {
      const { data: raw, error } = await supabase
        .from("rituals")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!raw?.length) return [] as EnrichedRitual[];

      const ritualIds = raw.map((r) => r.id);

      const memberMap = new Map<string, RitualMember[]>();
      const lastOccMap = new Map<string, { date: string; occId: string }>();

      const promises: PromiseLike<void>[] = [];

      // Members
      promises.push(
        supabase
          .from("ritual_members")
          .select("ritual_id, profile_id, profiles(id, full_name, avatar_url)")
          .in("ritual_id", ritualIds)
          .then(({ data }) => {
            for (const row of data ?? []) {
              const p = row.profiles as unknown as RitualMember | null;
              if (!p) continue;
              const list = memberMap.get(row.ritual_id) ?? [];
              list.push(p);
              memberMap.set(row.ritual_id, list);
            }
          })
      );

      // Last occurrence per ritual
      promises.push(
        supabase
          .from("ritual_occurrences")
          .select("id, ritual_id, date")
          .in("ritual_id", ritualIds)
          .order("date", { ascending: false })
          .then(({ data }) => {
            for (const occ of data ?? []) {
              if (!lastOccMap.has(occ.ritual_id)) {
                lastOccMap.set(occ.ritual_id, { date: occ.date, occId: occ.id });
              }
            }
          })
      );

      await Promise.all(promises);

      // Pending counts for last occurrences
      const occIds = [...lastOccMap.values()].map((v) => v.occId);
      const pendingMap = new Map<string, number>();

      if (occIds.length > 0) {
        const { data: cards } = await supabase
          .from("cards")
          .select("ritual_occurrence_id, status")
          .in("ritual_occurrence_id", occIds)
          .neq("status", "completed");

        for (const card of cards ?? []) {
          if (!card.ritual_occurrence_id) continue;
          pendingMap.set(card.ritual_occurrence_id, (pendingMap.get(card.ritual_occurrence_id) ?? 0) + 1);
        }
      }

      return raw.map((ritual): EnrichedRitual => {
        const lastOcc = lastOccMap.get(ritual.id);
        return {
          ...ritual,
          members: memberMap.get(ritual.id) ?? [],
          lastOccurrence: lastOcc
            ? { date: lastOcc.date, pendingCount: pendingMap.get(lastOcc.occId) ?? 0 }
            : null,
        };
      });
    },
    enabled: !!user,
  });

  const createRitual = useMutation({
    mutationFn: async (input: { name: string; frequency: string; memberIds?: string[] }) => {
      if (!user) throw new Error("Não autenticado");
      const { data, error } = await supabase
        .from("rituals")
        .insert({ name: input.name, frequency: input.frequency, created_by: user.id })
        .select()
        .single();
      if (error) throw error;

      if (input.memberIds?.length) {
        const rows = input.memberIds.map((pid) => ({ ritual_id: data.id, profile_id: pid }));
        await supabase.from("ritual_members").insert(rows);
      }
      return data;
    },
    onSuccess: () => { invalidate(); toast.success("Ritualística criada"); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const updateRitual = useMutation({
    mutationFn: async (input: { id: string; name?: string; description?: string; frequency?: string }) => {
      const updates: { name?: string; description?: string; frequency?: string } = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.frequency !== undefined) updates.frequency = input.frequency;
      const { error } = await supabase.from("rituals").update(updates).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Atualizado"); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const deleteRitual = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rituals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Ritualística excluída"); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const userRole = (profile?.role || 'member') as import("@/lib/permissions").UserRole;

  return { rituals, isLoading, userRole, createRitual, updateRitual, deleteRitual };
}
