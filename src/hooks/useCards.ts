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

export interface CardWithAssignees extends Card {
  assignees: { id: string; profile_id: string; full_name: string | null }[];
  teams: { id: string; team_id: string; name: string }[];
}

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
      // Fetch cards
      const { data: cardsData, error } = await supabase
        .from("cards")
        .select("*")
        .gte("start_date", startISO)
        .lte("start_date", endISO)
        .order("start_date", { ascending: true });
      if (error) throw error;

      if (!cardsData || cardsData.length === 0) return [] as CardWithAssignees[];

      const cardIds = cardsData.map((c) => c.id);

      // Fetch assignees and teams in parallel
      const [assigneesRes, teamsRes] = await Promise.all([
        supabase
          .from("card_assignees")
          .select("id, card_id, profile_id, profiles(full_name)")
          .in("card_id", cardIds),
        supabase
          .from("card_teams")
          .select("id, card_id, team_id, teams(name)")
          .in("card_id", cardIds),
      ]);

      if (assigneesRes.error) throw assigneesRes.error;
      if (teamsRes.error) throw teamsRes.error;

      const assigneesByCard = new Map<string, { id: string; profile_id: string; full_name: string | null }[]>();
      for (const a of assigneesRes.data || []) {
        const list = assigneesByCard.get(a.card_id) || [];
        list.push({
          id: a.id,
          profile_id: a.profile_id,
          full_name: (a as any).profiles?.full_name || null,
        });
        assigneesByCard.set(a.card_id, list);
      }

      const teamsByCard = new Map<string, { id: string; team_id: string; name: string }[]>();
      for (const t of teamsRes.data || []) {
        const list = teamsByCard.get(t.card_id) || [];
        list.push({
          id: t.id,
          team_id: t.team_id,
          name: (t as any).teams?.name || "",
        });
        teamsByCard.set(t.card_id, list);
      }

      return cardsData.map((c) => ({
        ...c,
        assignees: assigneesByCard.get(c.id) || [],
        teams: teamsByCard.get(c.id) || [],
      })) as CardWithAssignees[];
    },
    enabled: !!user,
  });

  // Apply client-side filters
  const cards = allCards.filter((card) => {
    if (filters.profileId && !card.assignees.some((a) => a.profile_id === filters.profileId)) return false;
    if (filters.teamId && !card.teams.some((t) => t.team_id === filters.teamId)) return false;
    return true;
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["cards"] });

  const createCard = useMutation({
    mutationFn: async (input: {
      card: TablesInsert<"cards">;
      assigneeIds?: string[];
      teamIds?: string[];
    }) => {
      const { data, error } = await supabase.from("cards").insert(input.card).select().single();
      if (error) throw error;

      // Insert assignees and teams
      await Promise.all([
        input.assigneeIds?.length
          ? supabase.from("card_assignees").insert(
              input.assigneeIds.map((pid) => ({ card_id: data.id, profile_id: pid }))
            )
          : null,
        input.teamIds?.length
          ? supabase.from("card_teams").insert(
              input.teamIds.map((tid) => ({ card_id: data.id, team_id: tid }))
            )
          : null,
      ]);

      return data;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Card criado com sucesso");
    },
    onError: (e: Error) => toast.error("Erro ao criar card: " + e.message),
  });

  const updateCard = useMutation({
    mutationFn: async (input: {
      id: string;
      updates: TablesUpdate<"cards">;
      assigneeIds?: string[];
      teamIds?: string[];
    }) => {
      const { data, error } = await supabase
        .from("cards")
        .update(input.updates)
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;

      // Replace assignees and teams
      if (input.assigneeIds !== undefined) {
        await supabase.from("card_assignees").delete().eq("card_id", input.id);
        if (input.assigneeIds.length) {
          await supabase.from("card_assignees").insert(
            input.assigneeIds.map((pid) => ({ card_id: input.id, profile_id: pid }))
          );
        }
      }
      if (input.teamIds !== undefined) {
        await supabase.from("card_teams").delete().eq("card_id", input.id);
        if (input.teamIds.length) {
          await supabase.from("card_teams").insert(
            input.teamIds.map((tid) => ({ card_id: input.id, team_id: tid }))
          );
        }
      }

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
