import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCalendar } from "@/contexts/CalendarContext";
import {
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { toast } from "sonner";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type Card = Tables<"cards">;

export type AssigneeInfo = { id: string; full_name: string | null; avatar_url: string | null };
export type TeamInfo = { id: string; name: string };

export type EnrichedCard = Card & {
  assignees: AssigneeInfo[];
  teams: TeamInfo[];
  assigned_to_profile: string | null;
  assigned_to_team: string | null;
};

type CreateCardInput = TablesInsert<"cards"> & {
  assignee_ids?: string[];
  team_ids?: string[];
  assigned_to_profile?: string | null;
  assigned_to_team?: string | null;
};

type UpdateCardInput = TablesUpdate<"cards"> & {
  id: string;
  assignee_ids?: string[];
  team_ids?: string[];
  assigned_to_profile?: string | null;
  assigned_to_team?: string | null;
};

function getDateRange(selectedDate: Date, viewMode: "day" | "week" | "month") {
  if (viewMode === "day") {
    return { start: startOfDay(selectedDate), end: endOfDay(selectedDate) };
  }
  if (viewMode === "week") {
    const ws = startOfWeek(selectedDate, { weekStartsOn: 1 });
    return { start: ws, end: endOfWeek(selectedDate, { weekStartsOn: 1 }) };
  }
  const ms = startOfMonth(selectedDate);
  const me = endOfMonth(selectedDate);
  const calStart = startOfWeek(ms, { weekStartsOn: 1 });
  const calEnd = endOfWeek(me, { weekStartsOn: 1 });
  return { start: calStart, end: calEnd };
}

async function syncJunctions(cardId: string, assigneeIds?: string[], teamIds?: string[]) {
  if (assigneeIds !== undefined) {
    await supabase.from("card_assignees").delete().eq("card_id", cardId);
    if (assigneeIds.length > 0) {
      await supabase.from("card_assignees").insert(
        assigneeIds.map((pid) => ({ card_id: cardId, profile_id: pid }))
      );
    }
  }
  if (teamIds !== undefined) {
    await supabase.from("card_teams").delete().eq("card_id", cardId);
    if (teamIds.length > 0) {
      await supabase.from("card_teams").insert(
        teamIds.map((tid) => ({ card_id: cardId, team_id: tid }))
      );
    }
  }
}

export function useCards() {
  const { user } = useAuth();
  const { selectedDate, viewMode, filters } = useCalendar();
  const queryClient = useQueryClient();

  const { start, end } = getDateRange(selectedDate, viewMode);
  const startISO = start.toISOString();
  const endISO = end.toISOString();

  const queryKey = ["cards", startISO, endISO];

  const { data: allCards = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data: rawCards, error } = await supabase
        .from("cards")
        .select("*")
        .gte("start_date", startISO)
        .lte("start_date", endISO)
        .order("start_date", { ascending: true });
      if (error) throw error;

      const cardIds = (rawCards as Card[]).map((c) => c.id);
      if (cardIds.length === 0) return [] as EnrichedCard[];

      const assigneeMap = new Map<string, AssigneeInfo[]>();
      const teamMap = new Map<string, TeamInfo[]>();

      try {
        const [assigneesRes, teamsRes] = await Promise.all([
          supabase
            .from("card_assignees")
            .select("card_id, profile_id, profiles(id, full_name, avatar_url)")
            .in("card_id", cardIds),
          supabase
            .from("card_teams")
            .select("card_id, team_id, teams(id, name)")
            .in("card_id", cardIds),
        ]);

        if (assigneesRes.error) console.warn("card_assignees query error:", assigneesRes.error);
        if (teamsRes.error) console.warn("card_teams query error:", teamsRes.error);

        for (const row of assigneesRes.data ?? []) {
          const p = row.profiles as unknown as AssigneeInfo | null;
          if (!p) continue;
          const list = assigneeMap.get(row.card_id) ?? [];
          list.push(p);
          assigneeMap.set(row.card_id, list);
        }

        for (const row of teamsRes.data ?? []) {
          const t = row.teams as unknown as TeamInfo | null;
          if (!t) continue;
          const list = teamMap.get(row.card_id) ?? [];
          list.push(t);
          teamMap.set(row.card_id, list);
        }
      } catch (enrichErr) {
        console.warn("Failed to enrich cards with assignees/teams:", enrichErr);
      }

      return (rawCards as Card[]).map((card): EnrichedCard => {
        const assignees = assigneeMap.get(card.id) ?? [];
        const teams = teamMap.get(card.id) ?? [];
        return {
          ...card,
          assignees,
          teams,
          assigned_to_profile: assignees[0]?.id ?? null,
          assigned_to_team: teams[0]?.id ?? null,
        };
      });
    },
    enabled: !!user,
  });

  // Apply client-side filters
  const cards = allCards.filter((card) => {
    if (filters.profileId && !card.assignees.some((a) => a.id === filters.profileId)) return false;
    if (filters.teamId && !card.teams.some((t) => t.id === filters.teamId)) return false;
    if (filters.cardType && card.card_type !== filters.cardType) return false;
    if (filters.priority && card.priority !== filters.priority) return false;
    if (filters.status) {
      if (filters.status === "overdue") {
        // Overdue = not completed + past deadline
        const dateStr = card.end_date || card.start_date;
        const isPast = dateStr ? new Date(dateStr) < new Date() : false;
        if (card.status === "completed" || !isPast) return false;
      } else {
        if (card.status !== filters.status) return false;
      }
    }
    return true;
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["cards"] });

  const createCard = useMutation({
    mutationFn: async ({ assignee_ids, team_ids, assigned_to_profile, assigned_to_team, ...cardData }: CreateCardInput) => {
      const { data, error } = await supabase.from("cards").insert(cardData).select().single();
      if (error) throw error;

      const aIds = assignee_ids ?? (assigned_to_profile ? [assigned_to_profile] : []);
      const tIds = team_ids ?? (assigned_to_team ? [assigned_to_team] : []);
      await syncJunctions(data.id, aIds, tIds);

      return data;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Card criado com sucesso");
    },
    onError: (e: Error) => toast.error("Erro ao criar card: " + e.message),
  });

  const updateCard = useMutation({
    mutationFn: async ({ id, assignee_ids, team_ids, assigned_to_profile, assigned_to_team, ...updates }: UpdateCardInput) => {
      const { data, error } = await supabase.from("cards").update(updates).eq("id", id).select().single();
      if (error) throw error;

      const aIds = assignee_ids ?? (assigned_to_profile !== undefined ? (assigned_to_profile ? [assigned_to_profile] : []) : undefined);
      const tIds = team_ids ?? (assigned_to_team !== undefined ? (assigned_to_team ? [assigned_to_team] : []) : undefined);
      await syncJunctions(id, aIds, tIds);

      return data;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Card atualizado");
    },
    onError: (e: Error) => toast.error("Erro ao atualizar card: " + e.message),
  });

  const deleteCard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Card excluído");
    },
    onError: (e: Error) => toast.error("Erro ao excluir card: " + e.message),
  });

  return { cards, isLoading, createCard, updateCard, deleteCard };
}
