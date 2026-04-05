import { useState } from "react";
import { Plus, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjects } from "@/hooks/useProjects";
import ProjectCard from "@/components/projects/ProjectCard";
import CreateProjectModal from "@/components/projects/CreateProjectModal";

type ProjectStatusFilter = "active" | "completed" | "archived";

const STATUS_FILTERS: { key: ProjectStatusFilter; label: string }[] = [
  { key: "active", label: "Ativos" },
  { key: "completed", label: "Concluídos" },
  { key: "archived", label: "Arquivados" },
];

const ProjectsPage = () => {
  const { projects, isLoading, isLeader, createProject } = useProjects();
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ProjectStatusFilter>("active");

  const filtered = projects.filter((p) => p.status === statusFilter);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between px-4 py-3 sticky top-0 bg-background z-10">
        <h1 className="text-lg font-semibold text-foreground">Projetos</h1>
        {isLeader && (
          <Button size="sm" className="h-8 px-3 text-xs" onClick={() => setShowCreate(true)}>
            <Plus size={14} className="mr-1" /> Novo
          </Button>
        )}
      </div>

      {/* Status filter chips */}
      <div className="px-4 pb-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
        {STATUS_FILTERS.map((f) => {
          const active = statusFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`shrink-0 h-8 px-3 rounded-full text-xs font-medium transition-colors ${
                active ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-20">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 text-muted-foreground gap-3">
            <FolderOpen size={48} strokeWidth={1.2} />
            <p className="text-sm">Nenhum projeto {statusFilter === "active" ? "ativo" : statusFilter === "completed" ? "concluído" : "arquivado"}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((p) => <ProjectCard key={p.id} project={p} />)}
          </div>
        )}
      </div>

      <CreateProjectModal open={showCreate} onClose={() => setShowCreate(false)} onCreate={(input) => createProject.mutate(input)} loading={createProject.isPending} />
    </div>
  );
};

export default ProjectsPage;
