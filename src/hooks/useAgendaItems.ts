import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

type AgendaItem = Tables<"agenda_items">;

export function useAgendaItems(cardId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ["agenda_items", cardId];

  const { data: items = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!cardId) return [];
      const { data, error } = await supabase
        .from("agenda_items")
        .select("*")
        .eq("card_id", cardId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as AgendaItem[];
    },
    enabled: !!cardId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const addItem = useMutation({
    mutationFn: async (content: string) => {
      if (!cardId) throw new Error("No card");
      const maxOrder = items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0;
      const { error } = await supabase.from("agenda_items").insert({
        card_id: cardId,
        content,
        sort_order: maxOrder,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error("Erro ao adicionar item: " + e.message),
  });

  const toggleItem = useMutation({
    mutationFn: async ({ id, is_completed }: { id: string; is_completed: boolean }) => {
      const { error } = await supabase
        .from("agenda_items")
        .update({ is_completed })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agenda_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const reorderItems = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, idx) =>
        supabase.from("agenda_items").update({ sort_order: idx }).eq("id", id)
      );
      await Promise.all(updates);
    },
    onSuccess: invalidate,
  });

  return { items, isLoading, addItem, toggleItem, deleteItem, reorderItems };
}
