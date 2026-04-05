import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Card = Tables<"cards">;

export type AssigneeInfo = { id: string; full_name: string | null; avatar_url: string | null; type: "profile" | "contact" };
export type TeamInfo = { id: string; name: string };

export type EnrichedFeedCard = Card & {
  assignees: AssigneeInfo[];
  teams: TeamInfo[];
  project_name: string | null;
  is_overdue: boolean;
  checklist_total: number;
  checklist_done: number;
};

export type FeedStatusFilter = "all" | "overdue" | "in_progress" | "completed";

export function useFeedCards(statusFilter: FeedStatusFilter = "all", personFilter?: { id: string; type: "profile" | "contact" } | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: allCards = [], isLoading, refetch } = useQuery({
    queryKey: ["feed-cards"],
    queryFn: async () => {
      const { data: rawCards, error } = await supabase
        .from("cards")
        .select("*")
        .order("start_date", { ascending: true });
      if (error) throw error;

      const cards = rawCards as Card[];
      if (cards.length === 0) return [] as EnrichedFeedCard[];

      const cardIds = cards.map((c) => c.id);

      const assigneeMap = new Map<string, AssigneeInfo[]>();
      const teamMap = new Map<string, TeamInfo[]>();
      const checklistMap = new Map<string, { total: number; done: number }>();

      const projectIds = [...new Set(cards.map((c) => c.project_id).filter(Boolean))] as string[];
      const projectMap = new Map<string, string>();

      try {
        const promises: PromiseLike<void>[] = [];

        // Profile assignees
        promises.push(
          supabase
            .from("card_assignees")
            .select("card_id, profile_id, profiles(id, full_name, avatar_url)")
            .in("card_id", cardIds)
            .then(({ data }) => {
              for (const row of data ?? []) {
                const p = row.profiles as unknown as { id: string; full_name: string | null; avatar_url: string | null } | null;
                if (!p) continue;
                const list = assigneeMap.get(row.card_id) ?? [];
                list.push({ ...p, type: "profile" });
                assigneeMap.set(row.card_id, list);
              }
            })
        );

        // Contact assignees
        promises.push(
          supabase
            .from("card_contact_assignees")
            .select("card_id, contact_id, contacts(id, full_name)")
            .in("card_id", cardIds)
            .then(({ data }) => {
              for (const row of data ?? []) {
                const c = row.contacts as unknown as { id: string; full_name: string } | null;
                if (!c) continue;
                const list = assigneeMap.get(row.card_id) ?? [];
                list.push({ id: c.id, full_name: c.full_name, avatar_url: null, type: "contact" });
                assigneeMap.set(row.card_id, list);
              }
            })
        );

        // Teams
        promises.push(
          supabase
            .from("card_teams")
            .select("card_id, team_id, teams(id, name)")
            .in("card_id", cardIds)
            .then(({ data }) => {
              for (const row of data ?? []) {
                const t = row.teams as unknown as TeamInfo | null;
                if (!t) continue;
                const list = teamMap.get(row.card_id) ?? [];
                list.push(t);
                teamMap.set(row.card_id, list);
              }
            })
        );

        // Checklist
        promises.push(
          supabase
            .from("agenda_items")
            .select("card_id, is_completed")
            .in("card_id", cardIds)
            .then(({ data }) => {
              for (const row of data ?? []) {
                const entry = checklistMap.get(row.card_id) ?? { total: 0, done: 0 };
                entry.total++;
                if (row.is_completed) entry.done++;
                checklistMap.set(row.card_id, entry);
              }
            })
        );

        // Projects
        if (projectIds.length > 0) {
          promises.push(
            supabase
              .from("projects")
              .select("id, name")
              .in("id", projectIds)
              .then(({ data }) => {
                for (const p of data ?? []) {
                  projectMap.set(p.id, p.name);
                }
              })
          );
        }

        await Promise.all(promises);
      } catch (err) {
        console.warn("Failed to enrich feed cards:", err);
      }

      const now = new Date();

      return cards.map((card): EnrichedFeedCard => {
        const assignees = assigneeMap.get(card.id) ?? [];
        const teams = teamMap.get(card.id) ?? [];
        const checklist = checklistMap.get(card.id) ?? { total: 0, done: 0 };
        const dateStr = card.end_date || card.start_date;
        const is_overdue = card.status !== "completed" && (dateStr ? new Date(dateStr) < now : false);

        return {
          ...card,
          assignees,
          teams,
          project_name: card.project_id ? (projectMap.get(card.project_id) ?? null) : null,
          is_overdue,
          checklist_total: checklist.total,
          checklist_done: checklist.done,
        };
      });
    },
    enabled: !!user,
  });

  // Client-side filters
  const cards = allCards.filter((card) => {
    // Status filter
    if (statusFilter === "overdue" && !card.is_overdue) return false;
    if (statusFilter === "in_progress" && card.status !== "in_progress") return false;
    if (statusFilter === "completed" && card.status !== "completed") return false;

    // Person filter
    if (personFilter) {
      const hasAssignee = card.assignees.some(
        (a) => a.id === personFilter.id && a.type === personFilter.type
      );
      if (!hasAssignee) return false;
    }

    return true;
  });

  const overdueCount = allCards.filter((c) => c.is_overdue).length;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["feed-cards"] });

  const createQuickTask = useMutation({
    mutationFn: async ({
      title,
      start_date,
      assignee_profile_ids,
      assignee_contact_ids,
    }: {
      title: string;
      start_date: string;
      assignee_profile_ids?: string[];
      assignee_contact_ids?: string[];
    }) => {
      if (!user) throw new Error("Não autenticado");
      const { data, error } = await supabase
        .from("cards")
        .insert({
          title,
          start_date,
          card_type: "task",
          origin_type: "standalone",
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;

      const inserts: Promise<unknown>[] = [];

      if (assignee_profile_ids && assignee_profile_ids.length > 0) {
        inserts.push(
          supabase
            .from("card_assignees")
            .insert(assignee_profile_ids.map((pid) => ({ card_id: data.id, profile_id: pid })))
            .then()
        );
      }

      if (assignee_contact_ids && assignee_contact_ids.length > 0) {
        inserts.push(
          supabase
            .from("card_contact_assignees")
            .insert(assignee_contact_ids.map((cid) => ({ card_id: data.id, contact_id: cid })))
            .then()
        );
      }

      if (inserts.length > 0) {
        await Promise.all(inserts);
      }

      return data;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Tarefa criada com sucesso");
    },
    onError: (e: Error) => toast.error("Erro ao criar tarefa: " + e.message),
  });

  return { cards, allCards, isLoading, overdueCount, refetch, createQuickTask };
}
