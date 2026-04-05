import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;
type Contact = Tables<"contacts">;

export type PersonWithStats = Profile & {
  pending_count: number;
  overdue_count: number;
};

export function usePeople() {
  const { user } = useAuth();

  const profilesQuery = useQuery({
    queryKey: ["people-profiles"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name", { ascending: true });
      if (error) throw error;

      const profileIds = profiles.map((p) => p.id);
      if (profileIds.length === 0) return [] as PersonWithStats[];

      // Get card assignments with status
      const { data: assignments } = await supabase
        .from("card_assignees")
        .select("profile_id, card_id, cards(id, status, end_date, start_date)")
        .in("profile_id", profileIds);

      const now = new Date();
      const statsMap = new Map<string, { pending: number; overdue: number }>();

      for (const row of assignments ?? []) {
        const card = row.cards as unknown as { id: string; status: string; end_date: string | null; start_date: string } | null;
        if (!card) continue;
        const stats = statsMap.get(row.profile_id) ?? { pending: 0, overdue: 0 };
        if (card.status !== "completed") {
          const dateStr = card.end_date || card.start_date;
          if (dateStr && new Date(dateStr) < now) {
            stats.overdue++;
          } else {
            stats.pending++;
          }
        }
        statsMap.set(row.profile_id, stats);
      }

      return profiles.map((p): PersonWithStats => ({
        ...p,
        pending_count: statsMap.get(p.id)?.pending ?? 0,
        overdue_count: statsMap.get(p.id)?.overdue ?? 0,
      }));
    },
    enabled: !!user,
  });

  const contactsQuery = useQuery({
    queryKey: ["people-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .is("linked_profile_id", null)
        .order("full_name", { ascending: true });
      if (error) throw error;
      return data as Contact[];
    },
    enabled: !!user,
  });

  const departments = Array.from(
    new Set(
      (profilesQuery.data ?? [])
        .map((p) => p.department)
        .filter(Boolean) as string[]
    )
  ).sort();

  return {
    profiles: profilesQuery.data ?? [],
    contacts: contactsQuery.data ?? [],
    departments,
    isLoading: profilesQuery.isLoading,
    refetch: () => {
      profilesQuery.refetch();
      contactsQuery.refetch();
    },
  };
}
