import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";

type Card = Tables<"cards">;

export type AssigneeInfo = { id: string; full_name: string | null; avatar_url: string | null };
export type TeamInfo = { id: string; name: string };

export type DetailedCard = Card & {
  assignees: AssigneeInfo[];
  teams: TeamInfo[];
  project_name: string | null;
  ritual_name: string | null;
};

export function useTaskDetail(cardId: string | undefined) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["task-detail", cardId];

  const { data: card, isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<DetailedCard | null> => {
      if (!cardId) return null;
      const { data, error } = await supabase
        .from("cards")
        .select("*")
        .eq("id", cardId)
        .single();
      if (error) throw error;
      const c = data as Card;

      // Enrich in parallel
      const [assigneesRes, teamsRes] = await Promise.all([
        supabase
          .from("card_assignees")
          .select("profile_id, profiles(id, full_name, avatar_url)")
          .eq("card_id", cardId),
        supabase
          .from("card_teams")
          .select("team_id, teams(id, name)")
          .eq("card_id", cardId),
      ]);

      const assignees: AssigneeInfo[] = (assigneesRes.data ?? [])
        .map((r) => r.profiles as unknown as AssigneeInfo)
        .filter(Boolean);

      const teams: TeamInfo[] = (teamsRes.data ?? [])
        .map((r) => r.teams as unknown as TeamInfo)
        .filter(Boolean);

      let project_name: string | null = null;
      if (c.project_id) {
        const { data: proj } = await supabase
          .from("projects")
          .select("name")
          .eq("id", c.project_id)
          .single();
        project_name = proj?.name ?? null;
      }

      let ritual_name: string | null = null;
      if (c.ritual_occurrence_id) {
        const { data: occ } = await supabase
          .from("ritual_occurrences")
          .select("ritual_id, rituals(name)")
          .eq("id", c.ritual_occurrence_id)
          .single();
        if (occ) {
          const r = occ.rituals as unknown as { name: string } | null;
          ritual_name = r?.name ?? null;
        }
      }

      return { ...c, assignees, teams, project_name, ritual_name };
    },
    enabled: !!cardId && !!user,
  });

  const isCreator = card?.created_by === user?.id;
  const isLeader = profile?.role === "leader";
  const canEditAll = isCreator || isLeader;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ["feed-cards"] });
    queryClient.invalidateQueries({ queryKey: ["cards"] });
  };

  const updateCard = useMutation({
    mutationFn: async (updates: TablesUpdate<"cards">) => {
      if (!cardId) throw new Error("No card");
      const { error } = await supabase.from("cards").update(updates).eq("id", cardId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Tarefa atualizada");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const updateAssignees = useMutation({
    mutationFn: async (profileIds: string[]) => {
      if (!cardId) throw new Error("No card");
      await supabase.from("card_assignees").delete().eq("card_id", cardId);
      if (profileIds.length > 0) {
        await supabase.from("card_assignees").insert(
          profileIds.map((pid) => ({ card_id: cardId, profile_id: pid }))
        );
      }
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const deleteCard = useMutation({
    mutationFn: async () => {
      if (!cardId) throw new Error("No card");
      const { error } = await supabase.from("cards").delete().eq("id", cardId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Tarefa excluída");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  return { card, isLoading, canEditAll, updateCard, updateAssignees, deleteCard };
}
