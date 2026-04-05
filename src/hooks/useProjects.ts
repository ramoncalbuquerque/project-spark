import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Project = Tables<"projects">;

export type ProjectMember = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

export type ProjectCounts = {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  overdue: number;
};

export type EnrichedProject = Project & {
  members: ProjectMember[];
  counts: ProjectCounts;
};

export function useProjects() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["projects"] });

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      // 1. Fetch projects (RLS already filters by creator/member)
      const { data: rawProjects, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!rawProjects?.length) return [] as EnrichedProject[];

      const projectIds = rawProjects.map((p) => p.id);

      // 2. Fetch members for all projects
      const memberMap = new Map<string, ProjectMember[]>();
      const countsMap = new Map<string, ProjectCounts>();

      const promises: PromiseLike<void>[] = [];

      promises.push(
        supabase
          .from("project_members")
          .select("project_id, profile_id, profiles(id, full_name, avatar_url)")
          .in("project_id", projectIds)
          .then(({ data }) => {
            for (const row of data ?? []) {
              const p = row.profiles as unknown as ProjectMember | null;
              if (!p) continue;
              const list = memberMap.get(row.project_id) ?? [];
              list.push(p);
              memberMap.set(row.project_id, list);
            }
          })
      );

      // 3. Fetch card counts per project
      promises.push(
        supabase
          .from("cards")
          .select("id, project_id, status, start_date, end_date")
          .in("project_id", projectIds)
          .then(({ data }) => {
            const now = new Date();
            for (const card of data ?? []) {
              if (!card.project_id) continue;
              const c = countsMap.get(card.project_id) ?? {
                total: 0, pending: 0, in_progress: 0, completed: 0, overdue: 0,
              };
              c.total++;
              if (card.status === "completed") {
                c.completed++;
              } else if (card.status === "in_progress") {
                c.in_progress++;
                const d = card.end_date || card.start_date;
                if (d && new Date(d) < now) c.overdue++;
              } else {
                c.pending++;
                const d = card.end_date || card.start_date;
                if (d && new Date(d) < now) c.overdue++;
              }
              countsMap.set(card.project_id, c);
            }
          })
      );

      await Promise.all(promises);

      return rawProjects.map((proj): EnrichedProject => ({
        ...proj,
        members: memberMap.get(proj.id) ?? [],
        counts: countsMap.get(proj.id) ?? {
          total: 0, pending: 0, in_progress: 0, completed: 0, overdue: 0,
        },
      }));
    },
    enabled: !!user,
  });

  const createProject = useMutation({
    mutationFn: async (input: { name: string; description?: string; memberIds?: string[] }) => {
      if (!user) throw new Error("Não autenticado");
      const { data, error } = await supabase
        .from("projects")
        .insert({ name: input.name, description: input.description ?? null, created_by: user.id })
        .select()
        .single();
      if (error) throw error;

      if (input.memberIds?.length) {
        const rows = input.memberIds.map((pid) => ({ project_id: data.id, profile_id: pid }));
        const { error: mErr } = await supabase.from("project_members").insert(rows);
        if (mErr) console.warn("Failed to add members:", mErr);
      }
      return data;
    },
    onSuccess: () => { invalidate(); toast.success("Projeto criado"); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const updateProject = useMutation({
    mutationFn: async (input: { id: string; name?: string; description?: string; status?: string }) => {
      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.status !== undefined) updates.status = input.status;
      const { error } = await supabase.from("projects").update(updates).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Projeto atualizado"); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Projeto excluído"); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const addMember = useMutation({
    mutationFn: async ({ projectId, profileId }: { projectId: string; profileId: string }) => {
      const { error } = await supabase.from("project_members").insert({ project_id: projectId, profile_id: profileId });
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const removeMember = useMutation({
    mutationFn: async ({ projectId, profileId }: { projectId: string; profileId: string }) => {
      const { error } = await supabase.from("project_members").delete().eq("project_id", projectId).eq("profile_id", profileId);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const isLeader = profile?.role === "leader";

  return { projects, isLoading, isLeader, createProject, updateProject, deleteProject, addMember, removeMember };
}
