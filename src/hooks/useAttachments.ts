import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Attachment = Tables<"attachments">;

export function useAttachments(cardId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["attachments", cardId];

  const { data: attachments = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!cardId) return [];
      const { data, error } = await supabase
        .from("attachments")
        .select("*")
        .eq("card_id", cardId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Attachment[];
    },
    enabled: !!cardId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const uploadFile = useMutation({
    mutationFn: async (file: File) => {
      if (!cardId || !user) throw new Error("Missing context");
      const filePath = `${user.id}/${cardId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("attachments")
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase.from("attachments").insert({
        card_id: cardId,
        file_name: file.name,
        file_url: filePath,
        file_size: file.size,
        uploaded_by: user.id,
      });
      if (dbError) throw dbError;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Arquivo anexado");
    },
    onError: (e: Error) => toast.error("Erro ao anexar: " + e.message),
  });

  const deleteFile = useMutation({
    mutationFn: async (attachment: Attachment) => {
      // Delete from storage
      await supabase.storage.from("attachments").remove([attachment.file_url]);
      // Delete from DB
      const { error } = await supabase.from("attachments").delete().eq("id", attachment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Anexo removido");
    },
    onError: (e: Error) => toast.error("Erro ao remover: " + e.message),
  });

  const getDownloadUrl = (filePath: string) => {
    const { data } = supabase.storage.from("attachments").getPublicUrl(filePath);
    return data.publicUrl;
  };

  return { attachments, isLoading, uploadFile, deleteFile, getDownloadUrl };
}
