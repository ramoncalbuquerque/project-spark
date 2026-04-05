import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AssigneeOption = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  type: "profile" | "contact";
};

export function useAssigneeOptions() {
  const { user } = useAuth();

  const { data: options = [], isLoading } = useQuery({
    queryKey: ["assignee-options"],
    queryFn: async () => {
      const [profilesRes, contactsRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, avatar_url"),
        supabase.from("contacts").select("id, full_name, linked_profile_id"),
      ]);

      const result: AssigneeOption[] = [];

      for (const p of profilesRes.data ?? []) {
        result.push({
          id: p.id,
          full_name: p.full_name ?? "Sem nome",
          avatar_url: p.avatar_url,
          type: "profile",
        });
      }

      for (const c of contactsRes.data ?? []) {
        if (!c.linked_profile_id) {
          result.push({
            id: c.id,
            full_name: c.full_name,
            avatar_url: null,
            type: "contact",
          });
        }
      }

      if (user) {
        result.sort((a, b) => {
          if (a.id === user.id) return -1;
          if (b.id === user.id) return 1;
          if (a.type !== b.type) return a.type === "profile" ? -1 : 1;
          return a.full_name.localeCompare(b.full_name);
        });
      }

      return result;
    },
    enabled: !!user,
  });

  return { options, isLoading };
}
