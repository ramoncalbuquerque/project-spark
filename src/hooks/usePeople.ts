import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;
type Contact = Tables<"contacts">;

export type UnifiedPerson = {
  id: string;
  full_name: string;
  position: string | null;
  department: string | null;
  avatar_url: string | null;
  superior_id: string | null;
  superior_name: string | null;
  hierarchy_level: string | null;
  has_account: boolean;
  has_phone: boolean;
  pending_count: number;
  overdue_count: number;
};

// Keep for backward compat
export type PersonWithStats = Profile & {
  pending_count: number;
  overdue_count: number;
};

export function usePeople() {
  const { user } = useAuth();

  const unifiedQuery = useQuery({
    queryKey: ["people-unified"],
    queryFn: async () => {
      // Fetch profiles and contacts in parallel
      const [profilesRes, contactsRes] = await Promise.all([
        supabase.from("profiles").select("*").order("full_name", { ascending: true }),
        supabase.from("contacts").select("*").order("full_name", { ascending: true }),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      const profiles = profilesRes.data as Profile[];
      const contacts = (contactsRes.data ?? []) as Contact[];

      // Build name→id map for profiles
      const profileNameMap = new Map<string, string>();
      const profileIdMap = new Map<string, Profile>();
      for (const p of profiles) {
        if (p.full_name) profileNameMap.set(p.full_name.toLowerCase().trim(), p.id);
        profileIdMap.set(p.id, p);
      }

      // Get card stats for profiles
      const profileIds = profiles.map((p) => p.id);
      const statsMap = new Map<string, { pending: number; overdue: number }>();

      if (profileIds.length > 0) {
        const { data: assignments } = await supabase
          .from("card_assignees")
          .select("profile_id, card_id, cards(id, status, end_date, start_date)")
          .in("profile_id", profileIds);

        const now = new Date();
        for (const row of assignments ?? []) {
          const card = row.cards as unknown as {
            id: string; status: string; end_date: string | null; start_date: string;
          } | null;
          if (!card || card.status === "completed") continue;
          const stats = statsMap.get(row.profile_id) ?? { pending: 0, overdue: 0 };
          const dateStr = card.end_date || card.start_date;
          if (dateStr && new Date(dateStr) < now) {
            stats.overdue++;
          } else {
            stats.pending++;
          }
          statsMap.set(row.profile_id, stats);
        }
      }

      // Unify profiles
      const unified: UnifiedPerson[] = profiles.map((p) => {
        const superiorProfile = p.superior_id ? profileIdMap.get(p.superior_id) : null;
        return {
          id: p.id,
          full_name: p.full_name || "Sem nome",
          position: p.position,
          department: p.department,
          avatar_url: p.avatar_url,
          superior_id: p.superior_id,
          superior_name: superiorProfile?.full_name ?? null,
          hierarchy_level: p.hierarchy_level,
          has_account: true,
          has_phone: !!p.phone,
          pending_count: statsMap.get(p.id)?.pending ?? 0,
          overdue_count: statsMap.get(p.id)?.overdue ?? 0,
        };
      });

      // Unify contacts (not linked to a profile)
      const unlinkedContacts = contacts.filter((c) => !c.linked_profile_id);
      for (const c of unlinkedContacts) {
        unified.push({
          id: c.id,
          full_name: c.full_name,
          position: c.position,
          department: c.department,
          avatar_url: null,
          superior_id: null,
          superior_name: null,
          hierarchy_level: null,
          has_account: false,
          has_phone: !!c.phone && c.phone !== "N/A",
          pending_count: 0,
          overdue_count: 0,
        });
      }

      // Sort all by name
      unified.sort((a, b) => a.full_name.localeCompare(b.full_name));

      return unified;
    },
    enabled: !!user,
  });

  const people = unifiedQuery.data ?? [];

  const departments = Array.from(
    new Set(people.map((p) => p.department).filter(Boolean) as string[])
  ).sort();

  const stats = {
    withAccount: people.filter((p) => p.has_account).length,
    withoutAccount: people.filter((p) => !p.has_account).length,
    withoutPhone: people.filter((p) => !p.has_phone).length,
  };

  return {
    people,
    departments,
    stats,
    isLoading: unifiedQuery.isLoading,
    refetch: () => unifiedQuery.refetch(),
  };
}
