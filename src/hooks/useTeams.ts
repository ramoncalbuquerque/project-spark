import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Team = Tables<"teams">;
type TeamMember = Tables<"team_members">;

interface TeamWithCount extends Team {
  member_count: number;
}

interface MemberWithProfile extends TeamMember {
  profile: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    role: string;
  } | null;
}

export function useTeams() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("*, team_members(count)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((t: any) => ({
        ...t,
        member_count: t.team_members?.[0]?.count ?? 0,
      })) as TeamWithCount[];
    },
    enabled: !!user,
  });

  const createTeam = useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) => {
      const { data, error } = await supabase
        .from("teams")
        .insert({ name, description: description || null, created_by: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
      toast.success("Time criado com sucesso");
    },
    onError: (e: Error) => toast.error("Erro ao criar time: " + e.message),
  });

  const updateTeam = useMutation({
    mutationFn: async ({ id, name, description }: { id: string; name: string; description?: string }) => {
      const { error } = await supabase
        .from("teams")
        .update({ name, description: description || null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
      toast.success("Time atualizado");
    },
    onError: (e: Error) => toast.error("Erro ao atualizar: " + e.message),
  });

  const deleteTeam = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("teams").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
      toast.success("Time excluído");
    },
    onError: (e: Error) => toast.error("Erro ao excluir: " + e.message),
  });

  return { teams, isLoading, createTeam, updateTeam, deleteTeam };
}

export function useTeamMembers(teamId: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["team_members", teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("*, profile:profiles(id, full_name, avatar_url, role)")
        .eq("team_id", teamId!);
      if (error) throw error;
      return (data || []) as MemberWithProfile[];
    },
    enabled: !!user && !!teamId,
  });

  const addMember = useMutation({
    mutationFn: async (profileId: string) => {
      const { error } = await supabase
        .from("team_members")
        .insert({ team_id: teamId!, profile_id: profileId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team_members", teamId] });
      qc.invalidateQueries({ queryKey: ["teams"] });
      toast.success("Membro adicionado");
    },
    onError: (e: Error) => toast.error("Erro ao adicionar membro: " + e.message),
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from("team_members").delete().eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team_members", teamId] });
      qc.invalidateQueries({ queryKey: ["teams"] });
      toast.success("Membro removido");
    },
    onError: (e: Error) => toast.error("Erro ao remover membro: " + e.message),
  });

  return { members, isLoading, addMember, removeMember };
}

export function useAllProfiles() {
  const { user } = useAuth();

  const { data: profiles = [] } = useQuery({
    queryKey: ["all_profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, role")
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  return profiles;
}
