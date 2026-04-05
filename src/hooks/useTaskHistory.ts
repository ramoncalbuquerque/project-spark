import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type TaskHistory = Tables<"task_history"> & {
  updated_by_name: string | null;
};

export function useTaskHistory(cardId: string | undefined) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["task-history", cardId],
    queryFn: async () => {
      if (!cardId) return [];
      const { data, error } = await supabase
        .from("task_history")
        .select("*, profiles:updated_by(full_name)")
        .eq("card_id", cardId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row): TaskHistory => {
        const p = row.profiles as unknown as { full_name: string | null } | null;
        return { ...row, updated_by_name: p?.full_name ?? null };
      });
    },
    enabled: !!cardId,
  });

  return { history, isLoading };
}
