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
      const { data, error } = await supabase
        .from("cards")
        .select("*")
        .gte("start_date", startISO)
        .lte("start_date", endISO)
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data as Card[];
    },
    enabled: !!user,
  });

  // Apply client-side filters
  const cards = allCards.filter((card) => {
    if (filters.profileId && card.assigned_to_profile !== filters.profileId) return false;
    if (filters.teamId && card.assigned_to_team !== filters.teamId) return false;
    return true;
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["cards"] });

  const createCard = useMutation({
    mutationFn: async (card: TablesInsert<"cards">) => {
      const { data, error } = await supabase.from("cards").insert(card).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Card criado com sucesso");
    },
    onError: (e: Error) => toast.error("Erro ao criar card: " + e.message),
  });

  const updateCard = useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"cards"> & { id: string }) => {
      const { data, error } = await supabase.from("cards").update(updates).eq("id", id).select().single();
      if (error) throw error;
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
