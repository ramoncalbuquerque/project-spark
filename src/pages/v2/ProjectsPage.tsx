import { useState } from "react";
import { Plus, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjects } from "@/hooks/useProjects";
import ProjectCard from "@/components/projects/ProjectCard";
import CreateProjectModal from "@/components/projects/CreateProjectModal";

const ProjectsPage = () => {
  const { projects, isLoading, isLeader, createProject } = useProjects();
  const [showCreate, setShowCreate] = useState(false);

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

      <div className="flex-1 overflow-y-auto px-4 pb-20">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 text-muted-foreground gap-3">
            <FolderOpen size={48} strokeWidth={1.2} />
            <p className="text-sm">Nenhum projeto ainda</p>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
          </div>
        )}
      </div>

      <CreateProjectModal open={showCreate} onClose={() => setShowCreate(false)} onCreate={(input) => createProject.mutate(input)} loading={createProject.isPending} />
    </div>
  );
};

export default ProjectsPage;
