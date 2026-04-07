import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";
import { canEditCard, canDeleteCard, type UserRole } from "@/lib/permissions";

type Card = Tables<"cards">;

export type AssigneeInfo = { id: string; full_name: string | null; avatar_url: string | null };
export type ContactAssigneeInfo = { id: string; full_name: string; avatar_url: null };
export type TeamInfo = { id: string; name: string };

export type DetailedCard = Card & {
  assignees: AssigneeInfo[];
  contact_assignees: ContactAssigneeInfo[];
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

      const [assigneesRes, contactAssigneesRes, teamsRes] = await Promise.all([
        supabase
          .from("card_assignees")
          .select("profile_id, profiles(id, full_name, avatar_url)")
          .eq("card_id", cardId),
        supabase
          .from("card_contact_assignees")
          .select("contact_id, contacts(id, full_name)")
          .eq("card_id", cardId),
        supabase
          .from("card_teams")
          .select("team_id, teams(id, name)")
          .eq("card_id", cardId),
      ]);

      const assignees: AssigneeInfo[] = (assigneesRes.data ?? [])
        .map((r) => r.profiles as unknown as AssigneeInfo)
        .filter(Boolean);

      const contact_assignees: ContactAssigneeInfo[] = (contactAssigneesRes.data ?? [])
        .map((r) => {
          const ct = r.contacts as unknown as { id: string; full_name: string } | null;
          return ct ? { id: ct.id, full_name: ct.full_name, avatar_url: null as null } : null;
        })
        .filter(Boolean) as ContactAssigneeInfo[];

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

      return { ...c, assignees, contact_assignees, teams, project_name, ritual_name };
    },
    enabled: !!cardId && !!user,
  });

  const isCreator = card?.created_by === user?.id;
  const isAssignee = card?.assignees.some(a => a.id === user?.id) ?? false;
  const role = (profile?.role || 'member') as UserRole;
  const canEditAll = canEditCard(role, isCreator, isAssignee);
  const canDelete = canDeleteCard(role, isCreator);

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
    mutationFn: async ({ profileIds, contactIds }: { profileIds: string[]; contactIds: string[] }) => {
      if (!cardId) throw new Error("No card");

      // Sync profile assignees
      await supabase.from("card_assignees").delete().eq("card_id", cardId);
      if (profileIds.length > 0) {
        await supabase.from("card_assignees").insert(
          profileIds.map((pid) => ({ card_id: cardId, profile_id: pid }))
        );
      }

      // Sync contact assignees
      await supabase.from("card_contact_assignees").delete().eq("card_id", cardId);
      if (contactIds.length > 0) {
        await supabase.from("card_contact_assignees").insert(
          contactIds.map((cid) => ({ card_id: cardId, contact_id: cid }))
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

  return { card, isLoading, canEditAll, canDelete, userRole: role, updateCard, updateAssignees, deleteCard };
}
